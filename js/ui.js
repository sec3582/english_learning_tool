// js/ui.js（頂端 imports）
import { analyzeArticle, extractJSON, getUsageSummary, getUsageBudget, setUsageBudget, resetUsageMonth, analyzeCustomWordAPI } from "./api.js";
import { addWord, getAllWords, deleteWord, getTodayWords, getDueWords, getDueCount, saveAllWords, scheduleNext, ensureDueForAll, getMasteredCount, getSyncMeta, clearDirtyAndSetLastSync } from "./storage.js";
import { speak, speakSequence } from "./speech.js";
import { buildTypingQuestion, makeChoiceQuestion, makeDictationQuestion, grade, afterAnswerSpeech, pickExamplePair } from "./quiz.js";
import { pushLocalStorageToSheets } from "./sheets_push.js";
import { updatePetDisplay, onWordAdded, onReviewComplete } from "./pixel_pet.js";



let lastDeleted = null;
let allPage = 1; const ALL_PAGE_SIZE = 10; let lastAllFiltered = [];
// ✅ Today / Due 分頁（每頁 10）
let todayPage = 1; const TODAY_PAGE_SIZE = 10; let lastTodayList = [];
let duePage = 1; const DUE_PAGE_SIZE = 10; let lastDueList = [];

let quizQueue = []; let quizIndex = 0; let quizScore = 0; let _quizEnterHandlerBound = false;
let quizAwaitingNext = false; let wrongAnswers = [];
let lastQuizQueue = []; // 本輪題庫快照（用於重測）
let _submittingAnswer = false;
let _currentSidebarTab = "today"; // 追蹤目前分頁：'today' | 'due' | 'all'（預設與 HTML 初始 tab 一致）


function escapeHTML(s=""){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function splitSentences(text = "") {
  // 簡單切句：遇到 . ? ! 加空白就拆
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[\.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function escapeReg(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}




/* POS 簡寫 */
const POS_MAP = { noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.", pronoun: "pron.", preposition: "prep.", conjunction: "conj.", interjection: "interj.", phrase: "phr." };
function posAbbr(pos=""){ const k = String(pos).toLowerCase().trim(); return POS_MAP[k] || pos; }

/* ===== 測驗偏好 & 自動語音 ===== */
let QUIZ_PREF = (() => {
  try { return JSON.parse(localStorage.getItem("quizPref") || "{}"); } catch { return {}; }
})();
if (!QUIZ_PREF || typeof QUIZ_PREF !== "object") QUIZ_PREF = {};
if (!("audio" in QUIZ_PREF)) QUIZ_PREF.audio = "none"; // none | word | sentence | both
if (!("showZh" in QUIZ_PREF)) QUIZ_PREF.showZh = true;
if (!("mode" in QUIZ_PREF)) QUIZ_PREF.mode = "typing"; // typing | choice_en2zh | choice_zh2en | dictation




/* ===== 測驗設定視窗：開/關/套用後開始 ===== */
export function openQuizSettings() {
  const modal = document.getElementById("quizSettings");
  if (!modal) { startQuiz?.(); return; } // 沒設定窗就直接開始
  // 套用上次偏好
  const radios = modal.querySelectorAll('input[name="qs_audio"]');
  radios.forEach(r => r.checked = (r.value === (QUIZ_PREF.audio || "none")));
  const cb = modal.querySelector("#qs_showZh");
  if (cb) cb.checked = !!QUIZ_PREF.showZh;
  modal.style.display = ""; 
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}
export function closeQuizSettings() {
  const modal = document.getElementById("quizSettings");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  modal.style.display = "none"; // ✅ 強制隱藏
}


export function startQuizFromSettings() {
  const modal = document.getElementById("quizSettings");
  const sel = modal?.querySelector('input[name="qs_audio"]:checked');
  const cb = modal?.querySelector("#qs_showZh");
  QUIZ_PREF.audio = sel ? sel.value : "none";
  QUIZ_PREF.showZh = cb ? !!cb.checked : true;
  QUIZ_PREF.mode = "typing";
  localStorage.setItem("quizPref", JSON.stringify(QUIZ_PREF));

  closeQuizSettings();
  requestAnimationFrame(() => startQuiz?.(_currentSidebarTab));
}


/* ===== 題型選擇視窗 ===== */
export function openQuizModePicker(){
  const m = document.getElementById("quizModePicker");
  if (!m) return openQuizSettings(); // 沒做選單就走舊流程
  m.classList.remove("hidden"); m.classList.add("flex");
}
export function closeQuizModePicker(){
  const m = document.getElementById("quizModePicker");
  if (m){ m.classList.add("hidden"); m.classList.remove("flex"); }
}

/** 使用者選了題型之後的流程：
 *  1) 設定 QUIZ_PREF.mode
 *  2) 根據題型決定是否需要顯示「測驗設定」(語音/顯示中文翻譯)
 *  3) 然後開始測驗
 */
export function startQuizFlowWithMode(mode){
  QUIZ_PREF.mode = mode || "typing";
  localStorage.setItem("quizPref", JSON.stringify(QUIZ_PREF));
  closeQuizModePicker();

  // 填空題：需要顯示「自動播放 / 題目顯示中文」等設定
  // 其他題型（選擇題/聽力）直接開始，避免多一步
  if (mode === "typing") {
    setTimeout(() => openQuizSettings(), 0);
  } else {
    // 對聽力給個合適的預設：播「單字」
    if (mode === "dictation") {
      QUIZ_PREF.audio = "word";
      QUIZ_PREF.showZh = false;
      localStorage.setItem("quizPref", JSON.stringify(QUIZ_PREF));
    }
    startQuiz(_currentSidebarTab);
  }
}


/* ===== AI 分析 ===== */
export async function handleAnalyzeClick() {
  const btn = document.getElementById("analyzeBtn");
  const text = document.getElementById("articleInput").value.trim();
  if (!text) return alert("請先貼上文章");
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "分析中…";
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("aiResult").classList.add("hidden");

  try {
    const raw = await analyzeArticle(text);
    const rawText = (typeof raw === "string") ? raw : JSON.stringify(raw);
    const words = Array.isArray(raw) ? raw : extractJSON(rawText);

    renderWordSelection(words, text);
    refreshUsageUI();
  } catch (e) {
    console.error(e);
    alert(e?.message || "AI 解析失敗，請稍後再試");
  } finally {
    document.getElementById("loading").classList.add("hidden");
    btn.disabled = false;
    btn.textContent = old;
  }
}


/* 語音圖示（主題色，用於 AI 建議列表「發音」按鈕） */
const ICON_SPEAK = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;

/* ===== AI 建議列表（整潔版；喇叭在第一行右側） ===== */
export function renderWordSelection(words, articleText = "") {
  const container = document.getElementById("wordForm");
  container.innerHTML = "";
  const existing = new Set(getAllWords().map(w => (w.word||"").toLowerCase()));

  // 先把文章切成一句一句
  const sentences = articleText ? splitSentences(articleText) : [];

  words.forEach(w => {
    const keyWord = String(w.word || "").toLowerCase().trim();

    // 先拿 AI 給的 example1，如果沒有或不含該字，就自己從文章裡找
    let exampleFromArticle = w.example1 || "";

    if (keyWord && sentences.length) {
      const hasWord = exampleFromArticle.toLowerCase().includes(keyWord);
      if (!hasWord) {
        const re = new RegExp("\\b" + escapeReg(keyWord) + "\\b", "i");
        const hit = sentences.find(s => re.test(s));
        if (hit) {
          exampleFromArticle = hit.trim();
        }
      }
    }

    // 把修正後的句子寫回物件，之後存單字時也會用這一句
    w.example1 = exampleFromArticle;

    // 外框
    const row = document.createElement("div");
    row.className = "p-3 border rounded bg-white shadow";

    // 勾選框
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.name = "word";
    cb.value = w.word;
    cb.detail = w;          // 這裡的 w 已經帶有修正後的 example1
    cb.className = "mt-1";
    cb.addEventListener("change", updateFabBar);

    // 第一行：左文字（flex-1）+ 右側「發音」按鈕（flex-shrink-0，不換行不重疊）
    const head = document.createElement("div");
    head.className = "flex items-start gap-2 mb-1";

    const headLeft = document.createElement("div");
    headLeft.className = "flex-1 min-w-0";
    headLeft.innerHTML = `
      <strong>${escapeHTML(w.word)}</strong>
      <span class="text-gray-700">(${escapeHTML(posAbbr(w.pos))})</span>
      <span style="word-break:keep-all;">— ${escapeHTML(w.definition)}</span>
    `;

    const headRight = document.createElement("button");
    headRight.type = "button";
    headRight.title = "播放發音";
    headRight.innerHTML = `${ICON_SPEAK} <span>發音</span>`;
    headRight.className = "flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-lg transition whitespace-nowrap mt-0.5";
    headRight.style.cssText = "color:#7C96AB; background:transparent;";
    headRight.addEventListener("mouseenter", () => { headRight.style.background = "#F3F4F1"; headRight.style.color = "#4A4A4A"; });
    headRight.addEventListener("mouseleave", () => { headRight.style.background = "transparent"; headRight.style.color = "#7C96AB"; });
    headRight.addEventListener("click", () => speak(w.word));

    head.appendChild(headLeft);
    head.appendChild(headRight);

    // 內文
    const body = document.createElement("div");
    body.className = "text-sm text-gray-700 space-y-1 mt-1";
    body.innerHTML = `
      ${exampleFromArticle ? `<div><em>文章例句：</em>「${escapeHTML(exampleFromArticle)}」</div>` : ""}
      ${w.example2     ? `<div><em>造句：</em>「${escapeHTML(w.example2)}」</div>` : ""}
      ${w.example2_zh  ? `<div><em>翻譯：</em>${escapeHTML(w.example2_zh)}</div>` : ""}
    `;

    // 佈局：勾選 + 內容
    const label = document.createElement("label");
    label.className = "flex items-start space-x-2";
    label.appendChild(cb);

    const content = document.createElement("div");
    content.className = "flex-1 min-w-0";
    content.appendChild(head);
    content.appendChild(body);
    label.appendChild(content);

    row.appendChild(label);
    container.appendChild(row);

    if (existing.has((w.word||"").toLowerCase())) markRowAsAdded(cb, true);
  });

  document.getElementById("aiResult").classList.remove("hidden");
  updateFabBar();
}


/* ===== 自訂單字：語意辨識並自動填入 ===== */
export async function handleAnalyzeCustom(){
  const article = document.getElementById("articleInput")?.value.trim() || "";
  const term = document.getElementById("customWordInput")?.value.trim() || "";
  if (!term) return alert("請先輸入要分析的單字或片語");

  document.getElementById("customWordEdit")?.classList.remove("hidden");

  try {
    const obj = await analyzeCustomWordAPI(article, term);

    const set = (id, v="") => { const el = document.getElementById(id); if (el) el.value = String(v||""); };
    set("cw_word", obj.word || term);
    set("cw_pos", obj.pos);
    set("cw_def", obj.definition);
    set("cw_level", obj.level || "");

    const exEN = document.getElementById("cw_example_en");
    const exAI = document.getElementById("cw_example_ai");
    const exZH = document.getElementById("cw_example_zh");
    if (exEN) exEN.value = obj.example_in_article || "";
    if (exAI) exAI.value = obj.example_ai || "";
    if (exZH) exZH.value = obj.example_ai_zh || obj.example_in_article_zh || "";
  } catch (err) {
    console.error(err);
    alert("分析失敗，請稍後再試或換較短的片語/單字");
  }
}

/* ===== 自訂新增（手動加入） ===== */
export function handleCustomAdd(){
  const word = document.getElementById("cw_word").value.trim();
  const pos  = document.getElementById("cw_pos").value.trim();
  const definition = document.getElementById("cw_def").value.trim();
  const example1   = document.getElementById("cw_example_en")?.value.trim() || "";
  const example2   = document.getElementById("cw_example_ai")?.value.trim() || "";
  const example2_zh = document.getElementById("cw_example_zh")?.value.trim() || "";
  const level = document.getElementById("cw_level")?.value.trim() || "";
  if (!word || !pos || !definition) return alert("請至少填：英文單字、詞性、中文解釋");

  const res = addWord({ word, pos, definition, example1, example2, example2_zh, level });
  if (!res.added) return alert(`「${word}」已存在`);
  alert(`已加入：${word}`);

  const cb = findCbByWord(word); if (cb) markRowAsAdded(cb, true);
  ["cw_word","cw_pos","cw_def","cw_example_en","cw_example_ai","cw_example_zh","cw_level"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  renderSidebarLists();
}

/* ===== 加入勾選 ===== */
export function handleSaveSelected(){
  const cbs = Array.from(document.querySelectorAll("input[name='word']:checked"));
  const current = getAllWords();
  const exists = new Set(current.map(w => (w.word||"").toLowerCase()));
  let anyAdded = false;

  cbs.forEach(cb => {
    const { word, pos, definition, example1, example2, example2_zh, level } = cb.detail;
    const k = (word||"").toLowerCase();
    if (exists.has(k)) { markRowAsAdded(cb, true); return; }

    const { added } = addWord({
      word, pos, definition,
      example1: example1 || "",
      example2: example2 || "",
      example2_zh: example2_zh || "",
      level: level || ""
    });

    if (added) { markRowAsAdded(cb, false); anyAdded = true; } else { markRowAsAdded(cb, true); }
    exists.add(k);
  });

  // 國考工具模式：新增不自動同步；請用「雲端同步」按鈕

  renderSidebarLists();
  hideFabBar();
  if (anyAdded) onWordAdded();
}

/* ===== 右側列表 + 分頁 ===== */
export function renderSidebarLists(){
  ensureDueForAll();
  renderDueBadge();
  renderListToday();
  renderListDue();
  renderListAll();
  refreshMasteredAndChart();
  refreshSyncUI();
}
function renderDueBadge(){ const n = getDueCount(); const el = document.getElementById("dueCountBadge"); if (el) el.textContent = n; }
function renderListToday(){
  const ul = document.getElementById("sidebarTodayList");
  if (!ul) return;
  ul.innerHTML = "";

  const arr = getTodayWords();
  lastTodayList = arr;

  const totalPages = Math.max(1, Math.ceil(arr.length / TODAY_PAGE_SIZE));
  if (todayPage > totalPages) todayPage = totalPages;

  const start = (todayPage - 1) * TODAY_PAGE_SIZE;
  arr.slice(start, start + TODAY_PAGE_SIZE).forEach(w => ul.appendChild(makeListItem(w)));

  const pager = document.getElementById("todayPager");
  const info  = document.getElementById("todayPageInfo");
  const prev  = document.getElementById("todayPrev");
  const next  = document.getElementById("todayNext");

  const onTab = !ul.classList.contains("hidden");
  if (pager) pager.classList.toggle("hidden", !onTab || arr.length <= TODAY_PAGE_SIZE);

  if (info) info.textContent = `第 ${todayPage} / ${totalPages} 頁`;
  if (prev) prev.disabled = todayPage <= 1;
  if (next) next.disabled = todayPage >= totalPages;
}

function renderListDue(){
  const ul = document.getElementById("sidebarDueList");
  if (!ul) return;
  ul.innerHTML = "";

  const arr = getDueWords();
  lastDueList = arr;

  const totalPages = Math.max(1, Math.ceil(arr.length / DUE_PAGE_SIZE));
  if (duePage > totalPages) duePage = totalPages;

  const start = (duePage - 1) * DUE_PAGE_SIZE;
  arr.slice(start, start + DUE_PAGE_SIZE).forEach(w => ul.appendChild(makeListItem(w, { reviewMode: true })));

  const pager = document.getElementById("duePager");
  const info  = document.getElementById("duePageInfo");
  const prev  = document.getElementById("duePrev");
  const next  = document.getElementById("dueNext");

  const onTab = !ul.classList.contains("hidden");
  if (pager) pager.classList.toggle("hidden", !onTab || arr.length <= DUE_PAGE_SIZE);

  if (info) info.textContent = `第 ${duePage} / ${totalPages} 頁`;
  if (prev) prev.disabled = duePage <= 1;
  if (next) next.disabled = duePage >= totalPages;
}


function renderListAll(){
  const ul = document.getElementById("sidebarAllList"); if (!ul) return; ul.innerHTML = "";
  const { q, pos, level, sort } = readAllFilters(); let arr = getAllWords();
  if (q){ const qq = q.toLowerCase(); arr = arr.filter(w => (w.word||"").toLowerCase().includes(qq) || (w.definition||"").toLowerCase().includes(qq)); }
  if (pos) arr = arr.filter(w => (w.pos||"").toLowerCase() === pos.toLowerCase());
  if (level) arr = arr.filter(w => (w.level||"").toUpperCase() === level.toUpperCase());
  if (sort === "recent") arr.sort((a,b)=> new Date(b.addedAt)-new Date(a.addedAt));
  if (sort === "oldest") arr.sort((a,b)=> new Date(a.addedAt)-new Date(b.addedAt));
  if (sort === "alpha")  arr.sort((a,b)=> (a.word||"").localeCompare(b.word||""));
  if (sort === "level")  arr.sort((a,b)=> (a.level||"").localeCompare(b.level||""));
  lastAllFiltered = arr;
  const totalPages = Math.max(1, Math.ceil(arr.length / ALL_PAGE_SIZE));
  if (allPage > totalPages) allPage = totalPages;
  const start = (allPage-1) * ALL_PAGE_SIZE;
  arr.slice(start, start + ALL_PAGE_SIZE).forEach(w => ul.appendChild(makeListItem(w)));
  const pager = document.getElementById("allPager"); const info = document.getElementById("allPageInfo");
  if (pager && info){ const onAll = !document.getElementById("sidebarAllList").classList.contains("hidden"); pager.classList.toggle("hidden", !onAll); info.textContent = `第 ${allPage} / ${totalPages} 頁`; const prev = document.getElementById("allPrev"), next = document.getElementById("allNext"); if (prev) prev.disabled = allPage <= 1; if (next) next.disabled = allPage >= totalPages; }
}
function readAllFilters(){ return { q: document.getElementById("allSearch")?.value.trim() || "", pos: document.getElementById("allPos")?.value || "", level: document.getElementById("allLevel")?.value || "", sort: document.getElementById("allSort")?.value || "recent" }; }
export function switchSidebarTab(which){
  _currentSidebarTab = which === "today" ? "today" : which === "due" ? "due" : which === "all" ? "all" : "mixed";

  const tToday = document.getElementById("tabToday");
  const tDue   = document.getElementById("tabDue");
  const tAll   = document.getElementById("tabAll");

  const lToday = document.getElementById("sidebarTodayList");
  const lDue   = document.getElementById("sidebarDueList");
  const lAll   = document.getElementById("sidebarAllList");

  const filters   = document.getElementById("allFilters");
  const pagerAll  = document.getElementById("allPager");
  const pagerToday= document.getElementById("todayPager");
  const pagerDue  = document.getElementById("duePager");

  [tToday,tDue,tAll].forEach(b=>b && b.classList.remove("bg-gray-100"));
  [lToday,lDue,lAll].forEach(x=>x && x.classList.add("hidden"));

  if (filters) filters.classList.add("hidden");
  [pagerAll,pagerToday,pagerDue].forEach(p => p && p.classList.add("hidden"));

  if (which === "today"){
    tToday && tToday.classList.add("bg-gray-100");
    lToday && lToday.classList.remove("hidden");
    renderListToday(); // ✅ 這裡會自己決定 todayPager 要不要顯示
  }
  else if (which === "due"){
    tDue && tDue.classList.add("bg-gray-100");
    lDue && lDue.classList.remove("hidden");
    renderListDue();   // ✅ 這裡會自己決定 duePager 要不要顯示
  }
  else {
    tAll && tAll.classList.add("bg-gray-100");
    lAll && lAll.classList.remove("hidden");
    if (filters) filters.classList.remove("hidden");
    renderListAll();   // 你原本的：renderListAll 會自己處理 allPager
  }
}

export function gotoAllPrev(){
  if (allPage > 1){
    allPage--;
    renderListAll();
    document.getElementById("sidebarAllList")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function gotoAllNext(){
  const totalPages = Math.max(1, Math.ceil((lastAllFiltered?.length || 0) / ALL_PAGE_SIZE));
  if (allPage < totalPages){
    allPage++;
    renderListAll();
    document.getElementById("sidebarAllList")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function gotoTodayPrev(){
  if (todayPage > 1){
    todayPage--;
    renderListToday();
    document.getElementById("sidebarTodayList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
export function gotoTodayNext(){
  const totalPages = Math.max(1, Math.ceil((lastTodayList?.length || 0) / TODAY_PAGE_SIZE));
  if (todayPage < totalPages){
    todayPage++;
    renderListToday();
    document.getElementById("sidebarTodayList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function gotoDuePrev(){
  if (duePage > 1){
    duePage--;
    renderListDue();
    document.getElementById("sidebarDueList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
export function gotoDueNext(){
  const totalPages = Math.max(1, Math.ceil((lastDueList?.length || 0) / DUE_PAGE_SIZE));
  if (duePage < totalPages){
    duePage++;
    renderListDue();
    document.getElementById("sidebarDueList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}



// ===== AI 記憶輔助懸浮窗 =====

// 計算某單字的累計答錯次數（從 reviewLogs 讀取）
function getWrongCount(word) {
  try {
    const logs = JSON.parse(localStorage.getItem("reviewLogs") || "[]");
    const key = (word || "").toLowerCase();
    return logs.filter(l => (l.word || "").toLowerCase() === key && !l.correct).length;
  } catch { return 0; }
}

// 記憶輔助內容快取（localStorage）
const _MNEMONIC_CACHE_KEY = "mnemonic_cache";
function _getMnemonicCache() {
  try { return JSON.parse(localStorage.getItem(_MNEMONIC_CACHE_KEY) || "{}"); } catch { return {}; }
}
function _setMnemonicCache(word, data) {
  const c = _getMnemonicCache();
  c[(word || "").toLowerCase()] = data;
  localStorage.setItem(_MNEMONIC_CACHE_KEY, JSON.stringify(c));
}

async function _fetchMnemonic(word, options = {}) {
  const { regen = false, prevMnemonic = null } = options;
  const cache = _getMnemonicCache();
  const hit = cache[(word || "").toLowerCase()];
  if (hit && !regen) return hit;

  const payload = { action: "mnemonicWord", term: word };
  if (regen) payload.regen = true;
  if (regen && prevMnemonic) payload.prevMnemonic = prevMnemonic;

  const res = await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API 錯誤");

  const raw = typeof data.content === "string"
    ? data.content.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
    : data.content;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  _setMnemonicCache(word, parsed);
  return parsed;
}

function _renderMnemonicBody(word, body, regenOptions = null) {
  body.innerHTML = `<div class="mnemonic-loading"><span class="mnemonic-dot"></span><span class="mnemonic-dot"></span><span class="mnemonic-dot"></span></div>`;

  const toChips = (str, cls) =>
    (str || "").split(",")
      .map(s => s.trim()).filter(s => s && s !== "無")
      .map(s => `<span class="mnemonic-chip${cls ? " " + cls : ""}">${escapeHTML(s)}</span>`)
      .join("");

  _fetchMnemonic(word, regenOptions || {})
    .then(d => {
      const parts = (d.daily_example || "").split(" | ");
      const eng = parts[0] || "";
      const zh  = parts[1] || "";
      const synChips = toChips(d.synonyms || "");
      const antChips = toChips(d.antonyms || "", "mnemonic-chip--ant");

      body.innerHTML = `
        <div class="mnemonic-section">
          <div class="mnemonic-label">語源拆解</div>
          <div class="mnemonic-text">${escapeHTML(d.etymology || "")}</div>
        </div>
        <div class="mnemonic-section">
          <div class="mnemonic-label">記憶口訣</div>
          <div class="mnemonic-text mnemonic-highlight">${escapeHTML(d.mnemonic || "")}</div>
        </div>
        <div class="mnemonic-section">
          <div class="mnemonic-label">生活例句</div>
          <div class="mnemonic-text">${escapeHTML(eng)}</div>
          ${zh ? `<div class="mnemonic-text mnemonic-zh">${escapeHTML(zh)}</div>` : ""}
        </div>
        ${synChips ? `<div class="mnemonic-section"><div class="mnemonic-label">同義字</div><div class="mnemonic-chips">${synChips}</div></div>` : ""}
        ${antChips ? `<div class="mnemonic-section"><div class="mnemonic-label">反義字</div><div class="mnemonic-chips">${antChips}</div></div>` : ""}
        <div class="mnemonic-regen-row">
          <button class="mnemonic-regen" id="mnemonicRegen">沒感覺，換一個</button>
        </div>`;

      document.getElementById("mnemonicRegen")?.addEventListener("click", () => {
        _renderMnemonicBody(word, body, { regen: true, prevMnemonic: d.mnemonic });
      });
    })
    .catch(err => {
      body.innerHTML = `<div class="mnemonic-error">無法生成輔助記憶：${escapeHTML(err.message)}</div>`;
    });
}

export function showMnemonicModal(word) {
  const modal = document.getElementById("mnemonicModal");
  const title = document.getElementById("mnemonicTitle");
  const body  = document.getElementById("mnemonicBody");
  if (!modal) return;

  title.textContent = word;
  title.onclick = (e) => { e.stopPropagation(); speak(word); };
  modal.classList.remove("hidden");
  _renderMnemonicBody(word, body);
}

export function closeMnemonicModal() {
  document.getElementById("mnemonicModal")?.classList.add("hidden");
}

// ===== 右側清單：可展開詳情（Morandi 扁平化） =====

// SVG 圖示（Lucide outline 風格）
const ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const ICON_SAVE  = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;

function makeListItem(w, opts = {}) {
  const li = document.createElement("li");
  li.dataset.word = (w.word || "").toLowerCase();

  // ── 標題行 ──
  const header = document.createElement("div");
  header.className = "wc-header";

  // 複習 Checkbox（僅限 today / due tab）
  if (opts.showReview) {
    const reviewCb = document.createElement("input");
    reviewCb.type = "checkbox";
    reviewCb.style.cssText = "flex-shrink:0;width:13px;height:13px;accent-color:#7C96AB;cursor:pointer;";
    reviewCb.title = "標記複習完成";
    reviewCb.addEventListener("click", (e) => {
      e.stopPropagation();
      scheduleNext(w.word, true);
      renderSidebarLists();
    });
    header.appendChild(reviewCb);
  }

  // 單字標題：word 獨立一行（block），pos+def 為獨立 meta row
  const titleArea = document.createElement("div");
  titleArea.className = "wc-title";
  titleArea.style.cssText = "flex:1;min-width:0;";
  titleArea.innerHTML =
    `<strong class="wc-word">${escapeHTML(w.word)}</strong>` +
    `<div class="wc-meta">` +
      `<span class="wc-pos">${escapeHTML(posAbbr(w.pos) || "")}</span>` +
      `<span class="wc-def">— ${escapeHTML(w.definition || "")}</span>` +
    `</div>`;

  // 單字文字點擊：播放發音；stopPropagation 防止觸發父層收闔
  titleArea.querySelector(".wc-word").addEventListener("click", (e) => {
    e.stopPropagation();
    speak(w.word);
  });

  // 展開箭頭
  const arrow = document.createElement("span");
  arrow.className = "wc-arrow";
  arrow.textContent = "▸";

  header.appendChild(titleArea);
  header.appendChild(arrow);

  // ── 詳情區 ──
  const details = document.createElement("div");
  details.className = "wc-body hidden";

  const exArticle = w.example1 || w.example_in_article || "";
  const exMake    = w.example2 || w.example_ai || "";
  const exZh      = w.example2_zh || w.example_ai_zh || "";

  // 1. 文章例句（正常字體，次要文字色 #7A7A7A，line-height 1.6）
  if (exArticle) {
    const artEx = document.createElement("p");
    artEx.className = "wc-article";
    artEx.textContent = `"${exArticle}"`;
    details.appendChild(artEx);
  }

  // 3. AI 助教解析區塊（移除標題行，直接從「造句」開始）
  if (exMake || exZh) {
    const aiSection = document.createElement("div");
    aiSection.className = "wc-ai";

    if (exMake) {
      const makeLine = document.createElement("p");
      makeLine.className = "wc-ai-text";
      makeLine.textContent = exMake;
      aiSection.appendChild(makeLine);
    }
    if (exZh) {
      const zhLine = document.createElement("p");
      zhLine.className = "wc-ai-zh";
      zhLine.textContent = exZh;
      aiSection.appendChild(zhLine);
    }
    details.appendChild(aiSection);
  }

  // 4. 複習模式：AI 記憶輔助按鈕（全部顯示）
  if (opts.reviewMode) {
    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "wc-ai-help";
    helpBtn.textContent = "幫助複習";
    helpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showMnemonicModal(w.word);
    });
    details.appendChild(helpBtn);
  }

  // 5. 底部操作列（僅在有存檔按鈕時才顯示，複習模式略過）
  if (opts.showReview && !opts.reviewMode) {
    const btnRow = document.createElement("div");
    btnRow.className = "wc-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.setAttribute("data-act", "review");
    saveBtn.className = "wc-btn-save";
    saveBtn.innerHTML = `${ICON_SAVE} 存檔`;
    btnRow.appendChild(saveBtn);
    details.appendChild(btnRow);
  }

  // 點標題行切換展開
  header.addEventListener("click", (e) => {
    if (e.target.closest("button, input")) return;
    details.classList.toggle("hidden");
    arrow.textContent = details.classList.contains("hidden") ? "▸" : "▾";
  });

  details.querySelector("[data-act='review']")?.addEventListener("click", () => {
    scheduleNext(w.word, true);
    renderSidebarLists();
  });

  const row = document.createElement("div");
  row.className = "wc-card";
  row.appendChild(header);
  row.appendChild(details);

  // 字卡右下角刪除按鈕（hover 才顯示；複習模式下不顯示）
  if (!opts.reviewMode) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "wc-del-corner";
    delBtn.title = "刪除此單字";
    delBtn.innerHTML = ICON_TRASH;
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const deleted = deleteWord(w.word);
      if (deleted) {
        lastDeleted = deleted;
        showUndoToast(`已刪除「${w.word}」`);
        unmarkRowByWord(w.word);
        renderSidebarLists();
      }
    });
    row.appendChild(delBtn);
  }

  li.appendChild(row);
  return li;
}

function showUndoToast(text){ const toast = document.getElementById("undoToast"); document.getElementById("undoText").textContent = text; toast.classList.remove("hidden"); clearTimeout(showUndoToast._tid); showUndoToast._tid = setTimeout(()=> toast.classList.add("hidden"), 4000); }
export function undoLastDelete(){ const toast = document.getElementById("undoToast"); if (!lastDeleted) return toast.classList.add("hidden"); const all = getAllWords(); all.push(lastDeleted); saveAllWords(all); const cb = findCbByWord(lastDeleted.word); if (cb) markRowAsAdded(cb, true); lastDeleted = null; toast.classList.add("hidden"); renderSidebarLists(); }

/* ===== FAB ===== */
function updateFabBar(){ const count = document.querySelectorAll("input[name='word']:checked").length; const bar = document.getElementById("fabBar"); document.getElementById("fabCount").textContent = String(count); bar.classList.toggle("hidden", count === 0); }
function hideFabBar(){ document.getElementById("fabBar").classList.add("hidden"); }

/* ===== AI 卡片標示/復原 ===== */
export function markRowAsAdded(cb, already) {
  try { speechSynthesis.cancel(); } catch (_) {}
  cb.disabled = true;
  cb.checked = false;
  updateFabBar?.();
  const card = cb._card || cb.closest(".p-3, .ai-card, .word-row") || cb.closest("div");
  if (!card) return;

  card.classList.add("pointer-events-none");
  card.style.cssText += "background:#F0F0F0;opacity:0.55;";

  if (!card.querySelector(".ai-mark-tip")) {
    const tip = document.createElement("span");
    tip.className = "ai-mark-tip";
    tip.style.cssText =
      "display:inline-flex;align-items:center;gap:3px;" +
      "margin-left:8px;padding:2px 9px;border-radius:999px;" +
      "background:#A3B18A;color:#fff;" +
      "font-size:.72rem;font-weight:700;white-space:nowrap;";
    tip.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${already ? "已存在" : "已加入"}`;
    card.appendChild(tip);
  }
}

export function unmarkRowByWord(word) {
  const cb = (typeof findCbByWord === "function") ? findCbByWord(word) : null;
  if (!cb) return;

  cb.disabled = false;
  cb.checked = false;
  updateFabBar?.();

  const card = cb._card || cb.closest(".p-3, .ai-card, .word-row") || cb.closest("div");
  if (card) {
    card.classList.remove("pointer-events-none");
    card.style.background = "";
    card.style.opacity = "";
    const tip = card.querySelector(".ai-mark-tip");
    if (tip) tip.remove();
  }
}

function findCbByWord(word){ const v = (window.CSS && CSS.escape) ? CSS.escape(word) : String(word).replace(/["\\]/g, "\\$&"); return document.querySelector(`input[name="word"][value="${v}"]`); }

/* ===== 測驗（集中：buildTypingQuestion 來自 quiz.js） ===== */
export function startQuiz(mode){
const resolvedMode = mode || _currentSidebarTab || "mixed";
const DESIRED = 15;
const DESIRED_ALL = 20;

// Fisher–Yates shuffle
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const pushUnique = (pool, queue, seen, limit) => {
  for (const w of pool) {
    const k = (w.word || "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    queue.push(w);
    if (queue.length >= limit) break;
  }
};

const queue = [];
const seen = new Set();

if (resolvedMode === "today") {
  // 僅測今日新增單字
  const todayPool = shuffle(getTodayWords().slice());
  if (!todayPool.length) return alert("今日尚無新增單字");
  pushUnique(todayPool, queue, seen, DESIRED);

} else if (resolvedMode === "all") {
  // 從全部單字隨機抽 20 筆
  const allPool = shuffle(getAllWords().slice());
  if (!allPool.length) return alert("清單是空的，先新增幾個單字吧！");
  pushUnique(allPool, queue, seen, DESIRED_ALL);

} else {
  // 'due' 或 'mixed'：優先複習到期，不足再補今日、全部
  const dueSorted = getDueWords()
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
  const duePool   = shuffle(dueSorted.slice(0, Math.max(DESIRED * 4, 60)));
  const todayPool = shuffle(getTodayWords().slice());
  const allPool   = shuffle(getAllWords().slice());

  pushUnique(duePool,   queue, seen, DESIRED);
  if (queue.length < DESIRED) pushUnique(todayPool, queue, seen, DESIRED);
  if (queue.length < DESIRED) pushUnique(allPool,   queue, seen, DESIRED);
  if (!queue.length) return alert("清單是空的，先新增幾個單字吧！");
}

if (!queue.length) return alert("清單是空的，先新增幾個單字吧！");

// 更新測驗 modal 標題標籤
const LABEL_MAP = { today: "今日挑戰", due: "複習模式", all: "全能抽測", mixed: "複習模式" };
const labelEl = document.getElementById("quizModeLabel");
if (labelEl) labelEl.textContent = LABEL_MAP[resolvedMode] || "";


  quizQueue = queue;
  lastQuizQueue = quizQueue.slice();
  quizIndex = 0; quizScore = 0; wrongAnswers = []; quizAwaitingNext = false;

  const modal = document.getElementById("quizModal");
  modal.classList.remove("hidden"); modal.classList.add("flex");
  document.getElementById("quizFeedback").textContent = "";
  showQuizQuestion();

  if (!_quizEnterHandlerBound){
    document.addEventListener("keydown", (e)=> {
      if (e.key !== "Enter") return;
  
      const modal = document.getElementById("quizModal");
      if (!modal || modal.classList.contains("hidden")) return; // 只在測驗視窗開啟時生效
  
      e.preventDefault();
      if (quizAwaitingNext) nextQuizStep();
      else submitQuizAnswer(false);
    }, true);
  
    _quizEnterHandlerBound = true;
  }

}

// js/ui.js ─ 取代原本的 showQuizQuestion()
function showQuizQuestion(){
  const w = quizQueue[quizIndex];
  const mode = (QUIZ_PREF.mode || "typing");

  let q = null;

  if (mode === "choice_en2zh") {
    q = makeChoiceQuestion(w, "en2zh", getAllWords());
    document.getElementById("quizPrompt").innerHTML = `
      <div class="space-y-2">
        <div>${q.stem}</div>
        <div class="space-y-2">
          ${q.options.map((opt, i) => `
            <label class="flex items-center gap-2">
              <input type="radio" name="quizOpt" value="${i}">
              <span>${opt}</span>
            </label>`).join("")}
        </div>
      </div>`;
    // 選擇題：隱藏輸入框
    const input = document.getElementById("quizAnswer");
    input.classList.add("hidden"); input.value = ""; input.disabled = true;
    document.getElementById("quizSubmit").classList.remove("hidden");
    document.getElementById("quizIDK").classList.remove("hidden");
    document.getElementById("quizNext").classList.add("hidden");
  }
  else if (mode === "choice_zh2en") {
    q = makeChoiceQuestion(w, "zh2en", getAllWords());
    document.getElementById("quizPrompt").innerHTML = `
      <div class="space-y-2">
        <div>${q.stem}</div>
        <div class="space-y-2">
          ${q.options.map((opt, i) => `
            <label class="flex items-center gap-2">
              <input type="radio" name="quizOpt" value="${i}">
              <span>${opt}</span>
            </label>`).join("")}
        </div>
      </div>`;
    const input = document.getElementById("quizAnswer");
    input.classList.add("hidden"); input.value = ""; input.disabled = true;
    document.getElementById("quizSubmit").classList.remove("hidden");
    document.getElementById("quizIDK").classList.remove("hidden");
    document.getElementById("quizNext").classList.add("hidden");
  }
  else if (mode === "dictation") {
    q = makeDictationQuestion(w, QUIZ_PREF.audio === "sentence" ? "sentence" : "word");
    document.getElementById("quizPrompt").innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <button id="qPlay" class="px-2 py-1 rounded border inline-flex items-center gap-1" style="color:#8F9A78;border-color:#8F9A78;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> 播放</button>
          <span class="text-sm text-gray-500">聽完輸入答案</span>
        </div>
        ${q.hintZh ? `<div class="text-sm text-amber-700">提示：${q.hintZh}</div>` : ""}
      </div>`;
    // 顯示輸入框
    const input = document.getElementById("quizAnswer");
    input.placeholder = "輸入你聽到的英文…";
    input.classList.remove("hidden"); input.disabled = false; input.value = ""; input.focus();
    document.getElementById("quizSubmit").classList.remove("hidden");
    document.getElementById("quizIDK").classList.remove("hidden");
    document.getElementById("quizNext").classList.add("hidden");

    // 立即/手動播放
    document.getElementById("qPlay")?.addEventListener("click", () => speak(q.speak));
    //try { speak(q.speak); } catch {}
  }
  else { // typing（原本的填空）
    q = buildTypingQuestion(w, { showZh: !!QUIZ_PREF.showZh });
    document.getElementById("quizPrompt").innerHTML = `
      <div class="space-y-1">
        <div>請輸入對應的英文單字：</div>
        <div class="p-3 bg-gray-50 rounded">${q.definition || "(無中文解釋)"}</div>
        ${q.maskedExample ? `<div class="text-sm text-gray-600">例句：${q.maskedExample}</div>` : ""}
        ${q.exampleZh ? `<div class="text-sm text-amber-700">翻譯：${q.exampleZh}</div>` : ""}
      </div>`;
    const input = document.getElementById("quizAnswer");
    input.placeholder = "輸入英文單字…";
    input.classList.remove("hidden"); input.disabled = false; input.value = ""; input.focus();
    document.getElementById("quizSubmit").classList.remove("hidden");
    document.getElementById("quizIDK").classList.remove("hidden");
    document.getElementById("quizNext").classList.add("hidden");
  }

  // 把題目物件存起來給評分用
  w._q = q;

  const prog = document.getElementById("quizProgress");
  if (prog) prog.textContent = `（${quizIndex+1}/${quizQueue.length}）`;
}


// js/ui.js ─ 取代原本的 submitQuizAnswer()
export function submitQuizAnswer(asWrong = false) {
  if (_submittingAnswer) return; // 防重入
  _submittingAnswer = true;

  try {
    // 若已在等待下一題，直接忽略（避免 Enter 連發）
    if (quizAwaitingNext) return;

    const w = quizQueue[quizIndex];
    const q = w?._q;
    const mode = (QUIZ_PREF?.mode || "typing");

    let userInput = "";
    let correct = false;

    if (typeof mode === "string" && mode.startsWith("choice_")) {
      const chosen = document.querySelector('input[name="quizOpt"]:checked');
      const picked = chosen ? Number(chosen.value) : NaN;

      if (!chosen && !asWrong) {
        alert("請先選一個選項");
        return; // ✅ finally 會解鎖
      }

      const g = grade(q, asWrong ? -1 : picked);
      correct = !!g.correct;
      userInput = chosen ? (chosen.parentElement?.innerText || "").trim() : "";
    } else {
      const inputEl = document.getElementById("quizAnswer");
      userInput = (inputEl?.value || "").trim().toLowerCase();

      const g = grade(q, asWrong ? "" : userInput);
      correct = !!g.correct || (!asWrong && userInput === (w.word || "").toLowerCase());
    }
 

    // ✅ 間隔複習排程
    scheduleNext(w.word, !!correct);

    // ✅ feedback
    const fb = document.getElementById("quizFeedback");
    if (correct) {
      quizScore++;
      if (fb) fb.innerHTML = `<span class="text-green-600">正確！</span>`;
    } else {
      if (fb) fb.innerHTML =
        `<span class="text-red-600">錯誤，答案是 <strong>${w.word}</strong></span>`;

      const pairForWrong = pickExamplePair(w, { showZh: !!QUIZ_PREF.showZh });
      wrongAnswers.push({
        word: w.word,
        your: userInput || "(空白)",
        correct: w.word,
        definition: w.definition || "",
        example: pairForWrong?.en || ""
      });
    }

    // ✅ 答後語音（略，保留你原本那段）
    try {
      const seq = afterAnswerSpeech(mode, w, q, { audio: QUIZ_PREF.audio, showZh: !!QUIZ_PREF.showZh });
      if (seq && seq.length) {
        speakSequence(seq);
      } else {
        const audioMode = (QUIZ_PREF.audio || "none");
        if (audioMode !== "none") {
          const texts = [];
          if ((audioMode === "word" || audioMode === "both") && w?.word) texts.push(w.word);
          const pair = pickExamplePair(w, { showZh: !!QUIZ_PREF.showZh });
          const sentence = pair?.en || "";
          if ((audioMode === "sentence" || audioMode === "both") && sentence) texts.push(sentence);
          if (texts.length) speakSequence(texts);
        }
      }
    } catch {}

    // ✅ 下一步 UI
    quizAwaitingNext = true;

    const input = document.getElementById("quizAnswer");
    if (input) input.disabled = true;

    document.getElementById("quizNext")?.classList.remove("hidden");
    document.getElementById("quizSubmit")?.classList.add("hidden");
    document.getElementById("quizIDK")?.classList.add("hidden");

    renderSidebarLists?.();

  } finally {
    _submittingAnswer = false; // ✅ 不管中途 return / throw 都會解鎖
  }
}

export function closeQuiz(){ const modal = document.getElementById("quizModal"); modal.classList.add("hidden"); modal.classList.remove("flex"); }
function nextQuizStep(){
  quizIndex++;
  if (quizIndex < quizQueue.length) {
    document.getElementById("quizFeedback").textContent = "";
    quizAwaitingNext = false;
    showQuizQuestion();
    return;
  }
  showQuizSummary();
}

// ui.js
function showQuizSummary(){
  const total = quizQueue.length || 0;
  const right = quizScore || 0;
  const wrong = Math.max(0, total - right);
  const acc = total ? Math.round((right/total)*100) : 0;

  // 只有選擇題模式才隱藏錯題詳情
  const mode = (typeof QUIZ_PREF === "object" && QUIZ_PREF.mode) ? QUIZ_PREF.mode : "typing";
  const isChoiceMode = mode === "choice_en2zh" || mode === "choice_zh2en";

  // 對於非選擇題，建立錯題表格（顯示你的答案/正確答案）
  let wrongHTML = "";
  if (!isChoiceMode && wrong > 0 && Array.isArray(wrongAnswers) && wrongAnswers.length){
    const rows = wrongAnswers.map((w,i)=>`
      <tr class="${i % 2 ? 'bg-gray-50' : ''}">
        <td class="px-2 py-1 text-center">${i+1}</td>
        <td class="px-2 py-1 text-rose-700 break-words">${w.your || "(空白)"}</td>
        <td class="px-2 py-1 text-green-700 break-words">${w.correct || w.word || ""}</td>
      </tr>
    `).join("");

    wrongHTML = `
      <div class="text-sm">
        <div class="mb-1">你錯了這些題目：</div>
        <div class="overflow-auto max-h-56 border rounded">
          <table class="w-full text-sm">
            <thead class="bg-gray-100 sticky top-0">
              <tr>
                <th class="px-2 py-1 w-10">#</th>
                <th class="px-2 py-1">你的答案</th>
                <th class="px-2 py-1">正確答案</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  const prompt = document.getElementById("quizPrompt");
  prompt.innerHTML = `
    <div class="space-y-3">
      <div class="text-lg sidebar-title">測驗完成</div>
      <div class="text-sm text-gray-700">
        總題數：${total}　答對：${right}　答錯：${wrong}　正確率：${acc}%
      </div>
      ${isChoiceMode
        ? "" // 選擇題不顯示任何錯題詳情
        : (wrongHTML || `<div class="text-sm" style="color:#8F9A78;">太強了！全對</div>`)}
      <div class="flex gap-2 pt-2">
        <button id="quizRetakeWrong" class="px-3 py-2 rounded quiz-btn-next disabled:opacity-50" ${wrong===0?'disabled':''}>只重測錯題</button>
        <button id="quizRetakeAll" class="px-3 py-2 rounded quiz-btn-primary">全部重測</button>
      </div>
    </div>`;

  const input = document.getElementById("quizAnswer");
  input.value = ""; input.disabled = true; input.classList.add("hidden");
  document.getElementById("quizSubmit").classList.add("hidden");
  document.getElementById("quizIDK").classList.add("hidden");
  document.getElementById("quizNext").classList.add("hidden");
  document.getElementById("quizFeedback").textContent = "";

  document.getElementById("quizRetakeWrong")?.addEventListener("click", retakeWrong);
  document.getElementById("quizRetakeAll")?.addEventListener("click", retakeAll);

  // PixelPet: react to quiz result (pass threshold: 60%)
  onReviewComplete(acc >= 60, acc === 100);
}


function retakeWrong(){
  if (!wrongAnswers.length) return;
  const set = new Set(wrongAnswers.map(x => String(x.word || "").toLowerCase()));
  let queue = lastQuizQueue.filter(w => set.has(String(w.word||"").toLowerCase()));
  if (!queue.length && typeof getAllWords === "function") {
    queue = getAllWords().filter(w => set.has(String(w.word||"").toLowerCase()));
  }
  startRetakeWith(queue);
}

function retakeAll(){
  const seen = new Set();
  const queue = [];
  const push = (list=[]) => {
    for (const w of list) {
      const k = String(w.word || "").toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      queue.push(w);
    }
  };

  const due   = typeof getDueWords   === "function" ? getDueWords().sort((a,b)=> new Date(a.dueAt||0) - new Date(b.dueAt||0)) : [];
  const today = typeof getTodayWords === "function" ? getTodayWords() : [];
  const all   = typeof getAllWords   === "function" ? getAllWords() : [];

  push(due);
  push(today);
  push(all);

  if (!queue.length) { alert("清單是空的，先新增幾個單字吧！"); return; }
  startRetakeWith(queue);
}

function startRetakeWith(queue){
  if (!queue || !queue.length) return;

  quizQueue = queue.slice();
  lastQuizQueue = quizQueue.slice();

  quizIndex = 0;
  quizScore = 0;
  wrongAnswers = [];
  quizAwaitingNext = false;

  document.getElementById("quizFeedback").textContent = "";

  const input = document.getElementById("quizAnswer");
  input.classList.remove("hidden"); input.disabled = false; input.value = ""; input.focus();
  document.getElementById("quizSubmit").classList.remove("hidden");
  document.getElementById("quizIDK").classList.remove("hidden");
  document.getElementById("quizNext").classList.add("hidden");

  showQuizQuestion();
}

/* ===== Header／統計 ===== */
function refreshMasteredAndChart(){
  const m = getMasteredCount(4); const badge = document.getElementById("masteredBadge"); if (badge) badge.textContent = m;
  updatePetDisplay();
}

/* ===== Sync 狀態（dirty / lastSync） ===== */
export function refreshSyncUI(){
  const { dirty = 0, lastSyncAt = 0 } = getSyncMeta() || {};
  const dirtyEl = document.getElementById("dirtyBadge");
  if (dirtyEl) dirtyEl.textContent = String(dirty);

  const lastEl = document.getElementById("lastSyncBadge");
  if (lastEl){
    if (!lastSyncAt) {
      lastEl.textContent = "尚未同步";
    } else {
      const d = new Date(Number(lastSyncAt));
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,"0");
      const day = String(d.getDate()).padStart(2,"0");
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");
      lastEl.textContent = `${y}-${m}-${day} ${hh}:${mm}`;
    }
  }
}

/* ===== Usage 面板 ===== */
export function refreshUsageUI(){
  const s = getUsageSummary(); const budget = getUsageBudget(); const cost = (s.cost||0);
  const badge = document.getElementById("usageCostBadge"); if (badge){ badge.textContent = Math.ceil(cost); const over = budget != null && budget > 0 && cost >= budget; badge.parentElement?.classList.toggle("text-yellow-200", over && cost < (budget*1.2)); badge.parentElement?.classList.toggle("text-red-200", over && cost >= (budget*1.2)); }
  const elCost = document.getElementById("usageCostTotal"), elP = document.getElementById("usagePromptTokens"), elC = document.getElementById("usageCompletionTokens"), box = document.getElementById("usagePerModel");
  if (elCost) elCost.textContent = Math.ceil(cost); if (elP) elP.textContent = (s.prompt_tokens||0).toLocaleString(); if (elC) elC.textContent = (s.completion_tokens||0).toLocaleString();
  if (box){ box.innerHTML = ""; const models = s.perModel || {}; Object.keys(models).forEach(m=>{ const r = models[m]; const div = document.createElement("div"); div.textContent = `${m} — NT$${Math.ceil(r.cost||0)} · P:${(r.prompt||0).toLocaleString()} / C:${(r.completion||0).toLocaleString()}`; box.appendChild(div); }); if (!Object.keys(models).length){ const div = document.createElement("div"); div.className="text-gray-500"; div.textContent = "尚無資料"; box.appendChild(div); } }
}
export function openUsageModal(){ const input = document.getElementById("usageBudgetInput"); const b = getUsageBudget(); if (input) input.value = b!=null?String(b):""; refreshUsageUI(); const m = document.getElementById("usageModal"); m?.classList.remove("hidden"); m?.classList.add("flex"); }
export function closeUsageModal(){ const m = document.getElementById("usageModal"); m?.classList.add("hidden"); m?.classList.remove("flex"); }
export function saveUsageBudget(){ const v = Number(document.getElementById("usageBudgetInput")?.value); if (isNaN(v)) return alert("請輸入數字（TWD）"); setUsageBudget(v); refreshUsageUI(); alert("已儲存每月預算"); }
export function resetUsage(){ resetUsageMonth(); refreshUsageUI(); alert("已重置本月估算（不影響 Gemini 真實用量）"); }

// ===== 匯出 / 匯入 JSON：備份單字清單 =====
export function handleExportJson() {
  const words = getAllWords();
  if (!words.length) {
    alert("目前沒有任何單字可以匯出。");
    return;
  }

  const blob = new Blob([JSON.stringify(words, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  a.href = url;
  a.download = `word-garden-${y}${m}${d}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function handleImportJsonClick() {
  const input = document.getElementById("importJsonFile");
  if (!input) {
    alert("找不到匯入用的檔案選擇器（importJsonFile）。");
    return;
  }

  // 每次匯入前清空，避免舊檔案殘留
  input.value = "";
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importJsonFile(file);
  };

  input.click();
}

export async function handleLoadSheets(){
  const ok = confirm(
    "這會用「Google Sheet（雲端）」覆蓋本機資料（localStorage）。\n\n確定要從雲端載入嗎？"
  );
  if (!ok) return;

  try {
    const mod = await import("./sheets_bootstrap.js");
    const fn = mod?.bootstrapFromSheetsToLocalStorage;
    if (typeof fn !== "function") throw new Error("bootstrapFromSheetsToLocalStorage not found");
    await fn();

    // 載入後：更新 UI + 同步狀態
    try { ensureDueForAll(); } catch {}
    try { renderSidebarLists?.(); } catch {}
    try { refreshMasteredAndChart?.(); } catch {}
    clearDirtyAndSetLastSync(Date.now());
    refreshSyncUI();

    alert("已從 Google Sheet 載入完成（本機資料已更新）。");
  } catch (e) {
    console.error(e);
    alert("雲端載入失敗，請看 Console 錯誤訊息。");
  }
}

export async function handlePushSheets() {
  const ok = confirm(
    "這會用「本機資料（localStorage）」覆蓋 Google Sheet（Words/AddedLogs/ReviewLogs）。\n\n確定要同步到 Google 嗎？"
  );
  if (!ok) return;

  try {
    const r = await pushLocalStorageToSheets();
    clearDirtyAndSetLastSync(Date.now());
    refreshSyncUI();
    alert(`已同步到 Google Sheet：\nWords=${r.words}\nAddedLogs=${r.addedLogs}\nReviewLogs=${r.reviewLogs}`);
  } catch (e) {
    console.error(e);
    alert("同步失敗，請看 Console 錯誤訊息。");
  }
}

function importJsonFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = String(e.target.result || "");
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        throw new Error("JSON 根節點不是陣列");
      }

      const existing = getAllWords();
      const map = new Map(
        existing.map((w) => [String(w.word || "").toLowerCase(), w])
      );

      let added = 0;
      let skipped = 0;

      for (const obj of data) {
        const key = String(obj.word || "").toLowerCase().trim();
        if (!key) {
          skipped++;
          continue;
        }
        if (map.has(key)) {
          // 已有同樣單字 → 略過（保留現有資料）
          skipped++;
          continue;
        }
        map.set(key, obj);
        added++;
      }

      const merged = Array.from(map.values());
      saveAllWords(merged);     // 目前只寫入本機（localStorage）
      renderSidebarLists?.();   // 更新右側清單與統計

      alert(
      `匯入完成：新增 ${added} 筆，略過 ${skipped} 筆（重複或無效）。\n\n` +
      `注意：目前只匯入到本機（localStorage）。若要同步到 Google Sheet，需要再做「寫回雲端」功能。`);
  
    } catch (err) {
      console.error(err);
      alert("匯入失敗：檔案內容可能不是此工具匯出的 JSON 格式。");
    }
  };

  reader.onerror = () => {
    alert("讀取檔案時發生錯誤，請再試一次。");
  };

  reader.readAsText(file, "utf-8");
}



/* ===== 圖片 OCR（沿用你的 UI 流程） ===== */
let _lastOcrFile = null;

export function handlePickOcrFile() {
  const input = document.getElementById("ocrFile");
  if (!input) return alert("找不到 ocrFile 欄位");
  input.value = "";
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    _lastOcrFile = file;
    await doOCR(file);
  };
  input.click();
}

export async function handleRunOcr() {
  if (!_lastOcrFile) return alert("尚未選擇圖片");
  await doOCR(_lastOcrFile);
}

// OCR 文字清理：移除排版產生的不正常斷行，還原自然段落結構
function cleanOcrText(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map(l => l.trim());
  const paragraphs = [];
  let current = [];

  for (const line of lines) {
    if (!line) {
      // 空行 → 段落邊界
      if (current.length) { paragraphs.push(current.join(" ")); current = []; }
      continue;
    }

    if (current.length > 0) {
      const prev = current[current.length - 1];
      // 前一行以句末標點結尾，且本行以大寫或引號開頭 → 視為新段落
      const prevEndsSentence = /[.!?]["'""»]?$/.test(prev);
      const thisStartsUpper  = /^[A-Z"'"'(]/.test(line);
      if (prevEndsSentence && thisStartsUpper) {
        paragraphs.push(current.join(" "));
        current = [line];
        continue;
      }
    }

    // 其餘情況：同一段落內的排版換行，合併為一行
    current.push(line);
  }

  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs.join("\n\n");
}

async function doOCR(file) {
  const status = document.getElementById("ocrStatus");
  const runBtn = document.getElementById("ocrRunBtn");
  if (!window.Tesseract) {
    alert("找不到 Tesseract.js，請確認已在 index.html 載入 CDN。");
    return;
  }

  status.textContent = "正在辨識圖片文字…";
  runBtn?.classList.add("hidden");

  try {
    const { createWorker } = window.Tesseract;
    const worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m?.progress != null) {
          const p = Math.round((m.progress || 0) * 100);
          status.textContent = `OCR 進行中… ${p}%`;
        }
      },
    });
    const ret = await worker.recognize(file);
    await worker.terminate();

    const rawText = (ret?.data?.text || "").trim();
    if (!rawText) {
      status.textContent = "沒有辨識到文字，請換張更清晰的圖片";
      return;
    }

    const text = cleanOcrText(rawText);

    const ta = document.getElementById("articleInput");
    if (!ta) return alert("找不到 articleInput");
    ta.value = ta.value ? (ta.value + "\n\n" + text) : text;

    status.textContent = `OCR 完成。已寫入輸入框（${text.length} 字）`;
    runBtn?.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    status.textContent = "OCR 失敗，請重試或換一張清晰的圖片";
    runBtn?.classList.remove("hidden");
  }
}

function ensureToTopButton() {
  if (document.getElementById("toTopBtn")) return;

  const btn = document.createElement("button");
  btn.id = "toTopBtn";
  btn.type = "button";
  btn.textContent = "↑ 回到最上方";
  btn.className = "fixed bottom-4 right-4 px-3 py-2 rounded-full border bg-white shadow hidden";
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.body.appendChild(btn);

  const toggle = () => {
    if (window.scrollY > 200) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
  };
  window.addEventListener("scroll", toggle, { passive: true });
  toggle();
}

document.addEventListener("DOMContentLoaded", ensureToTopButton);

window.addEventListener("usage-updated", () => {
  try { refreshUsageUI(); } catch (e) { console.error(e); }
});

/* ===== 通用 Toast（底部彈出訊息） ===== */
export function showToast(message, { duration = 3000, type = "success" } = {}) {
  let toast = document.getElementById("generalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "generalToast";
    toast.style.cssText =
      "position:fixed;bottom:5rem;left:50%;transform:translateX(-50%);" +
      "padding:.6rem 1.2rem;border-radius:12px;font-size:.9rem;font-weight:500;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.18);z-index:300;transition:opacity .25s;";
    document.body.appendChild(toast);
  }

  const colors = {
    success: "background:#1d3557;color:#fff;",
    warn:    "background:#92400e;color:#fff;",
    info:    "background:#6B7F5E;color:#fff;",
  };
  toast.style.cssText += colors[type] || colors.success;
  toast.textContent = message;
  toast.style.opacity = "1";

  clearTimeout(toast._tid);
  toast._tid = setTimeout(() => { toast.style.opacity = "0"; }, duration);
}


/* ===== 文章增益資料（翻譯 + 文法，存 localStorage） ===== */
const _ENRICHMENTS_KEY = 'article_enrichments';

export function getEnrichment(rowIndex) {
  try {
    const all = JSON.parse(localStorage.getItem(_ENRICHMENTS_KEY) || '{}');
    return all[String(rowIndex)] || {};
  } catch { return {}; }
}

export function saveEnrichment(rowIndex, patch) {
  if (!rowIndex) return;
  try {
    const all = JSON.parse(localStorage.getItem(_ENRICHMENTS_KEY) || '{}');
    const key = String(rowIndex);
    all[key] = { ...(all[key] || {}), ...patch };
    localStorage.setItem(_ENRICHMENTS_KEY, JSON.stringify(all));
  } catch {}
}

export function deleteEnrichment(rowIndex) {
  if (!rowIndex) return;
  try {
    const all = JSON.parse(localStorage.getItem(_ENRICHMENTS_KEY) || '{}');
    delete all[String(rowIndex)];
    localStorage.setItem(_ENRICHMENTS_KEY, JSON.stringify(all));
  } catch {}
}

/* ===== 圖書館列表（含搜尋 + 分頁） ===== */
const LIBRARY_PAGE_SIZE = 10;
let _libraryAllArticles = [];
let _libraryPage = 0;

// ── 自訂標題覆寫（localStorage 持久化）──
const _TITLE_KEY = "library_title_overrides";
function _getTitleOverrides() {
  try { return JSON.parse(localStorage.getItem(_TITLE_KEY) || "{}"); } catch { return {}; }
}
function _setTitleOverride(sheetRowIndex, newTitle, originalTitle) {
  const map = _getTitleOverrides();
  if (newTitle && newTitle !== originalTitle) map[sheetRowIndex] = newTitle;
  else delete map[sheetRowIndex];
  localStorage.setItem(_TITLE_KEY, JSON.stringify(map));
  const a = _libraryAllArticles.find(x => x.sheetRowIndex === sheetRowIndex);
  if (a) a.title = newTitle || originalTitle;
}

export function renderLibraryList(articles) {
  // 依 savedAt 降冪排序（最新在前）
  _libraryAllArticles = (articles || []).slice().sort((a, b) => {
    const ta = a.savedAt ? new Date(a.savedAt).getTime() : 0;
    const tb = b.savedAt ? new Date(b.savedAt).getTime() : 0;
    return tb - ta;
  });
  // 套用 localStorage 標題覆寫，並保留原始標題供重置用
  const overrides = _getTitleOverrides();
  _libraryAllArticles.forEach(a => {
    a._originalTitle = a.title;
    if (overrides[a.sheetRowIndex]) a.title = overrides[a.sheetRowIndex];
  });
  _libraryPage = 0;
  _renderLibraryPage_();
}

export function filterLibraryList() {
  _libraryPage = 0;
  _renderLibraryPage_();
}

export function gotoLibraryPrev() {
  if (_libraryPage > 0) { _libraryPage--; _renderLibraryPage_(); }
}

export function gotoLibraryNext() {
  const keyword = (document.getElementById("librarySearch")?.value || "").trim().toLowerCase();
  const filtered = keyword
    ? _libraryAllArticles.filter(a => a.title.toLowerCase().includes(keyword))
    : _libraryAllArticles;
  const maxPage = Math.max(0, Math.ceil(filtered.length / LIBRARY_PAGE_SIZE) - 1);
  if (_libraryPage < maxPage) { _libraryPage++; _renderLibraryPage_(); }
}

export function removeLibraryArticle(sheetRowIndex) {
  _libraryAllArticles = _libraryAllArticles
    .filter(a => a.sheetRowIndex !== sheetRowIndex)
    .map(a => ({
      ...a,
      // All rows after the deleted row shift up by 1 in the sheet
      sheetRowIndex: a.sheetRowIndex > sheetRowIndex ? a.sheetRowIndex - 1 : a.sheetRowIndex,
    }));
  _renderLibraryPage_();
}

function _renderLibraryPage_() {
  const container = document.getElementById("libraryItems");
  const pager     = document.getElementById("libraryPager");
  const pageInfo  = document.getElementById("libraryPageInfo");
  const prevBtn   = document.getElementById("libraryPrev");
  const nextBtn   = document.getElementById("libraryNext");
  if (!container) return;

  const keyword = (document.getElementById("librarySearch")?.value || "").trim().toLowerCase();
  const filtered = keyword
    ? _libraryAllArticles.filter(a => a.title.toLowerCase().includes(keyword))
    : _libraryAllArticles;

  const emptyState = document.getElementById("libraryEmptyState");
  if (!filtered.length) {
    // 顯示 empty state，清除任何先前的文章 item
    Array.from(container.children).forEach(el => {
      if (el.id !== "libraryEmptyState") el.remove();
    });
    if (emptyState) {
      emptyState.style.display = "";
      emptyState.querySelector("p").textContent = keyword
        ? "找不到符合的文章。"
        : "尚無文章記錄。\n如需同步，請使用右側「資料管理」的「雲端載入」。";
    }
    pager?.classList.add("hidden");
    return;
  }

  // 有文章時隱藏 empty state，只移除文章 items
  if (emptyState) emptyState.style.display = "none";
  Array.from(container.children).forEach(el => {
    if (el.id !== "libraryEmptyState") el.remove();
  });

  const totalPages = Math.ceil(filtered.length / LIBRARY_PAGE_SIZE);
  if (_libraryPage >= totalPages) _libraryPage = totalPages - 1;
  const page = filtered.slice(_libraryPage * LIBRARY_PAGE_SIZE, (_libraryPage + 1) * LIBRARY_PAGE_SIZE);
  page.forEach(article => {
    const item = document.createElement("div");
    item.className = "library-item";

    const dateStr = article.savedAt
      ? new Date(article.savedAt).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";

    // ── 左側文字區 ──
    const textArea = document.createElement("div");
    textArea.className = "flex-1 min-w-0";

    // 標題行（標題文字 + 鉛筆按鈕）
    const titleRow = document.createElement("div");
    titleRow.className = "flex items-center gap-1 min-w-0";

    const titleEl = document.createElement("div");
    titleEl.className = "font-medium text-gray-800 truncate flex-1 min-w-0 cursor-pointer";
    titleEl.textContent = article.title;
    titleEl.addEventListener("click", () => showReaderMode(article, getEnrichment(article.sheetRowIndex)));

    const pencilBtn = document.createElement("button");
    pencilBtn.className = "lib-pencil";
    pencilBtn.title = "編輯標題";
    pencilBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    pencilBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const originalTitle = article._originalTitle || article.title;
      const input = document.createElement("input");
      input.type = "text";
      input.value = article.title;
      input.className = "lib-title-input";
      titleRow.replaceChild(input, titleEl);
      pencilBtn.style.display = "none";
      input.focus(); input.select();
      const save = () => {
        const val = input.value.trim() || originalTitle;
        _setTitleOverride(article.sheetRowIndex, val, originalTitle);
        _renderLibraryPage_();
      };
      input.addEventListener("blur", save);
      input.addEventListener("keydown", ev => {
        if (ev.key === "Enter") { ev.preventDefault(); save(); }
        if (ev.key === "Escape") { ev.preventDefault(); _renderLibraryPage_(); }
      });
    });

    titleRow.appendChild(titleEl);
    titleRow.appendChild(pencilBtn);

    // ── Enrichment 徽章（翻譯 / 文法）──
    const enrichment = getEnrichment(article.sheetRowIndex);
    if (enrichment.translatedContent || enrichment.grammarAnalysis) {
      const badgeWrap = document.createElement("span");
      badgeWrap.className = "enrich-badges";
      if (enrichment.translatedContent) {
        const b = document.createElement("span");
        b.className = "enrich-badge enrich-badge--tr";
        b.textContent = "譯";
        badgeWrap.appendChild(b);
      }
      if (enrichment.grammarAnalysis) {
        const b = document.createElement("span");
        b.className = "enrich-badge enrich-badge--gr";
        b.textContent = "文";
        badgeWrap.appendChild(b);
      }
      titleRow.appendChild(badgeWrap);
    }

    const dateEl = document.createElement("div");
    dateEl.className = "text-xs text-gray-400 mt-0.5 cursor-pointer";
    dateEl.textContent = dateStr;
    dateEl.addEventListener("click", () => showReaderMode(article, getEnrichment(article.sheetRowIndex)));

    textArea.appendChild(titleRow);
    textArea.appendChild(dateEl);

    // ── 右側刪除按鈕（hover 才顯示）──
    const delBtn = document.createElement("button");
    delBtn.className = "lib-delete";
    delBtn.title = "刪除此文章";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("library-delete", { detail: { sheetRowIndex: article.sheetRowIndex, title: article.title } }));
    });

    item.appendChild(textArea);
    item.appendChild(delBtn);
    container.appendChild(item);
  });

  // Pagination controls
  if (totalPages > 1) {
    pager?.classList.remove("hidden");
    if (pageInfo) pageInfo.textContent = `第 ${_libraryPage + 1} / ${totalPages} 頁（共 ${filtered.length} 篇）`;
    if (prevBtn) prevBtn.disabled = _libraryPage === 0;
    if (nextBtn) nextBtn.disabled = _libraryPage >= totalPages - 1;
  } else {
    pager?.classList.add("hidden");
  }
}


/* ===== 文法標記 HTML 建構（同時供 main.js 的 modal 與 reader 使用）===== */
export function buildGrammarHTML(sentences, points) {
  const bysentence = {};
  for (const p of points) {
    if (!bysentence[p.sentenceId]) bysentence[p.sentenceId] = [];
    bysentence[p.sentenceId].push(p);
  }
  return sentences.map(s => {
    const pts = bysentence[s.id] || [];
    const spans = [];
    for (const p of pts) {
      const re = new RegExp(`(?<![\\w])${escapeReg(p.word)}(?![\\w])`, "i");
      const m = re.exec(s.text);
      if (m) spans.push({ start: m.index, end: m.index + m[0].length, id: p.id, matched: m[0] });
    }
    spans.sort((a, b) => a.start - b.start);
    const clean = [];
    let lastEnd = 0;
    for (const sp of spans) {
      if (sp.start >= lastEnd) { clean.push(sp); lastEnd = sp.end; }
    }
    let html = "";
    let pos = 0;
    for (const sp of clean) {
      html += escapeHTML(s.text.slice(pos, sp.start));
      html += `<grammar-tag id="${escapeHTML(sp.id)}">${escapeHTML(sp.matched)}</grammar-tag>`;
      pos = sp.end;
    }
    html += escapeHTML(s.text.slice(pos));
    return `<span data-id="${escapeHTML(s.id)}">${html}</span>`;
  }).join(" ");
}

/** 將文法標籤套用到中英對照 HTML 的英文段落上 */
function _applyGrammarTagsToTranslation_(translatedHTML, grammarData) {
  const { sentences, points } = grammarData;
  const bysentence = {};
  for (const p of points) {
    if (!bysentence[p.sentenceId]) bysentence[p.sentenceId] = [];
    bysentence[p.sentenceId].push(p);
  }

  // 預先為每個有文法點的句子建立標記後的 HTML
  const taggedMap = {}; // origText → taggedHTML
  for (const s of sentences) {
    const pts = bysentence[s.id] || [];
    if (!pts.length) continue;
    const spans = [];
    for (const p of pts) {
      const re = new RegExp(`(?<![\\w])${escapeReg(p.word)}(?![\\w])`, "i");
      const m = re.exec(s.text);
      if (m) spans.push({ start: m.index, end: m.index + m[0].length, id: p.id, matched: m[0] });
    }
    spans.sort((a, b) => a.start - b.start);
    const clean = []; let lastEnd = 0;
    for (const sp of spans) {
      if (sp.start >= lastEnd) { clean.push(sp); lastEnd = sp.end; }
    }
    let html = ""; let pos = 0;
    for (const sp of clean) {
      html += escapeHTML(s.text.slice(pos, sp.start));
      html += `<grammar-tag id="${escapeHTML(sp.id)}">${escapeHTML(sp.matched)}</grammar-tag>`;
      pos = sp.end;
    }
    html += escapeHTML(s.text.slice(pos));
    taggedMap[s.text] = `<span data-id="${escapeHTML(s.id)}">${html}</span>`;
  }
  if (!Object.keys(taggedMap).length) return translatedHTML;

  // 將標記套用到 eng-text 段落
  const tmp = document.createElement("div");
  tmp.innerHTML = translatedHTML;
  tmp.querySelectorAll("p.eng-text").forEach(p => {
    let inner = p.innerHTML;
    for (const [origText, tagged] of Object.entries(taggedMap)) {
      const escapedOrig = escapeHTML(origText);
      if (inner.includes(escapedOrig)) {
        inner = inner.replace(escapedOrig, tagged);
      }
    }
    p.innerHTML = inner;
  });
  return tmp.innerHTML;
}

/* ===== 閱讀模式 ===== */
let _readerArticle = null;
export function getCurrentReaderArticle() { return _readerArticle; }

function highlightKnownWords_(text, knownWords) {
  if (!knownWords.length) {
    // 無已知詞時直接轉段落
    return text.split(/\n\n+/).map(p =>
      `<p>${escapeHTML(p.replace(/\n/g, " "))}</p>`
    ).join("");
  }

  // 依長度降冪，優先匹配較長的片語
  const sorted = [...knownWords].sort((a, b) => b.word.length - a.word.length);

  // 先逐段處理，避免跨段 span
  return text.split(/\n\n+/).map(para => {
    let html = escapeHTML(para.replace(/\n/g, " "));
    for (const w of sorted) {
      const escaped = escapeReg(escapeHTML(w.word));
      const re = new RegExp(`\\b${escaped}\\b`, "gi");
      html = html.replace(re, match =>
        `<span class="reader-word" data-word="${escapeHTML(w.word)}" ` +
        `data-pos="${escapeHTML(w.pos)}" data-def="${escapeHTML(w.definition)}">${match}</span>`
      );
    }
    return `<p>${html}</p>`;
  }).join("");
}

export function showReaderMode(article, enrichment = {}) {
  // 記住目前的閱讀文章（供 main.js 讀取以執行 API）
  _readerArticle = article;

  // 隱藏輸入區、顯示閱讀區
  document.getElementById("articleInputSection")?.classList.add("hidden");
  const readerSection = document.getElementById("readerSection");
  readerSection?.classList.remove("hidden");

  // 標題 & 日期
  document.getElementById("readerTitle").textContent = article.title || "(無標題)";
  const dateEl = document.getElementById("readerSavedAt");
  if (dateEl && article.savedAt) {
    dateEl.textContent = "存檔時間：" + new Date(article.savedAt).toLocaleString("zh-TW");
  }

  // ── 工具列：顯示已有的增益資料 + 提供未有者的執行按鈕 ──
  const statusDiv        = document.getElementById("readerEnrichStatus");
  const translateBtn     = document.getElementById("readerTranslateBtn");
  const grammarBtn2      = document.getElementById("readerGrammarBtn");
  if (statusDiv) {
    statusDiv.innerHTML = "";
    if (enrichment.translatedContent) {
      const tag = document.createElement("span");
      tag.className = "reader-enrich-tag reader-enrich-tag--tr";
      tag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg> 已翻譯`;
      statusDiv.appendChild(tag);
    }
    if (enrichment.grammarAnalysis) {
      const tag = document.createElement("span");
      tag.className = "reader-enrich-tag reader-enrich-tag--gr";
      tag.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> 文法分析`;
      statusDiv.appendChild(tag);
    }
  }
  // 翻譯按鈕：無翻譯時顯示
  if (translateBtn) translateBtn.classList.toggle("hidden", !!enrichment.translatedContent);
  // 文法按鈕：無文法分析時顯示
  if (grammarBtn2) grammarBtn2.classList.toggle("hidden", !!enrichment.grammarAnalysis);

  // 重置文法面板
  const grammarPanel        = document.getElementById("readerGrammarPanel");
  const grammarPanelContent = document.getElementById("readerGrammarPanelContent");
  if (grammarPanel) grammarPanel.classList.add("hidden");

  // 解構 enrichment
  const { translatedContent, grammarAnalysis } = enrichment;

  // 建立文法點查找表
  const grammarPoints = {};
  if (grammarAnalysis?.points) {
    for (const p of grammarAnalysis.points) grammarPoints[p.id] = p;
  }

  // 取得已知單字（for 高亮）
  const knownWords = getAllWords().map(w => ({
    word: w.word || "",
    pos:  w.pos  || "",
    definition: w.definition || "",
  })).filter(w => w.word);

  // 重建 content 元素以清除舊的事件監聽器
  const oldContent = document.getElementById("readerContent");
  const content = oldContent.cloneNode(false);
  oldContent.replaceWith(content);

  // ── 渲染內文（優先順序：翻譯+文法 > 純翻譯 > 純文法 > 原文）──
  if (translatedContent && grammarAnalysis) {
    // 兩者兼有：將文法標籤套用到中英對照段落
    content.innerHTML = _applyGrammarTagsToTranslation_(translatedContent, grammarAnalysis);
  } else if (translatedContent) {
    content.innerHTML = translatedContent;
  } else if (grammarAnalysis) {
    content.innerHTML = `<div class="article-viewer">${buildGrammarHTML(grammarAnalysis.sentences, grammarAnalysis.points)}</div>`;
  } else {
    // 純原文 + 已知單字高亮
    content.innerHTML = highlightKnownWords_(article.fullText || "", knownWords);
    content.querySelectorAll(".reader-word").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showReaderTooltip_(el, { word: el.dataset.word, pos: el.dataset.pos, definition: el.dataset.def });
        jumpToWordCard(el.dataset.word);
      });
    });
  }

  // ── 文法標籤點擊 → 顯示解析面板 ──
  if (grammarAnalysis && grammarPanel && grammarPanelContent) {
    content.addEventListener("click", (e) => {
      const tag = e.target.closest("grammar-tag");
      if (tag) {
        e.stopPropagation();
        const point = grammarPoints[tag.id];
        if (point) {
          grammarPanel.classList.remove("hidden");
          grammarPanelContent.innerHTML =
            `<div class="font-medium mb-1" style="color:#4A4A4A;">${escapeHTML(point.name)}</div>` +
            `<div class="text-gray-600 mb-1">${escapeHTML(point.explanation)}</div>` +
            `<div style="color:#A3B18A;font-size:0.85em;">${escapeHTML(point.context)}</div>`;
        }
        return;
      }
      document.getElementById("readerTooltip")?.remove();
    });
  } else {
    content.addEventListener("click", () => {
      document.getElementById("readerTooltip")?.remove();
    });
  }

  readerSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showReaderTooltip_(el, wordData) {
  document.getElementById("readerTooltip")?.remove();

  const tip = document.createElement("div");
  tip.id = "readerTooltip";
  tip.className = "reader-tooltip";
  tip.innerHTML = `
    <button onclick="document.getElementById('readerTooltip').remove()"
      style="position:absolute;top:6px;right:10px;color:#94a3b8;font-size:14px;">✕</button>
    <div style="font-weight:700">${escapeHTML(wordData.word)}
      <span style="font-weight:400;color:#64748b;font-size:.85rem"> (${escapeHTML(wordData.pos)})</span>
    </div>
    <div style="margin-top:4px;font-size:.9rem;color:#334155">${escapeHTML(wordData.definition)}</div>
  `;

  document.body.appendChild(tip);

  const rect = el.getBoundingClientRect();
  const tipW = 250;
  let left = rect.left + window.scrollX;
  if (left + tipW > window.innerWidth - 16) left = window.innerWidth - tipW - 16;
  tip.style.top  = `${rect.bottom + window.scrollY + 6}px`;
  tip.style.left = `${left}px`;

  // 4 秒後自動消失
  setTimeout(() => tip.remove(), 4000);
}

export function hideReaderMode() {
  document.getElementById("readerSection")?.classList.add("hidden");
  document.getElementById("articleInputSection")?.classList.remove("hidden");
  document.getElementById("readerTooltip")?.remove();
}

// 點擊閱讀模式中的已知單字 → 右側字卡跳轉
export function jumpToWordCard(word) {
  if (!word) return;

  // 切換到「全部」分頁
  switchSidebarTab?.("all");

  // 把搜尋框設為該單字並觸發渲染
  const searchEl = document.getElementById("allSearch");
  if (searchEl) {
    searchEl.value = word;
    searchEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // 短暫高亮第一筆符合的字卡
  setTimeout(() => {
    const sidebar = document.getElementById("sidebarAllList");
    const target = word.toLowerCase();
    const firstCard = sidebar?.querySelector(`[data-word="${target}"]`);
    if (firstCard) {
      firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
      firstCard.style.transition = "background .3s";
      firstCard.style.background = "#dbeafe";
      setTimeout(() => { firstCard.style.background = ""; }, 2000);
    }
  }, 200);
}


/* ===== 反白選字浮動分析 ===== */
export async function handleSelectionAnalyze(term, anchorRect = null) {
  if (!term) return;
  const article = document.getElementById("articleInput")?.value.trim() || "";
  showToast("分析中…", { duration: 10000, type: "info" });
  try {
    const obj = await analyzeCustomWordAPI(article, term);
    showToast("", { duration: 1 }); // 清除 loading toast
    _showSelectionResult(obj, term, anchorRect);
  } catch (err) {
    console.error(err);
    showToast("分析失敗，請稍後再試", { type: "warn", duration: 4000 });
  }
}

function _extractSentence(text, word) {
  if (!text) return "";
  // 切句：以句號/問號/驚嘆號（含中英文）作為邊界
  const sentences = text.split(/(?<=[.!?。！？])\s*/);
  const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const hit = sentences.find(s => re.test(s));
  return (hit || text).trim();
}

function _highlightWord(sentence, word) {
  const re = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escapeHTML(sentence).replace(
    re,
    `<strong style="color:#A3B18A;font-weight:700;">$1</strong>`
  );
}

const ICON_SPEAK_SM = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A3B18A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

function _showSelectionResult(obj, term, anchorRect = null) {
  const card = document.getElementById("selectionResult");
  if (!card) return;

  const word  = obj.word || term;
  const pos   = obj.pos || "";
  const def   = obj.definition || "";
  const exArt = _extractSentence(obj.example_in_article || "", word);
  const exAI  = obj.example_ai || "";
  const exZH  = obj.example_ai_zh || obj.example_in_article_zh || "";

  const sentenceHTML = exArt ? _highlightWord(exArt, word) : "";

  // 檢查是否已加入清單，決定按鈕初始狀態
  const alreadyAdded = getAllWords().some(w => (w.word || "").toLowerCase() === word.toLowerCase());
  const addBtnStyle = alreadyAdded
    ? "margin-top:2px;width:100%;padding:7px 0;background:#EEF2E8;color:#8d9b76;border:none;border-radius:9px;font-size:.84rem;font-weight:600;cursor:default;"
    : "margin-top:2px;width:100%;padding:7px 0;background:#A3B18A;color:#fff;border:none;border-radius:9px;font-size:.84rem;font-weight:600;cursor:pointer;transition:background .15s;";
  const addBtnText = alreadyAdded ? "✓ 已在單字清單" : "加入單字清單";

  card.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">

      <!-- 標題列：單字 + 發音 + 關閉 -->
      <div style="display:flex;align-items:center;gap:6px;">
        <strong style="font-size:1.1rem;color:#222;flex:1;min-width:0;">${escapeHTML(word)}</strong>
        ${pos ? `<span style="font-size:.78rem;color:#888;white-space:nowrap;">${escapeHTML(pos)}</span>` : ""}
        <button id="_selSpeakBtn" title="朗讀" style="
          background:none;border:none;cursor:pointer;padding:2px;
          display:flex;align-items:center;flex-shrink:0;
        ">${ICON_SPEAK_SM}</button>
        <button id="_selCloseBtn" title="關閉" style="
          background:none;border:none;cursor:pointer;padding:3px 5px;
          font-size:.9rem;color:#A3B18A;line-height:1;flex-shrink:0;
          border-radius:4px;transition:background .15s;
        ">✕</button>
      </div>

      <!-- 中文解釋 -->
      ${def ? `<p style="font-size:.88rem;color:#444;margin:0;word-break:keep-all;">${escapeHTML(def)}</p>` : ""}

      <!-- 上下文例句（僅目標句，單字高亮） -->
      ${sentenceHTML ? `<p style="font-size:.8rem;color:#555;margin:0;line-height:1.6;font-style:italic;">"${sentenceHTML}"</p>` : ""}

      <!-- AI 造句 + 翻譯 -->
      ${exAI  ? `<p style="font-size:.8rem;color:#666;margin:0;line-height:1.6;">${escapeHTML(exAI)}</p>` : ""}
      ${exZH  ? `<p style="font-size:.78rem;color:#999;margin:0;">${escapeHTML(exZH)}</p>` : ""}

      <!-- 加入按鈕 -->
      <button id="_selAddBtn" ${alreadyAdded ? "disabled" : ""} style="${addBtnStyle}">${addBtnText}</button>
    </div>
  `;

  // 定位：使用 FAB 隱藏前記錄的座標（anchorRect），不超出視窗邊界
  if (anchorRect && anchorRect.width + anchorRect.height > 0) {
    const left = Math.min(anchorRect.left, window.innerWidth - 370);
    card.style.left = Math.max(8, left) + "px";
    card.style.top  = (anchorRect.bottom + 8) + "px";
  }
  card.classList.remove("hidden");

  // 發音
  document.getElementById("_selSpeakBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    speak(word);
  });

  function _closeAll() {
    card.classList.add("hidden");
    const fab = document.getElementById("selectionFab");
    if (fab) fab.style.display = "none";
    window.getSelection()?.removeAllRanges();
  }

  // 關閉按鈕
  document.getElementById("_selCloseBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    _closeAll();
  });

  // 加入清單
  document.getElementById("_selAddBtn")?.addEventListener("click", () => {
    if (alreadyAdded) return; // 已在清單，不重複加
    const btn = document.getElementById("_selAddBtn");
    const { added } = addWord({
      word, pos,
      definition:  obj.definition || "",
      example1:    exArt,
      example2:    exAI,
      example2_zh: exZH,
      level:       obj.level || "",
    });
    if (btn) {
      btn.disabled = true;
      btn.textContent = added ? "✓ 已加入" : "✓ 已在單字清單";
      btn.style.background = "#EEF2E8";
      btn.style.color = "#8d9b76";
      btn.style.cursor = "default";
    }
    if (added) renderSidebarLists();
    setTimeout(_closeAll, 1000);
  });
}























