// storage_google.js
// 用 Google Sheets 當資料庫：Words / AddedLogs / ReviewLogs
// 依你目前資料結構：word,pos,definition,example1,example2,example2_zh,level,addedAt,dueAt,stage

const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

const SHEET_WORDS = "Words";
const SHEET_ADDED = "AddedLogs";
const SHEET_REVIEW = "ReviewLogs";

let tokenClient = null;
let initPromise = null;

// ===== 初始化 Google SDK（只要呼叫一次）=====
export function ensureGoogleReady() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    const waitSdk = setInterval(async () => {
      if (!window.gapi || !window.google) return;
      clearInterval(waitSdk);

      try {
        await new Promise((r) => gapi.load("client", r));
        await gapi.client.init({
          discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            if (resp && resp.access_token) {
              gapi.client.setToken(resp);
              resolve(true);
            } else {
              reject(new Error("Google OAuth failed"));
            }
          },
        });

        // 立即要求 token（第一次會跳同意）
        tokenClient.requestAccessToken({ prompt: "" });
      } catch (e) {
        reject(e);
      }
    }, 100);

    // 10 秒還等不到 SDK 就視為失敗
    setTimeout(() => {
      clearInterval(waitSdk);
      reject(new Error("Google SDK not loaded"));
    }, 10000);
  });

  return initPromise;
}

// ===== 工具：讀整張表（從第2列開始）=====
async function readSheetRows(sheetName, rangeCols) {
  await ensureGoogleReady();
  const res = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:${rangeCols}`,
  });
  return res.result.values || [];
}

// ===== 工具：一次覆寫 Words（避免更新單列的複雜度）=====
async function overwriteWords(allWords) {
  await ensureGoogleReady();

  // 先清掉 A2:J
  await gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_WORDS}!A2:J`,
  });

  const rows = allWords.map(w => ([
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

  if (rows.length === 0) return;

  await gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_WORDS}!A2`,
    valueInputOption: "RAW",
    resource: { values: rows },
  });
}

// ===== 工具：append log =====
async function appendRow(sheetName, values) {
  await ensureGoogleReady();
  await gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [values] },
  });
}

// ===== 對外介面：你的 UI 會用到 =====
export async function getAllWords() {
  // 讀 Words A2:J
  const rows = await readSheetRows(SHEET_WORDS, "J");

  return rows.map(r => ({
    word: r[0] ?? "",
    pos: r[1] ?? "",
    definition: r[2] ?? "",
    example1: r[3] ?? "",
    example2: r[4] ?? "",
    example2_zh: r[5] ?? "",
    level: r[6] ?? "",
    addedAt: r[7] ?? "",
    dueAt: r[8] ?? "",
    stage: r[9] === "" || r[9] == null ? 0 : Number(r[9]),
  })).filter(x => x.word);
}

export async function saveAllWords(words) {
  // 若你原本有呼叫 saveAllWords，直接覆寫整表即可
  await overwriteWords(words);
}

export async function addWord(wordObj) {
  const words = await getAllWords();
  const w = (wordObj.word || "").trim();
  if (!w) return;

  // 去重（同 word 覆蓋）
  const next = words.filter(x => x.word.toLowerCase() !== w.toLowerCase());
  next.push(wordObj);

  await overwriteWords(next);
  await logAdded(w);
}

export async function updateWord(wordObj) {
  const words = await getAllWords();
  const w = (wordObj.word || "").trim();
  if (!w) return;

  const next = words.map(x =>
    x.word.toLowerCase() === w.toLowerCase() ? wordObj : x
  );

  await overwriteWords(next);
}

export async function deleteWord(word) {
  const words = await getAllWords();
  const w = (word || "").trim();
  const next = words.filter(x => x.word.toLowerCase() !== w.toLowerCase());
  await overwriteWords(next);
}

export async function logAdded(word) {
  await appendRow(SHEET_ADDED, [new Date().toISOString(), word]);
}

export async function logReview(word, correct) {
  await appendRow(SHEET_REVIEW, [new Date().toISOString(), word, correct ? "TRUE" : "FALSE"]);
}
