// js/sheets_push.js
const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";

// 注意：這裡是「可寫入」scope（第一次會再跳一次同意）
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

const SHEET_WORDS       = "Words";
const SHEET_ADDED       = "AddedLogs";
const SHEET_REVIEW      = "ReviewLogs";
const SHEET_MISC        = "Misc";
const SHEET_ENRICHMENTS = "Enrichments";
const SHEET_GRAMMAR     = "GrammarPoints";

const PET_KEYS = [
  'currentXP','level','petHunger','petHungerDecayTs',
  'petMood','petMoodDecayTs','lastAddWordTime','lastReviewTime','pet_last_active_ts'
];

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

async function ensureSheet(title) {
  const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.result.sheets || []).some(s => s.properties?.title === title);
  if (!exists) {
    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests: [{ addSheet: { properties: { title } } }] }
    });
  }
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
    w.example1_zh ?? "",
    w.example2 ?? "",
    w.example2_zh ?? "",
    w.level ?? "",
    w.addedAt ?? "",
    w.dueAt ?? "",
    (w.stage ?? 0).toString(),
    w.synonyms ?? "",
    w.antonyms ?? "",
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

  const WORDS_HEADER = ["word","pos","definition","example1","example1_zh","example2","example2_zh","level","addedAt","dueAt","stage","synonyms","antonyms"];

  // 清空整欄（含 header），再從 A1 完整寫回
  await clearRange(`${SHEET_WORDS}!A1:M`);
  await clearRange(`${SHEET_ADDED}!A2:B`);
  await clearRange(`${SHEET_REVIEW}!A2:C`);

  // 覆寫回去（Words 從 A1 含 header 一起寫）
  await updateValues(`${SHEET_WORDS}!A1`, [WORDS_HEADER, ...wordRows]);
  await updateValues(`${SHEET_ADDED}!A2`, addedRows);
  await updateValues(`${SHEET_REVIEW}!A2`, reviewRows);

  // ── Misc sheet：電子雞、標題覆寫、記憶法快取 ──
  await ensureSheet(SHEET_MISC);
  const petData = {};
  for (const k of PET_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) petData[k] = v;
  }
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const usageKey = `wordgarden_usage_${monthKey}`;

  const miscRows = [
    ["key", "value"],
    ["petData",       JSON.stringify(petData)],
    ["titleOverrides", localStorage.getItem('library_title_overrides') || '{}'],
    ["mnemonicCache",  localStorage.getItem('mnemonic_cache') || '{}'],
    ["wordgarden_budget", localStorage.getItem('wordgarden_budget') || "0"],
    [usageKey,            localStorage.getItem(usageKey) || "{}"],
  ];
  await clearRange(`${SHEET_MISC}!A1:B`);
  await updateValues(`${SHEET_MISC}!A1`, miscRows);

  // ── Enrichments sheet：翻譯 + 文法（每篇一列）──
  await ensureSheet(SHEET_ENRICHMENTS);
  let enrichments = {};
  try { enrichments = JSON.parse(localStorage.getItem('article_enrichments') || '{}'); } catch {}
  const enrichmentRows = [
    ["articleKey", "enrichmentJSON"],
    ...Object.entries(enrichments).map(([k, v]) => [k, JSON.stringify(v)])
  ];
  await clearRange(`${SHEET_ENRICHMENTS}!A1:B`);
  await updateValues(`${SHEET_ENRICHMENTS}!A1`, enrichmentRows);

  // ── GrammarPoints sheet：文法練習點 ──
  await ensureSheet(SHEET_GRAMMAR);
  let grammarPoints = [];
  try { grammarPoints = JSON.parse(localStorage.getItem('grammarPracticePoints') || '[]'); } catch {}
  const grammarRows = [
    ["id", "name", "explanation", "context", "word", "exampleSentence", "addedAt"],
    ...(Array.isArray(grammarPoints) ? grammarPoints : []).map(p => [
      p.id ?? "", p.name ?? "", p.explanation ?? "", p.context ?? "",
      p.word ?? "", p.exampleSentence ?? "", p.addedAt ?? "",
    ])
  ];
  await clearRange(`${SHEET_GRAMMAR}!A1:G`);
  await updateValues(`${SHEET_GRAMMAR}!A1`, grammarRows);

  return {
    words:      wordRows.length,
    addedLogs:  addedRows.length,
    reviewLogs: reviewRows.length,
    enrichments: enrichmentRows.length - 1,
    grammarPoints: grammarRows.length - 1,
  };
}
