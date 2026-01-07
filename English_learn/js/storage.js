// 讀/寫
export function getAllWords() {
  try { return JSON.parse(localStorage.getItem("myWords") || "[]"); }
  catch { return []; }
}
export function saveAllWords(arr) {
  localStorage.setItem("myWords", JSON.stringify(arr));
  // 方案B：不再使用 Supabase 的 Sync
}

// logs
function readJSON(k, def){ try{return JSON.parse(localStorage.getItem(k)||"");}catch{return def;} }
function writeJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
export function logAdded(word){ const a = readJSON("addedLogs", []); a.push({ word, ts: Date.now() }); writeJSON("addedLogs", a); }
export function logReview(word, correct){
  const a = readJSON("reviewLogs", []);
  a.push({ word, ts: Date.now(), correct: !!correct });
  writeJSON("reviewLogs", a);

  // ✅ 方案B：自動 append 到 Google Sheet（ReviewLogs）
  //window.GSheetsAppend?.enqueueReview?.(word, !!correct);
}



// 新增 / 刪除 / 更新
// 1) addWord：新增單字，預設立刻可練（dueAt 設成現在-1s）
export function addWord(wordObj = {}) {
  const all = getAllWords();
  const key = (wordObj.word || "").toLowerCase().trim();
  if (!key) return { added: false, obj: null };

  const hit = all.find(w => (w.word || "").toLowerCase() === key);
  if (hit) return { added: false, obj: hit };

  const now = new Date();
  const obj = {
    addedAt: now.toISOString(),
    dueAt: new Date(now.getTime() - 1000).toISOString(), // 立即可測
    stage: 0,
    ...wordObj
  };
  all.push(obj);
 saveAllWords(all);
  logAdded(obj.word);
  window.GSheetsAppend?.enqueueAdded?.(obj.word);
  window.WordsAutoSync?.schedule?.();
  
  return { added: true, obj };
}

export function deleteWord(word) {
  const key = (word || "").toLowerCase();
  const all = getAllWords();
  const idx = all.findIndex(w => (w.word || "").toLowerCase() === key);
  if (idx === -1) return null;
  const [deleted] = all.splice(idx, 1);
  saveAllWords(all);

  // ✅ 刪除也要同步覆寫 Words
  window.WordsAutoSync?.schedule?.();

  return deleted;
}


// 2) updateWord：以展開運算子合併寫回（確保不覆蓋掉原本欄位）
export function updateWord(word, patch) {
  const key = (word || "").toLowerCase();
  const all = getAllWords();
  const idx = all.findIndex(w => (w.word || "").toLowerCase() === key);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], ...patch };
  saveAllWords(all);
  window.WordsAutoSync?.schedule?.();
  return true;
}


// 查詢
export function getTodayWords() {
  const all = getAllWords(); const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  return all.filter(w => {
    if (!w.addedAt) return false;
    const t = new Date(w.addedAt);
    return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
  });
}
export function getDueWords(ref = new Date()) {
  return getAllWords().filter(w => !w.dueAt || new Date(w.dueAt) <= ref);
}
export function getDueCount() { return getDueWords().length; }
export function ensureDueForAll() {
  const all = getAllWords(); let changed = false;
  const nowMinus1 = new Date(Date.now() - 1000).toISOString();
  for (const w of all) { if (!w.dueAt) { w.dueAt = nowMinus1; changed = true; } }
  if (changed) {
  saveAllWords(all);
  window.WordsAutoSync?.schedule?.();
}

}

// 間隔複習
// 3) scheduleNext：依正誤調整 stage，設定下一次 dueAt
export function scheduleNext(word, wasCorrect) {
  const key = (word || "").toLowerCase();
  const all = getAllWords();
  const idx = all.findIndex(w => (w.word || "").toLowerCase() === key);
  if (idx === -1) return false;

  // 你的間隔梯度：0,1,3,7,14,30（天）
  const schedule = [0, 1, 3, 7, 14, 30];

  let stage = Number(all[idx].stage || 0);
  stage = wasCorrect ? Math.min(schedule.length - 1, stage + 1)
                     : Math.max(0, stage - 1);

  const next = new Date();
  next.setDate(next.getDate() + schedule[stage]);

  all[idx] = { ...all[idx], stage, dueAt: next.toISOString() };
  saveAllWords(all);
  window.WordsAutoSync?.schedule?.();
  logReview(word, !!wasCorrect);
  return true;
}

export function markReviewed(word){ return scheduleNext(word, true); }

// 統計
export function getMasteredCount(th = 4) {
  return getAllWords().filter(w => (w.stage || 0) >= th).length;
}
function localDateKey(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // 本地年月日，不受時區影響
}

export function getDailyStats(days = 14){
  const today = new Date(); today.setHours(0,0,0,0);
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    buckets.push({ key, d, added: 0, reviewed: 0 });
  }
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]));

  const added = JSON.parse(localStorage.getItem("addedLogs") || "[]");
  const reviewed = JSON.parse(localStorage.getItem("reviewLogs") || "[]");

  added.forEach(a => {
    const k = localDateKey(new Date(a.ts));
    if (byKey[k]) byKey[k].added++;
  });
  reviewed.forEach(r => {
    const k = localDateKey(new Date(r.ts));
    if (byKey[k]) byKey[k].reviewed++;
  });

  return buckets; // 已按（舊→新）排序
}

