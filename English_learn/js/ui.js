// js/ui.js
// 負責 UI 與 api.js 的串接，不做任何 JSON.parse

import { analyzeArticle, analyzeCustomWordAPI } from "./api.js";

// ===== DOM =====
const analyzeBtn = document.getElementById("analyzeBtn");
const articleInput = document.getElementById("articleInput");
const resultArea = document.getElementById("resultArea");

// ===== 工具 =====
function showMessage(msg) {
  resultArea.innerHTML = `<pre>${msg}</pre>`;
}

function renderResult(data) {
  // data 已經是 object / array
  resultArea.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

// ===== 事件處理 =====
async function handleAnalyzeClick() {
  const text = articleInput.value.trim();

  if (!text) {
    alert("請先輸入文章內容");
    return;
  }

  analyzeBtn.disabled = true;
  showMessage("AI 分析中，請稍候…");

  try {
    const result = await analyzeArticle(text);

    console.log("analyzeArticle result =", result);
    console.log("typeof result =", typeof result);

    renderResult(result);
  } catch (err) {
    console.error(err);
    showMessage("發生錯誤：\n" + err.message);
  } finally {
    analyzeBtn.disabled = false;
  }
}

// ===== 綁定 =====
if (analyzeBtn) {
  analyzeBtn.addEventListener("click", handleAnalyzeClick);
} else {
  console.error("找不到 analyzeBtn，請確認 HTML id 是否正確");
}
