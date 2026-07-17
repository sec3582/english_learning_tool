// /js/main.js — ESM 入口：事件綁定 + 啟動（含測驗設定開關）
import * as UI from "./ui.js";
import { APPS_SCRIPT_URL } from "./api.js";
import { initPixelPet } from "./pixel_pet.js";
import { stopAll } from "./speech.js";

// 由 APPS_SCRIPT_URL（http://localhost:3000/api）推導出 /notion-save 端點
const NOTION_SAVE_URL = APPS_SCRIPT_URL.replace(/\/api$/, "/notion-save");

const $ = (id) => document.getElementById(id);

// 當前文章的翻譯／文法快取（重新分析時清空）
let _translationHtml = null;
let _grammarData     = null;

// 當前結果來源："text"（手動輸入／圖片 OCR）或 "pdf"；決定 resultActionRow
// 裡翻譯／文法按鈕與 rtabTrans／rtabGrammar 分頁要不要顯示（Phase 4.5）
let _resultSource = null;

const on = (id, evt, fn) => {
  const el = $(id);
  if (el && typeof fn === "function") el.addEventListener(evt, fn);
};

/* ── 匯入文章 Tab 切換 ── */
function initInputTabs() {
  const tabs = [
    { btn: "inputTabManual", panel: "inputPanelManual" },
    { btn: "inputTabUpload", panel: "inputPanelUpload" },
    { btn: "inputTabPdf",    panel: "inputPanelPdf" },
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

// ─── 結果 Tab 切換（模組頂層）───
const RESULT_TABS = [
  { btn: "rtabWords",   panel: "rtabPanelWords"   },
  { btn: "rtabTrans",   panel: "rtabPanelTrans"   },
  { btn: "rtabGrammar", panel: "rtabPanelGrammar" },
];

// Phase 4.5：切分頁純粹是「切換顯示」——不再像過去那樣在切到 rtabTrans／
// rtabGrammar 時順便觸發 fetch。fetch 現在完全由 resultActionRow 的
// 「中文翻譯」「文法重點」按鈕獨立觸發（見 fetchTranslationAction／
// fetchGrammarAction）。這裡只在還沒產生內容時顯示提示文字。
function switchResultTab(activeId) {
  RESULT_TABS.forEach(({ btn, panel }) => {
    const isActive = btn === activeId;
    $(btn)?.classList.toggle("result-tab--active", isActive);
    $(panel)?.classList.toggle("hidden", !isActive);
  });

  if (activeId === "rtabTrans" && !_translationHtml) {
    const content = $("translationContent");
    if (content) content.innerHTML = '<p style="color:var(--muted); font-size:.875rem; padding:12px 0; text-align:center;">尚未產生翻譯，請點擊上方「中文翻譯」按鈕。</p>';
  }

  if (activeId === "rtabGrammar" && !_grammarData) {
    const content = $("grammarContent");
    if (content) content.innerHTML = '<p style="color:var(--muted); font-size:.875rem; padding:12px 0; text-align:center;">尚未產生文法重點，請點擊上方「文法重點」按鈕。</p>';
  }
}

// 中文翻譯：resultActionRow 的「中文翻譯」按鈕獨立觸發自己的 AI 呼叫
async function fetchTranslationAction() {
  const text = UI.getArticleContextText();
  if (!text) return;
  switchResultTab("rtabTrans");
  const content = $("translationContent");
  if (content) content.innerHTML = '<p style="color:var(--muted); font-size:.875rem; padding:12px 0; text-align:center;">翻譯中，請稍後…</p>';
  const btn = $("raTransBtn");
  if (btn) btn.disabled = true;
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
    // 成功後這顆按鈕功成身退——之後改用「翻譯」分頁瀏覽/重看內容，
    // 失敗時絕不能走到這裡（fetch 失敗會被下面 catch 攔截，按鈕留著讓使用者重試）
    _fadeOutQuiet(btn);
  } catch (err) {
    if (content) content.innerHTML = `<p style="color:#C0392B; font-size:.875rem; padding:12px 0;">翻譯失敗：${_esc(err.message)}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 文法重點：resultActionRow 的「文法重點」按鈕獨立觸發自己的 AI 呼叫
async function fetchGrammarAction() {
  const text = UI.getArticleContextText();
  if (!text) return;
  switchResultTab("rtabGrammar");
  const content = $("grammarContent");
  if (content) content.innerHTML = '<p style="color:var(--muted); font-size:.875rem; padding:12px 0; text-align:center;">文法分析中，請稍後…</p>';
  const btn = $("raGrammarBtn");
  if (btn) btn.disabled = true;
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
    const count = _grammarData.points?.length ?? 0;
    const badge = $("rtabGrammarBadge");
    if (badge) badge.textContent = count > 0 ? String(count) : "";
    // 成功後這顆按鈕功成身退——之後改用「文法重點」分頁瀏覽/重看內容，
    // 失敗時絕不能走到這裡（fetch 失敗會被下面 catch 攔截，按鈕留著讓使用者重試）
    _fadeOutQuiet(btn);
  } catch (err) {
    if (content) content.innerHTML = `<p style="color:#C0392B; font-size:.875rem; padding:12px 0;">文法分析失敗：${_esc(err.message)}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 安靜的淡入：只用 opacity，不做 scale/彈跳（遊戲導演規格：分析完成是安靜時刻，不是慶祝）
function _fadeInQuiet(el) {
  if (!el) return;
  el.classList.remove("hidden");
  if (typeof gsap !== "undefined") {
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.38, ease: "power2.out" });
  } else {
    el.style.opacity = "0";
    requestAnimationFrame(() => {
      el.style.transition = "opacity .38s ease-out";
      el.style.opacity = "1";
    });
  }
}

// 安靜的淡出：raTransBtn／raGrammarBtn 是「首次觸發」按鈕，成功後功成身退——
// 之後改用對應的 rtabTrans／rtabGrammar 分頁瀏覽或重看內容，不需要再顯示
// 這顆按鈕。只做 opacity（跟 _fadeInQuiet 對稱，同樣禁止 scale/彈跳），
// 動畫結束後才真正加上 hidden class，避免只是視覺透明卻仍佔位置／可被點擊。
// raWordsBtn 是可重複使用的「重跑」動作，永遠不會呼叫這個函式。
function _fadeOutQuiet(el) {
  if (!el || el.classList.contains("hidden")) return;
  if (typeof gsap !== "undefined") {
    gsap.to(el, {
      opacity: 0,
      duration: 0.38,
      ease: "power2.out",
      onComplete: () => el.classList.add("hidden"),
    });
  } else {
    el.style.transition = "opacity .38s ease-out";
    el.style.opacity = "0";
    setTimeout(() => el.classList.add("hidden"), 380);
  }
}

// 把 raTransBtn／raGrammarBtn 重設成「乾淨可見」狀態：移除 hidden class，
// 並清掉 _fadeOutQuiet() 可能留下的 inline opacity/transition——否則單靠
// classList.remove("hidden") 會讓按鈕恢復排版位置，但仍卡在 opacity:0
// 的殘留 inline style 上，變成「有位置但看不見」的隱形按鈕。
// 用於每一輪新分析開始時（見 setResultSource／stripReanalyzeBtn），確保
// 上一篇文章「翻譯這篇／拆解文法」淡出後留下的狀態，不會沿用到新的一輪。
function resetActionButtonsVisible() {
  ["raTransBtn", "raGrammarBtn"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.remove("hidden");
    el.style.opacity = "";
    el.style.transition = "";
  });
}

// source 依來源切換 resultActionRow／結果分頁可見的按鈕組合：
// "text"（手動輸入／圖片 OCR）＝ 三顆按鈕都在；"pdf" ＝ 只留「挑出單字」，
// 翻譯／文法兩顆按鈕與對應分頁整組隱藏，換成敘事文案一行字。
function setResultSource(source) {
  _resultSource = source;
  const isPdf = source === "pdf";
  // 先重置成乾淨可見，再依來源決定 pdf 情境要不要重新隱藏——確保每輪新分析
  // 都拿到跟上一篇文章的淡出狀態無關的乾淨起點。
  resetActionButtonsVisible();
  $("raTransBtn")?.classList.toggle("hidden", isPdf);
  $("raGrammarBtn")?.classList.toggle("hidden", isPdf);
  $("rtabTrans")?.classList.toggle("hidden", isPdf);
  $("rtabGrammar")?.classList.toggle("hidden", isPdf);
  $("pdfNarrativeCopy")?.classList.toggle("hidden", !isPdf);
}

// 分析成功後的共用收尾：手動輸入／圖片 OCR／PDF 三條路徑都走這裡，
// 確保摺疊帶、resultActionRow、來源切換的行為完全一致，不各自維護一份。
function finishAnalysisUI(source) {
  $("resultTabWrapper")?.classList.remove("hidden");
  setResultSource(source);
  switchResultTab("rtabWords");

  const wordCount = $("wordForm")?.children.length ?? 0;
  const wordBadge = $("rtabWordsBadge");
  if (wordBadge) wordBadge.textContent = wordCount > 0 ? String(wordCount) : "";

  _fadeInQuiet($("resultActionRow"));
  if (source === "pdf") _fadeInQuiet($("pdfNarrativeCopy"));

  const text = UI.getArticleContextText();
  const preview = text.slice(0, 80).replace(/\s+/g, " ").trim();
  const previewEl = $("inputCollapsedPreview");
  if (previewEl) previewEl.textContent = preview ? preview + "…" : "(文章已輸入)";

  $("articleInputSection")?.classList.add("hidden");
  $("inputCollapsedStrip")?.classList.remove("hidden");
  $("sidebarNotionWrap")?.classList.remove("hidden");
}

function bindEvents() {
  // —— 左側：AI 分析 & 自訂新增 ——
  on("analyzeBtn", "click", async () => {
    _translationHtml = null;
    _grammarData = null;
    UI.resetPdfContext(); // 手動／圖片這條路是全新一輪分析，清掉先前 PDF session 殘留的來源文字

    const ok = await UI.handleAnalyzeClick();
    const hasResult = ok && (($("wordForm")?.children.length ?? 0) > 0);
    if (hasResult) finishAnalysisUI("text");
  });

  on("saveBtn", "click", UI.handleSaveSelected);
  on("customAnalyzeBtn", "click", UI.handleAnalyzeCustom);
  on("customAddBtn", "click", UI.handleCustomAdd);
  on("ocrPickBtn", "click", UI.handlePickOcrFile);
  on("ocrRunBtn", "click", UI.handleRunOcr);

  // —— PDF 分頁：解析成功即自動串接 AI 分析（doPdfExtract 內部完成），
  // 這裡只需要在成功後跑跟手動／圖片一致的收尾 UI ——
  on("pdfPickBtn", "click", async () => {
    _translationHtml = null;
    _grammarData = null;
    const ok = await UI.handlePickPdfFile();
    if (ok) finishAnalysisUI("pdf");
  });
  on("pdfRerunBtn", "click", async () => {
    _translationHtml = null;
    _grammarData = null;
    const ok = await UI.handleRunPdfExtract();
    if (ok) finishAnalysisUI("pdf");
  });

  // —— 結果操作列：挑出單字／中文翻譯／文法重點，各自獨立觸發 ——
  on("raWordsBtn", "click", async () => {
    const text = UI.getArticleContextText();
    const ok = await UI.handleAnalyzeClick({ text, btnId: "raWordsBtn", loadingId: null });
    if (ok) {
      switchResultTab("rtabWords");
      const wordCount = $("wordForm")?.children.length ?? 0;
      const wordBadge = $("rtabWordsBadge");
      if (wordBadge) wordBadge.textContent = wordCount > 0 ? String(wordCount) : "";
    }
  });
  on("raTransBtn", "click", fetchTranslationAction);
  on("raGrammarBtn", "click", fetchGrammarAction);

  // 自訂新增單字（sidebar 摺疊，預設收合；比照 #progressCardHeader 的 toggle 邏輯）
  on("customWordHeader", "click", () => {
    const body = $("customWordBody");
    const chevron = $("customWordChevron");
    if (!body || !chevron) return;
    const nowHidden = body.classList.toggle("hidden");
    chevron.style.transform = nowHidden ? "rotate(-90deg)" : "rotate(0deg)";
  });
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
    const text = UI.getArticleContextText();
    if (!text) return UI.showToast("請先貼上文章內容", { type: "warn" });

    btn.disabled = true;
    btn.innerHTML = "儲存中…";

    try {
      // PDF 來源不提供翻譯／文法（跟 UI 上的限制一致：PDF 分頁的結果操作列
      // 只有「挑出單字」一顆按鈕），Notion 收藏也只同步單字清單，不補抓。
      // 手動輸入／圖片來源則維持原本行為：若翻譯或文法尚未載入，兩者並行補抓。
      const [translationHtml, grammarData] = _resultSource === "pdf"
        ? [null, null]
        : await Promise.all([
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

  // ─── 結果 Tab 切換 ───
  RESULT_TABS.forEach(({ btn }) => {
    on(btn, "click", () => switchResultTab(btn));
  });

  // ─── 摺疊帶：展開 ───
  on("stripExpandBtn", "click", () => {
    $("inputCollapsedStrip")?.classList.add("hidden");
    $("articleInputSection")?.classList.remove("hidden");
  });

  // ─── 摺疊帶：重新分析 ───
  on("stripReanalyzeBtn", "click", () => {
    $("inputCollapsedStrip")?.classList.add("hidden");
    $("articleInputSection")?.classList.remove("hidden");
    $("resultTabWrapper")?.classList.add("hidden");
    $("sidebarNotionWrap")?.classList.add("hidden");
    _translationHtml = null;
    _grammarData = null;
    _resultSource = null;
    UI.resetPdfContext();
    // resultActionRow／PDF 敘事文案下次分析成功才會重新淡入，這裡先收起來
    $("resultActionRow")?.classList.add("hidden");
    $("pdfNarrativeCopy")?.classList.add("hidden");
    // raTransBtn／raGrammarBtn 可能在上一篇文章成功翻譯／文法分析後已經淡出
    // 隱藏——新的一輪分析必須重新看得到這兩顆按鈕，不能沿用上一篇的狀態
    // （下一次 finishAnalysisUI 也會透過 setResultSource 再做一次，這裡先
    // 顯式重置一次，讓「重新分析」本身的行為就是正確、不依賴後續呼叫鏈）。
    resetActionButtonsVisible();
  });

  // ─── Sidebar Notion 按鈕 → 觸發原按鈕邏輯 ───
  on("sidebarNotionBtn", "click", () => {
    $("saveArticleBtn")?.click();
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




