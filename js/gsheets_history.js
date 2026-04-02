// js/gsheets_history.js
// 管理 Google Sheets 的 Article_History 分頁（自動建立 + 讀寫）

const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";
const SCOPES_RW = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_HISTORY = "Article_History";

let tokenClient;
let gapiReady = false;
let gisReady  = false;
let authed    = false;
let _historySheetId = null;

async function waitSdk_() {
  await new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (window.gapi && window.google) { clearInterval(t); resolve(true); }
    }, 100);
    setTimeout(() => { clearInterval(t); reject(new Error("Google SDK not loaded")); }, 10000);
  });
}

async function initGapi_() {
  if (gapiReady) return;
  await new Promise((r) => gapi.load("client", r));
  await gapi.client.init({
    discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
  });
  gapiReady = true;
}

function initGis_() {
  if (gisReady) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES_RW,
    callback: (resp) => {
      if (resp?.access_token) { gapi.client.setToken(resp); authed = true; }
    },
  });
  gisReady = true;
}

async function ensureAuthed_(interactive = false) {
  if (authed) return true;
  if (!gapiReady || !gisReady) return false;
  const prompt = interactive ? "" : "none";
  try {
    await new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp?.access_token) { gapi.client.setToken(resp); authed = true; resolve(true); }
        else reject(new Error("OAuth failed"));
      };
      tokenClient.requestAccessToken({ prompt });
    });
    return true;
  } catch {
    if (!interactive) return false;
    return false;
  }
}

async function getHistorySheetId_() {
  if (_historySheetId !== null) return _historySheetId;
  const info = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheet = (info.result.sheets || []).find(s => s.properties.title === SHEET_HISTORY);
  if (!sheet) throw new Error("Article_History sheet not found");
  _historySheetId = sheet.properties.sheetId;
  return _historySheetId;
}

async function ensureHistorySheet_() {
  const info = await gapi.client.sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheet = (info.result.sheets || []).find(s => s.properties.title === SHEET_HISTORY);
  if (sheet) {
    _historySheetId = sheet.properties.sheetId; // cache while we have it
    return;
  }

  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests: [{ addSheet: { properties: { title: SHEET_HISTORY } } }] },
  });
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_HISTORY}!A1:C1`,
    valueInputOption: "RAW",
    resource: { values: [["title", "fullText", "savedAt"]] },
  });
}

// 初始化（DOMContentLoaded 時呼叫一次）
export async function initGSheetsHistory() {
  try {
    await waitSdk_();
    await initGapi_();
    initGis_();
  } catch (err) {
    console.warn("[History] init 失敗：", err.message);
  }
}

// 使用者手動收藏：互動式授權 + 去重 + 回傳 { saved, duplicate }
export async function saveArticleHistory(fullText) {
  if (!fullText?.trim()) throw new Error("文章內容為空");

  const ok = await ensureAuthed_(true); // 互動式，跳出 Google 登入
  if (!ok) throw new Error("未完成 Google 授權");

  await ensureHistorySheet_();
  const trimmed = fullText.trim();
  const title = trimmed.split(/[.!?\n]/)[0].slice(0, 120).trim() || "(untitled)";

  // 去重：讀取現有全文欄（B 欄），比對是否完全相同
  const existing = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_HISTORY}!B2:B`,
  });
  const rows = existing.result.values || [];
  const dupIdx = rows.findIndex(r => (r[0] || "").trim() === trimmed);
  if (dupIdx !== -1) {
    return { saved: false, duplicate: true, title, sheetRowIndex: dupIdx + 2 }; // +2: 1-based + header row
  }

  const appendRes = await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_HISTORY}!A:C`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [[title, trimmed, new Date().toISOString()]] },
  });
  // Extract row number from updatedRange like "Article_History!A5:C5"
  const updatedRange = appendRes.result.updates?.updatedRange || "";
  const rowMatch = updatedRange.match(/!A(\d+)/);
  const sheetRowIndex = rowMatch ? parseInt(rowMatch[1], 10) : rows.length + 2;
  return { saved: true, duplicate: false, title, sheetRowIndex };
}

function stripHtml_(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim();
}

// 互動式授權後抓取最近 n 篇
export async function getRecentArticles(n = 10) {
  const ok = await ensureAuthed_(true);
  if (!ok) throw new Error("未授權 Google，請先完成 Google 登入設定。");

  try {
    await ensureHistorySheet_();
    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_HISTORY}!A2:C`,
    });
    const rows = res.result.values || [];
    const total = rows.length;
    // After slice(-n).reverse(), arr[i] corresponds to rows[total-1-i]
    // sheet row = (total-1-i) + 2  (row 1 is header, data starts at row 2)
    return rows.slice(-n).reverse().map((r, i) => ({
      title:         stripHtml_(r[0]) || "(untitled)",
      fullText:      stripHtml_(r[1]),
      savedAt:       r[2] || "",
      sheetRowIndex: total - i + 1, // 1-based sheet row index
    }));
  } catch (err) {
    throw new Error("讀取圖書館失敗：" + err.message);
  }
}

// 匯出用：抓取所有文章（需互動式授權）
export async function getAllArticles() {
  const ok = await ensureAuthed_(true);
  if (!ok) throw new Error("未授權 Google");
  await ensureHistorySheet_();
  const res = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_HISTORY}!A2:C`,
  });
  const rows = res.result.values || [];
  return rows.map(r => ({
    title:    stripHtml_(r[0]) || "(untitled)",
    fullText: stripHtml_(r[1]),
    savedAt:  r[2] || "",
  }));
}

// 匯入用：覆蓋全部文章（清空後重寫）
export async function replaceAllArticles(articles) {
  const ok = await ensureAuthed_(true);
  if (!ok) throw new Error("未授權 Google");
  await ensureHistorySheet_();
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_HISTORY}!A2:C`,
  });
  if (!articles.length) return;
  const rows = articles.map(a => [a.title || "(untitled)", a.fullText || "", a.savedAt || ""]);
  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_HISTORY}!A2`,
    valueInputOption: "RAW",
    resource: { values: rows },
  });
}

// 刪除指定列（sheetRowIndex 為 1-based，含 header；資料從第 2 列起）
export async function deleteArticleHistory(sheetRowIndex) {
  if (!sheetRowIndex || sheetRowIndex < 2) throw new Error("無效的列索引");

  const ok = await ensureAuthed_(true);
  if (!ok) throw new Error("未授權 Google，請先完成 Google 登入設定。");

  const sheetId = await getHistorySheetId_();
  await gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: sheetRowIndex - 1,  // 0-based
            endIndex:   sheetRowIndex,
          }
        }
      }]
    }
  });
}
