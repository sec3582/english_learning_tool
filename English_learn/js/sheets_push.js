// js/sheets_push.js
const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";

// 注意：這裡是「可寫入」scope（第一次會再跳一次同意）
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

const SHEET_WORDS = "Words";
const SHEET_ADDED = "AddedLogs";
const SHEET_REVIEW = "ReviewLogs";

function readJSON(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return def; }
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
}

function requestTokenWritable() {
  return new Promise((resolve, reject) => {
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp && resp.access_token) {
          gapi.client.setToken(resp);
          resolve(true);
        } else {
          reject(new Error("OAuth failed"));
        }
      },
    });
    tc.requestAccessToken({ prompt: "" });
  });
}

async function clearRange(range) {
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
}

async function updateValues(startRange, values) {
  if (!values.length) return;
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: startRange,
    valueInputOption: "RAW",
    resource: { values },
  });
}

export async function pushLocalStorageToSheets() {
  await waitSdk();
  await initGapi();
  await requestTokenWritable();

  const words = readJSON("myWords", []);
  const addedLogs = readJSON("addedLogs", []);
  const reviewLogs = readJSON("reviewLogs", []);

  // 轉成表格列
  const wordRows = (Array.isArray(words) ? words : []).map(w => ([
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

  const addedRows = (Array.isArray(addedLogs) ? addedLogs : []).map(x => ([
    new Date(x.ts || Date.now()).toISOString(),
    x.word ?? ""
  ])).filter(r => r[1]);

  const reviewRows = (Array.isArray(reviewLogs) ? reviewLogs : []).map(x => ([
    new Date(x.ts || Date.now()).toISOString(),
    x.word ?? "",
    x.correct ? "TRUE" : "FALSE"
  ])).filter(r => r[1]);

  // 清空 A2 以下（保留 header）
  await clearRange(`${SHEET_WORDS}!A2:J`);
  await clearRange(`${SHEET_ADDED}!A2:B`);
  await clearRange(`${SHEET_REVIEW}!A2:C`);

  // 覆寫回去
  await updateValues(`${SHEET_WORDS}!A2`, wordRows);
  await updateValues(`${SHEET_ADDED}!A2`, addedRows);
  await updateValues(`${SHEET_REVIEW}!A2`, reviewRows);

  return {
    words: wordRows.length,
    addedLogs: addedRows.length,
    reviewLogs: reviewRows.length,
  };
}
