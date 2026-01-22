// js/ui.js（頂端 imports）
import { analyzeArticle, extractJSON, getUsageSummary, getUsageBudget, setUsageBudget, resetUsageMonth, analyzeCustomWordAPI } from "./api.js";
import { addWord, getAllWords, deleteWord, getTodayWords, getDueWords, getDueCount, saveAllWords, scheduleNext, logReview, ensureDueForAll, getMasteredCount, getDailyStats, getSyncMeta, clearDirtyAndSetLastSync } from "./storage.js";
import { speak, speakSequence } from "./speech.js";
// 這行改成一起匯入 choice/dictation 以及評分/語音建議
import { buildTypingQuestion, makeChoiceQuestion, makeDictationQuestion, grade, afterAnswerSpeech, pickExamplePair } from "./quiz.js";
import { pushLocalStorageToSheets } from "./sheets_push.js";
import { bootstrapFromSheetsToLocalStorage } from "./sheets_bootstrap.js";



let lastDeleted = null;
let allPage = 1; const ALL_PAGE_SIZE = 10; let lastAllFiltered = [];
// ✅ Today / Due 分頁（每頁 10）
let todayPage = 1; const TODAY_PAGE_SIZE = 10; let lastTodayList = [];
let duePage = 1; const DUE_PAGE_SIZE = 10; let lastDueList = [];

let quizQueue = []; let quizIndex = 0; let quizScore = 0; let _quizEnterHandlerBound = false;
let quizAwaitingNext = false; let wrongAnswers = [];
let lastQuizQueue = []; // 本輪題庫快照（用於重測）
let _submittingAnswer = false;


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



// 答後自動播放（依偏好）
function maybeAutoSpeak(w) {
  const mode = (QUIZ_PREF.audio || "none");
  if (mode === "none") return;
  const texts = [];
  if (mode === "word" || mode === "both") texts.push(w.word);
  const pair = pickExamplePair(w, { showZh: !!QUIZ_PREF.showZh });
  const sentence = pair.en || "";
  if ((mode === "sentence" || mode === "both") && sentence) texts.push(sentence);
  speakSequence(texts);
}

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
  localStorage.setItem("quizPref", JSON.stringify(QUIZ_PREF));

  // ✅ 先關掉設定視窗（讓畫面先更新）
  closeQuizSettings();

  // ✅ 下一個 frame 再開始測驗，確保 modal 已消失
  requestAnimationFrame(() => startQuiz?.());
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
    startQuiz();
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
    console.log("raw typeof =", typeof raw);
    console.log("raw =", raw);
    console.log("analyzeArticle raw type:", typeof raw, raw);

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

    // 第一行：左文字 + 右側「發音」按鈕（你目前的版本）
    const head = document.createElement("div");
    head.className = "flex items-center flex-wrap gap-2";

    const headLeft = document.createElement("div");
    headLeft.innerHTML = `
      <strong>${escapeHTML(w.word)}</strong>
      <span class="text-gray-700">(${escapeHTML(posAbbr(w.pos))})</span>
      - ${escapeHTML(w.definition)}
    `;

    const headRight = document.createElement("button");
    headRight.type = "button";
    headRight.title = "播放";
    headRight.textContent = "發音";
    headRight.className = `
      ml-3 px-3 py-1 text-sm font-semibold
      bg-gray-600 text-white rounded-sm
      hover:bg-gray-700 transition
      whitespace-nowrap
    `;
    headRight.addEventListener("click", () => speak(w.word));

    head.appendChild(headLeft);
    head.appendChild(headRight);

    // 內文
    const body = document.createElement("div");
    body.innerHTML = `
      <div><em>文章例句：</em>「${escapeHTML(exampleFromArticle || "無")}」</div>
      <div><em>造句：</em>「${escapeHTML(w.example2 || "無")}」</div>
      <div><em>翻譯：</em>${escapeHTML(w.example2_zh || "無")}</div>
      <div class="text-xs text-gray-500" title="${escapeHTML(w.pos || "")}">
        難度：${escapeHTML(w.level || "")}
      </div>
    `;

    // 佈局：勾選 + 內容
    const label = document.createElement("label");
    label.className = "flex items-start space-x-2";
    label.appendChild(cb);

    const content = document.createElement("div");
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

  // 顯示編輯卡片
  document.getElementById("customWordEdit")?.classList.remove("hidden");

  try {
    const obj = await analyzeCustomWordAPI(article, term);

    // 安全填值
    const set = (id, v="") => { const el = document.getElementById(id); if (el) el.value = String(v||""); };
    set("cw_word", obj.word || term);
    set("cw_pos", obj.pos);
    set("cw_def", obj.definition);
    set("cw_example_en", obj.example_in_article || obj.example_ai || "");
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
}

/* ===== 自訂新增（手動加入） ===== */
export function handleCustomAdd(){
  const word = document.getElementById("cw_word").value.trim();
  const pos  = document.getElementById("cw_pos").value.trim();
  const definition = document.getElementById("cw_def").value.trim();
  const example1 = document.getElementById("cw_example_en")?.value.trim() || "";
  const example2    = document.getElementById("cw_example_ai")?.value.trim() || "";
  const example2_zh = document.getElementById("cw_example_zh")?.value.trim() || "";
  const level = document.getElementById("cw_level")?.value.trim() || "";
  if (!word || !pos || !definition) return alert("請至少填：英文單字、詞性、中文解釋");

  const res = addWord({ word, pos, definition, example1, example2, example2_zh, level });
  if (!res.added) return alert(`「${word}」已存在`);
  alert(`已加入：${word}`);

  // 國考工具模式：新增不自動同步；請用「雲端同步」按鈕

  const cb = findCbByWord(word); if (cb) markRowAsAdded(cb, true);
  ["cw_word","cw_pos","cw_def","cw_example_en","cw_example_ai","cw_example_zh","cw_level"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  renderSidebarLists();
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
  arr.slice(start, start + DUE_PAGE_SIZE).forEach(w => ul.appendChild(makeListItem(w, { showReview:true })));

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



// ===== 右側清單：可展開詳情（含喇叭） =====
function makeListItem(w, opts = {}) {
  const li = document.createElement("li");

  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "w-full text-left flex items-center justify-between";
 summary.innerHTML = `
  <span>
    <strong>${escapeHTML(w.word)}</strong>
    (${escapeHTML(posAbbr(w.pos) || "")}) - ${escapeHTML(w.definition || "")}
  </span>
  <span class="text-gray-400">▸</span>
`;


  const details = document.createElement("div");
  details.className = "mt-2 pl-5 text-sm text-gray-700 hidden";

  const exArticle = w.example1 || w.example_in_article || "";
  const exMake    = w.example2 || w.example_ai || "";
  const exZh      = w.example2_zh || w.example_ai_zh || "";

details.innerHTML = `
  <div class="mt-1">
    <button type="button" title="播放"
      class="ml-3 px-3 py-1 text-sm font-semibold
            bg-gray-600 text-white rounded-sm
            hover:bg-gray-700 transition whitespace-nowrap">發音</button>
  </div>
  ${exArticle ? `<div class="mt-1">文章例句：「${escapeHTML(exArticle)}」</div>` : ""}
  ${exMake    ? `<div class="mt-1">造句：「${escapeHTML(exMake)}」</div>` : ""}
  ${exZh      ? `<div class="mt-1">翻譯：${escapeHTML(exZh)}</div>` : ""}
  ${w.level   ? `<div class="mt-1 text-gray-500">難度：${escapeHTML(w.level)}</div>` : ""}
  <div class="mt-2 flex items-center gap-3">
    ${opts.showReview ? `<button class="text-green-600 underline" data-act="review">複習完成</button>` : ""}
    <button class="text-red-500" data-act="del">刪除</button>
  </div>
`;


  summary.addEventListener("click", () => {
    details.classList.toggle("hidden");
    const arrow = summary.querySelector("span:last-child");
    if (arrow) arrow.textContent = details.classList.contains("hidden") ? "▸" : "▾";
  });

  details.querySelector("button[title='播放']")?.addEventListener("click", () => speak(w.word));
  details.querySelector("[data-act='del']")?.addEventListener("click", () => {
    const deleted = deleteWord(w.word);
    if (deleted) {
      lastDeleted = deleted;
      showUndoToast(`已刪除「${w.word}」`);
      unmarkRowByWord(w.word);
      renderSidebarLists();
    }
  });
  details.querySelector("[data-act='review']")?.addEventListener("click", () => {
    scheduleNext(w.word, true);
    renderSidebarLists();
  });

  const row = document.createElement("div");
  row.className = "p-2 border rounded bg-white shadow";
  row.appendChild(summary);
  row.appendChild(details);
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
  if (card) {
    card.classList.add("bg-gray-200", "opacity-60", "pointer-events-none");
    if (!card.querySelector(".ai-mark-tip")) {
      const tip = document.createElement("span");
      tip.className = "ai-mark-tip ml-2 text-green-600 text-sm";
      tip.textContent = already ? "已存在" : "已加入";
      card.appendChild(tip);
    }
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
    card.classList.remove("bg-gray-200", "opacity-60", "pointer-events-none");
    const tip = card.querySelector(".ai-mark-tip");
    if (tip) tip.remove();
  }
}

function findCbByWord(word){ const v = (window.CSS && CSS.escape) ? CSS.escape(word) : String(word).replace(/["\\]/g, "\\$&"); return document.querySelector(`input[name="word"][value="${v}"]`); }

/* ===== 測驗（集中：buildTypingQuestion 來自 quiz.js） ===== */
export function startQuiz(){
const DESIRED = 15;

// Fisher–Yates shuffle
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// 先排序（保留優先複習），再從前面取一段做隨機抽題
const dueSorted = getDueWords()
  .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));

const duePool = shuffle(dueSorted.slice(0, Math.max(DESIRED * 4, 60)));
const todayPool = shuffle(getTodayWords().slice());
const allPool = shuffle(getAllWords().slice());

const queue = [];
const seen = new Set();

const pushUnique = (pool) => {
  for (const w of pool) {
    const k = (w.word || "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    queue.push(w);
    if (queue.length >= DESIRED) break;
  }
};

pushUnique(duePool);
if (queue.length < DESIRED) pushUnique(todayPool);
if (queue.length < DESIRED) pushUnique(allPool);

if (!queue.length) return alert("清單是空的，先新增幾個單字吧！");


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
          <button id="qPlay" class="px-2 py-1 rounded border">🔊 播放</button>
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
    let expected = "";
    let correct = false;

    if (typeof mode === "string" && mode.startsWith("choice_")) {
      const chosen = document.querySelector('input[name="quizOpt"]:checked');
      const picked = chosen ? Number(chosen.value) : NaN;

      if (!chosen && !asWrong) {
        alert("請先選一個選項");
        return; // ✅ finally 會解鎖
      }

      const g = grade(q, asWrong ? -1 : picked);
      expected = g.expected;
      correct = !!g.correct;
      userInput = chosen ? (chosen.parentElement?.innerText || "").trim() : "";
    } else {
      const inputEl = document.getElementById("quizAnswer");
      userInput = (inputEl?.value || "").trim().toLowerCase();

      const g = grade(q, asWrong ? "" : userInput);
      expected = g.expected;
      correct = !!g.correct || (!asWrong && userInput === (w.word || "").toLowerCase());
    }
 

    // ✅ 間隔複習排程
    scheduleNext(w.word, !!correct);

    // ✅ feedback
    const fb = document.getElementById("quizFeedback");
    if (correct) {
      quizScore++;
      if (fb) fb.innerHTML = `<span class="text-green-600">✅ 正確！</span>`;
    } else {
      if (fb) fb.innerHTML =
        `<span class="text-red-600">❌ 錯誤，答案是 <strong>${w.word}</strong></span>`;

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
      <div class="text-lg font-semibold">✅ 測驗完成</div>
      <div class="text-sm text-gray-700">
        總題數：${total}　答對：${right}　答錯：${wrong}　正確率：${acc}%
      </div>
      ${isChoiceMode
        ? "" // 選擇題不顯示任何錯題詳情
        : (wrongHTML || `<div class="text-sm text-emerald-700">太強了！全對 👏</div>`)}
      <div class="flex gap-2 pt-2">
        <button id="quizRetakeWrong" class="px-3 py-2 rounded bg-amber-500 text-white disabled:opacity-50" ${wrong===0?'disabled':''}>只重測錯題</button>
        <button id="quizRetakeAll" class="px-3 py-2 rounded bg-blue-600 text-white">全部重測</button>
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
  const svg = document.getElementById("statsSparkline"); if (!svg) return; const W = svg.viewBox.baseVal.width || 320, H = svg.viewBox.baseVal.height || 60, P = 4;
  const data = getDailyStats(14); const maxY = Math.max(1, ...data.map(d => Math.max(d.added, d.reviewed))); const stepX = (W - P*2) / Math.max(1, data.length - 1); const y = v => H - P - (v / maxY) * (H - P*2);
  function pathFor(key){ return data.map((d,i)=> `${i?"L":"M"}${P + i*stepX},${y(d[key])}`).join(" "); }
  svg.innerHTML = ""; const mid = document.createElementNS("http://www.w3.org/2000/svg","line"); mid.setAttribute("x1","0"); mid.setAttribute("x2",String(W)); mid.setAttribute("y1",String(y(Math.ceil(maxY/2)))); mid.setAttribute("y2",String(y(Math.ceil(maxY/2)))); mid.setAttribute("stroke","#e5e7eb"); mid.setAttribute("stroke-dasharray","2 3"); svg.appendChild(mid);
  const p1 = document.createElementNS("http://www.w3.org/2000/svg","path"); p1.setAttribute("d", pathFor("added")); p1.setAttribute("fill","none"); p1.setAttribute("stroke","#2563eb"); p1.setAttribute("stroke-width","2"); svg.appendChild(p1);
  const p2 = document.createElementNS("http://www.w3.org/2000/svg","path"); p2.setAttribute("d", pathFor("reviewed")); p2.setAttribute("fill","none"); p2.setAttribute("stroke","#16a34a"); p2.setAttribute("stroke-width","2"); svg.appendChild(p2);
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
  const badge = document.getElementById("usageCostBadge"); if (badge){ badge.textContent = cost.toFixed(2); const over = budget != null && cost >= budget; badge.parentElement?.classList.toggle("text-yellow-200", over && cost < (budget*1.2)); badge.parentElement?.classList.toggle("text-red-200", over && cost >= (budget*1.2)); }
  const elCost = document.getElementById("usageCostTotal"), elP = document.getElementById("usagePromptTokens"), elC = document.getElementById("usageCompletionTokens"), box = document.getElementById("usagePerModel");
  if (elCost) elCost.textContent = cost.toFixed(2); if (elP) elP.textContent = (s.prompt_tokens||0).toLocaleString(); if (elC) elC.textContent = (s.completion_tokens||0).toLocaleString();
  if (box){ box.innerHTML = ""; const models = s.perModel || {}; Object.keys(models).forEach(m=>{ const r = models[m]; const div = document.createElement("div"); div.textContent = `${m} — $${(r.cost||0).toFixed(2)} · P:${(r.prompt||0).toLocaleString()} / C:${(r.completion||0).toLocaleString()}`; box.appendChild(div); }); if (!Object.keys(models).length){ const div = document.createElement("div"); div.className="text-gray-500"; div.textContent = "尚無資料"; box.appendChild(div); } }
}
export function openUsageModal(){ const input = document.getElementById("usageBudgetInput"); const b = getUsageBudget(); if (input) input.value = b!=null?String(b):""; refreshUsageUI(); const m = document.getElementById("usageModal"); m?.classList.remove("hidden"); m?.classList.add("flex"); }
export function closeUsageModal(){ const m = document.getElementById("usageModal"); m?.classList.add("hidden"); m?.classList.remove("flex"); }
export function saveUsageBudget(){ const v = Number(document.getElementById("usageBudgetInput")?.value); if (isNaN(v)) return alert("請輸入數字（USD）"); setUsageBudget(v); refreshUsageUI(); alert("已儲存每月預算"); }
export function resetUsage(){ resetUsageMonth(); refreshUsageUI(); alert("已重置本月估算（不影響 OpenAI 真實用量）"); }

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

    const text = (ret?.data?.text || "").trim();
    if (!text) {
      status.textContent = "沒有辨識到文字，請換張更清晰的圖片";
      return;
    }

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
























