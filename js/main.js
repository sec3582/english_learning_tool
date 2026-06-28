// /js/main.js — ESM 入口：事件綁定 + 啟動（含測驗設定開關）
import * as UI from "./ui.js";
import { APPS_SCRIPT_URL } from "./api.js";
import { initPixelPet } from "./pixel_pet.js";
import { stopAll } from "./speech.js";

// 由 APPS_SCRIPT_URL（http://localhost:3000/api）推導出 /scrape 與 /notion-save 端點
const SCRAPE_URL      = APPS_SCRIPT_URL.replace(/\/api$/, "/scrape");
const NOTION_SAVE_URL = APPS_SCRIPT_URL.replace(/\/api$/, "/notion-save");

const $ = (id) => document.getElementById(id);

// 當前文章的翻譯／文法快取（重新分析時清空）
let _translationHtml = null;
let _grammarData     = null;

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
    { btn: "inputTabManual", panel: "inputPanelManual" },
    { btn: "inputTabUrl",    panel: "inputPanelUrl"    },
  ];

  tabs.forEach(({ btn, panel }) => {
    const btnEl = $(btn);
    if (!btnEl) return;
    btnEl.addEventListener("click", () => {
      tabs.forEach(t => {
        $(t.btn)?.classList.remove("input-tab--active");
        $(t.panel)?.classList.add("hidden");
      });
      btnEl.classList.add("input-tab--active");
      $(panel)?.classList.remove("hidden");
    });
  });
}

function _esc(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function _escReg(s) {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 文法重點內嵌渲染（僅用於摺疊區塊，不需要互動式文章 viewer）
function _renderGrammarInline(points) {
  const container = $("grammarContent");
  if (!container) return;
  if (!points?.length) {
    container.innerHTML = '<p style="color:var(--color-ink-2,#7A6045); font-size:.875rem; padding:12px 0;">未找到文法重點。</p>';
    return;
  }
  container.innerHTML = points.map((p, i) => {
    const exSentence = (p.exampleSentence || "").trim();
    const sep = i < points.length - 1 ? " border-bottom:1px solid var(--color-card-separator,rgba(160,110,30,.35));" : "";
    return `
    <details style="padding:12px 0;${sep}">
      <summary style="cursor:pointer; list-style:none; display:flex; align-items:center; gap:8px; font-size:.9375rem; color:var(--color-ink-1,#1C1208); user-select:none; outline:none;">
        <span class="gr-chev" style="font-size:.6rem; color:var(--color-ink-3,#A08568); flex-shrink:0; display:inline-block; transition:transform .18s;">▶</span>
        <span><strong style="font-weight:600;">${_esc(p.name || "")}</strong>${p.word ? `<span style="font-weight:400; color:var(--color-ink-2,#7A6045); margin-left:5px; font-size:.875rem;">「${_esc(p.word)}」</span>` : ""}</span>
      </summary>
      <div style="margin-top:8px; padding-left:20px;">
        <div style="font-size:.875rem; color:var(--color-ink-1,#1C1208); line-height:1.75;">${_esc(p.explanation || "")}</div>
        ${exSentence ? `<div style="font-size:.8125rem; color:var(--color-ink-2,#7A6045); margin-top:8px; border-left:2px solid var(--color-accent,#C8952A); padding-left:10px; line-height:1.65;">${_esc(exSentence)}</div>` : ""}
      </div>
    </details>`;
  }).join("");

  container.querySelectorAll("details").forEach(d => {
    const chev = d.querySelector(".gr-chev");
    d.addEventListener("toggle", () => {
      if (chev) chev.style.transform = d.open ? "rotate(90deg)" : "";
    });
  });
}

function bindEvents() {
  // —— 左側：AI 分析 & 自訂新增 ——
  on("analyzeBtn", "click", async () => {
    // 重置摺疊區塊狀態
    _translationHtml = null;
    _grammarData = null;
    $("translationSection")?.classList.add("hidden");
    $("grammarSection")?.classList.add("hidden");
    $("translationBody")?.classList.add("hidden");
    $("grammarBody")?.classList.add("hidden");
    const tChev = $("translationChevron");
    const gChev = $("grammarChevron");
    if (tChev) tChev.style.transform = "";
    if (gChev) gChev.style.transform = "";

    await UI.handleAnalyzeClick();

    // 分析成功後顯示摺疊區塊
    if (!$("aiResult")?.classList.contains("hidden")) {
      $("translationSection")?.classList.remove("hidden");
      $("grammarSection")?.classList.remove("hidden");
    }
  });

  on("saveBtn", "click", UI.handleSaveSelected);
  on("customAnalyzeBtn", "click", UI.handleAnalyzeCustom);
  on("customAddBtn", "click", UI.handleCustomAdd);
  on("ocrPickBtn", "click", UI.handlePickOcrFile);
  on("ocrRunBtn", "click", UI.handleRunOcr);
  on("loadSheetsBtn", "click", () => UI.handleLoadSheets());
  on("pushSheetsBtn", "click", UI.handlePushSheets);

  // 文章輸入變動時隱藏摺疊區塊
  $("articleInput")?.addEventListener("input", () => {
    _translationHtml = null;
    _grammarData = null;
    $("translationSection")?.classList.add("hidden");
    $("grammarSection")?.classList.add("hidden");
  });

  // —— 中文翻譯摺疊區塊（點開時懶加載）——
  $("translationToggleBtn")?.addEventListener("click", async () => {
    const body = $("translationBody");
    const chevron = $("translationChevron");
    if (!body) return;
    const isOpen = !body.classList.contains("hidden");
    body.classList.toggle("hidden", isOpen);
    if (chevron) chevron.style.transform = isOpen ? "" : "rotate(180deg)";

    if (!isOpen && !_translationHtml) {
      const text = $("articleInput")?.value.trim();
      if (!text) return;
      const content = $("translationContent");
      if (content) content.innerHTML = '<p style="color:var(--muted); font-size:.875rem; padding:12px 0; text-align:center;">翻譯中，請稍後…</p>';
      try {
        const res = await fetch("/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "translateArticle", text }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "翻譯失敗");
        _translationHtml = data.content;
        if (content) content.innerHTML = _translationHtml;
      } catch (err) {
        if (content) content.innerHTML = `<p style="color:#C0392B; font-size:.875rem; padding:12px 0;">翻譯失敗：${_esc(err.message)}</p>`;
      }
    }
  });

  // —— 文法重點摺疊區塊（點開時懶加載）——
  $("grammarToggleBtn")?.addEventListener("click", async () => {
    const body = $("grammarBody");
    const chevron = $("grammarChevron");
    if (!body) return;
    const isOpen = !body.classList.contains("hidden");
    body.classList.toggle("hidden", isOpen);
    if (chevron) chevron.style.transform = isOpen ? "" : "rotate(180deg)";

    if (!isOpen && !_grammarData) {
      const text = $("articleInput")?.value.trim();
      if (!text) return;
      const content = $("grammarContent");
      if (content) content.innerHTML = '<p style="color:var(--muted); font-size:.875rem; padding:12px 0; text-align:center;">文法分析中，請稍後…</p>';
      try {
        const res = await fetch("/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyzeGrammar", text }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "文法分析失敗");
        const raw = data.content.replace(/```(?:json)?\n?/gi, "").replace(/```\n?/g, "").trim();
        _grammarData = JSON.parse(raw);
        _renderGrammarInline(_grammarData.points || []);
      } catch (err) {
        if (content) content.innerHTML = `<p style="color:#C0392B; font-size:.875rem; padding:12px 0;">文法分析失敗：${_esc(err.message)}</p>`;
      }
    }
  });

  // —— 收藏到 Notion ——
  const _NOTION_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
  const _NOTION_LABEL = `${_NOTION_ICON} 收藏到 Notion`;

  on("saveArticleBtn", "click", async () => {
    const btn = $("saveArticleBtn");
    if (!btn) return;
    const text = $("articleInput")?.value.trim();
    if (!text) return UI.showToast("請先貼上文章內容", { type: "warn" });

    btn.disabled = true;
    btn.innerHTML = "儲存中…";

    try {
      // 若翻譯或文法尚未載入，兩者並行補抓
      const [translationHtml, grammarData] = await Promise.all([
        _translationHtml
          ? Promise.resolve(_translationHtml)
          : fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "translateArticle", text }) })
              .then(r => r.json())
              .then(d => {
                if (d.ok) { _translationHtml = d.content; return d.content; }
                return null;
              })
              .catch(() => null),
        _grammarData
          ? Promise.resolve(_grammarData)
          : fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "analyzeGrammar", text }) })
              .then(r => r.json())
              .then(d => {
                if (d.ok) {
                  const raw = d.content.replace(/```(?:json)?\n?/gi, "").replace(/```\n?/g, "").trim();
                  _grammarData = JSON.parse(raw);
                  return _grammarData;
                }
                return null;
              })
              .catch(() => null),
      ]);

      // 收集畫面上的單字卡
      const words = [];
      $("wordForm")?.querySelectorAll("input[name='word']").forEach(cb => {
        if (cb.detail) words.push(cb.detail);
      });

      const title = text.slice(0, 60).replace(/\n/g, " ").trim();
      const res = await fetch(NOTION_SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          articleText: text,
          translationHtml: translationHtml || null,
          grammarPoints:   grammarData?.points    || [],
          grammarSentences: grammarData?.sentences || [],
          words,
        }),
      });
      const result = await res.json();
      if (!result.ok) throw new Error(result.error);

      UI.showToast("已收藏到 Notion ✓", { duration: 5000 });
    } catch (err) {
      UI.showToast("收藏失敗：" + err.message, { type: "warn", duration: 5000 });
    } finally {
      btn.disabled = false;
      btn.innerHTML = _NOTION_LABEL;
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




