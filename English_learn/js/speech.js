// js/speech.js
// 發音模組：Web Speech API 封裝（英/中語音、序列連播、停止、偏好）
// 介面：speak(text, opts), speakEn(text), speakZh(text), speakSequence(seq), stopAll(), setSpeechPrefs(prefs)

let voices = [];
let ready = false;
let queue = [];
let playing = false;

const prefs = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voiceEn: null,  // 指定英文 voice.name（可選）
  voiceZh: null   // 指定中文 voice.name（可選）
};

function loadVoicesOnce() {
  function load() {
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    if (voices.length) {
      ready = true;
    }
  }
  try {
    load();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => { load(); };
    }
  } catch {}
}
loadVoicesOnce();

function isChinese(text = "") {
  return /[\u4E00-\u9FFF]/.test(text);
}

function pickVoice(langWanted, specifiedName) {
  if (!ready) return null;
  if (specifiedName) {
    const v = voices.find(v => v.name === specifiedName);
    if (v) return v;
  }
  // 優先完全相符，再找同語系
  const exact = voices.find(v => (v.lang || "").toLowerCase() === (langWanted || "").toLowerCase());
  if (exact) return exact;

  const tag = (langWanted || "").split("-")[0];
  const sameLang = voices.find(v => (v.lang || "").toLowerCase().startsWith(tag));
  if (sameLang) return sameLang;

  // 兜底：第一個可用
  return voices[0] || null;
}

function _utterFor(text, lang) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = prefs.rate;
  u.pitch = prefs.pitch;
  u.volume = prefs.volume;
  // 指定 voice
  if (lang?.startsWith("zh")) u.voice = pickVoice(lang, prefs.voiceZh);
  else u.voice = pickVoice(lang, prefs.voiceEn);
  return u;
}

export function setSpeechPrefs(p = {}) {
  if (typeof p.rate === "number")   prefs.rate = Math.min(2, Math.max(0.5, p.rate));
  if (typeof p.pitch === "number")  prefs.pitch = Math.min(2, Math.max(0, p.pitch));
  if (typeof p.volume === "number") prefs.volume = Math.min(1, Math.max(0, p.volume));
  if (typeof p.voiceEn === "string") prefs.voiceEn = p.voiceEn || null;
  if (typeof p.voiceZh === "string") prefs.voiceZh = p.voiceZh || null;
}

export function stopAll() {
  try { window.speechSynthesis?.cancel(); } catch {}
  queue = [];
  playing = false;
}

export function speak(text, opts = {}) {
  if (!text) return;
  // 自動語系或外部指定
  const lang = opts.lang || (isChinese(text) ? "zh-TW" : "en-US");
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
    return;
  }
  const u = _utterFor(text, lang);
  window.speechSynthesis.speak(u);
}

export function speakEn(text, opts = {}) {
  speak(text, { ...opts, lang: "en-US" });
}

export function speakZh(text, opts = {}) {
  speak(text, { ...opts, lang: "zh-TW" });
}

// seq: Array<string | {text, lang?}>
export function speakSequence(seq = []) {
  if (!Array.isArray(seq) || !seq.length) return;
  stopAll();
  queue = seq.map(item => {
    if (typeof item === "string") return { text: item, lang: isChinese(item) ? "zh-TW" : "en-US" };
    return { text: String(item.text || ""), lang: item.lang || (isChinese(item.text) ? "zh-TW" : "en-US") };
  }).filter(x => x.text);

  if (!queue.length) return;
  playing = true;

  const next = () => {
    if (!queue.length) { playing = false; return; }
    const cur = queue.shift();
    const u = _utterFor(cur.text, cur.lang);
    u.onend = () => next();
    u.onerror = () => next();
    try { window.speechSynthesis.speak(u); } catch { next(); }
  };
  next();
}

// 與舊程式相容（window.*）
if (typeof window !== "undefined") {
  window.speak = (t) => speak(t);
  window.speakSequence = (arr) => speakSequence(arr);
  window.stopSpeech = () => stopAll();
}
