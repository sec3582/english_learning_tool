#!/usr/bin/env python3
"""
collector.py — 英文學習工具的 URL 內容收集器

邏輯：
  - 普通網址 → requests + BeautifulSoup 抓取網頁文字 → Gemini 分析詞彙
  - YouTube 網址 → yt-dlp 下載音訊 → Gemini Files API 語音轉錄 + 詞彙分析

用法：
  python collector.py <URL>
  python collector.py <URL> --json          # 輸出原始 JSON
  python collector.py <URL> --model gemini-2.0-flash  # 指定其他模型

需要安裝（pip install -r requirements_py.txt）：
  requests beautifulsoup4 google-genai python-dotenv yt-dlp

系統需求（YouTube 音訊轉換用，可選）：
  ffmpeg  https://ffmpeg.org/download.html
"""

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

# Windows 終端機預設 Big5(cp950)，強制改為 UTF-8 避免中文/特殊字元印出錯誤
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── 第三方套件 ─────────────────────────────────────────────────────────────────

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("❌ 缺少套件：請執行  pip install requests beautifulsoup4")

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit("❌ 缺少套件：請執行  pip install google-genai")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv 不是必要的，直接從環境變數讀取也可以

try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
except ImportError:
    YT_DLP_AVAILABLE = False


# ── Gemini 初始化 ───────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    sys.exit(
        "❌ 找不到 GEMINI_API_KEY\n"
        "   請在 .env 加入：GEMINI_API_KEY=你的金鑰\n"
        "   取得方式：https://aistudio.google.com/app/apikey"
    )

client = genai.Client(api_key=GEMINI_API_KEY)

DEFAULT_MODEL = "gemini-2.5-flash-lite"


# ── YouTube URL 偵測 ────────────────────────────────────────────────────────────

_YT_PATTERNS = re.compile(
    r"(?:https?://)?(?:(?:www|m)\.)?(?:youtube\.com/(?:watch\?.*?v=|shorts/|embed/)|youtu\.be/)"
    r"([A-Za-z0-9_-]{11})"
)


def is_youtube_url(url: str) -> bool:
    return bool(_YT_PATTERNS.search(url))


def extract_video_id(url: str) -> str | None:
    m = _YT_PATTERNS.search(url)
    return m.group(1) if m else None


# ── 網頁文字抓取 ────────────────────────────────────────────────────────────────

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

_REMOVE_TAGS = ["script", "style", "nav", "header", "footer",
                "aside", "form", "noscript", "iframe", "svg"]


def fetch_webpage_text(url: str, max_chars: int = 8000) -> str:
    """抓取網頁並回傳清理後的純文字。"""
    resp = requests.get(url, headers=_HEADERS, timeout=20)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(_REMOVE_TAGS):
        tag.decompose()

    # 優先抓 <article> / <main>，否則用 <body>
    container = soup.find("article") or soup.find("main") or soup.body
    raw = container.get_text(separator="\n") if container else soup.get_text(separator="\n")

    # 清理多餘空白
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    text = "\n".join(lines)

    if len(text) < 100:
        raise ValueError(
            "擷取到的文字太少，該網頁可能需要登入或使用 JavaScript 動態渲染。"
        )

    return text[:max_chars]


# ── YouTube 音訊下載（yt-dlp）──────────────────────────────────────────────────

def download_youtube_audio(url: str, out_dir: str) -> tuple[str, str]:
    """
    用 yt-dlp 下載最佳音訊串流。
    回傳 (檔案路徑, MIME 類型)。
    優先以 ffmpeg 轉成 mp3；若 ffmpeg 不存在，則保留原始格式（通常是 m4a/webm）。
    """
    if not YT_DLP_AVAILABLE:
        raise RuntimeError(
            "yt-dlp 未安裝，請執行：pip install yt-dlp\n"
            "YouTube 音訊功能需要此套件。"
        )

    # 先嘗試含 ffmpeg 的 mp3 轉換
    for use_ffmpeg in (True, False):
        ydl_opts: dict = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": str(Path(out_dir) / "%(id)s.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
        }
        if use_ffmpeg:
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }]

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                video_id = info.get("id", "audio")

            if use_ffmpeg:
                path = Path(out_dir) / f"{video_id}.mp3"
                if path.exists():
                    return str(path), "audio/mpeg"
            else:
                # 找出實際下載的檔案
                for ext, mime in [("m4a", "audio/mp4"), ("webm", "audio/webm"),
                                   ("ogg", "audio/ogg"), ("opus", "audio/ogg")]:
                    path = Path(out_dir) / f"{video_id}.{ext}"
                    if path.exists():
                        return str(path), mime
                # fallback：取第一個非 part 檔
                for f in Path(out_dir).iterdir():
                    if f.suffix not in (".part", ".ytdl"):
                        return str(f), "audio/mp4"

        except Exception as e:
            if use_ffmpeg and "ffmpeg" in str(e).lower():
                print("[yt-dlp] ffmpeg 不可用，改用原始格式下載…")
                continue
            raise

    raise RuntimeError("無法下載 YouTube 音訊，請確認 URL 是否正確。")


# ── Gemini Prompt ───────────────────────────────────────────────────────────────

_VOCAB_SCHEMA = """\
[
  {
    "word": "...",
    "pos": "noun|verb|adjective|adverb|phrase|conjunction|preposition",
    "level": "A1|A2|B1|B2|C1|C2",
    "definition": "繁體中文簡短定義",
    "example1": "來自原文的完整例句",
    "example1_zh": "example1 的繁體中文翻譯",
    "example2": "AI 新造的自然例句（不得與 example1 重複）",
    "example2_zh": "example2 的繁體中文翻譯"
  }
]"""

_RULES = """\
嚴格規定：
1. 每個欄位都必須填入真實內容，禁止出現「無」「none」「N/A」或空字串。
2. example1 必須逐字引用原文（或音訊轉錄文字）中包含該字的句子。
3. example2 必須是 AI 自行造的新句子，風格自然、具教學性，且不得與 example1 相同。
4. definition、example1_zh、example2_zh 必須使用繁體中文。
5. 只回傳有效的 JSON 陣列，不得包含 markdown、程式碼圍欄或任何額外文字。"""


def _build_text_prompt(text: str) -> str:
    return (
        "你是專為繁體中文學習者服務的英文詞彙教學助理。\n\n"
        "請分析以下英文文章，從中擷取 8 到 15 個對語言學習者有價值的詞彙或片語。\n\n"
        f"每個詞彙請以下列 JSON 格式回傳：\n{_VOCAB_SCHEMA}\n\n"
        f"{_RULES}\n\n"
        f"文章：\n{text}"
    )


def _build_audio_prompt() -> str:
    return (
        "你是專為繁體中文學習者服務的英文詞彙教學助理。\n\n"
        "以下是一段英文音訊。請先將其完整轉錄，然後從轉錄文字中擷取 8 到 15 個"
        "對語言學習者有價值的詞彙或片語。\n\n"
        f"每個詞彙請以下列 JSON 格式回傳：\n{_VOCAB_SCHEMA}\n\n"
        f"{_RULES}"
    )


# ── Gemini API 呼叫 ─────────────────────────────────────────────────────────────

_BLANK = {"無", "none", "n/a", ""}


def _clean_field(v) -> str:
    s = str(v or "").strip()
    return "" if s.lower() in _BLANK else s


def _normalize_words(raw_json: str) -> list[dict]:
    """解析 Gemini 回應的 JSON，補齊缺漏欄位。"""
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_json.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    arr = json.loads(cleaned)
    if not isinstance(arr, list):
        raise ValueError("Gemini 回應不是 JSON 陣列")

    result = []
    for w in arr:
        word = _clean_field(w.get("word")) or "unknown"
        result.append({
            "word":        word,
            "pos":         _clean_field(w.get("pos"))         or "noun",
            "level":       _clean_field(w.get("level"))       or "B1",
            "definition":  _clean_field(w.get("definition"))  or word,
            "example1":    _clean_field(w.get("example1"))    or f"{word} is used in this context.",
            "example1_zh": _clean_field(w.get("example1_zh")) or f"「{word}」用於此語境中。",
            "example2":    _clean_field(w.get("example2"))    or f"She used the word {word} in her essay.",
            "example2_zh": _clean_field(w.get("example2_zh")) or f"她在文章中使用了「{word}」這個字。",
        })
    return result


def analyze_text(text: str, model_name: str = DEFAULT_MODEL) -> list[dict]:
    """將文字送到 Gemini，回傳詞彙陣列。"""
    response = client.models.generate_content(
        model=model_name,
        contents=_build_text_prompt(text),
    )
    return _normalize_words(response.text)


def analyze_audio(audio_path: str, mime_type: str,
                  model_name: str = DEFAULT_MODEL) -> list[dict]:
    """上傳音訊到 Gemini Files API，轉錄後回傳詞彙陣列。"""
    print(f"[Gemini] 上傳音訊（{Path(audio_path).name}）到 Files API…")
    uploaded = client.files.upload(
        file=audio_path,
        config=types.UploadFileConfig(mime_type=mime_type),
    )
    response = client.models.generate_content(
        model=model_name,
        contents=[uploaded, _build_audio_prompt()],
    )
    return _normalize_words(response.text)


# ── 主流程 ──────────────────────────────────────────────────────────────────────

def collect(url: str, model_name: str = DEFAULT_MODEL) -> list[dict]:
    """
    統一入口：
      YouTube URL → yt-dlp 下載音訊 → Gemini 語音分析
      普通 URL   → requests 抓取文字 → Gemini 文字分析
    """
    if is_youtube_url(url):
        vid = extract_video_id(url)
        print(f"[YouTube] 偵測到 YouTube 影片 ID：{vid}")
        print(f"[YouTube] 正在用 yt-dlp 下載音訊…")
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path, mime_type = download_youtube_audio(url, tmpdir)
            size_mb = Path(audio_path).stat().st_size / 1_048_576
            print(f"[YouTube] 音訊已下載：{Path(audio_path).name}（{size_mb:.1f} MB）")
            print(f"[Gemini] 正在送往 {model_name} 進行分析…")
            return analyze_audio(audio_path, mime_type, model_name)
    else:
        print(f"[Web] 正在抓取網頁：{url}")
        text = fetch_webpage_text(url)
        print(f"[Web] 抓取到 {len(text)} 字元，正在送往 {model_name} 進行分析…")
        return analyze_text(text, model_name)


# ── CLI ─────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="從網頁或 YouTube 影片擷取英文詞彙（Gemini）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "範例：\n"
            "  python collector.py https://www.bbc.com/news/science\n"
            "  python collector.py https://youtu.be/dQw4w9WgXcQ\n"
            "  python collector.py https://youtu.be/dQw4w9WgXcQ --json\n"
        ),
    )
    parser.add_argument("url", help="目標網址（網頁或 YouTube）")
    parser.add_argument(
        "--json", action="store_true",
        help="直接輸出原始 JSON（方便串接其他工具）"
    )
    parser.add_argument(
        "--model", default=DEFAULT_MODEL, metavar="MODEL",
        help=f"Gemini 模型名稱（預設：{DEFAULT_MODEL}）"
    )
    args = parser.parse_args()

    try:
        words = collect(args.url, model_name=args.model)
    except Exception as e:
        sys.exit(f"❌ 錯誤：{e}")

    if args.json:
        print(json.dumps(words, ensure_ascii=False, indent=2))
    else:
        print(f"\n[完成] 擷取到 {len(words)} 個詞彙\n")
        for i, w in enumerate(words, 1):
            bar = "─" * 52
            print(bar)
            print(f"{i:2}. {w['word']}  [{w['pos']}]  [{w['level']}]")
            print(f"    定義：{w['definition']}")
            print(f"    例句：{w['example1']}")
            print(f"    中譯：{w['example1_zh']}")
        print("─" * 52)


if __name__ == "__main__":
    main()
