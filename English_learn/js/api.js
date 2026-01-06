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
  const store = readUsage_();

  let totalUSD = 0;
  const byModel = Object.entries(store).map(([model, v]) => {
    const price = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o"];
    const inputUSD = (v.input / 1_000_000) * price.inPerM;
    const outputUSD = (v.output / 1_000_000) * price.outPerM;
    const sumUSD = inputUSD + outputUSD;
    totalUSD += sumUSD;

    return {
      model,
      input_tokens: v.input,
      output_tokens: v.output,
      cost_usd: sumUSD,
    };
  });

  return {
    month: monthKey(),
    total_usd: totalUSD,
    byModel,
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

// ====== GAS 呼叫 ======
async function callAppsScript(action, payload = {}) {
  const res = await fetch(GAS_URL, {
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
export async function analyzeArticle(text) {
  const data = await callAppsScript("analyzeArticle", { text: String(text || "") });

  // GAS 回：{ ok:true, content:"(模型輸出文字)" }
  const content = data.content || "";

  // 期望 content 是 JSON 陣列字串；若不是就抽取
  try {
    return JSON.parse(content);
  } catch {
    return extractJSON(content);
  }
}

// ====== 主要 API：查單字（自訂詞） ======
export async function analyzeCustomWordAPI(article, term) {
  const data = await callAppsScript("analyzeCustomWord", {
    article: String(article || ""),
    term: String(term || ""),
  });

  const content = data.content || "";

  try {
    return JSON.parse(content);
  } catch {
    return extractJSON(content);
  }
}

