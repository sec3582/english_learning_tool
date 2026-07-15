<!--  注意（2026-07-15）：本文件規格來源 docs/VISUAL_SPEC.md 已棄用。
--cold- / --story- token 整合方向待後續決策，本文件內容暫時凍結，請勿依此執行新修改。-->
# COLOR_TOKEN_MIGRATION.md — `--color-*` 家族治本修法預稽核

**角色**：perfume-art-director
**對應階段**：Phase 5f 修正輪 2 前置稽核（不動 CSS，僅稽核＋規格）
**狀態**：待使用者確認表格後才開始施工

**範疇**：`theme-perfume-day.css` `:root` 定義的整組 `--color-*` token（compiled-spec.md 的核心色彩層），這是繼 `--wc-*`、`--qz-*` 之後第三個、也是使用量最大的獨立色彩系統（**共 35 個 token、167 處引用**——上一輪報告估算「33 個」是稽核前的粗估，逐一數過 `:root` 區塊後修正為 35 個，詳見下表）。

---

## 0. 修法原則

- **結構色**（背景/邊框/文字階層/陰影/分隔線）：直接映射到既有 `--cold-*` 家族，不新增 token。
- **強調色**（accent/focus ring）：映射到 `--cold-accent` 及其衍生（`--cold-accent-ring`），維持「全站只有一個強調色」的硬規則。
- **語意色**（badge：mastered/due/pos/enrich）：**不能一律壓成同一個 `--cold-*` token**，否則「已熟悉」「待複習」「詞性」三種徽章在夜模式下會變成同一坨灰藍，使用者失去判讀依據。這批需要新設計一組 `--cold-badge-*` 語意色階，原則是「同一個冷色世界觀裡的內部差異」——不引入全新色相家族（例如真的塞一個鮮紅或鮮綠進來），而是用 `--cold-accent`／`--cold-dim`／`--cold-void`／`--cold-parchment` 之間不同比例的 `color-mix()` 混出彼此可區分、但仍然「屬於同一個晚上」的色階，呼應使用者原話「mastered = 冷藍偏亮、pending = 冷灰中階、待複習 = 冷紅偏暖」。

---

## 1. 完整 35-token 對照表

| Day 端 token | 現用 Day 值 | 用途分類 | Night 端對應 |
|---|---|---|---|
| `--color-bg` | `#EDEBE4` | 結構色（頁面底色） | `--cold-void` |
| `--color-surface-card` | `#F0E8D4` | 結構色（一般卡片底） | `--glass-cold-fill` |
| `--color-surface-panel` | `#E8DCCA` | 結構色（單字清單面板／hover 態底） | `--glass-cold-fill`（見 §6 決定 1，選 (a)：與 `--color-surface-card` 共用同一 token，不另外拉開層次） |
| `--color-surface-recessed` | `#DFD0B8` | 結構色（AI 區塊／輸入框底／modal 內層） | `--glass-cold-fill` |
| `--color-surface-modal` | `#F3ECDF` | 結構色（modal 容器底） | `--glass-cold-fill` |
| `--color-surface-panel-alt` | `#E3D7C0` | 結構色（Scheme B 隔行變色） | `color-mix(in srgb, var(--cold-wash) 92%, var(--cold-parchment) 8%)` |
| `--color-ink-1` | `#1C1208` | 結構色（主文字階層） | `--cold-parchment` |
| `--color-ink-2` | `#7A6045` | 結構色（次文字階層） | `--cold-dim` |
| `--color-ink-3` | `#A08568` | 結構色（placeholder／disabled 階層，比 ink-2 更淡一階） | `color-mix(in srgb, var(--cold-dim) 70%, transparent)` |
| `--color-accent` | `#C8952A` | 強調色（tab 底線／focus 相關） | `--cold-accent` |
| `--color-accent-dim` | `#9E7B38` | 強調色（**目前未被任何規則引用，死 token**，註解寫「mastered badge bg」但實際 mastered 徽章從沒接上它） | `--cold-accent`（若未來真的接上，維持跟主 accent 同一色，只靠透明度分層，不需要單獨一個「dim accent」） |
| `--color-accent-focus` | `rgba(200,149,42,0.25)` | 強調色（focus ring 擴散） | `--cold-accent-ring` |
| `--color-ledger-hi` | `rgba(120,85,30,0.20)` | 結構色（帳冊分隔線，依 index%3 輪替） | `rgba(92,118,134,0.20)` |
| `--color-ledger-mid` | `rgba(120,85,30,0.15)` | 結構色 | `rgba(92,118,134,0.15)` |
| `--color-ledger-lo` | `rgba(120,85,30,0.12)` | 結構色 | `rgba(92,118,134,0.12)` |
| `--color-ledger-section` | `rgba(120,85,30,0.22)` | 結構色（區塊/標題分隔線） | `var(--glass-cold-border)` |
| `--color-rim-card` | `rgba(255,220,140,0.30)` | 結構色（卡片頂緣高光，物理光影模擬，非語意） | `rgba(214,219,224,0.06)`（冷調版 rim，用 `--cold-parchment` 的低透明度，不用 accent——rim light 是「材質」不是「強調」） |
| `--color-rim-panel` | `rgba(255,220,140,0.38)` | 結構色 | `rgba(214,219,224,0.08)` |
| `--color-rim-modal-top` | `rgba(255,220,140,0.35)` | 結構色 | `rgba(214,219,224,0.07)` |
| `--color-rim-modal-left` | `rgba(255,220,140,0.20)` | 結構色 | `rgba(214,219,224,0.04)` |
| `--color-rim-btn` | `rgba(255,220,140,0.28)` | 結構色 | 已由修正輪 1 的按鈕新公式取代（見 §12.1，新公式不用 rim，改用實體邊框），此 token 在冷調按鈕上不再需要 |
| `--color-rim-hover` | `rgba(255,220,140,0.38)` | 結構色 | 同上，不再需要 |
| `--color-input-border` | `rgba(120,85,30,0.22)` | 結構色（輸入框預設邊框） | `--glass-cold-border` |
| `--color-input-border-foc` | `rgba(160,100,30,0.55)` | 強調色（focus 態邊框，帶 accent 色相） | `color-mix(in srgb, var(--cold-accent) 55%, transparent)` |
| `--color-overlay` | `rgba(40,25,8,0.55)` | 結構色（modal 遮罩／`.mnemonic-overlay`） | 新增 `--cold-overlay: rgba(20,23,26,0.65)`（沿用修正輪 1 已經在 `#quizModal` 系列驗證過的數值，這裡把它正式收編成 token，供 `.mnemonic-overlay` 等其他還沒修過的遮罩共用） |
| `--color-card-separator` | `rgba(160,110,30,0.35)` | 結構色（分隔線，Option A 低調版） | `var(--glass-cold-border)` |
| `--color-badge-pos-bg` | `#3E3018` | **語意色（死 token，未被引用）** | 見 §2.2 新設計 `--cold-badge-pos-bg` |
| `--color-badge-pos-fg` | `#E8DCCA` | 語意色（死 token） | `--cold-badge-pos-fg` |
| `--color-badge-mastered-bg` | `#4A5C2F` | 語意色（死 token） | `--cold-badge-mastered-bg` |
| `--color-badge-mastered-fg` | `#D8E0C4` | 語意色（死 token） | `--cold-badge-mastered-fg` |
| `--color-badge-due-bg` | `#7A5020` | 語意色（死 token） | `--cold-badge-due-bg` |
| `--color-badge-due-fg` | `#EAD9BC` | 語意色（死 token） | `--cold-badge-due-fg` |
| `--color-badge-enrich-bg` | `#E4D5BA` | 語意色（**有在用**：`.enrich-badge--tr`／`.reader-enrich-tag--tr`／`.word-level-badge`） | `--cold-badge-enrich-tr-bg` |
| `--color-badge-enrich-fg` | `#5C3D1A` | 語意色（同上） | `--cold-badge-enrich-tr-fg` |
| `--color-chip-navbar` | `rgba(200,180,140,0.35)` | 結構色（`.word-level-badge` 容器底，所有 CEFR 級別共用同一色，不區分語意） | `rgba(92,118,134,0.20)` |

**分類統計**：結構色 **22 個**、語意色 **8 個**、強調色 **5 個**（合計 35）。

---

## 2. 四組指定深挖

### 2.1 `--color-accent` / `--color-accent-*` 家族（5 個裡的 3 個屬於這家族）

| Token | 實際使用場景（file:line） | 用途分類細項 |
|---|---|---|
| `--color-accent` | `day.css:219`（sidebar tab active 底線 `box-shadow: inset 0 -2px 0`）、`day.css:250`（`#articleInputSection .input-tab--active` 底線） | **底線／強調線**，不是主 CTA 色（CTA 用的是 `--color-ink-1` 深墨底，見修正輪 1 已定案的「accent 不當大面積底色」硬規則），也不是連結色（全站沒有傳統文字連結） |
| `--color-accent-dim` | 無任何 `var()` 引用 | 死 token |
| `--color-accent-focus` | `day.css:446,507,872,914` 等共 5+ 處，全部是 `:focus-visible`/`:focus` 的 `box-shadow` 擴散環 | **focus ring 專用**，跟主 accent 是同一色相不同型態（實心 vs 光暈），Night 端統一對應到已經在用的 `--cold-accent-ring`，不需要新增 |

**決定**：全部壓成 `--cold-accent`（含其既有的 `--cold-accent-ring` 衍生），因為這三個在 Day Mode 本來就是「同一個 accent 的不同呈現方式」（實色底線 vs 光暈），不是三種不同語意，Night Mode 沒有理由拆開。

### 2.2 `--color-badge-*` 家族（8 個 token，重新設計語意色階）

| Token 群組 | Day 用途 | 現況 | Night 語意設計 |
|---|---|---|---|
| `pos`（詞性標籤） | 中性資訊標籤，不帶「好/壞/緊急」語意，純粹標示詞性 | 死 token（`js/ui.js` 目前用 `.word-card-pos` 純文字斜體呈現詞性，沒有實心徽章） | 中性冷灰階，不搶注意力：`--cold-badge-pos-bg: var(--cold-wash)`／`--cold-badge-pos-fg: var(--cold-dim)` |
| `mastered`（已熟悉） | 正向/完成狀態 | 死 token（header 的「已熟悉」數字用通用 `.chip` 白色半透明藥丸，不是這組 token） | 使用者原話「冷藍偏亮」：`--cold-badge-mastered-bg: color-mix(in srgb, var(--cold-accent) 55%, var(--cold-void) 45%)`（比一般 accent 更亮更飽和，讀作「達成」）／`--cold-badge-mastered-fg: color-mix(in srgb, var(--cold-accent) 25%, var(--cold-parchment) 75%)` |
| `due`（待複習） | 提醒/需要行動的狀態 | 死 token（header「待複習」數字同樣是通用 `.chip`） | 使用者原話「待複習＝冷紅偏暖」：`--cold-badge-due-bg: color-mix(in srgb, var(--cold-wrong) 60%, var(--cold-void) 40%)`（`--cold-wrong` 是 `VISUAL_QA_5E.md §9.3` 已提案但尚未寫進 CSS 的「低飽和冷調紅棕」token，這裡直接引用同一個定義，避免兩邊各自發明一個「錯誤/提醒」色）／`--cold-badge-due-fg: var(--cold-parchment)` |
| `enrich`（TR/GR 標記） | 分類性資訊標籤（翻譯 vs 文法），需要彼此可區分但都是「中性資訊」，不帶緊急/成功語意 | **有在用**（reader 模式的補充標記） | 拆成 tr／gr 兩組，用 accent 與 dim 兩種底色相區分：`--cold-badge-enrich-tr-bg: color-mix(in srgb, var(--cold-accent) 20%, var(--glass-cold-fill))`／`--cold-badge-enrich-tr-fg: var(--cold-parchment)`；`--cold-badge-enrich-gr-bg: color-mix(in srgb, var(--cold-dim) 25%, var(--glass-cold-fill))`／`--cold-badge-enrich-gr-fg: var(--cold-parchment)`（`.enrich-badge--gr`/`.reader-enrich-tag--gr` 目前是硬編碼 `#DDD0B8`，不經任何 token，屆時要順便補一個 token 化，不能只做 `--tr` 那一半） |

**為什麼不能一律壓同一色**（呼應使用者的硬性要求）：如果 mastered／due／pos 都套同一個 `--cold-dim`，使用者在單字清單裡完全無法從顏色判斷「這個字是已經學會了、還是快到期了、還是只是標個詞性」——這正是語意色存在的意義，壓平等於讓這組 token 從「有用的資訊」退化成「純裝飾」。

### 2.3 `--color-ink-1/2/3`（文字階層，確認直接映射）

| Token | Day 值 | 階層 | Night 對應 |
|---|---|---|---|
| `--color-ink-1` | `#1C1208`（近黑褐，主文字） | Primary | `--cold-parchment`（`#d6dbe0`，冷調系統最亮的文字階） |
| `--color-ink-2` | `#7A6045`（中棕，次文字） | Secondary | `--cold-dim`（`#838d96`） |
| `--color-ink-3` | `#A08568`（淺棕，placeholder/disabled） | Tertiary，比 ink-2 更淡 | `color-mix(in srgb, var(--cold-dim) 70%, transparent)`——**不能直接等於 `--cold-dim`**，否則 ink-2／ink-3 兩階會變成同一色，文字階層的「三層深淺」會塌成兩層。`--cold-*` 家族目前只有 parchment/dim 兩級亮度，沒有第三級，用透明度稀釋 `--cold-dim` 是最小成本補上第三階的做法，不需要新增第三個實色 token |

### 2.4 `--color-surface-panel` / `--color-surface-recessed` / `--color-input-border`（容器背景與邊框）

| Token | Day 值 | Night 對應 |
|---|---|---|
| `--color-surface-panel` | `#E8DCCA` | `--glass-cold-fill`（若跟 `--color-surface-recessed` 完全同色會讓「面板」與「凹陷區塊」兩層深度感消失，建議面板用 `--glass-cold-fill` 原值、recessed 用略深一階，見下方 §12.3 建議的分層公式） |
| `--color-surface-recessed` | `#DFD0B8`（比 panel 更深一階，AI 區塊/輸入框/modal 內層用） | `color-mix(in srgb, var(--glass-cold-fill) 70%, var(--cold-void) 30%)`（刻意比純 `--glass-cold-fill` 深，保留 Day Mode 原本「recessed 比 panel 凹陷」的深度層次） |
| `--color-input-border` | `rgba(120,85,30,0.22)` | `--glass-cold-border` |

---

## 3. 新增 token 總表（施工時要一次宣告的內容）

```css
body.scene-cold {
  /* 依 §1 對照表：結構色／強調色批次映射 */
  --color-bg:                var(--cold-void);
  --color-surface-card:      var(--glass-cold-fill);
  --color-surface-panel:     var(--glass-cold-fill);
  --color-surface-recessed:  color-mix(in srgb, var(--glass-cold-fill) 70%, var(--cold-void) 30%);
  --color-surface-modal:     var(--glass-cold-fill);
  --color-surface-panel-alt: color-mix(in srgb, var(--cold-wash) 92%, var(--cold-parchment) 8%);

  --color-ink-1: var(--cold-parchment);
  --color-ink-2: var(--cold-dim);
  --color-ink-3: color-mix(in srgb, var(--cold-dim) 70%, transparent);

  --color-accent:       var(--cold-accent);
  --color-accent-dim:   var(--cold-accent);
  --color-accent-focus: var(--cold-accent-ring);

  --color-ledger-hi:      rgba(92, 118, 134, 0.20);
  --color-ledger-mid:     rgba(92, 118, 134, 0.15);
  --color-ledger-lo:      rgba(92, 118, 134, 0.12);
  --color-ledger-section: var(--glass-cold-border);

  --color-rim-card:       rgba(214, 219, 224, 0.06);
  --color-rim-panel:      rgba(214, 219, 224, 0.08);
  --color-rim-modal-top:  rgba(214, 219, 224, 0.07);
  --color-rim-modal-left: rgba(214, 219, 224, 0.04);

  --color-input-border:     var(--glass-cold-border);
  --color-input-border-foc: color-mix(in srgb, var(--cold-accent) 55%, transparent);

  --color-overlay:        var(--cold-overlay, rgba(20, 23, 26, 0.65));
  --color-card-separator: var(--glass-cold-border);

  --color-chip-navbar: rgba(92, 118, 134, 0.20);

  /* 語意色（VISUAL_QA_5E.md §9.3 提案，這輪一併正式寫入，不拆成兩次施工，
     見 §6 決定 2） */
  --cold-correct: color-mix(in srgb, var(--cold-accent) 70%, var(--cold-parchment) 30%);
  --cold-wrong:   color-mix(in srgb, var(--cold-dim) 55%, #7a4a42 45%);

  /* 語意徽章色階（新設計，見 §2.2；--cold-badge-due-bg 直接吃上面剛宣告的
     --cold-wrong，同一個 body.scene-cold 區塊內，不需要 fallback 語法） */
  --cold-badge-pos-bg:         var(--cold-wash);
  --cold-badge-pos-fg:         var(--cold-dim);
  --cold-badge-mastered-bg:    color-mix(in srgb, var(--cold-accent) 55%, var(--cold-void) 45%);
  --cold-badge-mastered-fg:    color-mix(in srgb, var(--cold-accent) 25%, var(--cold-parchment) 75%);
  --cold-badge-due-bg:         color-mix(in srgb, var(--cold-wrong) 60%, var(--cold-void) 40%);
  --cold-badge-due-fg:         var(--cold-parchment);
  --cold-badge-enrich-tr-bg:   color-mix(in srgb, var(--cold-accent) 20%, var(--glass-cold-fill));
  --cold-badge-enrich-tr-fg:   var(--cold-parchment);
  --cold-badge-enrich-gr-bg:   color-mix(in srgb, var(--cold-dim) 25%, var(--glass-cold-fill));
  --cold-badge-enrich-gr-fg:   var(--cold-parchment);

  /* 沿用修正輪 1 已在 #quizModal 系列驗證過的遮罩數值，正式收編成 token */
  --cold-overlay: rgba(20, 23, 26, 0.65);
}
```

**注意：`--color-badge-pos/mastered/due-*` 目前是死 token（§1 已標註），這裡依然照樣設計 Night 版本**——不是因為現在有東西在用，是因為使用者明確要求「重新設計冷調系內部的語意化色階」，一旦未來真的把 mastered/due 徽章接上（例如單字清單改成用實心徽章取代純文字），Night Mode 不需要臨時再想色階，直接接就有。

**`.enrich-badge--gr`／`.reader-enrich-tag--gr` 需要額外處理**：這兩個目前是硬編碼 `#DDD0B8`/`#4A3014`，不經任何 `--color-*` token（跟 `--tr` 版本不同，`--tr` 版本至少還有 `var(--color-badge-enrich-bg, ...)` 可以覆寫，`--gr` 版本完全沒有掛勾點）——施工時要一併把這兩個字面 hex 改成讀 `--color-badge-enrich-gr-bg`／`-fg`（新增，Day Mode 也要同步補上這兩個 token 定義，不能只加 Night 版），才有辦法讓 `--cold-badge-enrich-gr-*` 生效。

---

## 4. 施工前仍待確認的相依性

1. ~~`--cold-wrong` token 還沒寫進 CSS~~ **已解決**：依 §6 決定 2，這輪把 `--cold-wrong`／`--cold-correct` 一併正式寫進 §3 的 `body.scene-cold` 宣告區塊，不拆成兩次 PR。
2. `.enrich-badge--gr`／`.reader-enrich-tag--gr` 需要在 Day Mode CSS 裡新增 `--color-badge-enrich-gr-bg/fg` 兩個 token（目前不存在，是這次稽核才發現的缺口），才能讓對應的 Night 版本掛得上去。
3. `--color-rim-btn`／`--color-rim-hover` 判定「不再需要」，是因為修正輪 1 已經把按鈕公式從「rim light + 實色底」改成「深底+邊框」——若之後又有人想把按鈕公式改回 rim 系，這兩個 token 的 Night 對應需要重新設計，目前先不寫入 §3 的宣告清單。

---

## 5. ID 攔截風險清單

**Grep 範圍**：`theme-perfume-day.css`、`theme-perfume-wc.css`、`theme-perfume-night.css`、`theme-ocean.css`、`index.html` 內嵌 `<style>`、`js/*.js`（含所有動態注入 `innerHTML` 字串裡的 inline `style`）。**搜尋標的是 `--color-XXX: 值;` 這種「重新宣告」的寫法**，不是 `var(--color-XXX)` 這種「引用」的寫法——兩者要分開看：引用不會造成攔截（`var()` 只是讀取當下作用域內最終生效的值），只有「在更窄的 selector scope 裡重新宣告同一個 custom property」才會造成第三次特異性戰爭（因為那個窄 scope 內的元素會直接吃到重新宣告的值，不會再往上找 `body.scene-cold` 宣告的版本）。

**結果：清單為空。** 35 個 `--color-*` token 在 `theme-perfume-day.css` 裡全部只在同一個 `:root { ... }` 區塊（`day.css:11-67`）宣告一次，沒有任何 `#id { --color-xxx: ... }` 或 `.class { --color-xxx: ... }` 形式的窄範圍重新宣告；其餘檔案（`wc.css`／`night.css`／`ocean.css`／`index.html`／全部 `js/*.js`）對 `--color-*` 完全沒有重新宣告，只有 `var(--color-xxx, 備援值)` 引用（例如 `js/main.js:54-68` 的文法重點彈窗 inline style，共 6 處，全部是「引用＋備援值」，不是「重新宣告」）。

| Selector | file:line | 重定義了哪些 `--color-*` token | 特異性 | `body.scene-cold` 對消策略 |
|---|---|---|---|---|
| — | — | 無 | — | 不適用 |

**結論：`body.scene-cold { --color-*: ...; }`（特異性 `(0,1,0)`，1 個 class）已經足夠，不需要對每個容器再補一層 ID 對等覆寫。** 這跟 `--wc-*`／`--qz-*` 的情況本質不同——`--wc-*`/`--qz-*` 之所以需要額外處理，根因不是「token 被重新宣告」，是「大量 ID 選擇器直接把『字面 hex 值』或『var() 讀出來的最終色值』寫死在 `background`/`color` 這種一般 CSS 屬性上」（例如 `#analyzeBtn { background: #1C1208 !important; }`），這種攻擊面 §7 全站按鈕表已經個別列出、個別處理，跟這裡查的「custom property 本身被重新宣告」是兩個不同層級的風險，不能互相取代——**這次 grep 只排除了後者，不代表 §7 按鈕表的 ID 攔截問題已經解決，兩份清單要分開追蹤。**

**額外備註（不影響本次放行結論，但值得記錄）**：`js/main.js:54-68` 那 6 處 inline `style="color:var(--color-ink-2,#7A6045)"` 這種「引用＋字面備援值」寫法，如果 custom property 因為任何原因解析失敗（理論上不會，因為 `--color-*` 現在會在 `body.scene-cold` 正確宣告並往下繼承），會退回備援值 `#7A6045`（暖色）。這不是 ID 攔截風險，是「備援值本身是暖色」的次要風險，正常情況下不會觸發，僅供未來排查「為什麼文法重點彈窗偶爾還是暖色」時的參考線索，不需要現在處理。

---

## 6. 兩項決定

**決定 1（`--color-surface-panel` vs `--color-surface-recessed` 層次）**：選 **(a)**——三個 surface token（`card`／`panel`／`recessed` 裡的 card 與 panel）塌成同一個 `--glass-cold-fill`，刪掉「略提亮版」註記，只保留 `recessed` 單獨用深一階的 `color-mix()` 版本。理由：回頭比對 Day Mode 原始數值，`--color-surface-card`（`#F0E8D4`）與 `--color-surface-panel`（`#E8DCCA`）兩者明度非常接近，Day Mode 本身的深度語言其實是「card/panel 同一個表面層」vs「recessed 凹陷層」的**兩層**關係，不是三層；選 (b) 硬拉開 card 與 panel 的差異，反而是在 Night Mode 發明一個 Day Mode 原本沒有的區分，不算「忠實映射」。§1 表格與 §3 宣告已同步修正。

**決定 2（`--cold-wrong`/`--cold-correct` 是否併入這輪）**：**是**，已併入 §3 的 `body.scene-cold` 宣告區塊（見上方更新），`--cold-badge-due-bg` 現在直接引用同區塊宣告的 `--cold-wrong`，不再需要 `var(--cold-wrong, 備援hex)` 這種跨文件 fallback 寫法。

---

## 統計回報

35 個 token 中：**結構色 22 個、語意色 8 個、強調色 5 個**（先前口頭估算的「33 個」在逐一清點 `:root` 區塊後修正為 35 個，差異來自漏數了 `--color-rim-hover` 與 `--color-surface-panel-alt` 兩個較少被提及的 token）。
