// server.js
// 本地代理伺服器：取代原本的 Google Apps Script (GAS) Web App
// 使用 @google/generative-ai 套件呼叫 Google Gemini API

import "dotenv/config"; // 載入 .env 設定檔（GEMINI_API_KEY 等變數）
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ESM 環境下取得 __dirname（CommonJS 才有內建，ESM 需自行計算）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ====== 初始化 Gemini 客戶端 ======
// 從 .env 讀取 GEMINI_API_KEY，建立 GoogleGenerativeAI 實例
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
  console.error("❌ 錯誤：請先在 .env 設定 GEMINI_API_KEY");
  console.error("   取得方式：https://aistudio.google.com/app/apikey");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 使用 gemini-2.5-flash-lite 模型：穩定且免費額度高
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// ====== 中介層設定 ======
app.use(cors()); // 允許前端跨域請求（開發時 file:// 或不同 port 都能存取）
app.use(express.json()); // 解析 application/json 請求
app.use(express.text({ type: "text/plain" })); // 相容舊版 GAS 格式（text/plain;charset=utf-8）
app.use(express.static(__dirname)); // 提供靜態檔案（index.html、js/、css/ 等）


// ====== Prompt 建構函式 ======

/**
 * 建構「文章分析」用的 Prompt
 * 目標：從文章中擷取 8~15 個適合學習的詞彙，並回傳 JSON 陣列
 * @param {string} text - 使用者輸入的英文文章
 */
function buildAnalyzeArticlePrompt(text) {
  return `You are an English vocabulary teaching assistant for Traditional Chinese learners.

Analyze the following English article and extract 8 to 15 vocabulary words or phrases that would be valuable for a language learner to study.

For each word, return a JSON object with these EXACT fields:
- "word": the word or phrase as it appears (string)
- "pos": part of speech in English, one of: noun, verb, adjective, adverb, phrase, conjunction, preposition (string)
- "level": CEFR difficulty level, one of: A1, A2, B1, B2, C1, C2 (string)
- "definition": concise Chinese definition in Traditional Chinese (string)
- "example1": a complete sentence FROM THE ARTICLE that contains the word (string)
- "example1_zh": Traditional Chinese translation of example1 (string)
- "example2": a NEW AI-generated natural example sentence using the word — must be different from example1 (string)
- "example2_zh": Traditional Chinese translation of example2 (string)

STRICT RULES — violation is not acceptable:
1. Every field MUST be filled with real content. NEVER output "無", "none", "N/A", "", or any empty/placeholder value.
2. "example1" MUST be copied verbatim from the article. If the word's exact form does not appear, use the sentence where it appears in a different form.
3. "example2" MUST be a brand-new sentence you compose — natural, educational, and not copied from the article.
4. All Chinese fields ("definition", "example1_zh", "example2_zh") MUST be in Traditional Chinese.
5. Return ONLY a valid JSON array — no markdown, no code fences, no extra text.

Here is a perfect example of the required output format (for the word "book" used as a verb):
[
  {
    "word": "book",
    "pos": "verb",
    "level": "A2",
    "definition": "預訂；預約",
    "example1": "She booked a table at the restaurant for Friday evening.",
    "example1_zh": "她預訂了週五晚上的餐廳座位。",
    "example2": "You should book your flight tickets early to get a better price.",
    "example2_zh": "你應該早點預訂機票，以獲得更優惠的價格。"
  }
]

Article:
${text}`;
}

/**
 * 建構「自訂單字分析」用的 Prompt
 * 目標：針對使用者指定的單字進行深度分析，回傳 JSON 物件
 * @param {string} article - 文章內容（作為上下文）
 * @param {string} term    - 使用者想分析的單字或片語
 */
function buildAnalyzeCustomWordPrompt(article, term) {
  return `You are an English vocabulary teaching assistant for Traditional Chinese learners.

Analyze the English word or phrase "${term}" and provide detailed information for a language learner.

Return a JSON object with these exact fields:
- "word": the word or phrase (string)
- "pos": part of speech in English, one of: noun, verb, adjective, adverb, phrase, conjunction, preposition (string)
- "level": CEFR difficulty level, one of: A1, A2, B1, B2, C1, C2 (string)
- "definition": concise Chinese definition in Traditional Chinese (string)
- "example_in_article": a complete sentence from the article below that contains the word (if not found, leave empty string) (string)
- "example_in_article_zh": Traditional Chinese translation of example_in_article (string)
- "example_ai": a new AI-generated natural example sentence using the word (string)
- "example_ai_zh": Traditional Chinese translation of example_ai (string)

Return ONLY a valid JSON object with no extra text, markdown, or code fences.

Article context:
${article || "(no article provided)"}`;
}


// ====== 主要 API 端點 ======
// 接受與原本 GAS proxy 相同的請求格式：POST /api
// Body 可以是 JSON 或 text/plain（前端舊版格式）
app.post("/api", async (req, res) => {
  let body = req.body;

  // 若請求為 text/plain（舊版 GAS 格式），手動解析 JSON
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "無法解析請求 JSON" });
    }
  }

  const { action, text, article, term } = body || {};

  // 根據 action 決定要使用哪個 Prompt
  let prompt;
  if (action === "analyzeArticle") {
    // 文章分析：傳入文章文字
    if (!text) return res.status(400).json({ ok: false, error: "缺少 text 欄位" });
    prompt = buildAnalyzeArticlePrompt(text);
  } else if (action === "analyzeCustomWord") {
    // 自訂單字分析：傳入文章上下文與目標單字
    if (!term) return res.status(400).json({ ok: false, error: "缺少 term 欄位" });
    prompt = buildAnalyzeCustomWordPrompt(article, term);
  } else {
    return res.status(400).json({ ok: false, error: `未知的 action：${action}` });
  }

  try {
    // 呼叫 Gemini API 產生內容
    const result = await geminiModel.generateContent(prompt);
    const responseText = result.response.text();

    // 從 Gemini 回應中取得 token 用量（用於前端的用量統計）
    const usageMeta = result.response.usageMetadata;
    const usage = {
      prompt_tokens: usageMeta?.promptTokenCount || 0,
      completion_tokens: usageMeta?.candidatesTokenCount || 0,
    };

    // analyzeArticle：後端補值，確保每個 word 物件欄位完整
    let finalContent = responseText;
    if (action === "analyzeArticle") {
      try {
        const raw = responseText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const BLANK = new Set(["無", "none", "n/a", ""]);
          const filled = arr.map(w => {
            const g = (v) => (BLANK.has(String(v ?? "").trim().toLowerCase()) ? "" : String(v ?? "").trim());
            const word = g(w.word) || "unknown";
            return {
              word,
              pos:          g(w.pos)          || "noun",
              level:        g(w.level)         || "B1",
              definition:   g(w.definition)    || word,
              example1:     g(w.example1)      || `${word} is used in this context.`,
              example1_zh:  g(w.example1_zh)   || `「${word}」用於此語境中。`,
              example2:     g(w.example2)      || `She used the word ${word} in her essay.`,
              example2_zh:  g(w.example2_zh)   || `她在文章中使用了「${word}」這個字。`,
            };
          });
          finalContent = JSON.stringify(filled);
        }
      } catch (_) {
        // 解析失敗就保留原始文字，前端自行 fallback
      }
    }

    res.json({
      ok: true,
      content: finalContent,
      model: "gemini-2.5-flash-lite",
      usage,
    });
  } catch (err) {
    console.error("[Gemini API 錯誤]", err);
    res.status(500).json({ ok: false, error: err.message || "Gemini API 呼叫失敗" });
  }
});

// ====== 工具：從 YouTube URL 取出 video ID ======
function extractYouTubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ====== YouTube 字幕擷取（多方法備援）======
async function fetchYouTubeTranscript(videoId) {
  function xmlToText(xml) {
    return xml
      .replace(/<text[^>]*>/g, " ")
      .replace(/<\/text>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\[.*?\]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  async function tryInnerTube(clientName, clientVersion, extraHeaders = {}, extraBody = {}) {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({
        videoId,
        racyCheckOk: true,
        contentCheckOk: true,
        context: {
          client: { clientName, clientVersion, hl: "en", gl: "US", ...extraBody },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    console.log(`[YouTube] ${clientName} HTTP ${res.status}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  }

  async function fetchTrackText(tracks) {
    const track = tracks.find(t => /^en/i.test(t.languageCode)) || tracks[0];
    if (!track?.baseUrl) return null;
    console.log(`[YouTube] 選用字幕軌: ${track.languageCode}`);
    const xmlRes = await fetch(track.baseUrl, { signal: AbortSignal.timeout(10000) });
    if (!xmlRes.ok) return null;
    const text = xmlToText(await xmlRes.text());
    return text.length > 50 ? text : null;
  }

  console.log(`[YouTube] videoId=${videoId}`);

  // 方法一：timedtext list（最輕量，有些影片支援）
  try {
    const listRes = await fetch(
      `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (listRes.ok) {
      const listXml = await listRes.text();
      console.log(`[YouTube] timedtext list: ${listXml.slice(0, 200)}`);
      const enMatch = listXml.match(/lang_code="(en[^"]*)"/);
      const anyMatch = listXml.match(/lang_code="([^"]+)"/);
      const lang = (enMatch || anyMatch)?.[1];
      if (lang) {
        const xmlRes = await fetch(
          `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (xmlRes.ok) {
          const text = xmlToText(await xmlRes.text());
          if (text.length > 50) { console.log(`[YouTube] 方法一成功`); return text; }
        }
      }
    }
  } catch (e) { console.log("[YouTube] 方法一例外:", e.message); }

  // 方法二：WEB_EMBEDDED_PLAYER（嵌入播放器，限制較少）
  try {
    const tracks = await tryInnerTube("WEB_EMBEDDED_PLAYER", "2.20240101.00.00", {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Origin": "https://www.youtube.com",
      "Referer": `https://www.youtube.com/watch?v=${videoId}`,
    });
    console.log(`[YouTube] WEB_EMBEDDED 字幕軌:`, tracks.map(t => t.languageCode));
    if (tracks.length) { const t = await fetchTrackText(tracks); if (t) { console.log("[YouTube] 方法二成功"); return t; } }
  } catch (e) { console.log("[YouTube] 方法二例外:", e.message); }

  // 方法三：iOS client（歷史上最不受限）
  try {
    const tracks = await tryInnerTube("IOS", "19.09.3", {
      "User-Agent": "com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_4 like Mac OS X)",
      "X-YouTube-Client-Name": "5",
      "X-YouTube-Client-Version": "19.09.3",
    }, { deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "17.4" });
    console.log(`[YouTube] IOS 字幕軌:`, tracks.map(t => t.languageCode));
    if (tracks.length) { const t = await fetchTrackText(tracks); if (t) { console.log("[YouTube] 方法三成功"); return t; } }
  } catch (e) { console.log("[YouTube] 方法三例外:", e.message); }

  // 方法四：ANDROID
  try {
    const tracks = await tryInnerTube("ANDROID", "19.09.37", {
      "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
      "X-YouTube-Client-Name": "3",
      "X-YouTube-Client-Version": "19.09.37",
    }, { androidSdkVersion: 30 });
    console.log(`[YouTube] ANDROID 字幕軌:`, tracks.map(t => t.languageCode));
    if (tracks.length) { const t = await fetchTrackText(tracks); if (t) { console.log("[YouTube] 方法四成功"); return t; } }
  } catch (e) { console.log("[YouTube] 方法四例外:", e.message); }

  throw new Error("此影片沒有可擷取的英文字幕");
}

// ====== URL 網頁內容抓取（代理，解決 CORS 問題）======
app.post("/scrape", async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: "缺少 url 欄位" });

  // ── YouTube：使用 youtube-transcript 擷取字幕 ──
  if (/youtube\.com|youtu\.be/i.test(url)) {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return res.status(400).json({ ok: false, error: "無法解析 YouTube 影片 ID，請確認網址格式。" });
    }
    try {
      const text = await fetchYouTubeTranscript(videoId);
      if (!text || text.length < 50) {
        return res.status(400).json({ ok: false, error: "此影片沒有英文字幕（或字幕已停用）。" });
      }
      return res.json({ ok: true, text: text.slice(0, 8000), source: "youtube" });
    } catch (err) {
      console.error("[YouTube 字幕錯誤]", err.message);
      return res.status(400).json({
        ok: false,
        error: `無法取得字幕：${err.message}`,
      });
    }
  }

  // ── 一般網頁：抓 HTML 並清理 ──
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return res.status(400).json({ ok: false, error: `無法存取該網址（HTTP ${response.status}）` });
    }

    const html = await response.text();

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 8000);

    if (text.length < 100) {
      return res.status(400).json({ ok: false, error: "擷取到的文字太少，該網頁可能需要登入或使用 JavaScript 動態渲染。" });
    }

    res.json({ ok: true, text });
  } catch (err) {
    const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
    res.status(500).json({ ok: false, error: isTimeout ? "請求逾時（12 秒），請稍後再試。" : `抓取失敗：${err.message}` });
  }
});

// ====== 啟動伺服器 ======
app.listen(PORT, () => {
  console.log(`✅ Jill's Word Garden 伺服器已啟動`);
  console.log(`   請在瀏覽器開啟：http://localhost:${PORT}`);
  console.log(`   模型：gemini-2.5-flash-lite`);
  console.log(`   按 Ctrl+C 停止伺服器`);
});
