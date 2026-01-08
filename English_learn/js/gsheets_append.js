// js/gsheets_append.js
// 方案 B：日常操作自動 append 到 Google Sheet（不清空）
// - 新增單字：append 到 Words + AddedLogs
// - 複習紀錄：append 到 ReviewLogs
// 刪除/大量調整：仍建議用「手動覆寫同步」的 push 功能

const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";
const SCOPES_WRITE = "https://www.googleapis.com/auth/spreadsheets";

const SHEET_WORDS = "Words";
const SHEET_ADDED = "AddedLogs";
const SHEET_REVIEW = "ReviewLogs";

let tokenClient;
let gapiReady = false;
let gisReady = false;
let authed = false;

let flushTimer = null;
const pending = {
  words: [],     // rows for Words
  added: [],     // rows for AddedLogs
  review: [],    // rows for ReviewLogs
};

function readQueue() {
  try {
    const s = localStorage.getItem("gs_queue_v1");
    if (!s) return;
    const obj = JSON.parse(s);
    ["words", "added", "review"].forEach(k => {
      if (Array.isArray(obj?.[k])) pending[k].push(...obj[k]);
    });
  } catch {}
}
function saveQueue() {
  localStorage.setItem("gs_queue_v1", JSON.stringify(pending));
}
function clearQueue() {
  pending.words = [];
  pending.added = [];
  pending.review = [];
  localStorage.removeItem("gs_queue_v1");
}

async function waitSdk() {
  await new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (window.gapi && window.google) { clearInterval(t); resolve(true); }
    }, 100);
    setTimeout(() => { clearInterval(t); reject(new Error("Google SDK not loaded")); }, 10000);
  });
}

async function initGapi() {
  await new Promise((r) => gapi.load("client", r));
  await gapi.client.init({
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  });
  gapiReady = true;
}

function initGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES_WRITE,
    callback: (resp) => {
      if (resp && resp.access_token) {
        gapi.client.setToken(resp);
        authed = true;
      }
    },
  });
  gisReady = true;
}

async function ensureAuthed({ interactive = false } = {}) {
  if (authed) return true;
  if (!gapiReady || !gisReady) throw new Error("Google not initialized");

  // interactive=true：允許彈一次（prompt:""）
  // interactive=false：靜默拿 token（prompt:"none"），不打擾作答
  const prompt = interactive ? "" : "none";

  try {
    await new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp && resp.access_token) {
          gapi.client.setToken(resp);
          authed = true;
          resolve(true);
        } else {
          reject(new Error("OAuth failed"));
        }
      };
      tokenClient.requestAccessToken({ prompt });
    });
    return true;
  } catch (e) {
    // 靜默失敗就回 false（不要跳窗/不要中斷）
    if (!interactive) return false;
    throw e;
  }
}

async function appendMany(sheetName, rows) {
  if (!rows.length) return;
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: rows },
  });
}

async function flushNow() {
  // 沒東西就不做
  if (!pending.words.length && !pending.added.length && !pending.review.length) return;

  // 先把 queue 持久化，避免中途關頁
  saveQueue();

const ok = await ensureAuthed({ interactive: false });
if (!ok) return; // 靜默拿不到 token 就先不寫，queue 留著下次再試


  // 分別 append（三次呼叫，簡單穩定）
  const words = pending.words.splice(0);
  const added = pending.added.splice(0);
  const review = pending.review.splice(0);

  try {
    await appendMany(SHEET_WORDS, words);
    await appendMany(SHEET_ADDED, added);
    await appendMany(SHEET_REVIEW, review);
    // 寫成功後清 queue
    clearQueue();
  } catch (e) {
    // 失敗就把剛剛拿出來的塞回去，保留 queue 下次再試
    pending.words.unshift(...words);
    pending.added.unshift(...added);
    pending.review.unshift(...review);
    saveQueue();
    throw e;
  }
}

function scheduleFlush(ms = 1500) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushNow().catch(err => console.error("[GSheets append] flush failed:", err));
  }, ms);
}

// 對外 API（給 storage.js 呼叫）
function enqueueWordRow(wordObj) {
  const row = [
    wordObj.word ?? "",
    wordObj.pos ?? "",
    wordObj.definition ?? "",
    wordObj.example1 ?? "",
    wordObj.example2 ?? "",
    wordObj.example2_zh ?? "",
    wordObj.level ?? "",
    wordObj.addedAt ?? "",
    wordObj.dueAt ?? "",
    (wordObj.stage ?? 0).toString(),
  ];
  pending.words.push(row);
  saveQueue();
  scheduleFlush();
}
function enqueueAdded(word) {
  pending.added.push([new Date().toISOString(), word]);
  saveQueue();
  scheduleFlush();
}
function enqueueReview(word, correct) {
  pending.review.push([new Date().toISOString(), word, correct ? "TRUE" : "FALSE"]);
  saveQueue();
  scheduleFlush();
}

// 初始化：在 main.js 的 DOMContentLoaded 早期呼叫一次
export async function initGSheetsAppend() {
  readQueue();
  await waitSdk();
  await initGapi();
  initGis();

  // 離開頁面前盡量寫一次（不保證一定成功，但能提高成功率）
  window.addEventListener("beforeunload", () => {
    try { saveQueue(); } catch {}
  });

window.GSheetsAppend = {
  enqueueWordRow,
  enqueueAdded,
  enqueueReview,
  flushNow,
  authInteractive: () => ensureAuthed({ interactive: true }), // ✅ 新增
  };

}

