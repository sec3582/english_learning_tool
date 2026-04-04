// /js/main.js — ESM 入口：事件綁定 + 啟動（含測驗設定開關）
import * as UI from "./ui.js";
import { initGSheetsHistory, saveArticleHistory, getRecentArticles, deleteArticleHistory } from "./gsheets_history.js";
import { APPS_SCRIPT_URL, analyzeGrammar } from "./api.js";
import { initPixelPet } from "./pixel_pet.js";
import { stopAll, speakSequence, setSpeechPrefs } from "./speech.js";
// enrichment helpers re-exported from ui.js
const { getEnrichment, saveEnrichment, deleteEnrichment } = UI;

// 由 APPS_SCRIPT_URL（http://localhost:3000/api）推導出 /scrape 端點
const SCRAPE_URL = APPS_SCRIPT_URL.replace(/\/api$/, "/scrape");




const $ = (id) => document.getElementById(id);
let _starredRowIndex = null;          // tracks sheetRowIndex of currently starred article
let _grammarPoints = {};              // { gN: { name, sentenceId, explanation, context } }
let _grammarHighlightedSentence = null;
let _currentTranslatedContent = null; // 當前翻譯 HTML（用於情境 B 收藏時一起存）
let _currentGrammarData = null;       // 當前文法資料 { sentences, points }（用於情境 B）

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


/* ── 匯入文章 Tab 切換 ── */
function initInputTabs() {
  const tabs = [
    { btn: "inputTabManual",  panel: "inputPanelManual"  },
    { btn: "inputTabUrl",     panel: "inputPanelUrl"     },
    { btn: "inputTabLibrary", panel: "inputPanelLibrary" },
  ];

  tabs.forEach(({ btn, panel }) => {
    const btnEl = $(btn);
    if (!btnEl) return;
    btnEl.addEventListener("click", async () => {
      // 所有 tab → 非 active
      tabs.forEach(t => {
        $(t.btn)?.classList.remove("input-tab--active");
        $(t.panel)?.classList.add("hidden");
      });
      // 點選的 tab → active + 顯示 panel
      btnEl.classList.add("input-tab--active");
      $(panel)?.classList.remove("hidden");

      // 圖書館 tab：若尚未載入資料，自動觸發授權 + 載入
      if (btn === "inputTabLibrary") {
        const items = $("libraryItems");
        const hasData = items && items.querySelectorAll(".library-item").length > 0;
        if (!hasData) {
          try {
            const articles = await getRecentArticles(50);
            UI.renderLibraryList(articles);
          } catch (err) {
            UI.showToast("圖書館載入失敗：" + err.message, { type: "warn", duration: 5000 });
          }
        }
      }
    });
  });
}

function _esc(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function _escReg(s) {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// buildGrammarHTML 已移至 ui.js 統一管理，使用 UI.buildGrammarHTML

function bindEvents() {
  // —— 左側：AI 分析 & 自訂新增 ——
  on("analyzeBtn", "click", UI.handleAnalyzeClick);
  on("saveBtn", "click", UI.handleSaveSelected);
  on("customAnalyzeBtn", "click", UI.handleAnalyzeCustom);
  on("customAddBtn", "click", UI.handleCustomAdd);
  on("ocrPickBtn", "click", UI.handlePickOcrFile);
  on("ocrRunBtn", "click", UI.handleRunOcr);
  on("loadSheetsBtn", "click", async () => {
    const result = await UI.handleLoadSheets();
    // 雲端載入完成後，同步更新圖書館列表
    // bootstrap 已讀取 Article_History，直接使用（同一 token，不需第二次授權彈窗）
    if (result) {
      try { UI.renderLibraryList(result.articles ?? []); } catch {}
    }
  });
  on("pushSheetsBtn", "click", UI.handlePushSheets);

  // —— 收藏此文 / 取消收藏 ——
  // SVG 星星（outline = 未收藏、filled = 已收藏）
  const _STAR_OUT  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  const _STAR_FILL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  function _setStarBtn(btn, starred) {
    if (starred) {
      btn.innerHTML = `${_STAR_FILL} 已收藏`;
      btn.className = "btn-ghost-m btn-ghost-m--starred";
    } else {
      btn.innerHTML = `${_STAR_OUT} 收藏此文`;
      btn.className = "btn-ghost-m";
    }
  }

  on("saveArticleBtn", "click", async () => {
    const btn = $("saveArticleBtn");
    if (!btn) return;

    // ── 已收藏 → 再次點擊 = 取消收藏 ──
    if (_starredRowIndex !== null) {
      const confirmDel = confirm("確定要取消收藏此文章並從圖書館刪除嗎？");
      if (!confirmDel) return;

      btn.disabled = true;
      btn.textContent = "刪除中…";
      try {
        deleteEnrichment(_starredRowIndex); // 同步刪除 enrichment
        await deleteArticleHistory(_starredRowIndex);
        UI.removeLibraryArticle(_starredRowIndex);
        _starredRowIndex = null;
        _setStarBtn(btn, false);
        btn.disabled = false;
        UI.showToast("已從圖書館移除", { type: "info", duration: 3000 });
      } catch (err) {
        UI.showToast("刪除失敗：" + err.message, { type: "warn", duration: 5000 });
        _setStarBtn(btn, true);
        btn.disabled = false;
      }
      return;
    }

    // ── 尚未收藏 → 儲存 ──
    const text = $("articleInput")?.value.trim();
    if (!text) return UI.showToast("請先貼上文章內容", { type: "warn" });

    btn.disabled = true;
    btn.textContent = "收藏中…";

    try {
      const result = await saveArticleHistory(text);

      _starredRowIndex = result.sheetRowIndex;
      _setStarBtn(btn, true);
      btn.disabled = false;

      // 情境 B：收藏時，將畫面上已有的翻譯/文法資料一起存入 enrichment
      const enrichPatch = {};
      if (_currentTranslatedContent) enrichPatch.translatedContent = _currentTranslatedContent;
      if (_currentGrammarData)       enrichPatch.grammarAnalysis    = _currentGrammarData;
      if (Object.keys(enrichPatch).length) saveEnrichment(_starredRowIndex, enrichPatch);

      if (result.duplicate) {
        UI.showToast("這篇文章已在圖書館中", { type: "info", duration: 4000 });
      } else {
        UI.showToast(`已收藏「${result.title.slice(0, 30)}…」`, { duration: 4000 });
        try {
          const articles = await getRecentArticles(50);
          UI.renderLibraryList(articles);
        } catch { /* 靜默 */ }
      }
    } catch (err) {
      UI.showToast("收藏失敗：" + err.message, { type: "warn", duration: 5000 });
      _setStarBtn(btn, false);
      btn.disabled = false;
    }
  });

  // 文章內容變動時重置收藏按鈕與當前 enrichment 狀態
  $("articleInput")?.addEventListener("input", () => {
    _starredRowIndex = null;
    _currentTranslatedContent = null;
    _currentGrammarData = null;
    const btn = $("saveArticleBtn");
    if (btn) { _setStarBtn(btn, false); btn.disabled = false; }
  });

  // —— 文法重點分析 ——
  on("grammarBtn", "click", async () => {
    const text = $("articleInput")?.value.trim();
    if (!text) return alert("請先在文字框貼上英文文章");

    const loading = $("loading");
    if (loading) { loading.textContent = "文法分析中，請稍後…"; loading.classList.remove("hidden"); }
    const btn = $("grammarBtn");
    if (btn) btn.disabled = true;

    try {
      const data = await analyzeGrammar(text);
      if (!data || !Array.isArray(data.sentences) || !Array.isArray(data.points)) {
        throw new Error("AI 回傳格式錯誤");
      }
      _grammarPoints = {};
      _grammarHighlightedSentence = null;
      for (const p of data.points) _grammarPoints[p.id] = p;

      // 儲存當前文法資料（供情境 B 收藏用）
      _currentGrammarData = { sentences: data.sentences, points: data.points };

      // 情境 A：文章已收藏 → 靜默更新 enrichment
      if (_starredRowIndex !== null) {
        saveEnrichment(_starredRowIndex, { grammarAnalysis: _currentGrammarData });
      }

      const viewer = $("grammarArticleViewer");
      if (viewer) viewer.innerHTML = UI.buildGrammarHTML(data.sentences, data.points, text);
      const panel = $("grammarExplanationPanel");
      if (panel) panel.innerHTML = `<p class="text-sm text-center" style="color:#9CA3AF; padding-top:1.75rem;">點擊文章中的藍色標籤，查看文法解析</p>`;

      const modal = $("grammarModal");
      if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
    } catch (err) {
      console.error("[文法分析]", err);
      alert(`文法分析失敗：${err.message}`);
    } finally {
      if (loading) { loading.textContent = "AI 分析中，請稍後…"; loading.classList.add("hidden"); }
      if (btn) btn.disabled = false;
    }
  });

  // 關閉文法 Modal
  on("grammarModalClose", "click", () => {
    const modal = $("grammarModal");
    if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
    _grammarHighlightedSentence = null;
  });

  // —— 全文翻譯 ——
  on("translateBtn", "click", async () => {
    const text = $("articleInput")?.value.trim();
    if (!text) return alert("請先在文字框貼上英文文章");

    const btn = $("translateBtn");
    const origLabel = btn.textContent.trim();
    btn.textContent = "翻譯中，請稍候...";
    btn.disabled = true;

    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "translateArticle", text }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "翻譯失敗");

      // 儲存當前翻譯結果（供情境 B 收藏用）
      _currentTranslatedContent = data.content;

      // 情境 A：文章已收藏 → 靜默更新 enrichment
      if (_starredRowIndex !== null) {
        saveEnrichment(_starredRowIndex, { translatedContent: _currentTranslatedContent });
      }

      const content = $("translateContent");
      if (content) content.innerHTML = data.content;

      const modal = $("translateModal");
      if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
    } catch (err) {
      console.error("[全文翻譯]", err);
      alert(`翻譯失敗：${err.message}`);
    } finally {
      btn.textContent = origLabel;
      btn.disabled = false;
    }
  });

  // 關閉翻譯 Modal
  on("translateModalClose", "click", () => {
    const modal = $("translateModal");
    if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
  });

  // 文法標籤點擊（事件委託）
  let _grammarModalCurrentPoint = null;
  $("grammarArticleViewer")?.addEventListener("click", (e) => {
    const tag = e.target.closest("grammar-tag");
    if (!tag) return;
    const point = _grammarPoints[tag.id];
    if (!point) return;

    // 移除上一個句子的高亮與 active 標籤
    if (_grammarHighlightedSentence) {
      $("grammarArticleViewer")?.querySelector(`[data-id="${_grammarHighlightedSentence}"]`)
        ?.classList.remove("highlight-sentence");
    }
    $("grammarArticleViewer")?.querySelectorAll("grammar-tag.active")
      .forEach(t => t.classList.remove("active"));

    // 套用新高亮
    const sentenceEl = $("grammarArticleViewer")?.querySelector(`[data-id="${point.sentenceId}"]`);
    if (sentenceEl) {
      sentenceEl.classList.add("highlight-sentence");
      _grammarHighlightedSentence = point.sentenceId;
    }
    tag.classList.add("active");

    // 記住目前文法點（供加入練習按鈕使用）
    _grammarModalCurrentPoint = {
      name:            point.name,
      explanation:     point.explanation,
      context:         point.context,
      word:            point.word,
      exampleSentence: sentenceEl?.textContent?.trim() || point.word,
    };

    // 更新解說區（含「加入／移除文法練習」toggle 按鈕）
    const panel = $("grammarExplanationPanel");
    if (panel) {
      panel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-weight:600; font-size:.9375rem; color:#1e293b;">${_esc(point.name)}</div>
          <div style="font-size:.875rem; color:#475569; line-height:1.7;">${_esc(point.explanation)}</div>
          <div style="font-size:.8125rem; color:#64748b; line-height:1.65;
                      border-left:2px solid #93c5fd; padding-left:10px; margin-top:4px;">${_esc(point.context)}</div>
          <div style="margin-top:8px; text-align:right;">
            <button id="grammarModalAddPracticeBtn"
              style="font-size:.78rem;border-radius:6px;padding:3px 10px;cursor:pointer;border:1px solid;">
            </button>
          </div>
        </div>`;
      const practiceBtn = $("grammarModalAddPracticeBtn");
      if (practiceBtn && _grammarModalCurrentPoint) {
        UI._syncGrammarPracticeBtnState(practiceBtn, _grammarModalCurrentPoint);
        practiceBtn.addEventListener("click", () => {
          UI._toggleGrammarPracticeBtn(practiceBtn, _grammarModalCurrentPoint);
        });
      }
    }
  });

  // —— 網址抓取 ——
  function _cleanFetchedText(text) {
    return text
      // 解碼 HTML entities（&#x27; → ' 等）
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
      // 移除殘留的 HTML 標籤
      .replace(/<[^>]+>/g, " ")
      // 移除控制字元（換行、tab 保留）
      .replace(/[^\S\n\t ]+/g, " ")
      // 合併多餘空白行（超過兩行換為兩行）
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function _setUrlStatus(msg, type = "info") {
    const el = $("urlStatus");
    if (!el) return;
    const styles = {
      info:    "background:#F3F4F1;color:#6B7280;",
      success: "background:#EEF2E8;color:#7a9068;",
      error:   "background:#FEF2F2;color:#C0392B;",
      youtube: "background:#FFF7ED;color:#92400E;",
    };
    el.style.cssText = styles[type] || styles.info;
    el.textContent = msg;
    el.classList.toggle("hidden", !msg);
  }

  on("urlFetchBtn", "click", async () => {
    const url = $("urlInput")?.value.trim();
    if (!url) { _setUrlStatus("請輸入網址", "error"); return; }

    const btn = $("urlFetchBtn");
    btn.textContent = "抓取中…";
    btn.disabled = true;
    _setUrlStatus("正在擷取網頁內容…", "info");

    try {
      const res = await fetch(SCRAPE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!data.ok) {
        _setUrlStatus(data.error, "error");
        return;
      }

      // 切到「手動輸入」Tab，把文字填入輸入框
      $("inputTabManual")?.click();
      const ta = $("articleInput");
      if (ta) {
        ta.value = _cleanFetchedText(data.text);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
      $("urlInput").value = "";
      _setUrlStatus("", "");
      UI.showToast?.(`已擷取 ${data.text.length} 字，可點「讓 AI 挑單字」開始分析！`, { duration: 4000 });
    } catch (e) {
      _setUrlStatus(
        navigator.onLine
          ? "無法連接伺服器，請稍後再試。"
          : "無網路連線，請檢查網路狀態。",
        "error"
      );
    } finally {
      btn.textContent = "擷取內容";
      btn.disabled = false;
    }
  });

  // 圖書館：搜尋 + 分頁
  $("librarySearch")?.addEventListener("input", () => UI.filterLibraryList?.());
  on("libraryPrev", "click", () => UI.gotoLibraryPrev?.());
  on("libraryNext", "click", () => UI.gotoLibraryNext?.());

  // 圖書館：刪除事件（由圖書館列表的垃圾桶按鈕觸發）
  window.addEventListener("library-delete", async (e) => {
    const { sheetRowIndex, title } = e.detail || {};
    if (!sheetRowIndex) return;
    try {
      await deleteArticleHistory(sheetRowIndex);
      UI.removeLibraryArticle(sheetRowIndex);
      // 如果目前 starred 的正是這篇，也重置星星按鈕
      if (_starredRowIndex === sheetRowIndex) {
        _starredRowIndex = null;
        const btn = $("saveArticleBtn");
        if (btn) { _setStarBtn(btn, false); btn.disabled = false; }
      } else if (_starredRowIndex !== null && _starredRowIndex > sheetRowIndex) {
        // Rows after deleted row shift up by 1
        _starredRowIndex--;
      }
      UI.showToast(`已刪除「${(title || "").slice(0, 25)}…」`, { type: "info", duration: 3000 });
    } catch (err) {
      UI.showToast("刪除失敗：" + err.message, { type: "warn", duration: 5000 });
    }
  });

  // —— 閱讀模式：返回編輯 ——
  on("readerBackBtn", "click", () => { stopAll(); _resetSpeakBtn(); UI.hideReaderMode?.(); });

  // —— 閱讀模式：朗讀全文 ——
  let _readerSpeaking = false;
  function _resetSpeakBtn() {
    const btn = $("readerSpeakBtn");
    if (!btn) return;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> 朗讀全文`;
    btn.disabled = false;
    _readerSpeaking = false;
  }
  on("readerSpeakBtn", "click", () => {
    if (_readerSpeaking) {
      stopAll();
      _resetSpeakBtn();
      return;
    }
    const article = UI.getCurrentReaderArticle?.();
    if (!article?.fullText) return;
    const paragraphs = article.fullText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    _readerSpeaking = true;
    const btn = $("readerSpeakBtn");
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> 停止朗讀`;
    setSpeechPrefs({ rate: 0.8 });
    speakSequence(paragraphs.map(p => ({ text: p, lang: "en-US" })), _resetSpeakBtn);
  });

  // —— 閱讀模式：翻譯此文 ——
  on("readerTranslateBtn", "click", async () => {
    const article = UI.getCurrentReaderArticle?.();
    if (!article?.fullText) return;
    const btn = $("readerTranslateBtn");
    const orig = btn.textContent.trim();
    btn.textContent = "翻譯中…"; btn.disabled = true;
    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "translateArticle", text: article.fullText }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "翻譯失敗");
      saveEnrichment(article.sheetRowIndex, { translatedContent: data.content });
      UI.showReaderMode(article, getEnrichment(article.sheetRowIndex));
    } catch (err) {
      UI.showToast("翻譯失敗：" + err.message, { type: "warn", duration: 5000 });
      btn.textContent = orig; btn.disabled = false;
    }
  });

  // —— 閱讀模式：文法分析 ——
  on("readerGrammarBtn", "click", async () => {
    const article = UI.getCurrentReaderArticle?.();
    if (!article?.fullText) return;
    const btn = $("readerGrammarBtn");
    const orig = btn.textContent.trim();
    btn.textContent = "分析中…"; btn.disabled = true;
    try {
      const data = await analyzeGrammar(article.fullText);
      if (!data?.sentences || !data?.points) throw new Error("AI 回傳格式錯誤");
      saveEnrichment(article.sheetRowIndex, { grammarAnalysis: { sentences: data.sentences, points: data.points } });
      UI.showReaderMode(article, getEnrichment(article.sheetRowIndex));
    } catch (err) {
      UI.showToast("文法分析失敗：" + err.message, { type: "warn", duration: 5000 });
      btn.textContent = orig; btn.disabled = false;
    }
  });

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

  document.getElementById("todayPrev")?.addEventListener("click", UI.gotoTodayPrev);
  document.getElementById("todayNext")?.addEventListener("click", UI.gotoTodayNext);
  document.getElementById("duePrev")?.addEventListener("click", UI.gotoDuePrev);
  document.getElementById("dueNext")?.addEventListener("click", UI.gotoDueNext);


  // 浮動加入列
  on("fabAddBtn", "click", UI.handleSaveSelected);

  // 刪除復原
  on("undoBtn", "click", UI.undoLastDelete);

  // —— 測驗（直接開設定視窗） ——
  on("startQuizBtn", "click", UI.openQuizSettings);
  on("quizClose", "click", UI.closeQuiz);
  on("qsCancel", "click", UI.closeQuizSettings);
  on("qsStart", "click", UI.startQuizFromSettings);
  on("quizSubmit", "click", () => UI.submitQuizAnswer?.(false));
  on("quizIDK", "click", () => UI.submitQuizAnswer?.(true));
  on("quizNext", "click", () => {
    const modal = $("quizModal");
    if (modal) modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  });

  // —— 文法測驗 ——
  on("startGrammarQuizBtn", "click", () => UI.openGrammarQuiz?.());
  on("grammarQuizClose",    "click", () => UI.closeGrammarQuiz?.());
  on("grammarQuizSubmit",   "click", () => UI.submitGrammarQuizAnswer?.());
  on("grammarQuizNext",     "click", () => UI.grammarQuizNext?.());
  on("grammarQuizShowHint", "click", () => UI.grammarQuizShowHint?.());
  on("grammarQuizDone",     "click", () => UI.closeGrammarQuiz?.());
  $("grammarQuizAnswer")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      UI.submitGrammarQuizAnswer?.();
    }
  });
  $("grammarQuizModal")?.addEventListener("click", (e) => {
    if (e.target === $("grammarQuizModal")) UI.closeGrammarQuiz?.();
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

  // —— AI 記憶輔助懸浮窗 ——
  on("mnemonicClose", "click", UI.closeMnemonicModal);
  $("mnemonicModal")?.addEventListener("click", (e) => {
    if (e.target === $("mnemonicModal")) UI.closeMnemonicModal?.();
  });

  // —— 反白選字浮動分析 FAB ——
  const selFab    = $("selectionFab");
  const selResult = $("selectionResult");
  let _selTerm    = "";
  let _hiddenAt   = 0; // 時間戳：防止 mousedown→mouseup 連鎖重新顯示 FAB

  function _clearSelection() {
    window.getSelection()?.removeAllRanges();
  }

  // 統一清理函式：確保畫面上不殘留分析按鈕與結果卡
  function cleanupAnalysisButton() {
    if (selFab)    selFab.style.display = "none";   // inline style 控制，避免被 class 優先級覆蓋
    selResult?.classList.add("hidden");
  }

  function _showFab(x, y, term) {
    // 若剛剛才關閉（50ms 內），不重新顯示
    if (Date.now() - _hiddenAt < 50) return;
    // 每次顯示新按鈕前先清除舊的，防止同時存在兩個
    cleanupAnalysisButton();
    _selTerm = term;
    selFab.style.left    = Math.max(8, x) + "px";
    selFab.style.top     = Math.max(8, y) + "px";
    selFab.style.display = "flex";  // inline style 顯示
  }

  // selFab 用 style.display 判斷；selResult 用 hidden class 判斷
  function _isVisible(el) {
    if (!el) return false;
    if (el === selFab) return el.style.display !== "none";
    return !el.classList.contains("hidden");
  }

  function _hideFab() {
    const hadVisible = _isVisible(selFab) || _isVisible(selResult);
    cleanupAnalysisButton();
    // 只有在 FAB / 結果卡確實可見時才清除 selection 與設時間戳
    // 避免對每次普通點擊（如貼入 textarea）都呼叫 removeAllRanges()
    if (!hadVisible) return;
    _clearSelection();
    _hiddenAt = Date.now();
  }

  // 在 articleInput textarea 上反白
  $("articleInput")?.addEventListener("mouseup", (e) => {
    if (Date.now() - _hiddenAt < 50) return; // 壓制：剛因點擊外部而關閉
    const ta   = e.currentTarget;
    const term = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
    if (!term) { _hideFab(); return; }
    _showFab(e.clientX - 30, e.clientY - 46, term);
  });

  // 在 readerContent div 上反白
  $("readerContent")?.addEventListener("mouseup", () => {
    if (Date.now() - _hiddenAt < 50) return;
    const sel  = window.getSelection();
    const term = sel?.toString().trim();
    if (!term) { _hideFab(); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    _showFab(rect.left + rect.width / 2 - 30, rect.top - 46, term);
  });

  // 點擊 FAB → 先記錄位置再隱藏，位置傳給結果卡使用
  selFab?.addEventListener("click", async () => {
    const fabRect = selFab.getBoundingClientRect(); // 隱藏前先記座標
    cleanupAnalysisButton();
    _clearSelection();
    _hiddenAt = Date.now();
    await UI.handleSelectionAnalyze?.(_selTerm, fabRect);
  });

  // 全域 mousedown 監聽：點擊非 FAB / 非結果卡的任何位置 → 清除按鈕
  // 必須用 mousedown（不能用 click）：click 在 mouseup 之後觸發，
  // 會把 mouseup 剛顯示的 FAB 立即再隱藏，導致選字無效。
  document.addEventListener("mousedown", (e) => {
    if (!selFab?.contains(e.target) && !selResult?.contains(e.target)) {
      _hideFab();
    }
  });

  // selectionchange：選取範圍消失時立即清除殘留的 FAB（不動結果卡）
  document.addEventListener("selectionchange", () => {
    const taActive = document.activeElement === $("articleInput");
    if (taActive) return; // textarea 的 selectionchange 由 mouseup 自行管理
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      if (selFab) selFab.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[WordGarden] DOM Ready");

  initInputTabs();
  bindEvents();

  UI.refreshUsageUI?.();
  UI.renderSidebarLists?.();
  UI.refreshSyncUI?.();
  initPixelPet();

  // Google Sheets History 模組初始化（靜默）
  initGSheetsHistory().catch(() => {});

  // ── 文章輸入框：自動撐高（Auto-expanding textarea）──
  // 原理：每次 input 先將 height 設為 'auto' 讓瀏覽器重算 scrollHeight，
  // 再將 height 設為 scrollHeight，使框體隨內容無限向下延伸，不出現 scrollbar。
  const articleTa = document.getElementById("articleInput");
  if (articleTa) {
    const autoResize = () => {
      articleTa.style.height = "auto";
      articleTa.style.height = articleTa.scrollHeight + "px";
    };
    articleTa.addEventListener("input", autoResize);
    // paste 事件需等 DOM 更新後才能拿到正確 scrollHeight
    articleTa.addEventListener("paste", () => setTimeout(autoResize, 0));
  }
});




