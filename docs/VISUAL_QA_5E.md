<!--  注意（2026-07-15）：本文件規格來源 docs/VISUAL_SPEC.md 已棄用。
--cold- / --story- token 整合方向待後續決策，本文件內容暫時凍結，請勿依此執行新修改。-->
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

---

## 6. 修正輪 1 使用者實測後的根因深挖（帶證據稽核）

**背景**：修正輪 1（commit `ca89a5c`）處理完「三套隱藏 token 系統」（`--wc-*`／`--qz-*`／裸 `select` 鎖色）之後，使用者實測回報畫面 1–3 仍有多處沒修到。逐一 grep 後發現：**這次不是漏了 selector，是同一顆按鈕背後同時疊了 2–4 層彼此用 ID／`:not()`／source order 互相「打贏」對方的歷史遺留規則**，我方才加的 `body.scene-cold .btn-primary-m` 這種「class 選擇器」天生打不贏任何 ID 選擇器，無論後面加多少個 class 或 `!important`。

> ⚠️ **重要警示**：使用者回報裡引用了「commit `d2cc98e`」——那是 Phase 5f **之前**的舊 commit，早於本文件第 0 節「按鈕統一」與修正輪 1 的全部工作。如果實測環境真的還停在 `d2cc98e`，畫面 2、3 描述的「完全沒被修到」全部符合預期（因為那些修法根本還沒進去）。但下面 (a)(c) 兩題挖出的問題，**在最新的 `ca89a5c` 之後依然成立、是真的程式碼 bug，不是版本落後**——請先確認實測用的是最新 commit，再依下面的清單排優先序，避免把「還沒重新整理頁面」跟「真的沒修好」混在一起處理。

### 6.1 (a)「讓 AI 挑單字」CTA 為什麼沒被 `body.scene-cold .btn-primary-m` 命中

**實際 selector**：`#analyzeBtn`，class 是 `btn-primary-m`（`index.html:1415`）。

**根因：不是特異性算錯，是壓根有一條 ID-only 規則在半路把 class 規則直接攔截。** `theme-perfume-day.css:664-685` 有一整塊「belt-and-suspenders」規則：

```css
#analyzeBtn, #saveBtn, #customAnalyzeBtn, #customAddBtn,
#urlFetchBtn, #qsStart, #startQuizBtn, #usageSaveBudget {
  background-color: #1C1208 !important;   /* 字面 hex，連 var() 都不用 */
  background:       #1C1208 !important;
  color:            #F0E8D4 !important;
  ...
}
```

這條規則的特異性是 `(0 ID組合內每個選擇器各自 1 個 ID, 0 class, 0 type)`——**單純一個 ID selector**。而修正輪 1 寫的 `body.scene-cold .btn-primary-m { background: var(--cold-wash) !important; }` 特異性是 `(0 ID, 2 class, 1 type)`。CSS 特異性比較是「先比 ID 欄位」：只要對方有 1 個 ID、我方是 0 個 ID，**不管我方疊多少個 class 或 type，永遠是對方贏**，`!important` 兩邊都有時也一樣先比特異性。這就是為什麼「新規則的 class 選擇器」在這 8 顆按鈕上全部失效——它們背後都躲著這條 ID 規則。

修正輪 1 只對 `#analyzeBtn` 做了 **文字色** 的 ID 對等覆寫（`body.scene-cold #analyzeBtn.btn-primary-m { color: var(--cold-parchment) !important; }`，`index.html:995-1000`），**沒有對背景色做同等級覆寫**，所以背景維持 `#1C1208`（使用者形容的「深棕色實色底」），且同一顆 ID 清單裡的其餘 7 顆按鈕（`#saveBtn`／`#customAnalyzeBtn`／`#customAddBtn`／`#startQuizBtn`／`#usageSaveBudget`，`#urlFetchBtn` 已隨網址 tab 移除、`#qsStart` 情況見下段）**背景與文字色兩者都完全沒被覆寫過**，全部原樣呈現 Day Mode 焦棕配色。

**連帶發現**：`#startQuizBtn`（sidebar「開始測驗」）背後其實疊了 *三層* 規則互相用 source order / `:not()` 特異性打架（`theme-ocean.css:84`、`theme-perfume-wc.css:779`、`theme-perfume-wc.css:1953` 的 `html:not([data-theme="dark"]) #startQuizBtn`），目前實際勝出的是 `html:not([data-theme="dark"]) #startQuizBtn { background: var(--color-ink-1) !important; }`（`theme-perfume-wc.css:1953-1961`，特異性 `(0 ID, 1 class即:not, 1 type即html)`）——同樣是 ID 等級，同樣的病灶。**使用者還沒測到這顆，但它現在跟 `#analyzeBtn` 一樣壞**。

### 6.2 (b) 「資料管理」4 顆按鈕的實際 class

`index.html:1690-1712`：

| 按鈕 | 實際 class |
|---|---|
| 匯出 JSON `#exportJsonBtn` | `px-3 py-2 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 text-sm hover:bg-gray-200` |
| 匯入 JSON `#importJsonBtn` | 同上 |
| 雲端載入 `#loadSheetsBtn` | `px-3 py-2 rounded-lg bg-gray-50 text-gray-600 border border-gray-300 text-sm hover:bg-gray-100 hover:border-[#4A6C6F] hover:text-[#4A6C6F] transition` |
| 同步到 Google `#pushSheetsBtn` | `px-3 py-2 rounded-lg bg-white text-gray-600 border border-gray-300 text-sm hover:bg-gray-50 hover:border-gray-400 transition` |

**確認**：4 顆全部是純 Tailwind gray 家族（`bg-gray-100`/`bg-gray-50`/`bg-white` + `text-gray-700`/`text-gray-600` + `border-gray-300`），**沒有任何 ID 專屬規則**，理論上修正輪 1 新增的「根因五」全站 Tailwind 掃描（`body.scene-cold .bg-white/.bg-gray-50/.bg-gray-100/.text-gray-600/.text-gray-700/.border-gray-300`，`index.html:1122-1143`）應該直接命中並修好這 4 顆——**這是 6.0 節警示的「可能是舊版本」的最佳例證**：這 4 顆按鈕在 `ca89a5c` 之後應該已經正確變冷色，如果實測仍是米白色，優先懷疑是還沒測到最新 commit，其次才懷疑 sweep 規則本身有問題（目前重新檢查過 `index.html:1122-1143`，選擇器與數值都正確，沒有發現邏輯錯誤）。

**唯一例外**：4 顆按鈕的 `hover:` 系列 class（`hover:bg-gray-200`／`hover:bg-gray-100`／`hover:border-[#4A6C6F]`／`hover:text-[#4A6C6F]`／`hover:bg-gray-50`／`hover:border-gray-400`）**完全沒被 sweep 涵蓋**——Tailwind 的 `hover:bg-gray-200` 編譯出來是獨立的 `.hover\:bg-gray-200:hover` 選擇器，跟 `.bg-gray-200`（base 態）是兩個不同的 class，我方 sweep 只寫了 base 態，滑鼠移上去的瞬間會「爆回」Day Mode 的暖色（也是使用者描述「開始測驗顏色」以外，另一個潛在的「滑過去爆色」根因，對應第 11 節 hover 態規劃）。

### 6.3 (c) 測驗視窗「提交」按鈕的 selector 與配色來源

**實際 selector**：`#quizSubmit`，class 是 `quiz-btn-primary`（`index.html:1741`）。

**根因**：`theme-perfume-wc.css:1420-1433`「7a. Primary — amber stamp」區塊：

```css
.quiz-btn-primary, #quizSubmit, #grammarQuizSubmit, #qsStart {
  background: var(--qz-accent) !important;   /* 實色填滿 */
  color:      #FDF6E3 !important;            /* 字面 hex 米白 */
  border:     1px solid rgba(200, 149, 42, 0.40) !important;
}
```

這條規則**也是 ID 等級**（`#quizSubmit` 在選擇器群組裡），比修正輪 1 的 `body.scene-cold .quiz-btn-primary`（class-only）特異性高，直接攔截。但因為修正輪 1「根因三」把 `--qz-accent` 這個 token 本身重新定義成 `var(--cold-accent)`（`index.html:1080-1089`，`body.scene-cold #quizModal { --qz-accent: var(--cold-accent); }`），**這條 ID 規則現在確實吃到了新顏色**——`--qz-accent` 解析出來是 `--cold-accent`（`#5c7686`，中低明度青灰藍）**當成實色滿版底色**，這正是使用者形容的「灰藍色實色底，飽和度過高，偏 Windows XP 藍」。

**這不是版本落後，是修正輪 1 真實存在的設計缺口**：根因三只換了「token 的值」，沒有換「用 token 的方式」——`.quiz-btn-primary` 家族的背景公式是「accent 當實色滿版底」，跟 `.btn-primary-m` 修正輪 1 已經放棄的舊公式是同一種問題（深字/淺字对比姑且不論，滿版 accent 本身就違反「accent 只用在邊緣/rim，不當大面積底色」的美學原則——見 `decisions.md` 的 Accent 用量硬規則）。`.quiz-btn-primary`／`#quizSubmit`／`#grammarQuizSubmit`／`#qsStart` 這 4 個目標，需要比照修正輪 1 給 `.btn-primary-m` 做的同一次「深底+亮字+accent 邊框」改造，而不是只換 token 值。文字色 `#FDF6E3` 也是字面 hex（不是 `var(--qz-ink)`），根因三的 token 重定義同樣沒碰到它——目前實際文字色就是這個字面米白，跟預期的 `--cold-parchment` 恰好數值相近但完全是巧合，不能依賴。

---

## 7. 全站按鈕總表（窮舉，含 hover 態）

**圖例**：「已修好」＝目前 `ca89a5c` 的規則邏輯上會正確命中；「壞—ID 攔截」＝class-only 規則打不贏背後的 ID 規則；「未涵蓋」＝目前完全沒有任何 scene-cold 規則碰過。

| # | 顯示文字 | Selector | 目前實際來源（檔案:行號） | Day 現況 | Night 目標 | hover 態 | 狀態 |
|---|---|---|---|---|---|---|---|
| 1 | 讓 AI 挑單字 | `#analyzeBtn.btn-primary-m` | `day.css:664`（ID belt-and-suspenders，background） | `#1C1208` 底／`#F0E8D4` 字 | `--cold-wash` 底／`--cold-parchment` 字／`--cold-accent` 邊框 | `color-mix(--cold-wash 80%, --cold-accent 20%)` | 壞—ID 攔截（背景） |
| 2 | 加入選取清單 | `#saveBtn.btn-primary-m` | `day.css:664` | 同上 | 同上 | 同上 | 壞—ID 攔截 |
| 3 | 分析（sidebar 自訂單字） | `#customAnalyzeBtn.btn-outline-m` | 無 ID 攔截，純 class | 透明底／`--color-ink-2` 字 | 透明底／`--cold-parchment` 字／`--glass-cold-border` 邊 | `rgba(92,118,134,.10)` 底 | 已修好 |
| 4 | 加入我的清單 | `#customAddBtn.btn-primary-m` | `day.css:664` | `#1C1208`／`#F0E8D4` | `--cold-wash`／`--cold-parchment`／`--cold-accent` 邊 | 同 #1 | 壞—ID 攔截 |
| 5 | 開始測驗（sidebar） | `#startQuizBtn.btn-primary-m` | `wc.css:1953`（`html:not([data-theme=dark])`，比 day.css:664 更高特異性且更晚載入，實際勝出者） | `#1C1208`／`#F0E8D4` | 同上 | 同上 | 壞—ID 攔截（三層規則打架，見 6.1） |
| 6 | 開始測驗（quizSettings 內） | `#qsStart.quiz-btn-primary` | `wc.css:1426`（qz-accent 實色滿版，見 6.3） | `--qz-accent` 實色底／`#FDF6E3` 字 | `--cold-wash` 底／`--cold-parchment` 字／`--cold-accent` 邊 | `color-mix(--cold-wash 80%, --cold-accent 20%)` | 壞—ID 攔截+設計公式需重做 |
| 7 | 取消（quizSettings） | `#qsCancel` | `index.html:1201`（body.scene-cold ID 覆寫，已比 wc.css:1444 特異性更高） | `bg-gray-100` | `transparent`／`--glass-cold-border` 邊／`--cold-parchment` 字 | 建議補 `rgba(92,118,134,.08)` | 已修好 |
| 8 | 提交（quizModal） | `#quizSubmit.quiz-btn-primary` | `wc.css:1424`（qz-accent 實色滿版） | 同 #6 | 同 #6 | 同 #6 | 壞—ID 攔截+設計公式需重做 |
| 9 | 不會（quizModal） | `#quizIDK` | `wc.css:1444`（rgba(61,43,31,.08) 底＋`--qz-ink`／`--qz-line`，根因三已讓 ink/line 轉冷） | 半透明暖底／`--qz-ink` 字／`--qz-line` 邊 | 背景改 `rgba(92,118,134,.08)`（目前殘留的暖色只在極低透明度的 rgba(61,43,31,...) 裡，肉眼幾乎看不出，但邊框/字已修好） | `rgba(200,149,42,.12)`→改 `rgba(92,118,134,.14)` | 大致已修好，僅背景 rgba 色相殘留暖褐（低優先） |
| 10 | 下一題（Enter） | `#quizNext.quiz-btn-next` | 無 ID 攔截 | `--navy` 底／白字 | `--cold-wash`／`--cold-parchment`／`--cold-accent` 邊 | 同 #1 | 已修好 |
| 11 | 只重測錯題 | `#quizRetakeWrong.quiz-btn-next`（動態注入，`ui.js:1331`） | 無 ID 攔截 | 同 #10 | 同 #10 | 同 #1 | 已修好 |
| 12 | 全部重測 | `#quizRetakeAll.quiz-btn-primary`（動態注入，`ui.js:1332`） | 無 ID 攔截 | 同 #6 | `--cold-wash`／`--cold-parchment`／`--cold-accent` 邊（走 `.quiz-btn-primary` 治本方案後這顆會自動跟上，不需要額外處理） | 同 #1 | 已修好（前提是 #6/#8 的治本方案落地） |
| 13 | 匯出 JSON | `#exportJsonBtn` | 純 Tailwind：`bg-gray-100 text-gray-700 border-gray-300` | 米白底／深棕字 | `--glass-cold-fill`／`--cold-dim`／`--glass-cold-border` | `hover:bg-gray-200` 未涵蓋→需補 | 已修好（base），hover 未涵蓋 |
| 14 | 匯入 JSON | `#importJsonBtn` | 同上 | 同上 | 同上 | 同上 | 同上 |
| 15 | 雲端載入 | `#loadSheetsBtn` | `bg-gray-50 text-gray-600 border-gray-300` + `hover:border-[#4A6C6F] hover:text-[#4A6C6F]` | 米白底／中棕字 | 同上 | `hover:bg-gray-100` 未涵蓋，`hover:border-[#4A6C6F]`／`hover:text-[#4A6C6F]` 是 Tailwind 任意值 class，需個別加 scene-cold hover 覆寫 | 已修好（base），hover 未涵蓋 |
| 16 | 同步到 Google | `#pushSheetsBtn` | `bg-white text-gray-600 border-gray-300` + `hover:border-gray-400` | 同上 | 同上 | `hover:bg-gray-50` 未涵蓋 | 已修好（base），hover 未涵蓋 |
| 17 | 重置本月估算 | `#usageReset` | `border-gray-200 text-gray-500` + `hover:border-gray-300 hover:text-gray-700` | 透明底／灰字 | `--glass-cold-border`／`--cold-dim` | hover 未涵蓋 | 已修好（base），hover 未涵蓋 |
| 18 | 儲存預算 | `#usageSaveBudget` | `day.css:664` ID 攔截 **+** inline `style="background:#A3B18A"` 與 `onmouseover/onmouseout` JS 直接改 `style.background`（`index.html:1797`） | `#1C1208`／`#F0E8D4`（!important 贏過 inline） | `--cold-wash`／`--cold-parchment`／`--cold-accent` 邊 | inline `onmouseover` 目前寫死 `#8d9b76`，建議整顆改用 class + scene-cold hover，拿掉 inline onmouseover/onmouseout | 壞—ID 攔截 **+** inline JS 需一併清掉 |
| 19 | 關閉（用量 modal，右上✕） | `#usageClose` | `text-gray-400 hover:text-gray-600` | 灰字 | `--cold-dim` | hover 未涵蓋 | 已修好（base），hover 未涵蓋 |
| 20 | 關閉（用量 modal，底部按鈕） | `#usageClose2` | inline `style="background:#8A9BA8"` + `onmouseover/onmouseout` 硬編碼，**沒有任何 !important 規則跟它競爭**，inline 直接勝出 | `#8A9BA8` 實色底（跟全站任何 token 都無關） | 建議改用 `.btn-outline-m` 或新 class，拿掉 inline，改吃 `--cold-wash`/`--cold-parchment`/`--cold-accent` | 拿掉 inline onmouseover，改 CSS hover | 未涵蓋（且是三種硬編碼按鈕配色裡最孤立的一個） |
| 21 | 儲存（同步 modal） | `#syncSave` | `bg-blue-600 text-white` | 飽和寶藍實色底 | 不應維持飽和藍——比照主要按鈕改 `--cold-wash`/`--cold-parchment`/`--cold-accent` 邊，或至少壓低飽和度換成 `--cold-accent` 邊框版 | 需新增 | 未涵蓋 |
| 22 | 關閉（同步 modal） | `#syncClose` | `bg-gray-200` | 米灰底 | `--glass-cold-fill` | 需新增 | 已修好（base，隨 Tailwind sweep），hover 未涵蓋 |
| 23 | 手動輸入／上傳圖片 | `.input-tab` / `.input-tab--active` | `index.html:1007-1011`（scene-cold 已覆寫） | — | 已於修正輪 1 修好 | 已涵蓋 | 已修好 |
| 24 | 今日新增／複習／全部 | `#tabToday/#tabDue/#tabAll` + `.tab--active` | `index.html:1019-1039`（修正輪 1 新增） | — | 已修好 | 已涵蓋 | 已修好 |
| 25 | 單字卡結果頁籤：單字卡／翻譯／文法重點 | `#rtabWords/#rtabTrans/#rtabGrammar` + `.result-tab`/`.result-tab--active` | **完全未稽核過**，需在修正輪 2 展開（class 定義位置待查，推測在 `theme-perfume-day.css` 的 `.result-tab-*` 區塊，讀取 `--color-*` 系列，跟 `--cold-*` 無關的機率很高） | 未知，需補查 | `--cold-parchment` 字（active）／`--cold-dim`（inactive）／底線 `--cold-accent` | 待查 | **未涵蓋（新發現，優先稽核）** |
| 26 | 展開／重新分析（摺疊帶） | `#stripExpandBtn.btn-outline-m` / `#stripReanalyzeBtn.btn-ghost-m` | 純 class，無 ID 攔截 | — | 已隨 `.btn-outline-m`/`.btn-ghost-m` 全站規則修好 | 已涵蓋 | 已修好 |
| 27 | 收藏到 Notion（sidebar） | `#sidebarNotionBtn.btn-outline-m` | 純 class | — | 已修好 | 已涵蓋 | 已修好 |
| 28 | 分頁器（上一頁/下一頁 × 3 組） | `#todayPrev/#todayNext/#duePrev/#dueNext/#allPrev/#allNext` | `bg-gray-100`，`hover:bg-gray-200` | 米灰底 | `--glass-cold-fill` | `hover:bg-gray-200` 未涵蓋 | 已修好（base），hover 未涵蓋 |
| 29 | 復原（undo toast） | `#undoBtn` | inline `style="background:rgba(255,255,255,.18)"` | 半透明白疊在 toast 底色上 | toast 本身若已是深底，這個半透明白疊層效果通用，不需要改（待第 9 節確認 `#undoToast` 底色本身沒有暖色殘留） | — | 需連同 `#undoToast` 一併檢查 |
| 30 | ✕（記憶輔助彈窗） | `#mnemonicClose` | 未稽核，樣式來源待查（`.mnemonic-close`） | 未知 | 待補 | 待補 | **未涵蓋（新發現）** |

**全站按鈕表共列 30 顆**（含 3 顆分頁器群組已合併計為 1 列，實際 DOM 元素數量更多）。「壞—ID 攔截」有 **7 處**（#1/#2/#4/#5/#6/#8/#18），全部同一種病灶（class 規則打不贏背後的 ID 規則），修法完全一致，可以一次性批次處理，見第 12 節。

---

## 8. Tailwind utility 對照表（含語意角色，不是無腦映同一色）

| Tailwind class | Day 語意角色 | scene-cold 對應 token | 備注 |
|---|---|---|---|
| `bg-white` | 頂層卡片／modal 面板底 | `--glass-cold-fill` | 已於修正輪 1 sweep（`index.html:1122`） |
| `bg-gray-50` | 次要卡片底／table thead／次要按鈕底 | `--glass-cold-fill` | 同上；語意上比 `bg-gray-100` 淺一階，但目前對應同一 token——冷色系統沒有拆這麼細的分層，可接受 |
| `bg-gray-100` | 卡片底／分頁器按鈕底／disabled 按鈕底／table zebra | `--glass-cold-fill` | 同上；**disabled 按鈕**若用這個 class，記得額外檢查 `opacity` 是否也正確調低，token 本身不處理 disabled 語意 |
| `bg-gray-200` | 次要按鈕底（`#quizIDK` 原始 class，但實際被 ID 規則攔截，見表 7 #9） | `--glass-cold-fill` | 同上；注意此 class 在 `#quizIDK` 上其實不生效（ID 攔截），不要誤以為它已經在管這顆按鈕 |
| `border-gray-100` | 頁籤下緣分隔線（極淡） | `--glass-cold-border` | 已 sweep |
| `border-gray-200` | 一般輸入框／卡片邊框 | `--glass-cold-border` | 已 sweep |
| `border-gray-300` | 按鈕邊框（資料管理 4 顆等） | `--glass-cold-border` | 已 sweep |
| `text-gray-300` | 極淡裝飾文字（罕見） | `--cold-dim` | 已 sweep |
| `text-gray-400` | 次要說明／pager 頁碼／額度提示 | `--cold-dim` | 已 sweep |
| `text-gray-500` | 次要標籤／label（`petStageLabel` 以外的通用 label） | `--cold-dim` | 已 sweep |
| `text-gray-600` | 說明文字（資料管理描述、usage modal 內文） | `--cold-dim` | 已 sweep |
| `text-gray-700` | 次要內文（quizPrompt 部分文字、usage modal 表格） | `--cold-dim` | 已 sweep |
| `text-gray-800` | 較重要的內文（少見，通常是 body 預設繼承色） | `--cold-parchment` | 已 sweep |
| `text-gray-900` | 強調數字（usageCostTotal） | `--cold-parchment` | 已 sweep |
| `text-amber-700` | **新發現，未涵蓋**：quiz 提示/翻譯 label（`ui.js:1137,1158`） | 建議新增 `--cold-dim`（維持「次要說明」語意層級，不要给 amber 冷色替代品，因为这类 label 本质是次要文字，不是強調色） | 見第 9 節 |
| `text-red-600` / `text-rose-700` | 錯誤/答錯語意色（quizFeedback 即時回饋、summary 錯題表格） | 建議新增 `--cold-wrong: color-mix(in srgb, var(--cold-dim) 60%, #b5645a 40%)`（低飽和的冷調紅棕，不是鮮紅，符合「沒有戲劇性」原則） | 見第 9 節；**不要沿用 `--wound`**（`--wound` 全站僅供 Day14 劇情事件使用，見 `theme-perfume-night.css` Step 4 的硬性禁令） |
| `text-green-600` / `text-green-700` | 正確語意色（quizFeedback 即時回饋、summary 表格） | 建議新增 `--cold-correct: color-mix(in srgb, var(--cold-accent) 70%, var(--cold-parchment) 30%)`（用現有 accent 提亮，不引入新色相） | 見第 9 節 |
| `bg-blue-600` | 同步 modal 儲存按鈕（**孤例**，全站唯一一處飽和藍） | 建議直接替換掉，改用 `.btn-primary-m` 或等效 class，不建議另開一個「藍色 token」只為了這一顆按鈕 | 見第 9 節 |
| `bg-yellow-*` / `bg-amber-*`（卡片/背景用途） | grep 全站未發現此類用途（僅上面 `text-amber-700` 一處是文字色） | — | 見第 9 節完整 grep 結果 |

---

## 9. 暖色殘留清單（grep 全站結果，含行號與用途）

### 9.1 硬編碼暖色 hex（直接寫在 CSS 或 inline style，不經任何 token）

| Hex | 位置 | 用途 | 建議 |
|---|---|---|---|
| `#1C1208` / `#F0E8D4` | `theme-perfume-day.css:672-674`（belt-and-suspenders ID 清單）、`theme-perfume-wc.css:1954-1956`（`html:not([data-theme=dark]) #startQuizBtn`） | 表 7 「壞—ID 攔截」7 顆按鈕的實際底色/字色 | 需要對等特異性的 `body.scene-cold` ID 覆寫，見第 12 節 |
| `#FDF6E3` | `theme-perfume-wc.css:1428`（`.quiz-btn-primary,#quizSubmit,#grammarQuizSubmit,#qsStart` 文字色） | 表 7 #6/#8 文字色 | 同上，改吃 `var(--cold-parchment)` |
| `#A3B18A` | `index.html:1797`（`#usageSaveBudget` inline style）、`ui.js:1329`（「太強了！全對」inline `style="color:#8F9A78"` 附近同色系，注意這兩個 hex 實際不同：`#A3B18A` vs `#8F9A78`，都是舊 Morandi 鼠尾草綠家族，只是深淺不同版本） | 儲存預算按鈕底色；quiz summary「全對」訊息文字色 | 前者隨按鈕一併重做；後者改用 `var(--cold-accent)` 或新增語意 token（見 9.3） |
| `#8d9b76` / `#7a8d9a` | `index.html:1797,1801`（`onmouseover`/`onmouseout` inline JS 硬編碼 hover 色） | `#usageSaveBudget`／`#usageClose2` 的 hover 態 | 拿掉 inline JS，改用 CSS class + scene-cold hover 規則 |
| `#8A9BA8` | `index.html:1801`（`#usageClose2` inline style） | 見表 7 #20 | 同上 |
| `#8F9A78` | `js/ui.js:1134`（dictation 模式播放按鈕 inline `style="color:#8F9A78;border-color:#8F9A78;"`）；`js/ui.js:1329`（quiz summary「太強了！全對」） | 播放按鈕圖示色；全對訊息文字色 | 兩處都建議改吃 `var(--cold-accent)` |
| `#7a9068` / `#6b7f57` | `theme-ocean.css:577-583`（`[data-theme="dark"] #quizSubmit`） | 舊版深色模式（非 scene-cold）的 quizSubmit 配色，只有使用者手動切換月亮圖示才會生效 | 屬於「兩套深色系統並存」的既有已知問題（見 `VISUAL_QA_5E.md` 第 0 節根因摘要），暫不處理，等按鈕系統徹底併軌到 scene-cold 再決定是否棄用 `[data-theme=dark]` 整個系統 |

### 9.2 Tailwind 暖色 class（grep 全站 `.html`／`.js`）

| Class | 位置 | 用途 |
|---|---|---|
| `text-amber-700` | `js/ui.js:1137`（dictation 提示「提示：...」）、`js/ui.js:1158`（typing 模式「翻譯：...」） | 對應使用者回報畫面 3「翻譯：」label 橘紅色，**確認命中** |
| `bg-blue-600` | `index.html:1820`（`#syncSave`「儲存」按鈕） | 唯一一處飽和藍，見表 7 #21 |
| `text-red-600` | `js/ui.js:1223`（quizFeedback 答錯即時回饋） | 語意色，非殘留 bug，但需要冷調等效版（見第 8 節） |
| `text-green-600` | `js/ui.js:1220`（quizFeedback 答對即時回饋） | 同上 |
| `text-rose-700` | `js/ui.js:1297`（quiz summary 錯題表格「你的答案」欄） | 同上 |
| `text-green-700` | `js/ui.js:1298`（quiz summary 錯題表格「正確答案」欄） | 同上 |
| `text-yellow-200` / `text-red-200` | `js/ui.js:1540`（用量超支警示，動態 toggle class） | 語意色（超支警示），使用場景是**暖色 header 漸層之上**（`.header-gradient` 目前維持暖色不受 scene-cold 影響，見 `index.html:734-748`），不建議改動——header 本身就是刻意保留的暖色系統，這兩個 class 在那個脈絡下沒有違和 |

`bg-amber-*` / `bg-yellow-*`（背景用途）：全站 grep 無命中，僅有上面列出的文字色與 toggle-class 用法。

### 9.3 建議新增的語意色 token（不是重新引入暖色，是給「正確/錯誤」語意找一個冷調安全的家）

現有 `--cold-*` 家族沒有「錯誤/正確」語意色——`--wound` 依規則禁止挪用（Day 14 劇情事件專屬）。建議在 `body.scene-cold` 內新增兩個衍生 token（都是從既有 `--cold-*` 家族色混出來，不引入新色相，符合「只用一個 accent」的硬規則精神，因為這兩個只用於語意回饋而非互動 accent）：

```css
body.scene-cold {
  --cold-correct: color-mix(in srgb, var(--cold-accent) 70%, var(--cold-parchment) 30%);
  --cold-wrong:   color-mix(in srgb, var(--cold-dim) 55%, #7a4a42 45%);  /* 低飽和冷調紅棕，非鮮紅 */
}
```

用途對照：`text-green-600`/`text-green-700` → `var(--cold-correct)`；`text-red-600`/`text-rose-700` → `var(--cold-wrong)`。

---

## 10. input / select / 展示框 全站盤點

| 元素 | Selector | 現況 class | 目前狀態 |
|---|---|---|---|
| 匯入文章 textarea | `#articleInput` | inline `color:var(--text)` | 已修好（scoped ID 覆寫） |
| 自訂單字查詢 | `#customWordInput` | 純 border | 已修好（`#customWordSidebar` 容器覆寫） |
| 自訂單字編輯欄位（7 個） | `#cw_word/#cw_pos/#cw_level/#cw_def/#cw_example_en/#cw_example_ai/#cw_example_zh` | 純 border | 已修好（同上） |
| 搜尋單字 | `#allSearch` | `p-2 border rounded` | 已修好（`body.scene-cold select` 不適用，這是 `<input>`，走的是 `input[type="text"]` 軟性 fallback，`index.html:1251-1259`，無 ID/裸 tag !important 對手，可正常生效） |
| 詞性 select | `#allPos` | `p-2 border rounded` | 已修好（`body.scene-cold select { !important }`，修正輪 1 新增，`index.html:1108-1112`） |
| 難度 select | `#allLevel` | 同上 | 已修好 |
| 排序 select | `#allSort` | 同上 | 已修好 |
| 測驗輸入框 | `#quizAnswer` | `w-full p-3 border rounded`（**裸 class，無 type 屬性選擇器命中**——注意 `<input id="quizAnswer" ...>`沒有寫 `type="text"`，瀏覽器預設行為等同 text，但 CSS 選擇器 `input[type="text"]` **不會**匹配沒有寫 `type` 屬性的 `<input>`！這是屬性選擇器的已知陷阱） | **未涵蓋（新發現的真根因）**：`input[type="text"]` 選擇器語法上就吃不到它，這才是使用者回報「輸入英文單字...米白底」的真正原因，不是特異性問題 |
| 用量預算 | `#usageBudgetInput` | `border border-gray-200` + `type="number"` | 已修好（`input[type="number"]` 有命中） |
| 同步代碼（目前） | `#syncCodeCurrent` | `border rounded bg-gray-100`，`type="text"` | 已修好（`type="text"` 命中 + `bg-gray-100` sweep 命中，兩者疊加無衝突） |
| 同步代碼（輸入） | `#syncCodeInput` | `border rounded`，`type="text"` | 已修好 |
| 中文提示框（quiz `q.definition`） | `.p-3.bg-gray-50.rounded`（無 ID，`ui.js:1156`） | 純 Tailwind class | 已修好（`bg-gray-50` sweep），文字色繼承自 `#quizModal > div` 的 `--cold-parchment` |
| 例句展示（`q.maskedExample`） | `.text-sm.text-gray-600`（`ui.js:1157`） | 純 Tailwind class | 已修好（`text-gray-600` sweep） |
| 翻譯展示（`q.exampleZh`） | `.text-sm.text-amber-700`（`ui.js:1158`） | **未涵蓋**——`text-amber-700` 不在任何 sweep 清單裡 | 見第 9 節，需新增 |
| 提示展示（dictation `q.hintZh`） | `.text-sm.text-amber-700`（`ui.js:1137`） | 同上 | 同上 |

**修正輪 2 最關鍵的新發現：`#quizAnswer` 沒有 `type="text"` 屬性，`input[type="text"]` 選擇器語法上完全吃不到它。** 這比任何特異性問題都根本——選擇器寫對了特異性也没用，因為它從一開始就不匹配這個元素。修法二選一：(1) 在 HTML 幫 `#quizAnswer` 補上 `type="text"`（`index.html` 目前寫法只有 `<input id="quizAnswer" class="w-full p-3 border rounded" placeholder="...">`，沒有 `type` 屬性）；(2) 或者 CSS 選擇器改用 `body.scene-cold #quizAnswer` 直接點名 ID，兩者擇一即可，選 (2) 風險更低（不動 HTML 屬性，純 CSS 新增一條規則）。

---

## 11. Modal 內部文字盤點：`#quizModal` / `#quizSettings`（含動態注入內容）

### 11.1 `#quizSettings`（測驗設定，靜態 HTML）

| 文字節點 | Selector | Token | 狀態 |
|---|---|---|---|
| 標題「測驗設定」 | `.sidebar-title`（`#quizSettings` 內） | `--qz-ink` → 已被 `body.scene-cold #quizSettings { --qz-ink: var(--cold-parchment); }` 覆寫；另有第 0 節兜底 `body.scene-cold .sidebar-title { color: var(--cold-parchment) !important; }` 雙重保險 | 已修好 |
| 「每題結束後自動播放」 | 純文字，繼承 `#quizSettings > div` 的 `color` | 已修好 |
| 4 個 radio label（不自動播放/只播單字/只播例句/單字+例句） | 純文字 + 原生 radio | 文字已修好；radio `accent-color` 已於修正輪 1 覆寫 | 已修好 |
| checkbox「題目顯示例句中文翻譯」 | 純文字 + 原生 checkbox | 同上 | 已修好 |
| 「取消」按鈕 | `#qsCancel` | 見表 7 #7 | 已修好 |
| 「開始測驗」按鈕 | `#qsStart` | 見表 7 #6 | 壞—需治本 |

### 11.2 `#quizModal`（測驗進行中，含動態注入）

| 文字節點 | Selector | Token | 狀態 |
|---|---|---|---|
| 標題「單字測驗」 | `.sidebar-title`（`#quizModal` 內，`index.html:1735` 附近） | 同 11.1，`--qz-ink` 已覆寫 + 兜底規則 | 已修好 |
| 模式副標「複習模式 (1/15)」 | `#quizModeLabel`（inline `style="color:var(--theme-color)"`）+ `#quizProgress`（`.text-sm.font-normal.text-gray-400`） | `#quizModeLabel` 讀的是 **inline style 直接指向 `--theme-color`**（`theme-ocean.css` 的舊 token，`#8F9A78`/`#748cab`，跟 `--qz-*`/`--cold-*` 完全無關）——**未涵蓋，新發現**；`#quizProgress` 的 `text-gray-400` 已被 sweep | `#quizModeLabel` 壞；`#quizProgress` 已修好 |
| 「✕」關閉 | `#quizClose`（`.text-gray-500.hover:text-gray-700`） | base 已 sweep；hover 未涵蓋 | 部分修好 |
| 「請輸入對應的英文單字：」 | 純文字（`ui.js:1155`） | 繼承 `#quizModal > div` 的 `--cold-parchment` | 已修好 |
| 中文提示框（`q.definition`） | `.p-3.bg-gray-50.rounded` | 見第 10 節 | 已修好 |
| 「例句：...」 | `.text-sm.text-gray-600` | 見第 10 節 | 已修好 |
| 「翻譯：...」label＋內容 | `.text-sm.text-amber-700`（`ui.js:1158`） | **未涵蓋**——label 與內容目前是同一個 `<div>`，同一個 class，使用者形容「label 橘紅、內容白色」是因為冒號後的中文內容其實跟 label 同色，只是視覺上使用者的注意力先被 label 的橘紅吸走，內容那幾個字剛好夠亮所以主觀感覺「OK」——**實際上整行都是 `text-amber-700`，不是分開兩色**，這是重要澄清 | 壞，需新增（見第 9.3） |
| 中文提示（dictation `q.hintZh`） | `.text-sm.text-amber-700`（`ui.js:1137`） | 同上 | 壞，需新增 |
| 播放按鈕（dictation） | `#qPlay`（inline `style="color:#8F9A78;border-color:#8F9A78;"`） | 硬編碼舊 Morandi 綠 | 壞，需新增（見第 9.1） |
| 「聽完輸入答案」 | `.text-sm.text-gray-500` | 已 sweep | 已修好 |
| 輸入框 `#quizAnswer` | 見第 10 節 | `type="text"` 屬性缺失，選擇器吃不到 | **壞（新發現的根本問題）** |
| 「提交」按鈕 | `#quizSubmit` | 見表 7 #8 | 壞—需治本 |
| 「不會」按鈕 | `#quizIDK` | 見表 7 #9 | 大致已修好 |
| 「下一題（Enter）」按鈕 | `#quizNext` | 見表 7 #10 | 已修好 |
| 答對/答錯即時回饋 | `#quizFeedback` 內動態 `<span class="text-green-600">`/`<span class="text-red-600">` | **未涵蓋**，見第 8、9 節建議新增 `--cold-correct`/`--cold-wrong` | 壞，需新增 |
| **測驗完成頁**（同一個 `#quizModal`，`showQuizSummary()` 動態改寫 `#quizPrompt.innerHTML`，`ui.js:1281-1334`，**使用者完全沒看過的畫面**） | | | |
| 「測驗完成」標題 | `.text-lg.sidebar-title` | 兜底規則已覆蓋 | 已修好 |
| 「總題數：X 答對：Y...」 | `.text-sm.text-gray-700` | 已 sweep | 已修好 |
| 「太強了！全對」 | inline `style="color:#8F9A78"`（`ui.js:1329`） | 硬編碼舊 Morandi 綠 | **壞，新發現** |
| 錯題表格「你的答案」欄 | `.text-rose-700` | 見第 8、9 節 | 壞，需新增 |
| 錯題表格「正確答案」欄 | `.text-green-700` | 見第 8、9 節 | 壞，需新增 |
| 錯題表格 thead | `.bg-gray-100` | 已 sweep | 已修好 |
| 錯題表格 zebra（奇數列） | `.bg-gray-50` | 已 sweep | 已修好 |
| 錯題表格外框 | 裸 `border` class（無 `-gray-*` 後綴） | Tailwind 預設 `border` class 的顏色行為取決於 Tailwind 版本設定，此專案用 CDN 版，實際渲染顏色需另外抽查（不在本次 grep 範圍內，標記待查） | 待查 |
| 「只重測錯題」／「全部重測」 | 見表 7 #11/#12 | 已修好 |

---

## 12. Hover / Active 態規劃（上一輪完全沒寫，這是「滑過去爆色」的根因）

原則：**所有互動元件的 hover 態一律用 `color-mix()` 在既有 base 色上疊加 `--cold-accent`（10–15% 不透明度）或調整明度 ±10–15%，不得引入新色相**，對應 `theme-perfume-night.css` 已經驗證過的公式（`.btn-night--primary:hover`/`.btn-night--ghost:hover`）。

| 元件族 | Base | Hover | Active |
|---|---|---|---|
| `.btn-primary-m`/`.quiz-btn-primary`/`.quiz-btn-next` | `--cold-wash` 底／`--cold-parchment` 字／`--cold-accent` 邊 | `color-mix(--cold-wash 80%, --cold-accent 20%)` 底 | `color-mix(--cold-wash 70%, black 30%)` 底 |
| `.btn-outline-m` | 透明底／`--cold-parchment` 字／`--glass-cold-border` 邊 | `rgba(92,118,134,.10)` 底／邊框轉 `color-mix(--cold-accent 60%, transparent)` | `rgba(92,118,134,.16)` |
| `.btn-ghost-m` | 透明底／`--cold-dim` 字 | `rgba(92,118,134,.10)` 底／字轉 `--cold-parchment` | `rgba(92,118,134,.16)` |
| 資料管理 4 顆（`bg-gray-*` 系列） | `--glass-cold-fill` | 需新增 `body.scene-cold [class*="hover:bg-gray"]:hover` 等效規則——**Tailwind 的 `hover:` 變體 class 無法用簡單的全域選擇器一次涵蓋**，建議改法：直接針對這 4 顆按鈕的 ID／或新增一個共用 class（例如 `.btn-data-mgmt`）取代裸 Tailwind class，才能一次性控制 hover，而不是每加一個 `hover:bg-gray-200` 就要多寫一條 `body.scene-cold .hover\:bg-gray-200:hover` 轉義選擇器（技術上可行但極醜、極易漏） | — |
| `#tabToday/#tabDue/#tabAll` | `--cold-dim` 字／透明底 | `rgba(92,118,134,.10)` 底／字轉 `--cold-parchment` | `.tab--active` 態另計 |
| `.input-tab` | `color-mix(--cold-parchment 55%, --cold-dim 45%)` | `--cold-parchment` | `.input-tab--active` 另計 |
| `#quizIDK`/`#qsCancel` | 半透明底／`--cold-dim` 或 `--cold-parchment` 字／`--glass-cold-border` 邊 | 建議統一改 `rgba(92,118,134,.10)` 底 | — |
| pager 按鈕（`#todayPrev` 等） | `--glass-cold-fill` | 需新增（同「資料管理」的 Tailwind hover: 變體問題） | — |

**建議的治本方向**（不在本文件範圍內實作，留給 `@frontend-developer` 評估）：凡是「hover 態用 Tailwind `hover:bg-gray-*`/`hover:text-*` 寫死」的按鈕，長期應該**換成共用 class**（比照 `.btn-outline-m`/`.btn-ghost-m` 的模式），而不是繼續疊加 Tailwind 任意值 class——目前這批「資料管理」「分頁器」按鈕正是全站僅剩的、還在用「裸 Tailwind + hover: 變體」寫按鈕的地方，也是未來最容易再次「hover 爆色」的地方。

---

## 13. 可照抄的完整實作清單（修正輪 2）

依優先序排列，每條都是「Day 現況 / Night 目標 / selector / hover 態」四欄，不留「請自行決定」的空白。

### P0（表 7 標記「壞—ID 攔截」的 7 顆按鈕，同一種病灶、同一種修法）

**目標 selector 清單**：`#analyzeBtn`、`#saveBtn`、`#customAnalyzeBtn`、`#customAddBtn`、`#startQuizBtn`、`#usageSaveBudget`（以上 6 顆對應 `day.css:664` 的 ID 清單）；`#qsStart`、`#quizSubmit`、`#grammarQuizSubmit`（對應 `wc.css:1424` 的 qz-accent ID 清單，`#qsStart` 同時中兩槍，修法要同時涵蓋）。

| Day 現況 | Night 目標 | selector | hover 態 |
|---|---|---|---|
| `#1C1208` 底／`#F0E8D4` 字（day.css ID 清單） | `--cold-wash` 底／`--cold-parchment` 字／`1px solid --cold-accent` 邊 | `body.scene-cold #analyzeBtn, body.scene-cold #saveBtn, body.scene-cold #customAnalyzeBtn, body.scene-cold #customAddBtn, body.scene-cold #startQuizBtn, body.scene-cold #usageSaveBudget`（每個都要單獨帶 `body.scene-cold` 前綴，不能只放在選擇器群組最前面一次——CSS 群組選擇器裡每個逗號分隔的子選擇器都要各自達到足夠特異性） | `color-mix(in srgb, var(--cold-wash) 80%, var(--cold-accent) 20%)` |
| `--qz-accent` 實色底／`#FDF6E3` 字（wc.css qz 清單） | 同上 | `body.scene-cold #qsStart, body.scene-cold #quizSubmit, body.scene-cold #grammarQuizSubmit` | 同上 |
| （`#usageSaveBudget` 額外項）inline `onmouseover`/`onmouseout` 寫死 `#8d9b76` | 拿掉這兩個 inline attribute，改用上面的 CSS hover 規則 | 同一顆按鈕，改 HTML 屬性 | — |

### P0（補：`#quizAnswer` 選擇器語法陷阱）

| Day 現況 | Night 目標 | selector | hover 態 |
|---|---|---|---|
| 裸 `border rounded`，無 `type` 屬性，`input[type="text"]` 選擇器吃不到 | `--glass-cold-fill` 底／`--cold-parchment` 字／`--glass-cold-border` 邊 | `body.scene-cold #quizAnswer`（直接點名 ID，不依賴 `type` 屬性選擇器） | focus 態沿用 `#articleInput:focus` 的 `--cold-accent` 公式 |

### P1（`.quiz-btn-primary` 家族設計公式重做，非只是 token 對調）

| Day 現況 | Night 目標 | selector | hover 態 |
|---|---|---|---|
| `background: var(--qz-accent) !important`（實色滿版）＋字面 `#FDF6E3` | 拆成兩條規則：(1) 在 P0 已經用 ID 覆寫解決特異性問題；(2) 額外確認 `.quiz-btn-primary` class-only 規則本身也同步改成「深底+亮字+accent 邊」公式（覆蓋沒有專屬 ID 攔截的其他 `.quiz-btn-primary` 用法，例如未來新增的按鈕） | `body.scene-cold .quiz-btn-primary`（已存在於修正輪 1，不需新增，只需確認 P0 的 ID 覆寫優先權夠高） | 同 P0 |

### P1（語意色新增：正確/錯誤/翻譯/提示）

| Day 現況 | Night 目標 | selector | hover 態 |
|---|---|---|---|
| `text-amber-700`（翻譯/提示 label，`ui.js:1137,1158`） | `--cold-dim` | `body.scene-cold .text-amber-700` | — |
| `text-green-600`（quizFeedback 答對） | `var(--cold-correct)`（新 token，見 9.3） | `body.scene-cold .text-green-600` | — |
| `text-red-600`（quizFeedback 答錯） | `var(--cold-wrong)`（新 token） | `body.scene-cold .text-red-600` | — |
| `text-rose-700`（summary 錯題「你的答案」） | `var(--cold-wrong)` | `body.scene-cold .text-rose-700` | — |
| `text-green-700`（summary 錯題「正確答案」） | `var(--cold-correct)` | `body.scene-cold .text-green-700` | — |
| inline `color:#8F9A78`（quiz summary 全對訊息＋dictation 播放按鈕） | `var(--cold-accent)` | 兩處都要改成 class 或 `body.scene-cold` 能命中的選擇器，**不能只換 hex 值**，因為目前是 inline style，需要把 `ui.js` 產生這段 HTML 的地方拿掉 inline `style`、改成 class（例如新增 `.quiz-summary-perfect`／`.quiz-play-btn`），才有選擇器可以掛 scene-cold 規則 | — |
| inline `color:var(--theme-color)`（`#quizModeLabel`） | `var(--cold-accent)` | 同上，拿掉 inline，改 class 或直接 `body.scene-cold #quizModeLabel` | — |

### P2（Tailwind `hover:` 變體遺缺，資料管理 4 顆＋分頁器＋usageReset/usageClose/quizClose）

| Day 現況 | Night 目標 | selector | hover 態 |
|---|---|---|---|
| 各種 `hover:bg-gray-*`/`hover:text-*`/`hover:border-*` Tailwind 變體，base 態已被 sweep，hover 態未涵蓋 | 統一改成 `rgba(92,118,134,.10)` 底／`--cold-parchment` 字／`color-mix(--cold-accent 60%, transparent)` 邊 | 建議不要逐一轉義 Tailwind hover 變體選擇器（`.hover\:bg-gray-200:hover` 這種寫法可行但難維護），改為幫這批按鈕新增一個共用 class（例如 `.btn-data-mgmt`）取代裸 Tailwind class，一次性定義 base+hover+active，長期更好維護 | 見左欄 |

### P2（同步 modal 飽和藍孤例）

| Day 現況 | Night 目標 | selector | hover 態 |
|---|---|---|---|
| `bg-blue-600 text-white`（`#syncSave`） | 改用 `.btn-primary-m`（直接換 class，不需要新 token） | `index.html:1820` 的 class 屬性從 `bg-blue-600 text-white rounded` 改成 `btn-primary-m` | 隨 `.btn-primary-m` 自動繼承 |

### P3（待查，優先權較低但需要排進下一輪稽核）

- `#rtabWords/#rtabTrans/#rtabGrammar`（`.result-tab`/`.result-tab--active`）：全新發現，完全未稽核，需要獨立展開一次 grep（表 7 #25）。
- 錯題表格外框裸 `border` class 的實際渲染色（表 11.2 待查項）。
- `#mnemonicClose`／`.mnemonic-*` 記憶輔助彈窗整個元件：未稽核（表 7 #30）。
- `#undoToast`／`#undoBtn`：需確認 toast 底色本身是否有暖色殘留（表 7 #29）。
- `[data-theme="dark"]` 這整套舊深色系統是否要正式棄用：目前跟 `body.scene-cold` 各自為政，長期建議二選一，但不在本次范圍內決定。
