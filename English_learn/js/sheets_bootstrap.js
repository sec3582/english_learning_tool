// js/sheets_bootstrap.js
const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly"; // 先做讀取即可（免費）

const SHEET_WORDS = "Words";
const SHEET_ADDED = "AddedLogs";
const SHEET_REVIEW = "ReviewLogs";

async function waitSdk() {
  await new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (window.gapi && window.google) {
        clearInterval(t);
        resolve(true);
      }
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

function requestToken() {
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
    tc.requestAccessToken({ prompt: "" }); // 第一次可能會跳同意
  });
}

async function getValues(range) {
  const res = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.result.values || [];
}

export async function bootstrapFromSheetsToLocalStorage() {
  await waitSdk();
  await initGapi();
  await requestToken();

  // 讀三張表
  const headerRows = await getValues(`${SHEET_WORDS}!1:1`);
  const header = (headerRows && headerRows[0]) ? headerRows[0].map(h => String(h || '').trim()) : [];
  const colIndex = Object.create(null);
  header.forEach((h, i) => { if (h) colIndex[h] = i; });
  const wordRows = await getValues(`${SHEET_WORDS}!A2:Z`);

  const addedRows = await getValues(`${SHEET_ADDED}!A2:B`);
  const reviewRows = await getValues(`${SHEET_REVIEW}!A2:C`);

  // 轉成你原本 storage.js 使用的格式
  const getCell = (r, name, fallbackIdx) => {
    const idx = colIndex[name];
    if (typeof idx === "number") return r[idx] ?? "";
    return (typeof fallbackIdx === "number") ? (r[fallbackIdx] ?? "") : "";
  };

  // 轉成你原本 storage.js 使用的格式（用欄名對應，避免欄位新增後錯位）
  const myWords = wordRows.map(r => ({
    word: getCell(r, "word", 0),
    pos: getCell(r, "pos", 1),
    definition: getCell(r, "definition", 2),
    example1: getCell(r, "example1", 3),
    example1_zh: getCell(r, "example1_zh", 4),
    example2: getCell(r, "example2", 5),
    example2_zh: getCell(r, "example2_zh", 6),
    level: getCell(r, "level", 7),
    addedAt: getCell(r, "addedAt", 8),
    dueAt: getCell(r, "dueAt", 9),
    stage: (() => {
      const v = getCell(r, "stage", 10);
      return v === "" || v == null ? 0 : Number(v);
    })(),
  })).filter(x => String(x.word || "").trim());


  const addedLogs = addedRows.map(r => ({
    ts: Date.parse(r[0]) || Date.now(),
    word: r[1] ?? "",
  })).filter(x => x.word);

  const reviewLogs = reviewRows.map(r => ({
    ts: Date.parse(r[0]) || Date.now(),
    word: r[1] ?? "",
    correct: String(r[2]).toUpperCase() === "TRUE",
  })).filter(x => x.word);

  localStorage.setItem("myWords", JSON.stringify(myWords));
  // compatibility for older UI
  localStorage.setItem("words", JSON.stringify(myWords));
  localStorage.setItem("tv_words", JSON.stringify(myWords));
  localStorage.setItem("addedLogs", JSON.stringify(addedLogs));
  localStorage.setItem("reviewLogs", JSON.stringify(reviewLogs));

  console.log("[SheetsBootstrap] pulled:", {
    myWords: myWords.length,
    addedLogs: addedLogs.length,
    reviewLogs: reviewLogs.length,
  });
}
