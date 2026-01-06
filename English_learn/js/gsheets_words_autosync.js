// js/gsheets_words_autosync.js
// 自動同步 Words：用本機 myWords 覆寫 Google Sheet 的 Words 分頁（只動 Words，不動 Logs）

const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";
const SCOPES_WRITE = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_WORDS = "Words";

let tokenClient;
let gapiReady = false;
let gisReady = false;
let authed = false;

let timer = null;

function readWords() {
  try { return JSON.parse(localStorage.getItem("myWords") || "[]"); } catch { return []; }
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

async function ensureAuthed() {
  if (authed) return true;
  if (!gapiReady || !gisReady) throw new Error("Google not initialized");
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
    tokenClient.requestAccessToken({ prompt: "" });
  });
  return true;
}

async function overwriteWordsNow() {
  await ensureAuthed();

  const words = readWords();
  const rows = (Array.isArray(words) ? words : []).map(w => ([
    w.word ?? "",
    w.pos ?? "",
    w.definition ?? "",
    w.example1 ?? "",
    w.example2 ?? "",
    w.example2_zh ?? "",
    w.level ?? "",
    w.addedAt ?? "",
    w.dueAt ?? "",
    (w.stage ?? "")
  ])).filter(r => r[0]);

  // 清空 A2:J（保留 header）
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_WORDS}!A2:J`,
  });

  // 沒資料就結束（代表清空完成）
  if (!rows.length) return;

  // 從 A2 起覆寫
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_WORDS}!A2`,
    valueInputOption: "RAW",
    resource: { values: rows },
  });
}

// 對外：初始化一次
export async function initWordsAutoSync() {
  await waitSdk();
  await initGapi();
  initGis();

  // 掛到 window，讓 storage.js 同步呼叫
  window.WordsAutoSync = {
    schedule(ms = 1200) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        overwriteWordsNow().catch(err => {
          console.error("[WordsAutoSync] failed:", err);
        });
      }, ms);
    },
    async flush() {
      await overwriteWordsNow();
    }
  };
}
