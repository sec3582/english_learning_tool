// ====== 你自己的設定（已替你填好） ======
const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";

// 需要可寫入試算表的 scope
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

// 分頁名稱（請確定跟你的 Google Sheet Tab 完全一致）
const SHEET_WORDS = "Words";
const SHEET_ADDED = "AddedLogs";
const SHEET_REVIEW = "ReviewLogs";

// ====== UI ======
const logEl = document.getElementById("log");
const signInBtn = document.getElementById("signInBtn");
const migrateBtn = document.getElementById("migrateBtn");

function log(msg) {
  logEl.textContent += msg + "\n";
  console.log("[MIGRATE]", msg);
}

// ====== Google Auth + gapi ======
let tokenClient = null;
let gapiReady = false;
let gisReady = false;

async function initGapi() {
  await new Promise((resolve) => gapi.load("client", resolve));
  await gapi.client.init({
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  });
  gapiReady = true;
  log("gapi ready");
  enableIfReady();
}

function initGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp && resp.access_token) {
        gapi.client.setToken(resp); // 很重要
        log("登入成功，已取得 access token");
        migrateBtn.disabled = false;
      } else {
        log("登入失敗：請看 console");
        console.error(resp);
      }
    },
  });
  gisReady = true;
  log("gis ready");
  enableIfReady();
}

function enableIfReady() {
  signInBtn.disabled = !(gapiReady && gisReady);
}

window.addEventListener("DOMContentLoaded", () => {
  signInBtn.disabled = true;
  migrateBtn.disabled = true;

  signInBtn.addEventListener("click", () => {
    tokenClient.requestAccessToken({ prompt: "consent" });
  });

  migrateBtn.addEventListener("click", migrateAll);

  // 等 SDK 載入
  const t = setInterval(() => {
    if (window.gapi && window.google) {
      clearInterval(t);
      initGapi();
      initGis();
    }
  }, 100);
});

// ====== 讀 localStorage ======
function readLocalJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// ====== Sheets helpers ======
async function clearRangeA2Down(sheetName, cols) {
  // 清除從第2列開始的資料（保留header）
  const range = `${sheetName}!A2:${cols}`;
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  log(`已清除：${range}`);
}

async function writeValues(sheetName, startRange, values) {
  // values.update：把 values 寫進指定範圍起點，Google 會自動填入需要的行列
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: startRange,
    valueInputOption: "RAW",
    resource: { values },
  });
  log(`已寫入 ${sheetName}：${values.length} 筆`);
}

// ====== 搬家主流程 ======
async function migrateAll() {
  migrateBtn.disabled = true;
  logEl.textContent = "";

  log("開始讀取 localStorage ...");

  const words = readLocalJSON("myWords", []);
  const addedLogs = readLocalJSON("addedLogs", []);
  const reviewLogs = readLocalJSON("reviewLogs", []);

  log(`myWords：${words.length} 筆`);
  log(`addedLogs：${addedLogs.length} 筆`);
  log(`reviewLogs：${reviewLogs.length} 筆`);

  if (!Array.isArray(words) || !Array.isArray(addedLogs) || !Array.isArray(reviewLogs)) {
    log("資料格式不正確（不是陣列），停止。");
    migrateBtn.disabled = false;
    return;
  }

  // 1) Words：轉成表格列
  // 你目前常見欄位：word,pos,definition,example1,example2,example2_zh,level,addedAt,dueAt,stage
  const wordRows = words.map(w => ([
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
  ]));

  // 2) AddedLogs：ts + word
  const addedRows = addedLogs.map(x => ([
    x.ts ?? x.time ?? "",
    x.word ?? ""
  ]));

  // 3) ReviewLogs：ts + word + correct
  const reviewRows = reviewLogs.map(x => ([
    x.ts ?? x.time ?? "",
    x.word ?? "",
    (typeof x.correct === "boolean" ? (x.correct ? "TRUE" : "FALSE") : (x.correct ?? ""))
  ]));

  try {
    log("準備清空 Google Sheet 的舊資料（保留標題列）...");
    await clearRangeA2Down(SHEET_WORDS, "J");
    await clearRangeA2Down(SHEET_ADDED, "B");
    await clearRangeA2Down(SHEET_REVIEW, "C");

    log("開始寫入 Google Sheet ...");
    if (wordRows.length) await writeValues(SHEET_WORDS, `${SHEET_WORDS}!A2`, wordRows);
    if (addedRows.length) await writeValues(SHEET_ADDED, `${SHEET_ADDED}!A2`, addedRows);
    if (reviewRows.length) await writeValues(SHEET_REVIEW, `${SHEET_REVIEW}!A2`, reviewRows);

    log("✅ 搬家完成！");
    log("請打開 Google Sheet 檢查三個分頁資料是否正確。");
  } catch (err) {
    console.error(err);
    const msg = err?.result?.error?.message || err?.message || JSON.stringify(err);
    log("❌ 搬家失敗原因：");
    log(msg);
  } finally {
    migrateBtn.disabled = false;
  }
}
