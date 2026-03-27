/**
 * js/pixel_pet.js — 像素電子雞 PixelPet
 *
 * localStorage 鍵值：
 *   lastAddWordTime  — 最後新增單字的時間戳 (ms)
 *   lastReviewTime   — 最後複習的時間戳 (ms)
 *   currentXP        — 目前等級內的 XP
 *   level            — 目前等級 (從 1 起)
 *   pet_last_active_ts — 最後互動時間（用於判斷睡眠）
 */
import { getAllWords, getDueCount } from './storage.js';

// ─── Color palette ────────────────────────────────────────────────────────────
const _ = null;
const EC = '#F5E6CC', EH = '#FFFDF5', EK = '#B0A080';
const CY = '#FFD700', CD = '#FFC200', CT = '#FFF0A0', CB = '#FF8C00';
const RD = '#CC2200', RB = '#8B7355', RL = '#C4A882', RK = '#6B5535', RF = '#FF8C00';
const EY = '#222222', EG = '#FFFFFF';

// ─── Pixel sprite grids (16 × 20, 3 px/cell → 48 × 60 SVG) ──────────────────
const EGG = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,EC,EC,EC,EC,EC,EC,_,_,_,_,_],
  [_,_,_,_,EC,EC,EC,EC,EC,EC,EC,EC,_,_,_,_],
  [_,_,_,EC,EH,EH,EC,EC,EC,EC,EC,EC,EC,_,_,_],
  [_,_,EC,EC,EH,EC,EC,EC,EC,EC,EC,EC,EC,EC,_,_],
  [_,_,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,_,_],
  [_,_,EC,EC,EC,EC,EC,EK,EC,EC,EC,EC,EC,EC,_,_],
  [_,_,EC,EC,EC,EC,EK,EC,EK,EC,EC,EC,EC,EC,_,_],
  [_,_,EC,EC,EC,EC,EC,EK,EC,EC,EC,EC,EC,EC,_,_],
  [_,_,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,_,_],
  [_,_,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,_,_],
  [_,_,_,EC,EC,EC,EC,EC,EC,EC,EC,EC,EC,_,_,_],
  [_,_,_,_,EC,EC,EC,EC,EC,EC,EC,EC,_,_,_,_],
  [_,_,_,_,_,EC,EC,EC,EC,EC,EC,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

const CHICK = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,CY,CY,CY,CY,CY,CY,_,_,_,_,_],
  [_,_,_,_,CY,CY,CY,CY,CY,CY,CY,CY,CB,CB,_,_],
  [_,_,_,_,CY,CY,EY,EG,CY,CY,CY,CY,CB,CB,_,_],
  [_,_,_,_,CY,CY,CY,CY,CY,CY,CY,CY,CB,_,_,_],
  [_,_,_,_,_,CY,CY,CY,CY,CY,CY,_,_,_,_,_],
  [_,CD,CD,_,CY,CY,CY,CY,CY,CY,CY,_,CD,CD,_,_],
  [_,CD,CY,CY,CY,CY,CY,CY,CY,CY,CY,CY,CY,CD,_,_],
  [_,CD,CY,CT,CT,CT,CT,CT,CT,CY,CY,CY,CY,CD,_,_],
  [_,CD,CY,CT,CT,CT,CT,CT,CT,CY,CY,CY,CY,CD,_,_],
  [_,_,CD,CY,CY,CY,CY,CY,CY,CY,CY,CY,CD,_,_,_],
  [_,_,_,_,CY,CY,CY,CY,CY,CY,CY,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,CB,_,_,_,CB,_,_,_,_,_,_],
  [_,_,_,_,_,CB,_,_,_,CB,_,_,_,_,_,_],
  [_,_,_,_,CB,CB,CB,_,CB,CB,CB,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];


const ROOSTER = [
  [_,_,_,_,_,RD,_,RD,_,RD,_,_,_,_,_,_],
  [_,_,_,_,_,RD,RD,RD,RD,RD,_,_,_,_,_,_],
  [_,_,_,_,RB,RB,RB,RB,RB,RB,RB,_,_,_,_,_],
  [_,_,_,_,RB,RB,EY,EG,RB,RB,RB,RF,RF,_,_,_],
  [_,_,_,RD,RB,RB,RB,RB,RB,RB,RB,RF,_,_,_,_],
  [_,_,_,RD,RD,RB,RB,RB,RB,RB,_,_,_,_,_,_],
  [_,_,_,_,_,RB,RB,RB,RB,RB,_,_,_,_,_,_],
  [_,RK,RK,RB,RB,RB,RB,RB,RB,RB,_,_,RD,_,_,_],
  [_,RK,RK,RB,RL,RL,RL,RL,RB,RB,_,RD,RD,_,_,_],
  [_,RK,RB,RB,RL,RL,RL,RL,RB,RB,_,RD,RD,_,_,_],
  [_,_,RK,RB,RB,RB,RB,RB,RB,RB,_,_,RD,_,_,_],
  [_,_,_,_,RB,RB,RB,RB,RB,_,_,_,_,_,_,_],
  [_,_,_,_,RB,RB,RB,RB,RB,_,_,_,_,_,_,_],
  [_,_,_,_,_,RF,_,_,_,RF,_,_,_,_,_,_],
  [_,_,_,_,_,RF,_,_,_,RF,_,_,_,_,_,_],
  [_,_,_,_,RF,RF,RF,RF,RF,RF,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// ─── SVG renderer ─────────────────────────────────────────────────────────────
function gridToSVG(grid, px = 3) {
  const rows = grid.length, cols = grid[0].length;
  let rects = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c])
        rects += `<rect x="${c*px}" y="${r*px}" width="${px}" height="${px}" fill="${grid[r][c]}"/>`;
  return `<svg viewBox="0 0 ${cols*px} ${rows*px}" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;display:block">${rects}</svg>`;
}

// ─── Stage helpers ────────────────────────────────────────────────────────────
function getPetStage(wordCount) {
  if (wordCount < 50)   return 'egg';
  if (wordCount <= 200) return 'chick';
  return 'rooster';
}
function getStageSVG(stage) {
  if (stage === 'egg')     return gridToSVG(EGG);
  if (stage === 'rooster') return gridToSVG(ROOSTER);
  return gridToSVG(CHICK);
}
function getStageLabel(stage) {
  if (stage === 'egg')     return '雞蛋';
  if (stage === 'rooster') return '大公雞';
  return '小雞';
}

// ─── XP / Level system ────────────────────────────────────────────────────────
// 升級所需 XP：第 N 級需要 N × 100 XP（LV1→2: 100, LV2→3: 200 …）
function xpNeeded(lv) { return lv * 100; }

/**
 * 增加 XP，自動處理升級，並持久化到 localStorage。
 * @param {number} amount
 * @returns {{ xp: number, lv: number, leveled: boolean }}
 */
export function addXP(amount) {
  let xp = Number(localStorage.getItem('currentXP') || 0);
  let lv = Number(localStorage.getItem('level')     || 1);

  xp += amount;
  let leveled = false;
  while (xp >= xpNeeded(lv)) {
    xp     -= xpNeeded(lv);
    lv     += 1;
    leveled = true;
  }

  localStorage.setItem('currentXP', String(xp));
  localStorage.setItem('level',     String(lv));
  return { xp, lv, leveled };
}

// ─── Stat calculations ────────────────────────────────────────────────────────
/**
 * 飽食度
 * 公式：70% − (距離上次新增的小時數 × rate%)
 * rate = 5%/hr (蛋/小雞)；7%/hr (大公雞)
 */
function getHunger() {
  const ts = localStorage.getItem('lastAddWordTime');
  if (!ts) return 0; // 從未新增過單字

  const wordCount = getAllWords().length;
  const stage     = getPetStage(wordCount);
  const rate      = stage === 'rooster' ? 7 : 5;
  const hours     = (Date.now() - Number(ts)) / 3_600_000;
  return Math.max(0, Math.min(100, Math.round(70 - hours * rate)));
}

/**
 * 心情度
 * 若待複習 > 50 且距上次複習 > 12 小時，每小時 −10%；否則 100%
 */
function getMood() {
  let dueCount = 0;
  try { dueCount = getDueCount(); } catch { dueCount = 0; }
  if (dueCount <= 50) return 100;

  const ts   = localStorage.getItem('lastReviewTime');
  const base = ts
    ? Number(ts)
    : Number(localStorage.getItem('pet_last_active_ts') || Date.now());
  const hours = (Date.now() - base) / 3_600_000;
  if (hours < 12) return 100;
  return Math.max(0, Math.round(100 - (hours - 12) * 10));
}

// ─── Penalty decorations ──────────────────────────────────────────────────────
const PX = 5;
const BR = '#7B4A2D', BL = '#C07840', BD = '#4A2810';
const GR = '#888888', GL = '#BBBBBB';

const POOP_GRID = [
  [_,_,_,BL,BL,_,_,_],
  [_,_,BL,BR,BR,BL,_,_],
  [_,BR,BR,BR,BR,BR,BR,_],
  [BR,BR,BR,BR,BR,BR,BR,BR],
  [BR,BR,BR,BR,BR,BR,BR,BR],
  [_,BD,BR,BR,BR,BR,BD,_],
  [_,_,BR,BR,BR,BR,_,_],
  [_,_,_,BD,BD,_,_,_],
];

const WEB_GRID = [
  [GL,_,_,_,GR,_,_,_,GL],
  [_,GR,_,_,GR,_,_,GR,_],
  [_,_,GR,_,GR,_,GR,_,_],
  [_,_,_,GR,GR,GR,_,_,_],
  [GR,GR,GR,GR,GL,GR,GR,GR,GR],
  [_,_,_,GR,GR,GR,_,_,_],
  [_,_,GR,_,GR,_,GR,_,_],
  [_,GR,_,_,GR,_,_,GR,_],
  [GL,_,_,_,GR,_,_,_,GL],
];

function penaltyToSVG(grid) {
  const rows = grid.length, cols = grid[0].length;
  let rects = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c])
        rects += `<rect x="${c*PX}" y="${r*PX}" width="${PX}" height="${PX}" fill="${grid[r][c]}"/>`;
  return `<svg viewBox="0 0 ${cols*PX} ${rows*PX}" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;display:block">${rects}</svg>`;
}

function updatePenaltyDecor(mood) {
  const el = document.getElementById('petPenalty');
  if (!el) return;
  if (mood < 20) {
    const grid = mood < 10 ? POOP_GRID : WEB_GRID;
    if (!el._lastMoodTier || el._lastMoodTier !== (mood < 10 ? 'poop' : 'web'))  {
      el._lastMoodTier = mood < 10 ? 'poop' : 'web';
      el.innerHTML = penaltyToSVG(grid);
    }
    el.style.display = 'block';
  } else {
    el.style.display  = 'none';
    el._lastMoodTier  = null;
  }
}

// ─── Animation state ──────────────────────────────────────────────────────────
let _animTimer  = null;
let _animActive = false;
let _idleTimer  = null;

function scheduleIdleAction() {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    _idleTimer = null;
    if (!_animActive) {
      triggerPetAnim(Math.random() < 0.5 ? 'eating' : 'head-turn', 800);
    }
    scheduleIdleAction();
  }, 30_000);
}

export function triggerPetAnim(state, duration = 2000) {
  const art    = document.getElementById('pixelPetArt');
  const bubble = document.getElementById('petBubble');
  if (!art) return;

  if (_animTimer) { clearTimeout(_animTimer); _animTimer = null; }
  _animActive    = true;
  art.className  = `pet-art ${state}`;

  if (bubble) {
    const txt = { slacking: '...', sleeping: 'Zzz', happy: '♥' }[state] ?? '';
    bubble.textContent   = txt;
    bubble.style.display = txt ? 'block' : 'none';
  }

  if (duration > 0 && state !== 'slacking' && state !== 'sleeping') {
    _animTimer = setTimeout(() => {
      _animTimer  = null;
      _animActive = false;
      updatePetDisplay();
    }, duration);
  }
}

// ─── Display update ───────────────────────────────────────────────────────────
export function updatePetDisplay() {
  if (_animActive) return;

  const artEl        = document.getElementById('pixelPetArt');
  const bubbleEl     = document.getElementById('petBubble');
  const stageLabelEl = document.getElementById('petStageLabel');
  const hungerBarEl  = document.getElementById('hungerBar');
  const hungerPctEl  = document.getElementById('hungerPct');
  const moodBarEl    = document.getElementById('moodBar');
  const moodPctEl    = document.getElementById('moodPct');
  const xpBarEl      = document.getElementById('xpBar');
  const xpPctEl      = document.getElementById('xpPct');
  if (!artEl) return;

  // ── Stage ──
  const wordCount = getAllWords().length;
  const stage     = getPetStage(wordCount);

  // ── Level + XP ──
  const lv    = Number(localStorage.getItem('level')     || 1);
  const xp    = Number(localStorage.getItem('currentXP') || 0);
  const xpMax = xpNeeded(lv);
  const xpPct = Math.round((xp / xpMax) * 100);

  if (stageLabelEl) stageLabelEl.textContent = `${getStageLabel(stage)} · LV${lv}`;
  if (xpBarEl) xpBarEl.style.width = xpPct + '%';
  if (xpPctEl) xpPctEl.textContent = `${xp}/${xpMax}`;

  // ── Hunger ──
  const hunger = getHunger();
  if (hungerBarEl) {
    hungerBarEl.style.width      = hunger + '%';
    hungerBarEl.style.background = hunger > 50 ? '#A3B18A' : hunger > 25 ? '#E8B87A' : '#E07070';
  }
  if (hungerPctEl) hungerPctEl.textContent = hunger + '%';

  // ── Mood ──
  const mood = getMood();
  if (moodBarEl) {
    moodBarEl.style.width      = mood + '%';
    moodBarEl.style.background = mood > 50 ? '#BC9C7F' : mood > 25 ? '#E8B87A' : '#E07070';
  }
  if (moodPctEl) moodPctEl.textContent = mood + '%';

  // ── Auto-state (priority: sleeping > slacking > idle) ──
  const hour             = new Date().getHours();
  const isNightTime      = hour >= 23 || hour < 7;
  const lastActive       = Number(localStorage.getItem('pet_last_active_ts') || Date.now());
  const hoursSinceActive = (Date.now() - lastActive) / 3_600_000;

  let autoState = 'idle';
  if (isNightTime || (hoursSinceActive >= 24 && hunger < 30)) {
    autoState = 'sleeping';
  } else if (mood < 30 || hunger < 30) {
    autoState = 'slacking';
  }

  // ── Sprite ──
  artEl.innerHTML = getStageSVG(stage);
  artEl.className = `pet-art ${autoState}`;

  if (bubbleEl) {
    const txt = { slacking: '...', sleeping: 'Zzz' }[autoState] ?? '';
    bubbleEl.textContent   = txt;
    bubbleEl.style.display = txt ? 'block' : 'none';
  }

  // ── 環境處罰裝飾 ──
  updatePenaltyDecor(mood);
}

// ─── Lifecycle hooks ──────────────────────────────────────────────────────────
/** 新增單字：+10 XP，觸發啄食動畫，補飽食度 */
export function onWordAdded() {
  localStorage.setItem('lastAddWordTime',    String(Date.now()));
  localStorage.setItem('pet_last_active_ts', String(Date.now()));
  addXP(10);
  triggerPetAnim('eating', 2000);
}

/**
 * 測驗結束
 * @param {boolean} passed  正確率 ≥ 60%
 * @param {boolean} perfect 正確率 = 100%（完美測驗 +50 XP）
 */
export function onReviewComplete(passed, perfect = false) {
  localStorage.setItem('lastReviewTime',     String(Date.now()));
  localStorage.setItem('pet_last_active_ts', String(Date.now()));

  if (perfect) {
    addXP(50);
    triggerPetAnim('happy', 3000);
  } else if (passed) {
    addXP(2);
    triggerPetAnim('happy', 3000);
  } else {
    _animActive = false;
    updatePetDisplay();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initPixelPet() {
  // 一次性遷移舊 key → 新 key（不影響現有使用者資料）
  if (!localStorage.getItem('lastAddWordTime') && localStorage.getItem('pet_last_word_ts'))
    localStorage.setItem('lastAddWordTime', localStorage.getItem('pet_last_word_ts'));
  if (!localStorage.getItem('lastReviewTime') && localStorage.getItem('pet_last_review_ts'))
    localStorage.setItem('lastReviewTime', localStorage.getItem('pet_last_review_ts'));

  if (!localStorage.getItem('pet_last_active_ts'))
    localStorage.setItem('pet_last_active_ts', String(Date.now()));

  updatePetDisplay();
  scheduleIdleAction();
  // 每 5 分鐘自動重算數值
  setInterval(() => { if (!_animActive) updatePetDisplay(); }, 5 * 60 * 1000);
}
