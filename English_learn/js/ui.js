// js/ui.js
import { analyzeArticle } from "./api.js";

// ===== DOM（對照你的 index.html）=====
const analyzeBtn = document.getElementById("analyzeBtn");
const articleInput = document.getElementById("articleInput");

const loadingEl = document.getElementById("loading");
const aiResultEl = document.getElementById("aiResult");
const wordFormEl = document.getElementById("wordForm");

// 小工具：顯示/隱藏
function setLoading(isLoading) {
  if (!loadingEl) return;
  loadingEl.classList.toggle("hidden", !isLoading);
}

function showAIResult(show) {
  if (!aiResultEl) return;
  aiResultEl.classList.toggle("hidden", !show);
}

function clearWordForm() {
  if (wordFormEl) wordFormEl.innerHTML = "";
}

// 先做一個最小 render：把結果用 JSON 顯示（確定有回來資料）
// 之後你要美化成「勾選單字列表」再改這裡即可
function renderRawJSON(data) {
  if (!wordFormEl) return;
  wordFormEl.innerHTML = `<pre class="p-3 bg-gray-50 rounded border text-sm overflow-auto">${escapeHtml(
    JSON.stringify(data, null, 2)
  )}</pre>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== 事件處理 =====
async function handleAnalyzeClick() {
  const text = (articleInput?.value || "").trim();
  if (!text) {
    alert("請先貼上英文文章");
    return;
  }

  analyzeBtn.disabled = true;
  setLoading(true);
  showAIResult(false);
  clearWordForm();

  try {
    const result = await analyzeArticle(text);

    // 重要：這裡不做 JSON.parse（避免 [object Object] 問題）
    console.log("analyzeArticle result =", result);
    console.log("typeof result =", typeof result);

    showAIResult(true);
    renderRawJSON(result);
  } catch (err) {
    console.error(err);
    showAIResult(true);
    renderRawJSON({ error: err?.message || String(err) });
  } finally {
    setLoading(false);
    analyzeBtn.disabled = false;
  }
}

// ===== 綁定 =====
if (!analyzeBtn) {
  console.error("找不到 #analyzeBtn，請確認 HTML id");
} else {
  analyzeBtn.addEventListener("click", handleAnalyzeClick);
}
