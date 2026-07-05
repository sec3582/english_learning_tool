/**
 * js/pixel_pet.js — 作坊燭火（Phase 5f 由「像素電子雞」換皮而成）
 *
 * 只換 sprite 與命名，資料邏輯完全不動——見下方 localStorage 鍵值表，
 * 全部沿用舊有欄位名稱，未來若要接回小說系統（v2 目標 6）不需要遷移資料。
 *
 * localStorage 鍵值：
 *   lastAddWordTime    — 最後新增單字的時間戳 (ms)
 *   lastReviewTime     — 最後複習的時間戳 (ms)
 *   currentXP          — 目前等級內的 XP
 *   level              — 目前等級 (從 1 起)
 *   pet_last_active_ts — 最後互動時間（用於判斷睡眠）
 *   petHunger          — 目前飽食度 (0–100)，視覺對應：燭火亮度（穩定明亮 ↔ 搖曳將熄）
 *   petHungerDecayTs   — 上次飽食度衰減計算時間戳
 *   petMood            — 目前心情度 (0–100)，視覺對應：蠟淚整齊度（平整凝結 ↔ 雜亂垂掛）
 *   petMoodDecayTs     — 上次心情度衰減計算時間戳
 */
import { getDueCount } from './storage.js';

// ─── Color palette ────────────────────────────────────────────────────────────
const _ = null;
// 蠟身：暖象牙蠟（主色／高光／陰影）＋ 燭芯
const WX = '#EDE0C8', WH = '#F7EFDC', WS = '#C9B48C', WK = '#3A2A1C';
// 蠟淚（心情低落時的雜亂垂墜，只在 messy 版本用到）
const DR = '#A97C4A';
// 鑲金燭台（LV16+ 專屬，呼應 storyboard.md CG-3 的蠟／金屬材質語彙）
const GD = '#C89B3C', GS = '#8B6B2E';
// 火焰：F1/F2/F3 不是固定色，只是「亮度層級」標記——實際顏色由
// flameColor() 依飽食度即時計算（亮＝穩定明亮，暗＝搖曳將熄），
// 對應決策 [[decision-5f-upload-pet]] 的 hunger→燭火亮度映射。
const F1 = 'F1', F2 = 'F2', F3 = 'F3';

// 火焰亮度：hunger 0–100 線性內插兩個端點色
const FLAME_RAMPS = {
  F1: ['#8A5A2E', '#FFF3B0'], // core：暗焦褐 → 亮米黃
  F2: ['#7A4A22', '#F5A623'], // mid：暗褐 → 琥珀
  F3: ['#5C3A1C', '#C97A1E'], // outer：更暗褐 → 橙褐
};
function _mixHex(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
function flameColor(token, hunger) {
  const t = Math.max(0, Math.min(1, hunger / 100));
  const [dim, bright] = FLAME_RAMPS[token];
  return _mixHex(dim, bright, t);
}

// ─── Pixel sprite grids (16 × 20, 3 px/cell → 48 × 60 SVG) ──────────────────
// 進化階梯：新蠟燭（LV1–5）→ 半燃蠟燭（LV6–15）→ 鑲金燭台（LV16+），
// 對應原本 蛋 → 小雞 → 大公雞 的三段式進化。半燃／鑲金各有 NEAT／MESSY
// 兩個蠟淚版本，由 mood 決定選哪一版（見 getStageSVG）；新蠟燭剛點燃，
// 還沒有蠟淚可言，只有一個版本。
// 新蠟燭（LV1–5）：矮胖、剛點燃，還沒有蠟淚
const CANDLE_NEW = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,F1,F1,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,F2,F1,F1,F2,_,_,_,_,_,_],
  [_,_,_,_,_,F2,F2,F1,F1,F2,F2,_,_,_,_,_],
  [_,_,_,_,_,F3,F2,F2,F2,F2,F3,_,_,_,_,_],
  [_,_,_,_,_,_,F3,F2,F2,F3,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,WK,WK,_,_,_,_,_,_,_],
  [_,_,_,_,_,WH,WX,WX,WX,WX,WS,_,_,_,_,_],
  [_,_,_,_,_,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,_,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,_,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,_,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,_,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,_,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WS,WX,WX,WX,WX,WX,WS,_,_,_,_,_],
  [_,_,_,_,WS,WS,WS,WS,WS,WS,WS,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// 半燃蠟燭（LV6–15）：燒了一段時間，蠟身變高——NEAT／MESSY 由 mood 決定
const CANDLE_HALF_NEAT = [
  [_,_,_,_,_,_,_,F1,F1,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,F2,F1,F1,F2,_,_,_,_,_,_],
  [_,_,_,_,_,F2,F2,F1,F1,F2,F2,_,_,_,_,_],
  [_,_,_,_,_,F3,F2,F2,F2,F2,F3,_,_,_,_,_],
  [_,_,_,_,_,_,F3,F2,F2,F3,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,WK,WK,_,_,_,_,_,_,_],
  [_,_,_,_,WH,WX,WX,WX,WX,WX,WS,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,WS,WX,WX,WX,WX,WX,WX,WS,_,_,_,_,_],
  [_,_,_,WS,WS,WS,WS,WS,WS,WS,WS,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];
const CANDLE_HALF_MESSY = CANDLE_HALF_NEAT.map((row, i) => {
  if (i === 9)  { const r = [...row]; r[3] = DR; r[11] = DR; return r; }
  if (i === 10) { const r = [...row]; r[3] = DR; return r; }
  return row;
});

// 鑲金燭台（LV16+）：最盛大版本，坐在金色燭台上，火焰也更亮更寬
const CANDLE_GILDED_NEAT = [
  [_,_,_,_,_,_,F1,F1,F1,_,_,_,_,_,_,_],
  [_,_,_,_,_,F2,F1,F1,F1,F2,_,_,_,_,_,_],
  [_,_,_,_,F2,F2,F1,F1,F1,F2,F2,_,_,_,_,_],
  [_,_,_,_,F3,F2,F2,F2,F2,F2,F3,_,_,_,_,_],
  [_,_,_,_,_,F3,F2,F2,F2,F3,_,_,_,_,_,_],
  [_,_,_,_,_,_,F3,F2,F2,F3,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,WK,WK,_,_,_,_,_,_,_],
  [_,_,_,_,WH,WX,WX,WX,WX,WX,WS,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,_,WX,WX,WX,WX,WX,WX,WX,_,_,_,_,_],
  [_,_,_,WS,WX,WX,WX,WX,WX,WX,WS,_,_,_,_,_],
  [_,_,GS,GD,GD,GD,GD,GD,GD,GD,GD,GS,_,_,_,_],
  [_,GS,GD,GD,GD,GD,GD,GD,GD,GD,GD,GD,GS,_,_,_],
  [_,_,GS,GS,GD,GD,GD,GD,GD,GD,GD,GD,GS,GS,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];
const CANDLE_GILDED_MESSY = CANDLE_GILDED_NEAT.map((row, i) => {
  if (i === 9)  { const r = [...row]; r[3] = DR; r[11] = DR; return r; }
  if (i === 10) { const r = [...row]; r[3] = DR; return r; }
  return row;
});

// ─── SVG renderer ─────────────────────────────────────────────────────────────
// hunger 用來即時計算火焰亮度（見 flameColor）；F1/F2/F3 以外的格子是
// 固定色碼（蠟／燭芯／鑲金），直接輸出，不受 hunger 影響。
function gridToSVG(grid, hunger, px = 3) {
  const rows = grid.length, cols = grid[0].length;
  let rects = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const fill = (cell === F1 || cell === F2 || cell === F3)
        ? flameColor(cell, hunger)
        : cell;
      rects += `<rect x="${c*px}" y="${r*px}" width="${px}" height="${px}" fill="${fill}"/>`;
    }
  return `<svg viewBox="0 0 ${cols*px} ${rows*px}" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;display:block">${rects}</svg>`;
}

// ─── Stage helpers ────────────────────────────────────────────────────────────
// 進化條件綁定等級（不變）：LV1–5 = 新蠟燭、LV6–15 = 半燃蠟燭、LV16+ = 鑲金燭台
function getPetStage(lv) {
  if (lv <= 5)  return 'candle-new';
  if (lv <= 15) return 'candle-half';
  return 'candle-gilded';
}
function getStageSVG(stage, hunger, mood) {
  const neat = mood >= 50; // mood → 蠟淚整齊度：≥50 平整凝結，否則雜亂垂掛
  if (stage === 'candle-new')    return gridToSVG(CANDLE_NEW, hunger);
  if (stage === 'candle-gilded') return gridToSVG(neat ? CANDLE_GILDED_NEAT : CANDLE_GILDED_MESSY, hunger);
  return gridToSVG(neat ? CANDLE_HALF_NEAT : CANDLE_HALF_MESSY, hunger);
}
function getStageLabel(stage) {
  if (stage === 'candle-new')    return '新蠟燭';
  if (stage === 'candle-gilded') return '鑲金燭台';
  return '半燃蠟燭';
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
 * 飽食度（持久化儲存 + 時間衰減）
 * rate = 5%/hr (新蠟燭/半燃蠟燭)；7%/hr (鑲金燭台) —— 數值不變，只是
 * 舊 stage key 'rooster' 已改名 'candle-gilded'（見 getPetStage）
 * 恢復來源：新增單字 +30%、通過複習 +10%
 */
function computeHungerDecay() {
  const lv    = Number(localStorage.getItem('level') || 1);
  const stage = getPetStage(lv);
  const rate  = stage === 'candle-gilded' ? 7 : 5;

  let hunger = Number(localStorage.getItem('petHunger') ?? -1);
  if (hunger < 0) {
    // 首次或遷移：用舊公式推算初始值
    const ts = localStorage.getItem('lastAddWordTime');
    if (!ts) {
      localStorage.setItem('petHunger', '0');
      localStorage.setItem('petHungerDecayTs', String(Date.now()));
      return 0;
    }
    const hours = (Date.now() - Number(ts)) / 3_600_000;
    hunger = Math.max(0, Math.min(100, Math.round(70 - hours * rate)));
  }

  const decayTs = Number(localStorage.getItem('petHungerDecayTs') || Date.now());
  const hours   = (Date.now() - decayTs) / 3_600_000;
  hunger = Math.max(0, Math.min(100, Math.round(hunger - hours * rate)));
  localStorage.setItem('petHunger', String(hunger));
  localStorage.setItem('petHungerDecayTs', String(Date.now()));
  return hunger;
}

function getHunger() { return computeHungerDecay(); }

function addHunger(amount) {
  const current = computeHungerDecay();
  localStorage.setItem('petHunger', String(Math.min(100, current + amount)));
}

/**
 * 心情度（持久化儲存 + 時間衰減）
 * 扣除條件：待複習 > 50 且距上次複習超過 24 小時
 * 衰減速率：每小時 −2%
 * 恢復：任何複習完成後 +20%
 */
function computeMoodDecay() {
  let mood = Number(localStorage.getItem('petMood') ?? -1);
  if (mood < 0) {
    mood = 100;
    localStorage.setItem('petMood', '100');
    localStorage.setItem('petMoodDecayTs', String(Date.now()));
    return mood;
  }

  let dueCount = 0;
  try { dueCount = getDueCount(); } catch {}
  const reviewTs          = localStorage.getItem('lastReviewTime');
  const hoursSinceReview  = reviewTs
    ? (Date.now() - Number(reviewTs)) / 3_600_000
    : Infinity;

  if (dueCount > 50 && hoursSinceReview > 24) {
    const decayTs = Number(localStorage.getItem('petMoodDecayTs') || Date.now());
    const hours   = (Date.now() - decayTs) / 3_600_000;
    mood = Math.max(0, Math.min(100, Math.round(mood - hours * 2)));
  }

  localStorage.setItem('petMood', String(mood));
  localStorage.setItem('petMoodDecayTs', String(Date.now()));
  return mood;
}

function getMood() { return computeMoodDecay(); }

function addMood(amount) {
  const current = computeMoodDecay();
  localStorage.setItem('petMood', String(Math.min(100, current + amount)));
}

// ─── Penalty decorations ──────────────────────────────────────────────────────
// 心情 < 10：無人照料的燭灰堆（原本是雞糞，換皮成灰燼，形狀/門檻不變）
const PX = 5;
const SA = '#6B6058', SL = '#8C8079', SD = '#3A322C';
const GR = '#888888', GL = '#BBBBBB';

const ASH_GRID = [
  [_,_,_,SL,SL,_,_,_],
  [_,_,SL,SA,SA,SL,_,_],
  [_,SA,SA,SA,SA,SA,SA,_],
  [SA,SA,SA,SA,SA,SA,SA,SA],
  [SA,SA,SA,SA,SA,SA,SA,SA],
  [_,SD,SA,SA,SA,SA,SD,_],
  [_,_,SA,SA,SA,SA,_,_],
  [_,_,_,SD,SD,_,_,_],
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
    const grid = mood < 10 ? ASH_GRID : WEB_GRID;
    if (!el._lastMoodTier || el._lastMoodTier !== (mood < 10 ? 'ash' : 'web'))  {
      el._lastMoodTier = mood < 10 ? 'ash' : 'web';
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

  // ── Level + XP ──
  const lv    = Number(localStorage.getItem('level')     || 1);
  const xp    = Number(localStorage.getItem('currentXP') || 0);
  const xpMax = xpNeeded(lv);
  const xpPct = Math.round((xp / xpMax) * 100);

  // ── Stage（依等級決定）──
  const stage = getPetStage(lv);

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
  const lastActive       = Number(localStorage.getItem('pet_last_active_ts') || Date.now());
  const hoursSinceActive = (Date.now() - lastActive) / 3_600_000;

  let autoState = 'idle';
  if (hoursSinceActive >= 12) {
    autoState = 'sleeping';
  } else if (mood < 30 || hunger < 30) {
    autoState = 'slacking';
  }

  // ── Sprite ──
  artEl.innerHTML = getStageSVG(stage, hunger, mood);
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
/** 新增單字：+10 XP、飽食度 +30%，觸發啄食動畫 */
export function onWordAdded() {
  localStorage.setItem('lastAddWordTime',    String(Date.now()));
  localStorage.setItem('pet_last_active_ts', String(Date.now()));
  addXP(10);
  addHunger(30);
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
  addMood(20); // 任何複習完成，心情 +20%

  if (perfect) {
    addXP(50);
    triggerPetAnim('happy', 3000);
  } else if (passed) {
    addXP(15);
    addHunger(10); // 通過測驗，飽食度 +10%
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
