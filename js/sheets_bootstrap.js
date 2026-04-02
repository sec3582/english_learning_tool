// js/sheets_bootstrap.js
// Robust bootstrap: uses header row to map columns so it won't break when you insert/reorder columns.

const CLIENT_ID = "604882659298-ru334ffd6ai9rh5s5kkbp96fs9l7hsn9.apps.googleusercontent.com";
const SPREADSHEET_ID = "1N_3dZjoFr-lEeaR0hkd6q2YfVho74JpCrXVxRdj2BsQ";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

const SHEET_WORDS       = "Words";
const SHEET_ADDED       = "AddedLogs";
const SHEET_REVIEW      = "ReviewLogs";
const SHEET_MISC        = "Misc";
const SHEET_ENRICHMENTS = "Enrichments";
const SHEET_GRAMMAR     = "GrammarPoints";

async function waitSdk() {
  await new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (window.gapi && window.google) {
        clearInterval(t);
        resolve(true);
      }
    }, 100);
    setTimeout(() => {
      clearInterval(t);
      reject(new Error("Google SDK not loaded"));
    }, 10000);
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
    tc.requestAccessToken({ prompt: "" });
  });
}

async function getValues(range) {
  const res = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.result.values || [];
}

function toNumberSafe(v, fallback = 0) {
  if (v === "" || v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeHeader(h) {
  return String(h || "").trim();
}

export async function bootstrapFromSheetsToLocalStorage() {
  await waitSdk();
  await initGapi();
  await requestToken();

  // --- Words: read header row then rows ---
  const headerRow = await getValues(`${SHEET_WORDS}!A1:M1`);
  const header = (headerRow?.[0] || []).map(normalizeHeader);

  const required = [
    "word",
    "pos",
    "definition",
    "example1",
    "example1_zh",
    "example2",
    "example2_zh",
    "level",
    "addedAt",
    "dueAt",
    "stage",
    "synonyms",
    "antonyms",
  ];

  const col = Object.create(null);
  for (const name of required) {
    const idx = header.indexOf(name);
    col[name] = idx;
  }

  // If header is missing or incomplete, fall back to a safe positional mapping for your declared order.
  const hasAll = required.every((k) => col[k] >= 0);

  const wordRows = await getValues(`${SHEET_WORDS}!A2:M`);

  const myWords = wordRows
    .map((r) => {
      if (!hasAll) {
        // fallback assumes exact order: word,pos,definition,example1,example1_zh,example2,example2_zh,level,addedAt,dueAt,stage,synonyms,antonyms
        return {
          word: r[0] ?? "",
          pos: r[1] ?? "",
          definition: r[2] ?? "",
          example1: r[3] ?? "",
          example1_zh: r[4] ?? "",
          example2: r[5] ?? "",
          example2_zh: r[6] ?? "",
          level: r[7] ?? "",
          addedAt: r[8] ?? "",
          dueAt: r[9] ?? "",
          stage: toNumberSafe(r[10], 0),
          synonyms: r[11] ?? "",
          antonyms: r[12] ?? "",
        };
      }

      const get = (k) => (col[k] >= 0 ? r[col[k]] : "");
      return {
        word: get("word") ?? "",
        pos: get("pos") ?? "",
        definition: get("definition") ?? "",
        example1: get("example1") ?? "",
        example1_zh: get("example1_zh") ?? "",
        example2: get("example2") ?? "",
        example2_zh: get("example2_zh") ?? "",
        level: get("level") ?? "",
        addedAt: get("addedAt") ?? "",
        dueAt: get("dueAt") ?? "",
        stage: toNumberSafe(get("stage"), 0),
        synonyms: get("synonyms") ?? "",
        antonyms: get("antonyms") ?? "",
      };
    })
    .filter((x) => String(x.word || "").trim());

  // --- Logs ---
  const addedRows = await getValues(`${SHEET_ADDED}!A2:B`);
  const reviewRows = await getValues(`${SHEET_REVIEW}!A2:C`);

  const addedLogs = addedRows
    .map((r) => ({
      ts: Date.parse(r[0]) || Date.now(),
      word: r[1] ?? "",
    }))
    .filter((x) => x.word);

  const reviewLogs = reviewRows
    .map((r) => ({
      ts: Date.parse(r[0]) || Date.now(),
      word: r[1] ?? "",
      correct: String(r[2]).toUpperCase() === "TRUE",
    }))
    .filter((x) => x.word);

  // Store under both key sets to be compatible with different UI/storage versions.
  localStorage.setItem("myWords", JSON.stringify(myWords));
  localStorage.setItem("words", JSON.stringify(myWords));
  localStorage.setItem("addedLogs", JSON.stringify(addedLogs));
  localStorage.setItem("reviewLogs", JSON.stringify(reviewLogs));

  // ── Misc sheet：電子雞、標題覆寫、記憶法快取 ──
  let miscPulled = {};
  try {
    const miscRows = await getValues(`${SHEET_MISC}!A2:B`);
    const miscMap = Object.fromEntries(
      miscRows.filter(r => r[0] && r[1] != null).map(r => [r[0], r[1]])
    );
    if (miscMap.petData) {
      try {
        const pet = JSON.parse(miscMap.petData);
        for (const [k, v] of Object.entries(pet)) localStorage.setItem(k, v);
      } catch {}
    }
    if (miscMap.titleOverrides) localStorage.setItem('library_title_overrides', miscMap.titleOverrides);
    if (miscMap.mnemonicCache)  localStorage.setItem('mnemonic_cache', miscMap.mnemonicCache);
    if (miscMap.wordgarden_budget != null) localStorage.setItem('wordgarden_budget', miscMap.wordgarden_budget);
    for (const [k, v] of Object.entries(miscMap)) {
      if (k.startsWith('wordgarden_usage_')) localStorage.setItem(k, v);
    }
    miscPulled = miscMap;
  } catch (err) {
    console.warn("[SheetsBootstrap] Misc sheet not found or failed:", err.message);
  }

  // ── Enrichments sheet：翻譯 + 文法 ──
  let enrichmentCount = 0;
  try {
    const enrichmentRows = await getValues(`${SHEET_ENRICHMENTS}!A2:B`);
    const enrichments = {};
    for (const r of enrichmentRows) {
      if (r[0] && r[1]) {
        try { enrichments[r[0]] = JSON.parse(r[1]); } catch {}
      }
    }
    if (Object.keys(enrichments).length > 0) {
      localStorage.setItem('article_enrichments', JSON.stringify(enrichments));
      enrichmentCount = Object.keys(enrichments).length;
    }
  } catch (err) {
    console.warn("[SheetsBootstrap] Enrichments sheet not found or failed:", err.message);
  }

  // ── GrammarPoints sheet：文法練習點 ──
  let grammarCount = 0;
  try {
    const grammarRows = await getValues(`${SHEET_GRAMMAR}!A2:G`);
    const grammarPoints = grammarRows.filter(r => r[0]).map(r => ({
      id:              r[0] ?? "",
      name:            r[1] ?? "",
      explanation:     r[2] ?? "",
      context:         r[3] ?? "",
      word:            r[4] ?? "",
      exampleSentence: r[5] ?? "",
      addedAt:         r[6] ?? "",
    }));
    localStorage.setItem('grammarPracticePoints', JSON.stringify(grammarPoints));
    grammarCount = grammarPoints.length;
  } catch (err) {
    console.warn("[SheetsBootstrap] GrammarPoints sheet not found or failed:", err.message);
  }

  console.log("[SheetsBootstrap] pulled:", {
    myWords: myWords.length,
    addedLogs: addedLogs.length,
    reviewLogs: reviewLogs.length,
    hasAllHeader: hasAll,
    header,
    misc: Object.keys(miscPulled),
    enrichments: enrichmentCount,
    grammarPoints: grammarCount,
  });
}
