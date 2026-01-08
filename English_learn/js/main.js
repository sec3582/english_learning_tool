// /js/main.js — ESM 入口：事件綁定 + 啟動（含測驗設定開關）
import * as UI from "./ui.js";
import { bootstrapFromSheetsToLocalStorage } from "./sheets_bootstrap.js";
import { initGSheetsAppend } from "./gsheets_append.js";
import { initWordsAutoSync } from "./gsheets_words_autosync.js";




const $ = (id) => document.getElementById(id);
const on = (id, evt, fn) => {
  const el = $(id);
  if (el && typeof fn === "function") el.addEventListener(evt, fn);
};

// OCR：圖片 → 文字 → 填到 articleInput
async function handleImageUpload() {
  const input = document.getElementById("imageUpload");
  if (!input.files.length) return alert("請先選擇圖片");

  const file = input.files[0];
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("loading").textContent = "正在辨識圖片文字...";

  try {
    // 載入 Tesseract.js（如果還沒在 html 引入，要在 <head> 加 <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>）
    const { createWorker } = Tesseract;
    const worker = await createWorker("eng");
    const ret = await worker.recognize(file);
    await worker.terminate();

    const text = ret.data.text.trim();
    if (!text) {
      alert("未辨識到文字，請換張清晰的英文圖片");
    } else {
      // 寫入 textarea
      document.getElementById("articleInput").value = text;
      alert("圖片文字已匯入，可以交給 AI 分析囉！");
    }
  } catch (err) {
    console.error("OCR 錯誤", err);
    alert("圖片辨識失敗，請稍後再試");
  } finally {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("loading").textContent = "AI 分析中，請稍後...";
  }
}


function bindEvents() {
  // —— 左側：AI 分析 & 自訂新增 ——
  on("analyzeBtn", "click", UI.handleAnalyzeClick);
  on("saveBtn", "click", UI.handleSaveSelected);
  on("customAnalyzeBtn", "click", UI.handleAnalyzeCustom);
  on("customAddBtn", "click", UI.handleCustomAdd);
  on("ocrPickBtn", "click", UI.handlePickOcrFile);
  on("ocrRunBtn", "click", UI.handleRunOcr);
  on("pushSheetsBtn", "click", UI.handlePushSheets);

  on("customWordInput", "keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); UI.handleAnalyzeCustom?.(); }
  });

  // —— 右側清單：分頁／篩選／分頁器 ——
  on("tabToday", "click", () => UI.switchSidebarTab?.("today"));
  on("tabDue",   "click", () => UI.switchSidebarTab?.("due"));
  on("tabAll",   "click", () => UI.switchSidebarTab?.("all"));

  $("allSearch")?.addEventListener("input", UI.renderSidebarLists);
  ["allPos", "allLevel", "allSort"].forEach((id) => {
    $(id)?.addEventListener("change", UI.renderSidebarLists);
  });
  on("allPrev", "click", UI.gotoAllPrev);
  on("allNext", "click", UI.gotoAllNext);

  // 浮動加入列
  on("fabAddBtn", "click", UI.handleSaveSelected);

  // 刪除復原
  on("undoBtn", "click", UI.undoLastDelete);

  // —— 測驗（先開設定視窗） ——
  on("startQuizBtn", "click", UI.openQuizModePicker);
  on("quizClose", "click", UI.closeQuiz);                            // 關閉測驗視窗（原本就有）
  on("qsCancel", "click", UI.closeQuizSettings);                     // 關閉設定
  on("qsStart", "click", UI.startQuizFromSettings);                  // 用設定值開始測驗
  on("quizSubmit", "click", () => UI.submitQuizAnswer?.(false));
  on("quizIDK", "click", () => UI.submitQuizAnswer?.(true));
  on("quizNext", "click", () => {
    const modal = $("quizModal");
    if (modal) modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  });
  // 題型選擇視窗
  on("qpClose", "click", UI.closeQuizModePicker);
  document.getElementById("quizModePicker")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation(); // ✅ 阻止同一次 click 觸發到其他「點背景關閉」的邏輯
    
    UI.startQuizFlowWithMode(btn.getAttribute("data-mode"));
  });


  // —— 用量面板 ——
  on("openUsageBtn", "click", () => { UI.refreshUsageUI?.(); UI.openUsageModal?.(); });
  on("usageClose", "click", UI.closeUsageModal);
  on("usageClose2", "click", UI.closeUsageModal);
  on("usageSaveBudget", "click", UI.saveUsageBudget);
  on("usageReset", "click", UI.resetUsage);

  // —— 匯出 / 匯入 JSON 單字清單 ——
  on("exportJsonBtn", "click", UI.handleExportJson);
  on("importJsonBtn", "click", UI.handleImportJsonClick);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[WordGarden] DOM Ready");

  bindEvents();

  UI.refreshUsageUI?.(); // ✅ 新增：一進頁面就用 localStorage 更新 badge

  bootstrapFromSheetsToLocalStorage().catch(err => {
    console.warn("Google Sheets 引導失敗，可能未登入:", err);
  });

  initGSheetsAppend();
  initWordsAutoSync();
});




