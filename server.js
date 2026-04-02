// server.js
// 本地代理伺服器：取代原本的 Google Apps Script (GAS) Web App
// 使用 @google/generative-ai 套件呼叫 Google Gemini API

import "dotenv/config"; // 載入 .env 設定檔（GEMINI_API_KEY 等變數）
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { spawn } from "child_process";
import { readdir, rm, mkdtemp } from "fs/promises";
import { tmpdir } from "os";

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

// Files API 客戶端（音訊 fallback 用）
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

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
- "definition": the most natural Traditional Chinese term used in Taiwan for this word (e.g. "柚子" for pomelo, "電梯" for elevator). If a short, commonly-used Taiwanese Chinese name exists (1–4 characters preferred), use ONLY that name. Use a brief description ONLY when no standard Chinese term exists. Do NOT write a full sentence or a long explanatory phrase. (string)
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

Article:
${truncateArticleToParagraphs(text)}`;
}

/**
 * 截斷文章至前 maxParagraphs 段，減少送出的 token 數量。
 * 適用於詞彙分析、文法分析等不需要全文的任務。
 */
function truncateArticleToParagraphs(text, maxParagraphs = 5) {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length <= maxParagraphs) return text;
  return paragraphs.slice(0, maxParagraphs).join('\n\n');
}

/**
 * 從文章中擷取包含 term 的前後句子（±windowSize 句），避免送整篇文章。
 * 若 term 不在文章中，fallback 回傳前 400 字元。
 */
function extractTermContext(article, term, windowSize = 2) {
  if (!article || !term) return article || "";
  const sentences = article.match(/[^.!?\n]+[.!?\n]+/g) || [];
  if (!sentences.length) return article.slice(0, 400);
  const termLower = term.toLowerCase();
  const idx = sentences.findIndex(s => s.toLowerCase().includes(termLower));
  if (idx === -1) return article.slice(0, 400);
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(sentences.length, idx + windowSize + 1);
  return sentences.slice(start, end).join("").trim();
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
- "definition": the most natural Traditional Chinese term used in Taiwan for this word (e.g. "柚子" for pomelo, "電梯" for elevator). If a short, commonly-used Taiwanese Chinese name exists (1–4 characters preferred), use ONLY that name. Use a brief description ONLY when no standard Chinese term exists. Do NOT write a full sentence or a long explanatory phrase. (string)
- "example_in_article": a complete sentence from the article below that contains the word (if not found, leave empty string) (string)
- "example_in_article_zh": Traditional Chinese translation of example_in_article (string)
- "example_ai": a new AI-generated natural example sentence using the word (string)
- "example_ai_zh": Traditional Chinese translation of example_ai (string)

Return ONLY a valid JSON object with no extra text, markdown, or code fences.

Article context:
${article || "(no article provided)"}`;
}

/**
 * 建構「AI 記憶輔助」用的 Prompt
 * 目標：針對單一單字，生成語源拆解、諧音口訣、生活例句
 * @param {string} word - 目標英文單字
 */
function buildMnemonicPrompt(word, options = {}) {
  const { regen = false, prevMnemonic = null } = options;

  const styleBlock = regen ? `
STYLE REQUIREMENT (style: "humorous_and_witty"):
- For the "mnemonic" field, you MUST use either 諧音法 (phonetic similarity trick) OR 荒謬故事法 (absurd/surreal short story). Do NOT use generic imagery or plain association.
- Be bold, funny, and unexpected. Taiwanese pop culture, food, or internet humour references are welcome.` : "";

  const avoidBlock = (regen && prevMnemonic)
    ? `\nSTRICT RULE: The previous mnemonic was — "${prevMnemonic}" — you MUST use completely different logic, method, and wording this time. Do NOT recycle the same approach.`
    : "";

  return `You are an English vocabulary memory coach for Traditional Chinese learners.

Create three memory aids for the English word "${word}":

Return a JSON object with these exact fields:
- "etymology": Brief word root/prefix/suffix breakdown in Traditional Chinese (2-3 sentences). Show how understanding the parts reveals the meaning.
- "mnemonic": A fun, creative memory trick in Traditional Chinese. Use phonetic similarities (諧音), vivid imagery, or a short memorable story. Keep it playful!
- "daily_example": One natural English sentence using "${word}" in a situation a Taiwanese person would encounter daily. Format exactly as: "English sentence | 繁體中文翻譯"
- "synonyms": 3-5 English synonyms of "${word}", separated by commas only (e.g. "happy, glad, pleased")
- "antonyms": 3-5 English antonyms of "${word}", separated by commas only (e.g. "sad, unhappy, gloomy"). If no clear antonyms exist, write "無"
${styleBlock}${avoidBlock}
Return ONLY a valid JSON object, no markdown, no code fences, no extra text.`;
}


/**
 * 建構「僅取同義字/反義字」用的輕量 Prompt（不含語源/口訣/例句）
 * @param {string} term - 目標英文單字
 */
function buildSynonymsOnlyPrompt(term) {
  return `For the English word "${term}", provide synonyms and antonyms.
Return ONLY a valid JSON object with no markdown, no code fences, no extra text:
{
  "synonyms": "word1, word2, word3",
  "antonyms": "word1, word2"
}
Rules:
- "synonyms": 3–5 common English synonyms, comma-separated
- "antonyms": 1–3 common English antonyms, comma-separated. If none exist, write "無"`;
}

/**
 * 建構「文法重點分析」用的 Prompt
 * 目標：識別文章中 5~10 個文法重點，標記所在句子，並提供繁體中文詳細解析
 * @param {string} text - 使用者輸入的英文文章
 */
function buildAnalyzeGrammarPrompt(text) {
  return `You are an English grammar teaching assistant for Traditional Chinese learners.

Analyze the following English article and identify 6 to 12 key grammar points AND phrase patterns that would be valuable for a learner to understand.

Coverage should include a MIX of both:
- Grammar structures: verb tenses, voice (active/passive), clause types, conditionals, modal verbs, articles, gerunds/infinitives, etc.
- Phrase patterns: phrasal verbs (e.g., "give up", "look forward to"), prepositional phrases, common collocations, idiomatic expressions, fixed phrases.

First, split the article into individual sentences. Then, for each point, identify the specific word or phrase (can be 1–5 words) that best demonstrates the concept.

Return ONLY a valid JSON object with this exact structure:
{
  "sentences": [
    { "id": "s1", "text": "The complete original sentence, preserved exactly." },
    { "id": "s2", "text": "Another sentence." }
  ],
  "points": [
    {
      "id": "g1",
      "sentenceId": "s1",
      "word": "exact word or multi-word phrase copied verbatim from the sentence",
      "name": "文法或片語名稱（繁體中文，例如：現在完成式、動詞片語 give up、介系詞片語）",
      "explanation": "清楚說明此文法規則或片語用法，用繁體中文，2至3句話",
      "context": "結合本句語境的解析，說明為何此處使用這個文法或片語，用繁體中文"
    }
  ]
}

STRICT RULES:
1. "sentences" must contain ALL sentences from the article, preserving the original text exactly.
2. "word" must be a substring that appears verbatim (exact same characters and case) in the referenced sentence. For phrasal verbs or multi-word phrases, include the complete phrase as it appears.
3. Aim for roughly half grammar points and half phrase/collocation points.
4. All Chinese fields ("name", "explanation", "context") MUST be in Traditional Chinese (繁體中文).
5. Return ONLY a valid JSON object — no markdown, no code fences, no extra text.

Article:
${truncateArticleToParagraphs(text)}`;
}

/**
 * 建構「全文中英對照翻譯」用的 Prompt
 * @param {string} text - 英文文章內容
 */
function buildTranslateArticlePrompt(text) {
  return `你是一個專業的英文翻譯助理。請將以下英文文章翻譯成繁體中文。為了幫助使用者學習，請採用「段落式中英對照」的格式回傳。請先輸出一段原始的英文段落，接著在下一段輸出對應的繁體中文翻譯。請使用 HTML 格式排版，英文段落請用 <p class="eng-text"> 包覆，中文翻譯請用 <p class="cht-text" style="color: #666; margin-bottom: 20px;"> 包覆。請確保每一段都有對應的翻譯，不要遺漏。只回傳 HTML 內容，不要加入任何說明文字或 code fence。

文章內容：
${text}`;
}

/**
 * 建構「文法測驗出題」用的 Prompt
 * @param {Array} points - 已收藏的文法點 [{ name, explanation, context, word, exampleSentence }]
 * @param {Array} knownWords - 使用者已知單字 [{ word, definition }]
 */
function buildGrammarQuizGeneratePrompt(points, knownWords) {
  const pointsText = points.map((p, i) =>
    `${i + 1}. 文法點：${p.name}\n   示例句：${p.exampleSentence || p.word}`
  ).join("\n\n");

  const wordsText = (knownWords || []).slice(0, 15).map(w => w.word).join(", ");

  return `You are an English grammar quiz designer for Traditional Chinese learners.

The learner has saved these grammar points for practice:
${pointsText}

The learner also knows these vocabulary words (try to incorporate some naturally):
${wordsText || "(none)"}

Design exactly 5 grammar rewriting exercises. Each exercise gives the learner ONE original English sentence and asks them to rewrite it according to a specific grammar instruction.

RULES:
- Each question must target one of the grammar points listed above (you may repeat if there are fewer than 5 points)
- The instruction must be clear and specific (e.g., "改成被動語態", "用現在完成式改寫", "把這句改成表達遺憾的假設語氣")
- The originalSentence should be a complete, natural English sentence (can be from the example or freshly composed)
- Instructions must be written in Traditional Chinese (繁體中文)
- Make sentences varied and interesting; avoid trivial one-word sentences

Return ONLY a valid JSON array of exactly 5 objects:
[
  {
    "grammarPointName": "文法點名稱（繁體中文，對應上面的文法點）",
    "instruction": "改寫指示（繁體中文，說明要如何改寫）",
    "originalSentence": "The original English sentence to rewrite.",
    "hint": "關鍵提示（繁體中文，一句話提示改寫方向，例如：記得用 had + 過去分詞）"
  }
]

Return ONLY the JSON array, no markdown, no code fences, no extra text.`;
}

/**
 * 建構「文法測驗批改」用的 Prompt
 */
function buildGrammarQuizFeedbackPrompt(instruction, originalSentence, userAnswer, grammarPointName) {
  return `You are an English grammar coach for Traditional Chinese learners.

Grammar point being practiced: ${grammarPointName}
Task instruction (in Chinese): ${instruction}
Original sentence: "${originalSentence}"
Learner's rewritten answer: "${userAnswer}"

Evaluate the learner's answer and provide feedback.

Return ONLY a valid JSON object:
{
  "correct": true or false,
  "score": "A" | "B" | "C",
  "referenceSentence": "A model correct rewriting of the original sentence",
  "feedbackZh": "具體的繁體中文回饋，說明哪裡對、哪裡需要改進（2-3 句）",
  "grammarNote": "這個文法點的關鍵規則提醒（繁體中文，1-2 句）"
}

Score rubric:
- A: Grammatically correct and natural, fully satisfies the instruction
- B: Mostly correct with minor issues (wrong article, slight unnatural phrasing, etc.)
- C: Major grammatical errors or did not follow the instruction

Return ONLY the JSON object, no markdown, no code fences.`;
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
    prompt = buildAnalyzeCustomWordPrompt(extractTermContext(article, term), term);
  } else if (action === "analyzeGrammar") {
    // 文法重點分析：傳入文章文字
    if (!text) return res.status(400).json({ ok: false, error: "缺少 text 欄位" });
    prompt = buildAnalyzeGrammarPrompt(text);
  } else if (action === "mnemonicWord") {
    // AI 記憶輔助：語源 + 口訣 + 生活例句
    if (!term) return res.status(400).json({ ok: false, error: "缺少 term 欄位" });
    const isRegen = body.regen === true;
    const prevMnemonic = typeof body.prevMnemonic === "string" ? body.prevMnemonic : null;
    prompt = buildMnemonicPrompt(term, { regen: isRegen, prevMnemonic });
  } else if (action === "translateArticle") {
    // 全文中英對照翻譯：按段落分批呼叫 API，降低單次 token 用量
    if (!text) return res.status(400).json({ ok: false, error: "缺少 text 欄位" });
    try {
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
      const CHUNK_SIZE = 4;
      let combinedHtml = "";
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      for (let i = 0; i < paragraphs.length; i += CHUNK_SIZE) {
        const chunk = paragraphs.slice(i, i + CHUNK_SIZE).join("\n\n");
        const chunkResult = await geminiModel.generateContent(buildTranslateArticlePrompt(chunk));
        combinedHtml += chunkResult.response.text();
        const meta = chunkResult.response.usageMetadata;
        totalPromptTokens += meta?.promptTokenCount || 0;
        totalCompletionTokens += meta?.candidatesTokenCount || 0;
      }
      return res.json({
        ok: true,
        content: combinedHtml,
        model: "gemini-2.5-flash-lite",
        usage: { prompt_tokens: totalPromptTokens, completion_tokens: totalCompletionTokens },
      });
    } catch (err) {
      console.error("[Gemini API 錯誤]", err);
      return res.status(500).json({ ok: false, error: err.message || "Gemini API 呼叫失敗" });
    }
  } else if (action === "grammarQuizGenerate") {
    // 文法測驗出題
    const { points, knownWords } = body;
    if (!points?.length) return res.status(400).json({ ok: false, error: "缺少 points 欄位" });
    prompt = buildGrammarQuizGeneratePrompt(points, knownWords || []);
  } else if (action === "grammarQuizFeedback") {
    // 文法測驗批改
    const { instruction, originalSentence, userAnswer, grammarPointName } = body;
    if (!instruction || !originalSentence || !userAnswer) {
      return res.status(400).json({ ok: false, error: "缺少必要欄位" });
    }
    prompt = buildGrammarQuizFeedbackPrompt(instruction, originalSentence, userAnswer, grammarPointName || "");
  } else if (action === "synonymsOnly") {
    // 輕量同義字/反義字查詢（addWord 後非同步補齊）
    if (!term) return res.status(400).json({ ok: false, error: "缺少 term 欄位" });
    prompt = buildSynonymsOnlyPrompt(term);
  } else {
    return res.status(400).json({ ok: false, error: `未知的 action：${action}` });
  }

  try {
    // 呼叫 Gemini API 產生內容（regen 模式提升 temperature 增加創造力）
    const activeModel = (action === "mnemonicWord" && body.regen === true)
      ? genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig: { temperature: 0.9 } })
      : geminiModel;
    const result = await activeModel.generateContent(prompt);
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

// ====== YouTube 音訊下載（yt-dlp fallback）======
async function downloadYouTubeAudio(url) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "yt-audio-"));
  const outputTemplate = path.join(tmpDir, "%(id)s.%(ext)s");

  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", [
      "--format", "bestaudio[ext=m4a][abr<=128]/bestaudio[ext=m4a]/bestaudio/best",
      "--match-filter", "duration<=1200",   // 限制 20 分鐘以內
      "--output", outputTemplate,
      "--no-playlist",
      "--quiet",
      url,
    ]);

    let stderr = "";
    proc.stderr.on("data", d => { stderr += d; });
    proc.stdout.on("data", () => {});

    proc.on("error", async (err) => {
      await rm(tmpDir, { recursive: true }).catch(() => {});
      reject(new Error(`yt-dlp 未安裝或無法執行：${err.message}`));
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        await rm(tmpDir, { recursive: true }).catch(() => {});
        const msg = stderr.includes("does not pass filter") || stderr.includes("duration")
          ? "影片超過 20 分鐘，不支援音訊下載。"
          : `yt-dlp 下載失敗：${stderr.slice(0, 200)}`;
        reject(new Error(msg));
        return;
      }
      try {
        const files = await readdir(tmpDir);
        const audio = files.find(f => !f.endsWith(".part") && !f.endsWith(".ytdl") && !f.endsWith(".json"));
        if (!audio) {
          await rm(tmpDir, { recursive: true }).catch(() => {});
          reject(new Error("找不到下載的音訊檔案"));
          return;
        }
        const ext = path.extname(audio).slice(1).toLowerCase();
        const mimeMap = { mp3: "audio/mpeg", m4a: "audio/mp4", webm: "audio/webm", ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav" };
        resolve({ audioPath: path.join(tmpDir, audio), mimeType: mimeMap[ext] || "audio/mp4", tmpDir });
      } catch (e) {
        await rm(tmpDir, { recursive: true }).catch(() => {});
        reject(e);
      }
    });
  });
}

// ====== Gemini 音訊轉錄 ======
async function transcribeAudioWithGemini(audioPath, mimeType) {
  console.log(`[Audio] 上傳音訊：${path.basename(audioPath)}`);
  const uploadResult = await fileManager.uploadFile(audioPath, {
    mimeType,
    displayName: path.basename(audioPath),
  });
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const result = await model.generateContent([
    { fileData: { fileUri: uploadResult.file.uri, mimeType: uploadResult.file.mimeType } },
    { text: "Please transcribe this audio completely and accurately. Return only the transcription text, no commentary or formatting." },
  ]);
  return result.response.text().trim();
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
    // 第一步：嘗試字幕擷取
    let captionText = null;
    try {
      captionText = await fetchYouTubeTranscript(videoId);
      if (!captionText || captionText.length < 50) captionText = null;
    } catch (e) {
      console.log(`[YouTube] 字幕失敗，改用 yt-dlp：${e.message}`);
    }

    if (captionText) {
      return res.json({ ok: true, text: captionText.slice(0, 8000), source: "youtube" });
    }

    // 第二步：yt-dlp 下載音訊 → Gemini 轉錄
    let tmpDir = null;
    try {
      console.log(`[YouTube] 啟動 yt-dlp fallback…`);
      const { audioPath, mimeType, tmpDir: td } = await downloadYouTubeAudio(`https://www.youtube.com/watch?v=${videoId}`);
      tmpDir = td;
      const transcript = await transcribeAudioWithGemini(audioPath, mimeType);
      if (!transcript || transcript.length < 50) {
        return res.status(400).json({ ok: false, error: "音訊轉錄結果太短，無法分析。" });
      }
      console.log(`[YouTube] yt-dlp fallback 成功，轉錄 ${transcript.length} 字元`);
      return res.json({ ok: true, text: transcript.slice(0, 8000), source: "youtube-audio" });
    } catch (err) {
      console.error("[YouTube fallback 錯誤]", err.message);
      return res.status(400).json({
        ok: false,
        error: `無法處理此影片：${err.message}`,
      });
    } finally {
      if (tmpDir) await rm(tmpDir, { recursive: true }).catch(() => {});
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
