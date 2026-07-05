# VISUAL_QA_5E.md — 夜模式視覺 QA 巡檢 + 新元件規格

**角色**：perfume-art-director
**對應階段**：Phase 5e 完成後（commit `d2cc98e`）
**規格來源**：`docs/VISUAL_SPEC.md`（色彩/動畫規格）、`docs/UI_COMPONENTS.md`（token 總表與元件片段）
**狀態**：清單與規格，未動程式碼——實作交給 `@ui-designer` + `@frontend-developer`

**範疇備註**：本文件第 3、4 節的新元件規格，依委託指示建立在「自訂新增單字搬進 sidebar」「網址 tab 移除、上傳圖片升級為第二頁籤」這兩個決策之上。目前 `decision-5f-upload-pet.md` 只書面記錄了「上傳圖片升級為第三頁籤（含網址）」與「電子雞改蠟燭」兩項；搬移自訂新增單字、以及把網址 tab 直接移除（而非保留三頁籤）是本次委託口頭追加的範圍擴張。實作前建議請 `@perfume-game-director` 補寫決策文件，避免兩份文件對不上。

---

## 0. 根因摘要（建議先讀，決定修法優先順序）

實測 `index.html` 目前的整合方式，找到一個貫穿全部 4 個 QA 區塊的共同根因，而不是 4 個獨立小 bug：

**現況**：`body.scene-cold` 的冷調覆寫是一份「白名單」——每次有人回報「這裡還是暖色」，就有人在 `index.html:667-938` 那段 `<style>` 裡多加一條 `body.scene-cold #某個ID { ... !important }`。目前白名單涵蓋：header、`#articleInputSection`、`#articleInput`、`.wc-card`、`#quizModal > div`、四張頂層側欄卡片（`#progressCard`/`#wordListCard`/`#pixelPetCard`/`#backupCard`）、`#customWordCard`。**沒有在白名單裡的元件，維持 100% Day Mode 樣式**，這正是本次回報的 4 個區塊的共同成因——它們單純還沒被加進白名單，不是技術上特別難修。

**另一個獨立但會放大症狀的問題**：這個 codebase 目前有**兩套互不相干的深色系統同時存在**：

1. `[data-theme="dark"]`（`<html>` 屬性，由 header 的月亮圖示 `#darkModeToggle` 手動切換）——舊系統，`theme-perfume-day.css` 裡的 `.btn-primary-m` / `.btn-outline-m` / `.btn-ghost-m` 的深色變體都掛在這個屬性上。
2. `body.scene-cold`（永久寫死在 `<body class="bg-gray-100 text-gray-800 scene-cold">`，見 `index.html:942`，並非使用者手動切換）——VISUAL_SPEC 定義的新冷調系統，只覆寫上面列的白名單元件。

**結果**：全站所有按鈕（`讓 AI 挑單字`、`上傳圖片`、`分析`、`加入我的清單`、`開始測驗`、測驗 modal 內的按鈕⋯）目前只認 `[data-theme="dark"]`，完全不認 `body.scene-cold`。也就是說，就算 QA 把 4 個回報區塊的背景/文字都修好，**裡面的按鈕仍然會是 Day Mode 配色**，除非同時又手動切換了舊的月亮圖示深色模式——兩套開關疊加時的實際畫面目前沒人驗證過。

**建議修法方向**：不要繼續逐一補白名單條目（治標）。请 `@frontend-developer` 評估是否讓 `.btn-primary-m` / `.btn-outline-m` / `.btn-sm-m` / `.quiz-btn-primary` / `.quiz-btn-next` 這幾個共用按鈕 class 直接吃 `body.scene-cold` 的 `--cold-accent` 系統（比照 `theme-perfume-night.css` 的 `.btn-night--primary` / `.btn-night--ghost` 做法），一次性解決「按鈕永遠掉隊」的問題，而不是每次 QA 都再多修一顆按鈕。

---

## 1. 逐區塊 QA：未對齊 VISUAL_SPEC 的位置

### 1.1 「測驗設定」modal（`#quizSettings`）

**現況**：`index.html:1369-1393`。外層 `#quizSettings` 是 `bg-black/50` 遮罩（沒問題），內層 `<div class="bg-white w-full max-w-md rounded-xl shadow p-6 space-y-4">` 是純白卡片——**完全不在白名單裡**（白名單只覆寫了 `#quizModal > div`，也就是「測驗進行中」的卡片，跟「測驗設定」`#quizSettings` 是兩個不同 ID，容易被誤認為同一個已經修過）。內部細節：
- 標題 `測驗設定`（`.sidebar-title` class）：已有全站 `body.scene-cold .sidebar-title`？**沒有**——只有 `#wordListCard .sidebar-title` 這條 scoped 規則（見 `index.html:834`），`#quizSettings` 底下的 `.sidebar-title` 吃不到，仍是 `var(--navy)`（Day Mode 深綠）。
- `開始測驗`／`取消` 按鈕：`#qsStart` 是 `.quiz-btn-primary`（`background:var(--theme-color)`，`--theme-color:#8F9A78` 是 `theme-ocean.css` 殘留的橄欖綠 token，不屬於 Day 也不屬於 Night 任一套色系）；`#qsCancel` 是裸的 `bg-gray-100`。兩顆按鈕都不在任何 scene-cold 白名單裡。
- 四個 radio（`qs_audio`）與一個 checkbox（`qs_showZh`）：純瀏覽器原生渲染，沒有 `accent-color` 設定，深色卡片底下原生控制項的白色圓點/方塊會非常突兀。
- 標籤文字（`每題結束後自動播放`、`題目顯示例句中文翻譯`）：目前用 Tailwind `.font-medium` 之類的 utility，繼承 body 文字色，不在白名單覆寫範圍。

**應該改成**：對照 `VISUAL_SPEC.md §2.1` 冷調 Liquid Glass 卡片（`--glass-cold-fill` / `--glass-cold-border` / `--cold-parchment`），比照白名單裡 `#quizModal > div` 已經驗證過的做法（`index.html:797-807`）原樣複製一份給 `#quizSettings > div`。

**修法建議**：
- 新增 `body.scene-cold #quizSettings > div { background: var(--glass-cold-fill) !important; border: 1px solid var(--glass-cold-border) !important; backdrop-filter: blur(20px) saturate(120%); box-shadow: 0 20px 60px var(--cold-shadow) !important; color: var(--cold-parchment) !important; --text: var(--cold-parchment); --muted: var(--cold-dim); --navy: var(--cold-parchment); }`（与 `#quizModal > div` 那條完全同構，可直接複製再改選擇器）。
- 按鈕：`#qsStart` 建議直接歸戶到 0 節提出的「按鈕統一吃 `--cold-accent`」修法；若不想動共用 class，暫時可加 `body.scene-cold #qsStart { background: var(--cold-accent) !important; color: var(--cold-void) !important; }`、`body.scene-cold #qsCancel { background: transparent !important; border: 1px solid var(--glass-cold-border) !important; color: var(--cold-parchment) !important; }`。
- radio/checkbox：加 `body.scene-cold #quizSettings input[type=radio], body.scene-cold #quizSettings input[type=checkbox] { accent-color: var(--cold-accent); }`（`accent-color` 是目前跨瀏覽器改原生控制項顏色最乾淨的做法，不需要重做整個自訂 checkbox 視覺）。
- 標籤文字：`body.scene-cold #quizSettings { color: var(--cold-parchment) !important; }` 加在外層即可讓子元素 label 文字一併繼承，不需要逐一點名。

---

### 1.2 「匯入文章」卡片：標題、tabs、對比度

**現況**：`#articleInputSection` 本身、`#articleInput`、`.section-h`、`.input-tab--active` 都**已經在白名單裡**（`index.html:760-904`），這部分是做對的。但同一張卡片內還有 3 處遺漏：
- `#urlInput`（網址 panel 的輸入框，`index.html:1072-1074`）：`theme-perfume-wc.css` 的 `#articleInput, #urlInput, #librarySearch` 是同一條規則一起設定羊皮紙底色（`P1. Article-section inputs`），但白名單只覆寫了 `#articleInput` 一個 ID，`#urlInput` 沒被提到，仍是米色底。
- `#ocrPickBtn` / `#ocrRunBtn`（`.btn-sm-m` 小按鈕）與 `#ocrStatus`（`text-gray-400`）：目前浮在標題列，不在任何白名單規則範圍內。
- `#urlFetchBtn`（`.btn-primary-m`）：連同 `#analyzeBtn` 一起被 `theme-perfume-day.css` 額外鎖了文字顏色為 `#F0E8D4`（`FINAL COLOR LOCK`，`day.css:1037-1062`），這條鎖字色的規則本身沒有 scene-cold 版本。

**應該改成**：對照 `VISUAL_SPEC.md §2.1` 與 `§5.1`（首頁唯一視覺焦點是輸入卡片本身，卡片內任何子元素都不該漏色）。

**修法建議**：
- 補 `body.scene-cold #urlInput { background: var(--glass-cold-fill) !important; border-color: var(--glass-cold-border) !important; color: var(--cold-parchment) !important; }` 及對應 `::placeholder` / `:focus`（直接比照 `#articleInput` 那 3 條規則，選擇器換掉即可）——**若第 3 節「網址 tab 移除」的決策確認執行，這條可以直接跳過不用修，這裡列出是為了涵蓋「萬一先上線 QA 修正、晚一點才移除網址 tab」的過渡期**。
- `#ocrPickBtn`／`#ocrRunBtn`／`#ocrStatus`：第 3 節會把這整組重新設計成頁籤內容，屆時直接依照新規格實作即可，不需要為即將被取代的舊版臨時按鈕另外修色。
- `#urlFetchBtn` 文字鎖色問題：同樣因為網址 tab 即將移除而可視為過渡期問題，不需要另外處理。

---

### 1.3 「單字清單」內 `.word-suggestion-card` 例句框（背景太亮、文字對比不夠）

**現況**：這組卡片其實不在側欄 `#wordListCard` 裡，而是「匯入文章」分析完成後、主內容區的結果頁籤 `#rtabPanelWords`（`index.html:1101-1103`，class 是裸的 `bg-white rounded-b-xl shadow`）內，由 `js/ui.js:219-275` 動態產生 `.word-suggestion-card`（定義在 `theme-perfume-day.css:1434-1514`）。整組——包含外層 `#rtabPanelWords` 容器與卡片本身——**完全沒有任何 scene-cold 覆寫**，卡片背景維持 `var(--color-surface-card, #F0E8D4)`（羊皮紙米色），例句文字 `.word-card-example` 用 `var(--color-ink-3, #A08568)`（淡棕色，是為了疊在 `#F0E8D4` 米色底上設計的低對比說明色）。這個組合單獨看是 OK 的（Day Mode 設計本來就如此），但套進冷調頁面後，卡片本身是一塊突兀的亮黃色方塊漂在深色背景上，而卡片內部「本來就刻意做低對比」的例句文字，此刻對比度完全失控（淡棕字 on 淡棕底附近色階，幾乎讀不出來——這就是回報裡「文字對比不夠」的成因：**它的低對比不是「這次沒修好」，是 Day Mode 設計本來的低對比，被硬套進了跟它預期環境完全相反的冷色玻璃卡片系統**）。

**應該改成**：對照 `VISUAL_SPEC.md §2.1` 與白名單裡 `.wc-card` 已經驗證過的模式（`index.html:780-789`）——`.word-suggestion-card` 在視覺上就是「AI 建議版」的 `.wc-card`，理應套用同一組冷調 token，而不是保留 Day Mode 羊皮紙配色。

**修法建議**：
- `#rtabPanelWords` 容器：加 `body.scene-cold #rtabPanelWords { background: transparent !important; box-shadow: none !important; }`（結果頁籤面板本身不需要自己是一張卡片，真正的卡片感應該來自內層的 `.word-suggestion-card`，避免兩層卡片疊卡片）。
- `.word-suggestion-card` 本身：加 `body.scene-cold .word-suggestion-card { background: var(--glass-cold-fill) !important; border: 1px solid var(--glass-cold-border) !important; box-shadow: none !important; color: var(--cold-parchment) !important; }`（這條沒有 `!important` 競爭對手，`theme-perfume-day.css` 原規則本身沒寫 `!important`，可以不用但建議還是統一加上，避免之後有人在 day.css 補寫 `!important` 又打回原形）。
- 卡片內文字三層都要個別覆寫（因為它們各自讀不同的 `--color-ink-*` token，不是共用 `--text`/`--muted`）：
  - `.stamp-word` → `color: var(--cold-parchment) !important;`
  - `.word-card-meta`、`.word-card-def` → `color: var(--cold-dim) !important;`
  - `.word-card-example` → `color: var(--cold-dim) !important;`（這是回報裡對比度最差的元素，優先修）
- `.speak-btn-warm`（發音按鈕）→ `color: var(--cold-dim) !important;`，hover 用 `background: rgba(92,118,134,0.10) !important; color: var(--cold-parchment) !important;`（沿用 `--cold-accent` 的低透明度疊層公式，跟 `theme-perfume-night.css` 的 `.btn-night--ghost:hover` 一致）。

---

### 1.4 textarea / input 白底融合問題（全站通用bucket）

**現況**：目前白名單只個別點名了 `#articleInput` 與 `#customWordCard input/textarea` 兩組。以下輸入元件目前**沒有任何 scene-cold 覆寫**，會是「白底輸入框浮在深色卡片上」的融合問題，且都跟本次回報的 1.1–1.3 三個區塊在同一個成因家族裡：

| 選擇器 | 位置 | 現況樣式來源 |
|---|---|---|
| `#quizAnswer` | 測驗進行中 modal（`#quizModal`）內 | 裸 `class="w-full p-3 border rounded"`，白底 |
| `#allSearch` / `#allPos` / `#allLevel` / `#allSort` | 側欄「單字清單→全部」篩選列 | 裸 `class="p-2 border rounded"` |
| `#usageBudgetInput` | 用量 modal | `border border-gray-200`，白底 |
| `#syncCodeCurrent` / `#syncCodeInput` | 同步設定 modal | `border rounded`，白底 |

**應該改成**：對照 `VISUAL_SPEC.md §2.1`——凡是出現在已經（或即將）被判定為冷調場景容器內的輸入元件，都必須讀 `--cold-parchment` 文字 / `--glass-cold-fill` 底色，不能維持瀏覽器預設白底。

**修法建議**：與其逐一點名（目前的白名單模式已經證明「漏一個修一個」不可持續，見第 0 節），建議訂一條通用規則，只要輸入元件的祖先容器已經是 scene-cold 覆寫過的卡片，就統一吃同一組樣式：
```css
body.scene-cold input[type="text"],
body.scene-cold input[type="number"],
body.scene-cold input[type="search"],
body.scene-cold input[type="url"],
body.scene-cold select,
body.scene-cold textarea {
  background: var(--glass-cold-fill);
  border-color: var(--glass-cold-border);
  color: var(--cold-parchment);
}
```
（刻意不加 `!important`、且用低優先權的 type 選擇器，讓任何既有的 scoped `!important` 規則——例如 `#articleInput`——可以繼續贏過這條通用規則，這條只負責「兜底」，不負責「精修」。個別元件如果之後需要更精細的 focus / placeholder 樣式，再疊加 scoped 規則覆蓋它。）

---

## 2. 尚未涵蓋、QA 過程中一併發現的關聯問題（供後續排優先序，非本次委託重點）

- `#usageModal`、`#syncModal` 整體都是白卡片，完全不在白名單裡（用量估算、同步設定兩個次要 modal）。
- 側欄 `#tabGroup`（`今日新增`／`複習`／`全部`）與 `.tab--active` 的 active 狀態顏色未檢查是否有 scene-cold 版本。
- `#progressCard` 展開後內部的 `#progressStats` / `#progressChart` / `#progressGroups` 尚未實測——四張頂層卡片的白名單只覆蓋了容器背景，內部圖表用色需要另外抽查。

---

## 3. 新元件規格：「自訂新增單字」sidebar 摺疊版

### 3.1 現況（實作前基準）

`#customWordCard`（`index.html:1128-1176`）目前是主內容區第二張獨立卡片，緊接在「匯入文章」下方，永遠展開、永遠佔用主內容欄一整張卡片的垂直空間，內容分兩段：
1. 查詢列：`#customWordInput`（文字輸入）+ `#customAnalyzeBtn`（`分析`按鈕），一行 `flex gap-2`。
2. 編輯區 `#customWordEdit`（初始 `hidden`，AI 分析完成後才顯示）：`grid grid-cols-2 gap-3` 六個欄位（英文單字／詞性／難度／中文解釋／文章例句／AI 造句／翻譯，其中「英文單字」與三個 textarea 各自 `col-span-2`），加上 `#customAddBtn`（`加入我的清單`，`w-full btn-primary-m`）。

其樣式已經有一份完整的 scene-cold 覆寫（`body.scene-cold #customWordCard` 及其 `label`/`input`/`textarea`/`::placeholder`，`index.html:912-938`），這組 token 可以直接沿用到新的 sidebar 外框。

### 3.2 目標位置與外框

搬到 `#wordListCard` 內，插在「開始測驗」按鈕列（`index.html:1216-1221`）之後、「All filters」（`index.html:1224`）之前，作為 `#wordListCard` 的一個子區塊，**不是**獨立的頂層卡片——它不需要自己的 `background`/`border`/`shadow`，外框應該是「sidebar 卡片裡的一個摺疊列」，比照既有 `#progressCard` 的摺疊模式（`progressCardHeader` + chevron + `progressCardBody`，`index.html:1184-1195`），而不是比照主內容區「摺疊帶」`#inputCollapsedStrip` 那種獨立浮動條——因為它現在的身份是「一張卡片裡的一段」，不是「取代一整張卡片」。

### 3.3 摺疊態（預設收合）

視覺上比照 `#progressCardHeader` 的既有寫法：一行 `flex items-center justify-between`，左側標題文字，右側 chevron（`▼`，收合時 `rotate(-90deg)`，`transition:transform .2s`）。

```html
<div id="customWordHeader" class="flex items-center justify-between mb-2 cursor-pointer select-none">
  <h3 class="sidebar-title" style="font-size:.875rem;">自訂新增單字</h3>
  <span id="customWordChevron" style="font-size:.85rem;color:var(--cold-dim,#B0A090);transform:rotate(-90deg);transition:transform .2s;display:inline-block">▼</span>
</div>
```

- 字級比 `#wordListCard` 主標題「單字清單」略小一階（`.875rem` vs 現有 `.sidebar-title` 預設的 `1.25rem`），維持視覺層級——它是「單字清單」卡片裡的次要功能，不能跟主標題平起平坐。
- Hover：整條 header 列 `background: rgba(92,118,134,0.06)`（`--cold-accent` 的極低透明度疊層，跟 `.btn-night--ghost:hover` 同一公式），提示「可點擊」，不需要額外文字提示（既有 chevron 方向已經足夠溝通「有東西可以展開」）。
- 收合時不顯示任何輸入框或按鈕——摺疊態只有這一行，`#customWordEdit` 與查詢列一起包進 body，一併隱藏。

### 3.4 展開態

點擊 header 切換 `#customWordBody` 的 `hidden` class（JS 邏輯與 `#progressCardHeader`／`#progressCardChevron` 現有的 toggle 完全同構，沿用同一套 pattern，不需要新發明一套摺疊機制）。

展開後內容排版需要從主內容區的「兩欄 grid」改回 sidebar 寬度的單欄，因為 sidebar 欄寬遠小於主內容欄：

```html
<div id="customWordBody" class="hidden" style="margin-top:8px;">
  <div style="height:1px;background:var(--glass-cold-border,#EDE5D8);margin:0 0 12px"></div>

  <!-- 查詢列：sidebar 窄欄改直排，不再左右並排 -->
  <div class="space-y-2 mb-3">
    <input id="customWordInput" type="text" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="輸入單字或片語…">
    <button id="customAnalyzeBtn" class="w-full btn-outline-m justify-center" style="font-size:.8125rem;">分析</button>
  </div>

  <!-- 編輯區：單欄，不用 grid-cols-2（sidebar 欄寬放不下兩欄還能維持可讀性） -->
  <div id="customWordEdit" class="hidden space-y-2">
    <!-- 英文單字／詞性／難度／中文解釋／文章例句／AI 造句／翻譯：同樣 7 個欄位，全部 col-span-2 拿掉，直接單欄堆疊 -->
    <button id="customAddBtn" class="w-full btn-primary-m justify-center">加入我的清單</button>
  </div>
</div>
```

- 按鈕層級：`分析`降為 `.btn-outline-m`（次要動作），因為 sidebar 的主要 CTA 已經是上方的「開始測驗」（`.btn-primary-m`）；`加入我的清單`維持 `.btn-primary-m`——它是這個摺疊區塊裡真正完成任務的動作，但視覺上仍比「開始測驗」小一階（沿用現有 `font-size` 差異即可，不需要新增字級 token）。
- 欄位間距：`gap-3` 改 `space-y-2`（sidebar 窄欄下，欄位間垂直堆疊時用較緊的間距，避免摺疊區展開後把整個側欄拉得過長）。
- label 文字保留原本 `text-xs font-medium text-gray-500` 的層級關係，只是改成單欄排列，不需要重新設計。

### 3.5 樣式沿用與新增

沿用（不需要改）：
- `body.scene-cold #customWordCard input, textarea` 那組規則（`index.html:927-938`）——把選擇器裡的 `#customWordCard` 換成新容器 ID（例如 `#customWordSidebar`）即可直接套用，token 不變。
- `.btn-primary-m` / `.btn-outline-m` 本身的樣式（第 0 節提到的「按鈕統一吃 `--cold-accent`」如果實作了，這裡自動受惠，不需要為這個新元件單獨處理按鈕配色）。

新增（原本沒有、因為原本是頂層卡片不需要摺疊）：
- Header hover 疊層（3.3 節）。
- Chevron 旋轉動畫沿用 `#progressCardChevron` 的 `transition:transform .2s`，不需要引入 `theme-perfume-night.css` 的 `--night-duration-*`（这是既有 Day Mode 摺疊機制的既有節奏，維持一致優先於統一到新系統的動畫時長）。

---

## 4. 新元件規格：上傳圖片頁籤

### 4.1 現況

`index.html:1012-1035`：頁籤只有 `手動輸入`（`#inputTabManual`）／`網址`（`#inputTabUrl`）兩個（`.input-tab` / `.input-tab--active`），`上傳圖片`（`#ocrPickBtn`）是塞在標題列右側、跟頁籤系統平行的獨立小按鈕，旁邊還有 `重跑 OCR`（`#ocrRunBtn`，預設 `hidden`）與狀態文字（`#ocrStatus`）。

### 4.2 目標結構

依委託指示：頁籤改為兩個——`手動輸入`（保留）、`上傳圖片`（新增，取代目前的按鈕），**移除**`網址`頁籤與其面板 `#inputPanelUrl`（`index.html:1069-1079`，含 `#urlInput`/`#urlFetchBtn`/`#urlStatus`）。

```html
<div class="flex border-b border-gray-100 mb-5">
  <button id="inputTabManual" class="input-tab input-tab--active">手動輸入</button>
  <button id="inputTabUpload" class="input-tab">上傳圖片</button>
</div>
```

- 沿用既有 `.input-tab` / `.input-tab--active` class，不新增顏色或字重變化——兩個頁籤必須是完全相同的視覺層級（這也是既有 scene-cold 規則 `body.scene-cold #articleInputSection .input-tab--active` 已經覆蓋的範圍，新頁籤直接繼承，不需要額外加規則）。
- 標題列（`index.html:1014-1029`）原本用來放 `#ocrPickBtn`/`#ocrRunBtn`/`#ocrStatus` 的那個 `flex items-center gap-2` 容器可以整個移除——這些功能全部搬進頁籤內容區（4.3），標題列恢復成只有「匯入文章」標題本身，跟「手動輸入」頁籤內容平級，不再有『標題列工具』與『頁籤內容』並存的雙重心智模型（呼應 `decision-5f-upload-pet.md` 決策一的第 3 點）。

### 4.3 頁籤內容區（`#inputPanelUpload`）

```html
<div id="inputPanelUpload" class="hidden space-y-3">
  <!-- 上傳／拖放區：無檔案時顯示 -->
  <div id="uploadDropzone" class="upload-dropzone">
    <input id="ocrFile" type="file" accept="image/*,application/pdf" class="hidden">
    <p class="upload-dropzone__hint">拖曳圖片或 PDF 到這裡，或</p>
    <button id="ocrPickBtn" class="btn-outline-m">選擇檔案</button>
  </div>

  <!-- 載入中狀態：辨識進行中顯示，取代上面的 dropzone -->
  <div id="uploadLoading" class="hidden upload-loading">
    <span class="upload-loading__spinner"></span>
    <span>辨識中，請稍候…</span>
  </div>

  <!-- 已有檔案／辨識完成後的狀態列 -->
  <div id="uploadStatusRow" class="hidden flex items-center gap-2">
    <span id="ocrStatus" class="text-sm" style="color:var(--muted);"></span>
    <button id="ocrRunBtn" class="btn-ghost-m hidden" style="font-size:.8125rem;">重跑 OCR</button>
  </div>

  <!-- 額度提醒：非警告樣式 -->
  <p class="upload-quota-hint">圖片辨識較耗用本月額度</p>
</div>
```

- **狀態機**：`dropzone`（預設）→ 選檔後 `uploadLoading`（辨識中）→ 完成後兩者都隱藏、`uploadStatusRow` 顯示檔名/結果摘要 + `重跑 OCR`；辨識結果文字寫入 `#articleInput`（切回或保持在「上傳圖片」頁籤都可以，但 textarea 本體只有一份，跟「手動輸入」共用同一個 `#articleInput`，不建立第二個 textarea）——對應決策一「校對後才分析」的要求：使用者可以在辨識完成後直接在這個頁籤看到寫入 `#articleInput` 的文字並修改，或切回「手動輸入」頁籤編輯，兩者是同一個 DOM 元素，不需要同步邏輯。
- **共用 CTA**：`讓 AI 挑單字`（`#analyzeBtn`）留在頁籤外、`articleInputSection` 底部原本的位置不動（不在頁籤內容區裡重複放一顆），兩個頁籤共用同一顆送出按鈕，呼應決策一「不要為圖片路徑另外做一顆 CTA」。
- **額度提示樣式**：`.text-gray-400` 在 Day Mode 下可用，但 scene-cold 場景下 `#9CA3AF`（Tailwind gray-400）跟 `--cold-void`（`#14171a`）對比不足以維持「次要但可讀」的層級，需要新增 class 而非直接套 Tailwind 工具類：
  ```css
  .upload-quota-hint {
    font-size: 0.75rem;
    color: var(--muted, #9CA3AF); /* Day Mode 沿用 --muted */
  }
  body.scene-cold .upload-quota-hint {
    color: var(--cold-dim) !important; /* 冷調場景改吃 --cold-dim，維持同一層級的「次要說明」語感 */
  }
  ```

### 4.4 Dropzone / Loading 樣式

Day Mode 與 scene-cold 各自需要一份，比照第 0 節「按鈕/輸入框吃場景 token」的一貫做法：

```css
.upload-dropzone {
  border: 1px dashed var(--color-input-border, #D8C9A8);
  border-radius: var(--radius-input, 8px);
  padding: 28px 16px;
  text-align: center;
  color: var(--muted);
}
body.scene-cold .upload-dropzone {
  border-color: var(--glass-cold-border) !important;
  color: var(--cold-dim) !important;
  background: var(--glass-cold-fill) !important;
}

.upload-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  color: var(--muted);
}
body.scene-cold .upload-loading {
  color: var(--cold-dim) !important;
}
```

- Dropzone 邊框用 `dashed`（虛線）維持「這是一個可拖放的區域」的既定視覺語言，粗細與圓角沿用既有 `--radius-input` token，不新增圓角規格。
- 不做拖放時的高亮動畫規格（例如 dragover 狀態的邊框變色）——留給 `@frontend-developer` 用既有 `--cold-accent` 的 hover 公式（`color-mix` 疊加）實作，不需要額外設計規格，屬於「功能性 chrome」等級的細節。

---

## 5. 待確認事項

1. 第 0 節提出的「按鈕統一吃 `--cold-accent`」是治本方案，但影響全站所有 `.btn-primary-m`/`.btn-outline-m`/`.quiz-btn-*` 的視覺，範圍比其餘 QA 項目大很多——是否同意在這次一併處理，還是先用逐一覆寫的白名單方式修完這次回報的區塊，治本方案另開任務？
2. 「自訂新增單字」搬進 sidebar、「網址」頁籤移除——這兩項決策目前只出現在這次委託的口頭描述裡，建議請 `@perfume-game-director` 補一份決策文件存證，或確認由本文件視為既定範圍即可？
3. 上傳圖片頁籤的 dropzone 是否需要支援真正的拖放（`dragover`/`drop` 事件），或先做「按鈕選檔」的簡化版、拖放留待下一輪？
