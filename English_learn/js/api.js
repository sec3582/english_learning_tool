// js/api.js
const GAS_URL = "https://script.google.com/macros/s/你的GAS_ID/exec";

// 模型單價（USD / 百萬 tokens），可依實際調整
const MODEL_PRICING = { "gpt-4o": { inPerM: 5, outPerM: 15 } };

// ---- 用量儲存/讀取 ----
function monthKey(d = new Date()) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function readUsageStore() { try { return JSON.parse(localStorage.getItem("apiUsage") || "{}"); } catch { return {}; } }
function writeUsageStore(obj) { localStorage.setItem("apiUsage", JSON.stringify(obj)); }
function addUsage(model, usage) {
  const store = readUsageStore(); const key = monthKey();
  const rec = store[key] || { totals: { prompt: 0, completion: 0, cost: 0 }, models: {} };
  const byModel = rec.models[model] || { prompt: 0, completion: 0, cost: 0 };
  const price = MODEL_PRICING[model] || { inPerM: 10, outPerM: 10 };
  const p = usage?.prompt_tokens || 0, c = usage?.completion_tokens || 0;
  const cost = (p * price.inPerM + c * price.outPerM) / 1_000_000;
  byModel.prompt += p; byModel.completion += c; byModel.cost += cost;
  rec.totals.prompt += p; rec.totals.completion += c; rec.totals.cost += cost;
  rec.models[model] = byModel; store[key] = rec; writeUsageStore(store);
}

async function callAppsScript(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    // ❌ 不要設 Content-Type: application/json
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ action, ...payload })
  });

  if (!res.ok) {
    throw new Error(`Apps Script 請求失敗：${res.status}`);
  }

  const data = await res.json();
  if (!data?.ok) {
    throw new Error(data?.error || "Apps Script 回傳失敗");
  }

  if (data?.usage) addUsage(data.model || "gpt-4o", data.usage);
  return data;
}


export function getUsageSummary() {
  const store = readUsageStore(); const rec = store[monthKey()] || { totals: { prompt: 0, completion: 0, cost: 0 }, models: {} };
  return { cost: rec.totals.cost || 0, prompt_tokens: rec.totals.prompt || 0, completion_tokens: rec.totals.completion || 0, perModel: rec.models || {}, month: monthKey() };
}
export function resetUsageMonth(key = monthKey()) { const store = readUsageStore(); delete store[key]; writeUsageStore(store); }
export function getUsageBudget() { const v = localStorage.getItem("apiUsageBudget"); return v ? Number(v) : null; }
export function setUsageBudget(n) { if (n == null || isNaN(n)) localStorage.removeItem("apiUsageBudget"); else localStorage.setItem("apiUsageBudget", String(n)); }

// ---- 文章 → AI 挑字 ----
// ---- 文章 → AI 挑字 ----
export async function analyzeArticle(text) {
  const data = await callAppsScript("analyzeArticle", { text });
  return data.content;
}



export function extractJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); }
  catch {
    const arr = text.match(/\[\s*{[\s\S]*}\s*]/); if (arr) return JSON.parse(arr[0]);
    const obj = text.match(/{\s*"word"[\s\S]*?}/); if (obj) return JSON.parse(obj[0]);
    throw new Error("找不到有效的 JSON（請貼短一點的文章再試或稍後重試）");
  }
}

// ---- 自訂單字：依語境判讀 ----
export function buildCustomWordPrompt(article, term) {
  return `
你是一位專業的英語語義判讀助手。請根據「文章內容」分析「查詢詞」在該文最可能的意思與詞性。
若文章中沒有明確出現該詞，請給出最常見且符合一般學習者的解釋。
請回傳「單一 JSON 物件」：
\`\`\`json
{
  "word": "查詢詞原樣",
  "pos": "詞性（noun, verb, adjective, adverb, phrasal verb, idiom...）",
  "definition": "中文解釋（以該文語境為主，簡潔）",
  "example_in_article": "從文章擷取或改寫成通順英句；若無可留空字串",
  "example_in_article_zh": "上列英句的中文翻譯；若無可留空字串",
  "example_ai": "再給一個簡短自造例句",
  "example_ai_zh": "自造例句的中文翻譯",
  "level": "CEFR 難度（A1~C2）"
}
\`\`\`

【查詢詞】
${term}

【文章內容】
${article || "(無，請給常見義)"}
`;
}
export async function analyzeCustomWordAPI(article, term) {
  const data = await callAppsScript("analyzeCustomWord", { article, term });
  const content = data.content || "";
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const pure = fence ? fence[1].trim() : content;
  try { return JSON.parse(pure); }
  catch { return extractJSON(content); }
}



