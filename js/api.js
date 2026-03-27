// js/api.js（Gemini 版：前端呼叫本機 Node.js 代理伺服器，再由伺服器呼叫 Google Gemini API）
// 原本透過 Google Apps Script (GAS) proxy 呼叫 OpenAI，現已改為呼叫本機 server.js

// 本機代理伺服器端點（server.js 啟動後的位址）
// 原本是 GAS Web App URL，現在改為本機 Express 伺服器
export const APPS_SCRIPT_URL = "http://localhost:3000/api";

// ====== 用量統計（本機 localStorage）======
// 匯率：1 USD = TWD
const USD_TO_TWD = 32.5;

// 模型單價（USD / 百萬 tokens）— 已從 OpenAI GPT-4o 改為 Google Gemini 系列費率
// 參考：https://ai.google.dev/pricing
const MODEL_PRICING = {
  "gemini-2.5-flash-lite": { inPerM: 0.10, outPerM: 0.40 }, // Gemini 2.0 Flash：快速且低成本
  "gemini-2.5-flash-lite": { inPerM: 0.075, outPerM: 0.30 }, // Gemini 1.5 Flash（備用）
  "gemini-1.5-pro":   { inPerM: 1.25,  outPerM: 5.00 }, // Gemini 1.5 Pro（高性能，較貴）
};

function roughTokenEstimate(str) {
  const s = String(str || "");
  return Math.ceil(s.length / 4); // 粗估：4 chars ≈ 1 token
}


function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function usageStoreKey() {
  return `wordgarden_usage_${monthKey()}`;
}

function budgetStoreKey() {
  return `wordgarden_budget`;
}


function readUsage_() {
  try {
    return JSON.parse(localStorage.getItem(usageStoreKey()) || "{}");
  } catch {
    return {};
  }
}

function writeUsage_(obj) {
  localStorage.setItem(usageStoreKey(), JSON.stringify(obj));
}

function addUsage(model, usage) {
  if (!usage) return;

  const inputTokens =
    usage.prompt_tokens ??
    usage.input_tokens ??
    usage.promptTokens ??
    usage.inputTokens ??
    0;

  const outputTokens =
    usage.completion_tokens ??
    usage.output_tokens ??
    usage.completionTokens ??
    usage.outputTokens ??
    0;

  const store = readUsage_();
  const cur = store[model] || { input: 0, output: 0 };

  cur.input += Number(inputTokens) || 0;
  cur.output += Number(outputTokens) || 0;

  store[model] = cur;
  writeUsage_(store);
  window.dispatchEvent(new Event("usage-updated"));

}

export function getUsageSummary() {
  // 回傳格式要和 ui.js 的 refreshUsageUI() 相容：
  // { cost, prompt_tokens, completion_tokens, perModel }
  const store = readUsage_();

  let cost = 0;
  let prompt_tokens = 0;
  let completion_tokens = 0;

  const perModel = {};

  for (const [model, v] of Object.entries(store)) {
    // 若模型不在定價表中，以 gemini-2.5-flash-lite 費率作為 fallback
    const price = MODEL_PRICING[model] || MODEL_PRICING["gemini-2.5-flash-lite"];
    const inTok = Number(v?.input) || 0;
    const outTok = Number(v?.output) || 0;

    const inputUSD = (inTok / 1_000_000) * price.inPerM;
    const outputUSD = (outTok / 1_000_000) * price.outPerM;
    const sumTWD = (inputUSD + outputUSD) * USD_TO_TWD;

    prompt_tokens += inTok;
    completion_tokens += outTok;
    cost += sumTWD;

    perModel[model] = {
      prompt: inTok,
      completion: outTok,
      cost: sumTWD,
    };
  }

  return {
    month: monthKey(),
    cost,
    prompt_tokens,
    completion_tokens,
    perModel,
  };
}

export function resetUsageMonth() {
  localStorage.removeItem(usageStoreKey());
}

export function getUsageBudget() {
  const raw = localStorage.getItem(budgetStoreKey());
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function setUsageBudget(v) {
  const n = Number(v);
  localStorage.setItem(budgetStoreKey(), String(Number.isFinite(n) ? n : 0));
}

// ====== 本機伺服器呼叫（取代原 GAS 呼叫）======
// 原本送到 Google Apps Script，現在改送到本機 server.js（Node.js + Gemini API）
async function callAppsScript(action, payload = {}) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      // 改用 application/json（本機伺服器直接以 express.json() 解析，不需 text/plain）
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });

  // 伺服器偶爾可能回傳非 JSON（例如 Express 錯誤頁），先拿文字再嘗試 parse
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`伺服器回傳非 JSON：\n${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(`伺服器 HTTP ${res.status}: ${data?.error || text}`);
  }

  if (!data?.ok) {
    throw new Error(data?.error || "伺服器回傳 ok=false");
  }

// 記錄用量（如果 GAS 有回 usage）
  // 記錄用量（server.js 從 Gemini usageMetadata 取得後回傳）
  if (data?.usage) {
    // 使用伺服器回傳的精確 token 用量（來自 Gemini API 的 usageMetadata）
    addUsage(data.model || "gemini-2.5-flash-lite", data.usage);
  } else {
    // fallback：伺服器未回傳 usage 時，以字元數粗估 token 數量
    const inTok = roughTokenEstimate(JSON.stringify({ action, ...payload }));
    const outTok = roughTokenEstimate(data?.content ?? text);
    addUsage(data.model || "gemini-2.5-flash-lite", { prompt_tokens: inTok, completion_tokens: outTok });

    console.warn("[usage] 伺服器未回傳 usage，已使用粗估 token 計入本月估算", {
      action, inTok, outTok,
    });
  }

  return data;
}

// ====== JSON 抽取（保留給 ui.js 用）======
export function extractJSON(text) {
  // 嘗試抓到第一個 JSON array/object
  const s = String(text || "");

  // 先找 code fence
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const inside = fence[1].trim();
    try {
      return JSON.parse(inside);
    } catch {
      // fallthrough
    }
  }

  // 找第一個 [ ... ] 或 { ... }
  const firstArr = s.indexOf("[");
  const firstObj = s.indexOf("{");

  let start = -1;
  if (firstArr >= 0 && firstObj >= 0) start = Math.min(firstArr, firstObj);
  else start = Math.max(firstArr, firstObj);

  if (start < 0) throw new Error("找不到 JSON 起始符號");

  // 粗略找結尾（最後一個 ] 或 }）
  const endArr = s.lastIndexOf("]");
  const endObj = s.lastIndexOf("}");
  const end = Math.max(endArr, endObj);

  if (end <= start) throw new Error("找不到 JSON 結尾符號");

  const candidate = s.slice(start, end + 1);
  return JSON.parse(candidate);
}

// （保留相容：你之前有 export 這個，但目前 ui.js 不一定用到）
export function buildCustomWordPrompt(article, term) {
  return `term=${term}\narticle=${article}`; // 只是佔位，實際 prompt 在 GAS 端
}

// ====== 主要 API：文章分析 ======
function normalizeToJSON_(content) {
  // 若 GAS 已回傳陣列/物件，就直接用（避免 JSON.parse([object Object])）
  if (content && typeof content === "object") return content;

  const s = String(content ?? "");

  // 先嘗試直接 parse（純 JSON 字串）
  try {
    return JSON.parse(s);
  } catch {
    // 若夾雜文字/Code fence，抽取 JSON
    return extractJSON(s);
  }
}

export async function analyzeArticle(text) {
  const data = await callAppsScript("analyzeArticle", { text: String(text || "") });
  return normalizeToJSON_(data?.content);
}

export async function analyzeGrammar(text) {
  const data = await callAppsScript("analyzeGrammar", { text: String(text || "") });
  return normalizeToJSON_(data?.content);
}

// ====== 主要 API：查單字（自訂詞） ======
export async function analyzeCustomWordAPI(article, term) {
  const data = await callAppsScript("analyzeCustomWord", {
    article: String(article || ""),
    term: String(term || ""),
  });
  return normalizeToJSON_(data?.content);
}


