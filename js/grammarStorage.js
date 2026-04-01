// js/grammarStorage.js
// 文法練習點的輕量儲存（獨立於單字的間隔重複系統）
// 使用 localStorage，與 myWords 分開管理

const POINTS_KEY   = "grammarPracticePoints";
const HISTORY_KEY  = "grammarPracticeHistory";

function readJSON(k, def) {
  try { return JSON.parse(localStorage.getItem(k) || ""); }
  catch { return def; }
}
function writeJSON(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}

// ── 文法練習點清單 ──────────────────────────────────────
export function getGrammarPracticePoints() {
  return readJSON(POINTS_KEY, []);
}

/**
 * 加入一個文法點到練習清單
 * @param {{ name, explanation, context, word, exampleSentence }} point
 * @returns {{ added: boolean, obj: object }}
 */
export function addGrammarPoint(point) {
  const points = getGrammarPracticePoints();
  // 以 name + word 去重（grammar-tag 的 id 是 session 內唯一，跨次載入會變）
  const dedupeKey = `${(point.name || "").trim()}||${(point.word || "").trim()}`;
  const exists = points.find(p => `${(p.name || "").trim()}||${(p.word || "").trim()}` === dedupeKey);
  if (exists) return { added: false, obj: exists };

  const obj = {
    id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name:            point.name            || "",
    explanation:     point.explanation     || "",
    context:         point.context         || "",
    word:            point.word            || "",
    exampleSentence: point.exampleSentence || "",
    addedAt:         new Date().toISOString(),
  };
  points.push(obj);
  writeJSON(POINTS_KEY, points);
  return { added: true, obj };
}

export function removeGrammarPoint(id) {
  const points = getGrammarPracticePoints();
  const idx = points.findIndex(p => p.id === id);
  if (idx === -1) return false;
  points.splice(idx, 1);
  writeJSON(POINTS_KEY, points);
  return true;
}

// ── 練習歷史（輕量：最後練習時間 + 次數）──────────────────
export function getGrammarHistory() {
  return readJSON(HISTORY_KEY, {});
}

export function recordGrammarPractice(pointId) {
  const history = getGrammarHistory();
  const cur = history[pointId] || { lastPracticed: 0, count: 0 };
  history[pointId] = {
    lastPracticed: Date.now(),
    count: cur.count + 1,
  };
  writeJSON(HISTORY_KEY, history);
}
