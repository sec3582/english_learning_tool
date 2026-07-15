<!--  注意（2026-07-15）：本文件規格來源 docs/VISUAL_SPEC.md 已棄用。
--cold- / --story- token 整合方向待後續決策，本文件內容暫時凍結，請勿依此執行新修改。-->
# UI_COMPONENTS.md — 夜模式（冷調）元件規格

**對應檔案**：`theme-perfume-night.css`
**規格來源**：`docs/VISUAL_SPEC.md`
**狀態**：草稿，尚未掛載到 `index.html`，與現有暖色 Day Mode（`theme-perfume-day.css` / `theme-perfume-wc.css`）並列、獨立、不共用色彩 token。

本文件說明 v2「沉浸式文本小說」功能的夜模式視覺元件：CSS 變數總表、首頁骨架草稿、三個主要元件的程式碼片段，以及傷口色 `#8a3b2c` 為什麼要被隔離在元件庫之外。

---

## 1. CSS 變數總表

### 1.1 冷調系統（`.scene-cold`，主世界，約佔畫面時間 85–90%）

| Token | 值 | 用途 |
|---|---|---|
| `--cold-void` | `#14171a` | 全站底色（霧黑，非純黑；帶極淡藍灰） |
| `--cold-wash` | `#1b1f23` | 次層墨色、Liquid Glass 卡片底層陰影 |
| `--cold-parchment` | `#d6dbe0` | 主要文字（冷灰白，非純白） |
| `--cold-dim` | `#838d96` | 次要文字、說明文字 |
| `--cold-accent` | `#5c7686` | **唯一**允許的冷調強調色（互動狀態、連結、進行中指示）；禁止提高飽和度 |
| `--glass-cold-fill` | `rgba(214,219,224,0.05)` | 冷調 Liquid Glass 卡片填色 |
| `--glass-cold-border` | `rgba(92,118,134,0.20)` | 冷調 Liquid Glass 卡片邊緣 |
| `--cold-accent-ring`（衍生） | `rgba(92,118,134,0.35)` | focus ring 用；從 `--cold-accent` 換算透明度，不是新色相 |
| `--cold-shadow`（衍生） | `rgba(8,10,12,0.45)` | 卡片陰影；從 `--cold-void` 換算，冷調系統專用（不可用 Day Mode 的暖棕陰影） |

### 1.2 暖調系統（`.scene-warm`，教會／政客場景，稀有敘事事件，約 10–15%）

| Token | 值 | 用途 |
|---|---|---|
| `--warm-void` | `#241a12` | 場景底色（燭光暗底，非純黑；帶暖棕） |
| `--warm-parchment` | `#e8dcc8` | 主要文字（羊皮紙白，非純白） |
| `--warm-gold` | `#a8792e` | 暗金強調（火把、燭光反射、標題底線） |
| `--warm-dim` | `#8c7355` | 次要文字 |
| `--glass-warm-fill` | `rgba(232,220,200,0.06)` | 暖調 Liquid Glass 卡片填色 |
| `--glass-warm-border` | `rgba(168,121,46,0.24)` | 暖調 Liquid Glass 卡片邊緣 |
| `--warm-shadow`（衍生） | `rgba(14,9,5,0.50)` | 卡片陰影；從 `--warm-void` 換算 |

### 1.3 場景別名（給內容容器元件用，跟著目前套用的 scene class 自動切換）

`.glass-card`、`.word-card` 這類「內容容器」元件不需要自己判斷現在是冷調還是暖調場景，直接吃下面這組別名即可：

| 別名 | `.scene-cold` 時等於 | `.scene-warm` 時等於 |
|---|---|---|
| `--scene-void` | `--cold-void` | `--warm-void` |
| `--scene-wash` | `--cold-wash` | `--warm-void`（暖調沒有獨立次層色，沿用底色） |
| `--scene-parchment` | `--cold-parchment` | `--warm-parchment` |
| `--scene-dim` | `--cold-dim` | `--warm-dim` |
| `--scene-glass-fill` | `--glass-cold-fill` | `--glass-warm-fill` |
| `--scene-glass-border` | `--glass-cold-border` | `--glass-warm-border` |
| `--scene-shadow` | `--cold-shadow` | `--warm-shadow` |

**注意**：這組別名刻意**不包含** `--scene-accent`。強調色沒有場景別名版本 —— 見第 3.3 節，按鈕與所有互動元件的強調色被硬性鎖定在 `--cold-accent`，不隨場景切換，避免元件不小心把 `--warm-gold` 接進互動狀態。

### 1.4 傷口色（不屬於任一系統，全站僅出現一次）

| Token | 值 | 使用規則 |
|---|---|---|
| `--wound` | `#8a3b2c` | 只能在 Day 14 谷底事件使用一次，寫死在 `.day14-reveal-card` 專屬區塊，不進 `.scene-cold` / `.scene-warm` / 任何共用元件。詳見第 4 節。 |

### 1.5 動畫共用 Tokens

| Token | 值 | 用途 |
|---|---|---|
| `--night-ease` | `cubic-bezier(0.45, 0, 0.15, 1)` | 全站統一緩動曲線，無 bounce/overshoot |
| `--night-duration-min` | `350ms` | 互動回饋時長下限（按鈕、輸入框），不做 100–150ms 快閃動效 |
| `--night-duration-card` | `450ms` | 卡片 hover／進場 |
| `--night-duration-slow` | `600ms` | 較大範圍的狀態轉換 |
| `--night-duration-crossfade` | `2800ms` | 冷／暖場景切換 crossfade（VISUAL_SPEC §2.4-4） |

---

## 2. 首頁 HTML/CSS 結構草稿

**唯一視覺焦點**：文章輸入區的 Liquid Glass 卡片，浮在墨流背景上，沒有其他次要 CTA 或裝飾元件（VISUAL_SPEC §5.1）。

```html
<div class="night-stage scene-cold">
  <!-- 背景層：p5.js 繪製 Suminagashi 墨流，這裡只放容器，繪製邏輯不在此檔案範圍 -->
  <canvas id="ink-layer"></canvas>

  <!-- 唯一視覺焦點：文章匯入卡片 -->
  <section class="glass-card">
    <h1 class="word-card__word">貼上文章</h1>
    <textarea
      class="blank-input"
      style="width: 100%; min-height: 160px; display: block;"
      placeholder="貼上一段文字，開始今晚的辨識……"
    ></textarea>
    <button class="btn-night btn-night--primary" type="submit">送出</button>
  </section>
</div>
```

```css
/* 已在 theme-perfume-night.css 定義，此處僅摘要重點 */
.night-stage {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;   /* 卡片永遠置中，不靠零散 margin 手動對齊 */
  min-height: 100vh;
  padding: clamp(32px, 8vw, 96px);  /* 大量 padding 撐開留白 */
}

#ink-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.glass-card {
  width: min(100%, 560px);  /* 卡片本身有寬度上限，四周自動留白 */
  z-index: 1;
  /* backdrop-filter / 半透明填色與邊框，見第 3.1 節 */
}
```

### 留白比例怎麼達成

- `.night-stage` 用 `display: grid; place-items: center` 讓卡片自動置中，不需要任何 `margin-top` / `margin-left` 之類的手動微調。
- 卡片寬度用 `width: min(100%, 560px)` 鎖上限，視窗越寬，卡片以外的墨流可視面積越大。
- `.night-stage` 的 `padding: clamp(32px, 8vw, 96px)` 確保即使在小螢幕上，卡片與畫面邊緣之間也一定有呼吸空間。
- 整頁只有一個 `<section class="glass-card">`，沒有次要按鈕列、沒有麵包屑、沒有裝飾性插圖 —— 這是 55–60% 留白能夠成立的前提：不是「留白很多」，而是「東西本來就很少」。

---

## 3. 三個主要元件

### 3.1 單字卡片 `.word-card`

```html
<article class="word-card">
  <p class="word-card__word">petrichor</p>
  <p class="word-card__meta">n. · B2</p>
  <p class="word-card__definition">雨後泥土散發出的氣味</p>
</article>
```

```css
.word-card {
  width: min(100%, 480px);
  padding: clamp(24px, 3.5vw, 36px);
  background: var(--scene-glass-fill, var(--glass-cold-fill));
  border: 1px solid var(--scene-glass-border, var(--glass-cold-border));
  border-radius: 16px;
  backdrop-filter: blur(16px) saturate(115%);
  box-shadow: 0 16px 48px var(--scene-shadow, var(--cold-shadow));
  transition:
    transform    var(--night-duration-card) var(--night-ease),
    box-shadow   var(--night-duration-card) var(--night-ease),
    border-color var(--night-duration-card) var(--night-ease);
}

.word-card:hover,
.word-card:focus-within {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--cold-accent) 55%, transparent);
}
```

重點：背景／邊框吃 `--scene-*` 別名（會跟著目前的場景自動變色），但 hover 狀態的邊框強調色**固定**用 `--cold-accent`，不是 `--scene-*`。

### 3.2 填空輸入框 `.blank-input`

```html
<input class="blank-input" type="text" placeholder="___" />
```

```css
.blank-input {
  padding: 4px 10px;
  color: var(--scene-parchment, var(--cold-parchment));
  background: var(--scene-glass-fill, var(--glass-cold-fill));
  border: 1px solid var(--scene-glass-border, var(--glass-cold-border));
  border-bottom: 2px solid var(--cold-dim);
  border-radius: 4px;
  transition:
    border-color var(--night-duration-min) var(--night-ease),
    box-shadow    var(--night-duration-min) var(--night-ease);
}

.blank-input:focus {
  border-bottom-color: var(--cold-accent);
  box-shadow: 0 0 0 3px var(--cold-accent-ring);
}
```

重點：`:focus` 的底線與外框光暈只用 `--cold-accent` / `--cold-accent-ring`。就算這個輸入框當下畫面套用的是 `.scene-warm`，focus 狀態依然是冷調藍灰，不會變成 `--warm-gold`。

### 3.3 功能按鈕 `.btn-night`

```html
<button class="btn-night btn-night--primary">確認</button>
<button class="btn-night btn-night--ghost">略過</button>
```

```css
.btn-night--primary {
  background: var(--cold-accent);
  color: var(--cold-void);
}
.btn-night--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--cold-accent) 88%, white 12%);
}
.btn-night--primary:active:not(:disabled) {
  background: color-mix(in srgb, var(--cold-accent) 90%, black 10%);
}

.btn-night--ghost {
  background: transparent;
  border: 1px solid var(--glass-cold-border);
}
.btn-night--ghost:hover:not(:disabled) {
  background: rgba(92, 118, 134, 0.10); /* --cold-accent 的低透明度疊層 */
}
```

**明確標註**：`.btn-night--primary` 與 `.btn-night--ghost` 的 hover / active / focus 狀態，全部只透過 `color-mix()` 疊加白／黑的極小比例，或用 `--cold-accent` 本身的 rgba 透明度疊層做出來。整份檔案裡沒有任何一行按鈕互動樣式引用 `--warm-gold` 或其他暖色 —— 這是 VISUAL_SPEC 與這次任務都明訂的硬性限制，即使某個暖色版本「看起來更好看」也不允許，因為按鈕是功能性 chrome，不參與敘事表演。

---

## 4. 為什麼傷口色 `#8a3b2c` 要獨立、不進元件庫

`--wound` 在 VISUAL_SPEC 裡被定義成「全站僅出現一次」的顏色（§2.3），對應的是 Day 14 劇情裡玩家親手觸發谷底真相揭露的那個瞬間（§3.3、電影場景參考 B：Baldini 深夜製香的孤光審問）。它不是一個「警示色」或「錯誤狀態色」，而是一個**敘事事件**，重量感來自它的稀缺性。

如果把 `--wound` 放進 `.scene-cold` / `.scene-warm` 的共用 token，或做成任何元件庫裡可重複調用的 class（例如當作「刪除按鈕」的紅色、或「錯誤提示」的邊框色），會發生兩個問題：

1. **稀缺性被稀釋**：一旦其他功能開始「順手」拿去用（畢竟它就在 token 表裡，看起來像個現成的警示紅），Day 14 事件發生時就不再特別 —— 玩家會覺得「這只是又一個紅色而已」，谷底時刻失去它應有的重量。
2. **未來維護者難以追蹤**：如果 `--wound` 散落在多個元件的樣式規則裡，日後想確認「這個顏色真的只出現一次」會需要整個專案搜尋比對，而不是打開一個檔案就能看到全部用法。

因此 `theme-perfume-night.css` 把 `--wound` 定義**限定在 `.day14-reveal-card` 這一個 class 內部**，並用醒目的大寫框線註解圈起來：

```css
/* ============================================
   DAY 14 ONLY — DO NOT REUSE
   此顏色全站僅能出現一次（谷底真相揭露事件）。
   不要把它加進元件庫、按鈕、狀態色、或任何可能被
   未來其他功能誤用的共用 class。
   ============================================ */
.day14-reveal-card { --wound: #8a3b2c; ... }
```

未來如果要加新功能、新元件、新的警示色，**請不要**從 `.day14-reveal-card` 裡把 `--wound` 抄出來重用，也不要在 `:root` 或 `.scene-*` 裡另外宣告一份。如果真的需要警示色，冷調系統裡唯一被允許的手法是調整 `--cold-accent` 的亮度或 `--cold-dim` 的深淺（見 `.blank-input.is-incorrect` 的做法：加粗底線 + 用 `--cold-dim`，而不是變紅）。

---

## 5. 尚未涵蓋的部分（刻意留給後續實作）

- p5.js 墨流粒子系統的實際繪製邏輯（Perlin noise 驅動、色相隨場景切換）。
- Day 0 → Day 30 的完整動畫時間軸（翻卡節奏一致性、empty 卡片的異色墨滴、Day 14 事件的完整分鏡、Day 30 的靜止收尾）—— 這些屬於 VISUAL_SPEC §3 的行為規格，需要 JS 狀態機搭配這份 CSS 一起實作，此份文件只交付「靜態視覺骨架」。
- `index.html` 目前未掛載 `theme-perfume-night.css` 的 `<link>`，依照任務要求先不動它。
