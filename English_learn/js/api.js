// js/api.js (GAS 版：前端不再直連 OpenAI)

// 你的 GAS Web App /exec URL（你提供的這條）
export const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzutX0-ktHxBftKRlP_1-nrOh-i0UoOYmVLT1EjuFHL8WC4V12iW7S1qrNten-EVyaGqA/exec";

// ====== 用量統計（本機 localStorage）======
// 模型單價（USD / 百萬 tokens），可依實際調整
const MODEL_PRICING = {
  "gpt-4o": { inPerM: 5, outPerM: 15 },
};

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function usageStoreKey() {
  return `wordgarden_usage_${monthKey()}`;
}

function budgetStoreKey() {
  return `wordgarden_budget_${monthKey()}`;
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
    const price = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o"];
    const inTok = Number(v?.input) || 0;
    const outTok = Number(v?.output) || 0;

    const inputUSD = (inTok / 1_000_000) * price.inPerM;
    const outputUSD = (outTok / 1_000_000) * price.outPerM;
    const sumUSD = inputUSD + outputUSD;

    prompt_tokens += inTok;
    completion_tokens += outTok;
    cost += sumUSD;

    perModel[model] = {
      prompt: inTok,
      completion: outTok,
      cost: sumUSD,
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

export function resetUsageMonth() {() {
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

// ====== GAS 呼叫 ======
async function callAppsScript(action, payload = {}) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      // 讓 GAS 直接用 e.postData.contents 解析
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({ action, ...payload }),
  });

  // GAS 有時會回非 JSON（例如錯誤 HTML），這裡先拿文字再嘗試 parse
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`GAS 回傳非 JSON：\n${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(`GAS HTTP ${res.status}: ${data?.error || text}`);
  }

  if (!data?.ok) {
    throw new Error(data?.error || "GAS 回傳 ok=false");
  }

  // 記錄用量（如果 GAS 有回 usage）
  if (data?.usage) addUsage(data.model || "gpt-4o", data.usage);

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

// ====== 主要 API：查單字（自訂詞） ======
export async function analyzeCustomWordAPI(article, term) {
  const data = await callAppsScript("analyzeCustomWord", {
    article: String(article || ""),
    term: String(term || ""),
  });
  return normalizeToJSON_(data?.content);
}
