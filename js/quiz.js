// js/quiz.js
// ─────────────────────────────────────────────
// 純題目邏輯（不碰 DOM）：抽干擾選項、組題、評分、答後語音、
// 以及「輸入英文」型題目的建構（含遮字與詞形偵測）。
// ─────────────────────────────────────────────

function _pickExamplePairCore(w) {
  const en = w.example_ai || w.example1 || w.example2 || "";
  const zh = w.example_ai_zh || w.example1_zh || w.example2_zh || w.definition || "";
  return { en, zh };
}

// 允許 UI 指定 showZh 偏好；但不依賴 DOM
export function pickExamplePair(w, opts = { showZh: true }) {
  const variants = [];

  // v1: example1 / 文章例句（同一組）
  const ex1 = (w.example1 || w.example_in_article || "").trim();
  const ex1zh = (w.example1_zh || w.example_in_article_zh || "").trim();
  if (ex1) variants.push({ tag: "ex1", en: ex1, zh: ex1zh });

  // v2: example_ai（同一組）
  const exAi = (w.example_ai || "").trim();
  const exAizh = (w.example_ai_zh || "").trim();
  if (exAi) variants.push({ tag: "ai", en: exAi, zh: exAizh });

  // v3: example2（同一組）
  const ex2 = (w.example2 || "").trim();
  const ex2zh = (w.example2_zh || "").trim();
  if (ex2) variants.push({ tag: "ex2", en: ex2, zh: ex2zh });

  // 沒例句就回空（由 UI 決定要不要顯示）
  if (!variants.length) return { en: "", zh: "", tag: "none" };

  // ✅ 輪替：每個單字各自記一個 index（存在 localStorage）
  const k = `exPick:${(w.id || w.word || "").toString().toLowerCase()}`;
  const idx = parseInt(localStorage.getItem(k) || "0", 10) || 0;
  const chosen = variants[idx % variants.length];
  localStorage.setItem(k, String((idx + 1) % variants.length));

  // ✅ 嚴格對應：showZh 只控制顯示與否，不允許拿別的欄位充當
  if (!opts?.showZh) return { ...chosen, zh: "" };
  return chosen; // zh 可能是 ""，那就顯示空 or UI 隱藏該行
}


// ── 干擾選項（同 pos / 同 level 優先）
export function sampleDistractors(target, allWords = [], count = 3) {
  const pos = String(target.pos || "").toLowerCase();
  const lvl = String(target.level || "").toUpperCase();
  let pool = allWords.filter(w => (w.word || "").toLowerCase() !== (target.word || "").toLowerCase() && (w.definition || "").trim());

  let primary = pool.filter(w => String(w.pos || "").toLowerCase() === pos);
  if (primary.length < count) {
    primary = primary.concat(pool.filter(w => String(w.level || "").toUpperCase() === lvl && !primary.includes(w)));
  }
  if (primary.length < count) primary = pool;

  const out = [];
  const used = new Set();
  while (out.length < count && primary.length) {
    const i = Math.floor(Math.random() * primary.length);
    const pick = primary.splice(i, 1)[0];
    const key = (pick.definition || "").trim();
    if (!key || used.has(key)) continue;
    used.add(key);
    out.push(pick);
  }
  return out;
}

// ── 產生選擇題（英→中 / 中→英）
export function makeChoiceQuestion(w, direction = "en2zh", allWords = []) {
  const stem = direction === "en2zh"
    ? `請選出 <strong>${w.word}</strong> 的正確中文意思：`
    : `請選出符合下列中文解釋的英文單字：<div class="mt-1 p-2 bg-gray-50 rounded">${w.definition || ""}</div>`;

  const correct = direction === "en2zh" ? (w.definition || "") : (w.word || "");
  const distractors = sampleDistractors(w, allWords, 3).map(x => direction === "en2zh" ? (x.definition || "") : (x.word || ""));
  const options = [correct, ...distractors].filter(Boolean);

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const correctIndex = options.findIndex(o => o === correct);

  return {
    type: "choice",
    direction,
    stem,
    options,
    correctIndex,
    expected: String(w.word || "").toLowerCase(),
    explainZh: w.definition || ""
  };
}

// ── 產生聽寫題（依偏好：單字 / 句子）
export function makeDictationQuestion(w, audioPref = "word") {
  // 朗讀內容仍可依偏好選「單字」或「句子」；句子來源採用與填空/typing一致的輪替例句
  const pair = pickExamplePair(w, { showZh: false });
  const speak = (audioPref === "sentence" && pair.en) ? pair.en : (w.word || pair.en || "");
  return {
    type: "dictation",
    speak,
    expected: String((audioPref === "sentence" && pair.en) ? pair.en : (w.word || "")).toLowerCase(),
    hintZh: ""   // 🚫 不再提供提示
  };
}

// ── 產生填空題（遮字仍在 UI；這裡輸出句子/翻譯/正解）
export function makeFillQuestion(w, showZh = true) {
  // ✅ 使用輪替例句（ex1/ai/ex2）且 showZh 不影響英文例句來源；中文只顯示同句對應翻譯（可能為空）
  const pair = pickExamplePair(w, { showZh: !!showZh });
  return {
    type: "fill",
    expected: String(w.word || "").toLowerCase(),
    exampleEn: pair.en || "",
    exampleZh: showZh ? (pair.zh || "") : ""
  };
}

// ── 輸入答案正規化：避免智慧引號/多空白/隱形字元造成誤判
// 例：don’t (U+2019) vs don't (')
function normalizeAnswer_(s) {
  if (s == null) return "";
  let x = String(s);

  // Unicode 正規化（避免同字不同碼位）
  try { x = x.normalize("NFKC"); } catch (_) {}

  // 常見隱形字元（零寬空白、BOM）
  x = x.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // 統一引號（避免智慧引號）
  x = x
    .replace(/[’‘‛‹›`´]/g, "'")
    .replace(/[“”„‟]/g, '"');

  // 統一破折號/連字號
  x = x.replace(/[‐‑‒–—―]/g, "-");

  // 空白正規化
  x = x.replace(/\s+/g, " ").trim();

  return x.toLowerCase();
}

// ── 評分：choice 接收 index；其他接收字串
export function grade(question, userInput) {
  if (question.type === "choice") {
    return { correct: Number(userInput) === Number(question.correctIndex), expected: question.expected };
  }

  const ans = normalizeAnswer_(userInput);
  const exp = normalizeAnswer_(question.expected || "");
  return { correct: ans === exp, expected: question.expected };
}

// ── 答後語音建議：回傳 [{text, lang}] 供外層串播
export function afterAnswerSpeech(mode, wordObj, question, prefs = { audio: "none", showZh: true }) {
  if (!prefs || prefs.audio === "none") return [];
  if (mode === "choice_en2zh" || mode === "choice_zh2en") {
    return [{ text: wordObj.word, lang: "en" }, { text: (wordObj.definition || ""), lang: "zh" }];
  }
  if (mode === "dictation") {
    return [{ text: question.expected, lang: "en" }];
  }
  // 填空：依使用者設定
  const seq = [];
  if (prefs.audio === "word" || prefs.audio === "both") seq.push({ text: wordObj.word, lang: "en" });
  if ((prefs.audio === "sentence" || prefs.audio === "both") && question.exampleEn) seq.push({ text: question.exampleEn, lang: "en" });
  if (prefs.showZh && (wordObj.definition || question.exampleZh)) seq.push({ text: (wordObj.definition || question.exampleZh), lang: "zh" });
  return seq;
}

// ─────────────────────────────────────────────
// 額外提供：輸入英文型題目建構（含遮字與詞形偵測）
// ─────────────────────────────────────────────

// 不規則動詞簡表（用於詞形偵測）
const IRREGULAR_MAP = {
  be: ['am','is','are','was','were','been','being'],
  do: ['does','did','done','doing'],
  have: ['has','had','having'],
  go: ['goes','went','gone','going'],
  get: ['gets','got','gotten','getting'],
  make: ['makes','made','making'],
  take: ['takes','took','taken','taking'],
  come: ['comes','came','come','coming'],
  see: ['sees','saw','seen','seeing'],
  eat: ['eats','ate','eaten','eating'],
  write: ['writes','wrote','written','writing'],
  read: ['reads','read','reading'],
  say: ['says','said','saying'],
  tell: ['tells','told','telling'],
  think: ['thinks','thought','thinking'],
  buy: ['buys','bought','buying'],
  bring: ['brings','brought','bringing'],
  run: ['runs','ran','running'],
  begin: ['begins','began','begun','beginning'],
  drink: ['drinks','drank','drunk','drinking'],
  drive: ['drives','drove','driven','driving'],
  give: ['gives','gave','given','giving'],
  leave: ['leaves','left','leaving'],
  feel: ['feels','felt','feeling'],
  keep: ['keeps','kept','keeping'],
  hold: ['holds','held','holding'],
  pay: ['pays','paid','paying'],
  meet: ['meets','met','meeting'],
  find: ['finds','found','finding'],
  mean: ['means','meant','meaning'],
  sit: ['sits','sat','sitting'],
  swim: ['swims','swam','swum','swimming'],
  sing: ['sings','sang','sung','singing'],
  speak: ['speaks','spoke','spoken','speaking'],
  wear: ['wears','wore','worn','wearing'],
  win: ['wins','won','winning'],
  lose: ['loses','lost','losing'],
  build: ['builds','built','building'],
  choose: ['chooses','chose','chosen','choosing'],
  cut: ['cuts','cut','cutting'],
  put: ['puts','put','putting'],
  set: ['sets','set','setting'],
};

function buildMorphRegex(base) {
  const b = String(base || '').toLowerCase();
  const parts = new Set();

  // 不規則
  (IRREGULAR_MAP[b] || []).forEach(f => parts.add(f.toLowerCase()));
  parts.add(b); // 原型

  // 規則變化：三單/plural
  const esEndings = ['s','x','z','ch','sh','o'];
  if (esEndings.some(e => b.endsWith(e))) parts.add(b + 'es'); else parts.add(b + 's');

  // 過去式/分詞
  if (b.endsWith('y') && !/[aeiou]y$/.test(b)) {
    parts.add(b.slice(0, -1) + 'ies'); // studies
    parts.add(b.slice(0, -1) + 'ied'); // studied
  } else if (b.endsWith('e')) {
    parts.add(b + 'd');   // liked
    parts.add(b + 'ing'); // (先加一般 ing，下面會處理 drop e)
  } else {
    parts.add(b + 'ed');  // worked
  }

  // -ing：drop e / CVC 雙寫
  if (b.endsWith('ie')) {
    parts.add(b.slice(0, -2) + 'ying'); // die -> dying
  } else if (b.endsWith('e') && !b.endsWith('ee')) {
    parts.add(b.slice(0, -1) + 'ing');  // make -> making
  } else {
    const cvc = /([bcdfghjklmnpqrstvwxyz])([aeiou])([bcdfghjklmnpqrstvwxyz])$/;
    if (cvc.test(b) && !/[wxy]$/.test(b)) {
      const last = b.slice(-1);
      parts.add(b + last + 'ing'); // stop -> stopping
      parts.add(b + last + 'ed');  // stop -> stopped
    }
    parts.add(b + 'ing');
  }

  const alt = [...parts].map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(?:${alt})\\b`, 'i');
}

export function detectExpectedVariant(base, sentence) {
  if (!sentence || !base) return '';
  const re = buildMorphRegex(base);
  const m = sentence.match(re);
  return m ? m[0].toLowerCase() : '';
}

// 單字遮字（尊重字邊界）
export function maskWordInText(word = "", text = "") {
  if (!word || !text) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  return text.replace(re, (m) =>
    m.length <= 2 ? "_".repeat(m.length) : m[0] + "_".repeat(m.length - 2) + m[m.length - 1]
  );
}

// 建立「輸入英文」型題目（給 UI 使用）
export function buildTypingQuestion(wordObj, opts = { showZh: true }) {
  const pair = pickExamplePair(wordObj, { showZh: !!opts.showZh });
  const expectedVariant = detectExpectedVariant(wordObj.word, pair.en);
  const expected = (expectedVariant || (wordObj.word || '')).toLowerCase();
  const maskedExample = pair.en ? maskWordInText(expected || wordObj.word, pair.en) : "";
  return {
    type: "typing",
    expected,
    definition: wordObj.definition || "",
    exampleEn: pair.en || "",
    exampleZh: opts.showZh ? (pair.zh || "") : "",
    maskedExample
  };
}



