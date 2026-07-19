> ⚠️ 2026-07-15 之前的決策記錄基於《香水》電影美學（已棄用）。
> 2026-07-15 起視覺基礎改為小說世界觀本身。
> 舊記錄保留作歷史參考，不再作為執行依據。

---

# decisions.md — Day Mode Full Application
**Film**: Perfume: The Story of a Murderer (2006) — Dir. Tom Tykwer, DP Frank Griebe
**Scope**: Day Mode only — full application shell (not wc-card component only)
**Date**: 2026-04-09

---

## 1. The Brief（一句話）

每一個畫面都是 18 世紀格拉斯香料作坊的工作桌——羊皮紙泛黃、墨水已乾、陽光斜射進木格窗，而不是矽谷軟體介面。

> Translation for engineering: Every surface in this UI should read as aged, tactile, and warm — not clean, corporate, or digital.

---

## 2. Visual North Star（不可妥協的 5 條）

1. **光源方向永遠是左上 30–40°。** 所有陰影必須符合這個方向。不能出現均勻柔焦的全方向陰影（Google Shadow）。
2. **羊皮紙感必須在每一個表面上存在。** 背景、卡片、面板、modal——全部都有微噪點紋理，不能是純色平面。肉眼不一定能指出它在哪，但移除後畫面會變得「數位感太強」。
3. **暖色不能甜膩。** 主背景必須加入微量的綠灰抑制（desaturate + slight cool undertone），防止整體色溫變成蜂蜜蛋糕。看起來要像「日光下的老石牆」，不像「新鮮奶油」。
4. **黑色永遠不能出現。** 最深的顏色是乾墨水（warm near-black，帶褐棕色調）。純 `#000000` 或冷黑出現在任何地方都是錯誤。
5. **每個容器的深度靠光影表達，不靠描邊。** 卡片邊框不是畫上去的線，是光線打在物體邊緣形成的亮邊（rim light）與底部落下的陰影共同暗示的輪廓。1px solid border 一律替換。

---

## 3. Uniqueness Check（像什麼 / 不要像什麼）

### 像
- 18 世紀香料作坊的羊皮紙帳冊
- 植物標本館的展示頁面（specimen sheet）
- 古舊的玻璃藥瓶在木架上反光
- 陽光穿過厚玻璃窗灑在石桌上的粉塵感
- 墨水已在紙面上暈染成棕黃色的老信件
- 乾燥薰衣草和迷迭香掛在木梁上的室內氛圍

### 不要像
| 禁止類型 | 代表外觀 |
|---------|---------|
| 現代 Notion/Linear | 灰白背景、細細 1px 邊框、Geist 字體、空氣感太足 |
| Material Design 3 | 圓角 28px、彩色 filled button、動態色彩提取 |
| 玻璃擬態（glassmorphism） | 半透明 blur backdrop、白色 border + opacity、霜凍感 |
| 乾淨科技感 | 冷灰調、水藍 accent、Inter/DM Sans 搭配 #F9FAFB 背景 |
| 純白極簡 | #FFFFFF 大面積背景、pure black 文字、無紋理 |
| 前版設計（莫蘭迪鼠尾草綠） | #A3B18A primary、#F2F3EE background、pill badge、cold navy dark mode |

---

## 4. Day Mode Color Script（色彩腳本）

### 色彩關係總覽

| 角色 | 色相描述 | 明度（L in HSL）| 飽和度 | 備注 |
|------|---------|--------------|-------|------|
| **主背景**（頁面底層） | 暖黃 + 微量綠灰壓制（hue ~42–44°，帶極少量 cool grey undertone） | L 91–93% | 飽和度 18–22%（偏低，防甜膩） | 像陽光下的舊石膏牆，不是奶油 |
| **主要表面**（卡片、面板、右側欄） | 暖黃-棕（hue ~38–42°，純羊皮紙） | L 87–90% | 飽和度 24–28% | 比背景稍深，稍暖 |
| **次要表面**（recessed 區塊、AI 分析塊、下拉選單底） | 更深的老紙色（hue ~36–38°） | L 80–83% | 飽和度 26–30% | 凹入卡片的感覺，不是懸浮 |
| **主文字**（標題、英文單字、主要 label） | 乾燥棕黑墨水（hue ~30–35°，帶褐） | L 8–12% | 飽和度 35–45% | 絕不是純黑，帶暖棕 |
| **次文字**（定義、說明、muted 狀態） | 褪色棕墨（hue ~28–32°） | L 42–48% | 飽和度 28–35% | 像寫了幾年的棕墨筆記 |
| **分隔線 / 邊框等效線** | 琥珀金稻草色（hue ~40–45°） | L 68–72% | 飽和度 35–42% | 像帳冊裡的橫線，不是 UI separator |
| **強調色（accent）** | 琥珀 / 老金（hue ~38–42°） | L 48–54% | 飽和度 70–80% | 陽光穿過玻璃器皿的金色，用量克制 |
| **互動焦點環（focus ring）** | 同 accent 但更淡 | L 68% | 飽和度 45% | 不是藍色 focus ring |

### Accent 琥珀金用量硬規則

琥珀金是畫面裡最稀有的光——像作坊窗口射進的一道陽光，只打在一個點上。

**允許出現的位置（全部）：**
- focus ring / active state
- 選取高亮（selected row、active tab 邊線）
- 關鍵分隔細線（帳冊橫線等效線）
- 少量 icon 點睛（不超過 icon 面積 30%）

**禁止出現的位置：**
- 任何元件的大面積背景底色（包括 primary button 整顆金底）
- 背景漸層的主色
- 大面積 border 或分隔線系統（分隔線只能用比背景略深的暖棕，gold 只出現在「關鍵橫線」）

> Primary button 的正確方向是「深墨色底 + 琥珀金 rim（頂邊 inset 高光）」，而不是整顆琥珀金底色按鈕——後者讓 accent 失去稀有性，整個畫面變成蜂蜜廣告。

### 需加入一點綠灰抑制（答案：是）
主背景和部分次要表面需加微量 cool green-grey 抑制（hue 偏移到 42–44° 而非 36–38°，飽和度壓低到 16–20%），防止整個畫面變成「桃花心木家具廣告」。效果是讓老石牆感出現：看起來舊、看起來有歲月，不看起來甜或奢侈品牌。

### 絕對不能出現的顏色
- 純白 `#FFFFFF`（任何表面都不行）
- 純黑 `#000000`（任何文字/邊框都不行）
- 前版鼠尾草綠（`#A3B18A`、`#7C9070` 系列）
- 冷灰（hue < 220° 或 > 260° 的藍灰、鋼灰）
- 螢光藍、螢光綠
- Material 3 的動態色（任何飽和度 > 85% 且 hue 在藍-綠-紅範圍的顏色）

---

## 5. Lighting & Depth Rules（日光打光規則）

### 主光方向
左上 30–40° 入射。這是工作室左牆木格窗的漫射午後陽光。

### 陰影規則（可驗收語句）

| 規則 | 正確做法 | 錯誤做法 |
|------|---------|---------|
| 卡片陰影偏向右下 | `box-shadow: 2px 4px 16px …` x 偏移正值、y 偏移較大 | `box-shadow: 0 4px 16px …` 完全水平對稱 |
| 最近元素（tooltip、FAB）陰影最深 | 深度按照 z-index 遞增 | 所有元素同一陰影強度 |
| 陰影色必須是暖棕色半透明 | `rgba(80, 50, 15, 0.12–0.22)` | `rgba(0, 0, 0, 0.3)` 冷黑陰影 |
| 禁止全方向均勻軟化陰影 | 有明確 x/y 偏移 | `blur: 40px, spread: 0, offset: 0` 無方向 |
| 不同 z 層的陰影強度不同 | 模態框陰影 > 卡片陰影 > 面板陰影 | 所有容器相同陰影值 |

### Rim Light（必須出現的位置）

| 元件 | Rim Light 表現方式 | 方向 |
|------|-----------------|------|
| 主要卡片（section cards） | `box-shadow` 加 inset 頂邊高光 `inset 0 1px 0 rgba(255,220,140,0.35)` | 頂邊（光從上打） |
| Modal 容器 | 左邊 + 頂邊各一條薄 inset 高光，右邊和底邊無 | 左上 |
| Primary 按鈕 | 頂邊 1px inset 高光（像光打在隆起的紙漿表面） | 頂邊 |
| 輸入框 focus 狀態 | 左邊稍明顯的邊框加深（模擬光從左側打在凹槽邊緣） | 左邊 |

### Word List Row 分隔規則（`#wordListCard` 專屬）

由於「1px border 一律替換」的原則，word list 的每列分隔不能用 `border-bottom: 1px solid`。工程可執行方向如下：

| 分隔方式 | 實作 | 效果 |
|---------|------|------|
| **帳冊橫墨線**（首選） | `border-bottom: 1px solid rgba(120, 85, 30, 0.18)` — 暖棕、低對比、帶透明度，模擬墨水壓印在紙上的橫線 | 像帳冊內頁的分行線，有歲月感，不是 UI divider |
| 光影凹凸（備選） | 奇數 row 加極淡的 `box-shadow: inset 0 -1px 0 rgba(100,70,20,0.10)`，偶數 row 略深背景（L 差 1–2%），交替產生微凹凸感 | 比帳冊線更立體，但工程量稍大 |

> 不允許：`border-bottom: 1px solid #e5e7eb`（冷灰 Tailwind divider）；`border-bottom: 1px solid var(--border)`（沿用舊變數）；背景交替使用冷色系斑馬條。

### Vignette（全局背景暗角）

- 整個 `<body>` 或外層 wrapper 使用 `::after` 偽元素疊加徑向漸層：
  `radial-gradient(ellipse at center, transparent 55%, rgba(40,25,8,0.12) 100%)`
- 強度：非常輕，中心透明，四角暗 ~8–14%
- 肉眼效果：感覺像在看一張擺在桌上的老紙頁，邊緣自然收進陰影，不是一個白色光箱

---

## 6. Material System（材質系統：三層）

### 第一層：全站底材（頁面背景 / 空氣層）

| 屬性 | 說明 |
|------|------|
| **用於** | `body` 背景、全頁面地基 |
| **紋理類型** | 極細石灰牆粉塵（fine grain，點狀，非纖維） |
| **強度** | 2–3% opacity |
| **疊加模式** | `overlay`（讓底色仍可透出，紋理只增加粗糙感） |
| **實作** | SVG `<feTurbulence>` 生成，`baseFrequency="0.75"` 左右，透過 `::before` 偽元素覆蓋全頁，pointer-events: none |
| **感受** | 舊石膏牆的顆粒感——不是印刷品，是建築表面 |

### 第二層：主要容器表面（卡片 / 面板 / Modal）

| 屬性 | 說明 |
|------|------|
| **用於** | `section` cards、右側 wordListCard、所有 modal 容器、右側資料管理面板 |
| **紋理類型** | 羊皮紙纖維（短纖維方向隨機，輕微長條狀） |
| **強度** | 3–4% opacity |
| **疊加模式** | `soft-light`（讓表面暖色更豐富，纖維感更立體） |
| **實作** | SVG `<feTurbulence>` type=`turbulence`，`baseFrequency="0.45 0.35"` 略有方向性，透過 `::after` 偽元素 + `isolation: isolate` 限制在容器內 |
| **感受** | 拿起一張帳冊內頁——有重量、有纖維，不是列印紙 |

### 第三層：互動元件表面（按鈕 / 標籤 / 輸入框）

| 屬性 | 說明 |
|------|------|
| **用於** | 所有 button、tab、badge/chip、input、select、textarea |
| **紋理類型** | 輕微磨損感（非常低頻的凹凸，邊緣比中心稍深） |
| **強度** | 1–2% opacity（非常克制） |
| **疊加模式** | `multiply`（輕微壓暗邊緣，增加邊緣磨損感，不干擾文字可讀性） |
| **實作** | 用 `box-shadow` 模擬（而非真實紋理）：按鈕底部 + 右邊有 1px 暗邊，頂部有 1px 亮邊（rim），模擬壓印/凸起物件 |
| **感受** | 像在按一個蠟封的標籤紙——有物理存在感，不是螢幕上的平面矩形 |

---

## 7. Typography Decisions（字體與排版性格）

### 字體性格（兩種文字功能域）

| 功能域 | 性格描述 | 選型方向 |
|--------|---------|---------|
| **閱讀文字**（文章內文、例句、AI 分析、definition） | 古籍閱讀感，手稿溫度，字形略寬，帶稍微的人工筆觸感。不能是死板的現代 didone 或科技感等線字體。 | 過渡性或人文主義 serif：EB Garamond、Lora、Crimson Pro、或 Georgia（fallback）。不要 Times New Roman（太法庭感）、不要 Playfair（太奢侈品）。 |
| **UI 標籤**（按鈕、tab、badge、section 標題、表單 label） | 手稿標籤感，像用鵝毛筆在小標籤上寫字，有個性但不難讀。略帶人文感，不是幾何感。 | 人文主義 sans-serif：Jost、DM Sans、或 Source Sans 3。不要 Inter（太系統化）、不要 Nunito（太可愛）、不要 Roboto（太 Material）。 |

### 字重策略

| 元素 | 字重 | 原因 |
|------|------|------|
| 英文單字標題（wc-title strong） | 700 | 標本名稱，需要絕對主導地位 |
| Section 區塊標題（section-h） | 600 | 章節名，次一層的主導 |
| 定義文字、重要 label | 500 | 清晰但不搶主角 |
| 內文 / 例句 / AI 分析文字 | 400 | 閱讀舒適度優先，不搶眼 |
| 次要 muted 文字（詞性、meta 資訊） | 400，但用色彩區分輕重，不靠字重 | 細字在羊皮紙底色上容易失去對比度，用顏色深淺控制層次更可靠 |
| 按鈕 label | 500–600（primary button: 600; ghost/outline: 500） | 太粗（700）在暖色底上顯得用力過度 |

### 行高 / 字距傾向

| 文字類型 | 行高 | 字距 |
|---------|------|------|
| 閱讀正文（文章、例句） | 1.75–1.85（偏鬆，模擬手稿頁面間距） | 0 或 +0.01em（不加過多，保持自然）|
| 英文單字標題 | 1.15–1.25（緊，強調重量感） | -0.01 至 -0.02em（稍微收緊，增加 specimen label 的嚴肅感） |
| UI label / 按鈕 / tab | 1.3–1.4（緊湊，標籤感） | 0（不加不減，保持乾淨） |
| 全大寫 badge / chip | 1.2 | +0.06–0.08em（必須加，否則全大寫太擠） |

### 字體大小比例
使用接近古典黃金比例的層次（不強求精確，但梯度要明顯）：
英文單字 `1.375–1.5rem` → Section 標題 `1.0625rem` → 定義/正文 `0.9375rem` → muted/meta `0.8125–0.875rem`。
不允許「所有東西都是 `0.875rem`」的扁平化做法。

---

## 8. Components in Scope（第一輪要改的核心元件）

以下 8 個元件為本輪 Day Mode 改動範圍，優先順序遞減：

| 優先 | 元件名稱 | HTML 對應 | 目前問題 |
|------|---------|----------|---------|
| 1 | **頁面底層背景** | `body`、`#mainGrid` wrapper | 純 Tailwind `bg-gray-100`，無紋理，無暖色，無暗角 |
| 2 | **主要 Section 卡片** | `#articleInputSection`、`#aiResult`、`#readerSection`（`bg-white rounded-xl shadow`） | 純白底、無材質、通用 SaaS 卡片外觀 |
| 3 | **右側單字清單面板** | `#wordListCard`（`bg-white rounded-xl shadow`）| 和主內容區外觀無差異，無場景感 |

> **Word List 是 Day Mode 的主鏡頭（hero scene）。** 使用者停留最久、最常反覆掃視這個面板。它的場景定義是「香料作坊帳冊攤開在桌上」——每一列單字都是帳冊裡的一個條目，不是 SaaS list item。視覺重量、紋理深度、row 分隔方式的規格在全頁面中最高，不應與左側卡片等同對待。
| 4 | **Modal 容器** | `#quizModal .modal`、`#quizSettings .modal`、`#grammarQuizModal .modal` | `.modal` 目前是 `var(--card)` 底 + `box-shadow:0 24px 60px rgba(2,6,23,.35)`，冷黑陰影，無 rim light |
| 5 | **Primary Button** | `.btn-primary-m`、`.quiz-btn-primary` | `var(--primary)` 鼠尾草綠底色，需整體替換為琥珀金 / 深墨色方向 |
| 6 | **Input 欄位、Textarea、Select** | `input`、`textarea`、`select` 全域規則 + `#articleInput`、`#urlInput`、`#librarySearch`、`#grammarQuizAnswer` | 純白底 + 冷藍 focus ring，完全背離羊皮紙世界 |
| 7 | **Tab 群組** | `#tabGroup`（今日/複習/全部）、`.input-tab` | 灰底 active state + 冷藍底，需改為琥珀邊線 + 深暖色底 |
| 8 | **Badge / Chip / Tag** | `.chip`（header navbar）、`.enrich-badge`、`.reader-enrich-tag` | 半透明白色（navbar chip）或冷藍-冷綠（enrich-badge），需替換為暖金、墨棕 方向 |

**本輪不改（暫緩）：**
- 深色模式（Night Mode） — 本次只做 Day Mode
- `.wc-card` 的 CSS（已在 `theme-perfume-wc.css` 中完成）
- JS 行為邏輯（任何 `.js` 檔案）
- 後端 Python / API 介面

---

## 9. Acceptance Checklist（驗收 — 全部肉眼可判定）

| # | 驗收項目 | 判定方式 |
|---|---------|---------|
| 1 | **背景永遠不是純色** | 縮小瀏覽器到 50% 放大率，仍可隱約看出背景有微細顆粒感，而非平滑純色 |
| 2 | **沒有任何純白 `#fff` 表面** | 截圖後用顏色選取工具點頁面上任何「白色區域」，RGB 值必須含有明顯暖色偏移（R > G > B） |
| 3 | **沒有任何冷灰或藍灰文字** | 所有 muted 文字、placeholder 文字，用顏色選取工具確認都帶暖棕色調（R > B 且 hue 在 20–45° 之間） |
| 4 | **每個 section 卡片都有方向性陰影** | 用滑鼠指向卡片右下角與左上角，右下角陰影明顯深於左上角（光從左上打） |
| 5 | **每個 modal 都有 rim light** | 開啟任一 modal，modal 容器的頂邊或左邊應可見一條比背景色稍亮的薄高光邊，右邊和底邊沒有 |
| 6 | **頁面四角比中心稍暗** | 截圖後在四個角落各取一個像素，色值明度應低於頁面正中心色值明度 5–10% |
| 7 | **Primary button 在 hover 前後都不出現藍色或冷色** | hover 前後截圖對比，按鈕背景和文字色彩都保持在暖色系（hue 0–60° 範圍） |
| 8 | **Input focus 時 focus ring 是暖色** | 點擊任意 input，focus ring 應呈琥珀金或暖棕色，不是藍色或紫色 |
| 9 | **Tab active state 靠暖色邊線或底色區分，不靠冷色** | 切換今日/複習/全部，active tab 的強調色在暖色系（不是藍色底 active） |
| 10 | **英文單字標題在卡片中是唯一的「最大字」** | 展開任一 wc-card，英文單字字體尺寸目測明顯大於同卡片內所有其他文字 |
| 11 | **陰影沒有冷黑色** | 截圖後，選取任何陰影深色區域，確認 RGB 中 R 值大於 G 和 B（暖棕，非 `rgba(0,0,0,x)`） |
| 12 | **移除所有顏色和字型後，頁面不像之前的 Morandi SaaS 版本** | 將截圖轉為灰階，確認整體佈局與深淺關係（重與輕）和舊版不同——新版卡片深度更強，層次更多 |

---

## 2026-07-15 視覺參考基礎轉向

**決策**：放棄《香水》電影作為視覺參考，改以小說世界觀本身定義視覺語言
**理由**：小說內容與香水電影無關；工具真實意義是「主角確認自己還活著的工具」，視覺語言應從此出發
**放棄的選項**：繼續沿用電影美學做微調
**影響範圍**：`compiled-spec.md`、所有角色的視覺規格、CSS token 色盤

---

## 2026-07-15 subagent 架構建立

**決策**：首次建立 `.claude/agents/` 目錄，新增 6 個角色檔案（perfume-game-director、perfume-art-director、ui-designer、frontend-developer、backend-architect、technical-writer）
**理由**：專案進入 Phase 5 視覺重設計階段，需要多角色協作；同時視覺方向已從《香水》電影改為小說世界觀，趁此機會以新規格從零建立
**放棄的選項**：以單一 prompt 處理所有角色職責
**影響範圍**：所有 `@角色` 呼叫、視覺規格執行流

---

## 2026-07-15 CSS Story Token 新增

**決策**：在 theme-perfume-day.css 的 :root 新增四個區段（§2G–§2J）
**內容**：
- §2G：--story-fog / --story-mud / --story-amber / --story-breath（四色弧線）
- §2H：--anim-* 動畫 token（5 個）
- §2I：--font-* 字體 token（7 個）
- §2J：--space-* 間距 token（5 個）
**原則**：與 theme-perfume-night.css 的 --cold-* 並存，暫不替換
**影響範圍**：theme-perfume-day.css（第 109–139 行）

---

## 2026-07-15 .word-card 材質方向變更

**決策**：放棄 backdrop-filter Liquid Glass 作為主要材質來源，改用 gradient fill + 多層 inset box-shadow 表達卡片材質
**理由**：backdrop-filter 在純色深底（--cold-void #14171a）上無法取樣，等於空轉，卡片讀成平面深色板。新方案以「教會門票舊紙」為意象（story/world.md 第6段），用 linear-gradient(155deg, --story-fog, --story-breath) + inset 高光/陰影疊加表達紙感
**影響範圍**：theme-perfume-night.css 第 311–358 行（.word-card，Commit 1 待執行）

---

## 2026-07-15 不新建 .scene-story 場景 class

**決策**：--story-* token 維持在全域 :root，不新建 .scene-story 互斥場景 class
**理由**：
1. .scene-cold／.scene-warm 是互斥的環境重貼皮，--story-* 是跨故事弧線的情緒推進，語意不同，強行納入互斥模型會破壞現有狀態機邏輯
2. .word-card 是主角隨身物件，應維持同一種紙的觸感，不隨場景重新上色，直讀 :root 才符合敘事事實
3. 維護成本過高，無對應場景需求支撐
**放棄的選項**：新建 .scene-story，比照 .scene-warm 複製一整套 token
**影響範圍**：無新增檔案；theme-perfume-night.css 的 .scene-cold / .scene-warm 互斥架構維持不動。未來若需畫面隨故事段落漸變，改用 data-story-phase="1".."8" + color-mix/crossfade 插值機制

---

## 2026-07-15 全專案文件棄用聲明清理

**背景**：全站視覺方向於 2026-07-15 從《香水》電影美學轉為小說世界觀後，進行全專案文件審計（唯讀），確認仍殘留舊世界觀描述的檔案清單，並於同日執行棄用聲明插入。

**執行內容（commit 5630c81）**：
- theme-perfume-day.css / night.css / wc.css：CSS 檔頭電影敘述換成棄用聲明，結構索引保留
- index.html：#ambient-candle-glow 區塊前插入舊世界觀警示
- storyboard.md / docs/VISUAL_SPEC.md / decision-5f-upload-pet.md：頂部插入棄用橫幅，本文不動

**凍結處理（token 整合待決策）**：
- docs/UI_COMPONENTS.md / VISUAL_QA_5E.md / COLOR_TOKEN_MIGRATION.md：頂部插入「凍結中，待 --cold-* / --story-* 整合決策」注意事項

**決策**：
- 所有棄用聲明為純插入，未修改任何 CSS 規則或功能程式碼
- --cold-* / --story-* token 整合列入技術債務，Phase 5 完成後處理
- VISUAL_SPEC.md 採「加棄用聲明」而非「重寫」，降低當前風險

---

## 2026-07-15 文件清理任務完成

**執行內容**：全專案文件審計後，針對所有殘留《香水》電影舊世界觀描述的檔案執行棄用標注。

**Commit 5630c81**（棄用聲明插入）：
- theme-perfume-day.css / night.css / wc.css：CSS 檔頭電影敘述換成棄用聲明，結構索引保留
- index.html 第 2750 行：#ambient-candle-glow 區塊前插入舊世界觀警示
- storyboard.md / docs/VISUAL_SPEC.md / decision-5f-upload-pet.md：頂部插入棄用橫幅，本文不動

**Commit 91c26d0**（token 文件凍結）：
- docs/UI_COMPONENTS.md / VISUAL_QA_5E.md / COLOR_TOKEN_MIGRATION.md：頂部插入凍結聲明，待 --cold-* / --story-* 整合決策後再處理

**Commit 582f6ae**（decisions.md 補齊）：
- 本 session 所有未 commit 的 decisions.md 變更一次補齊

**決策**：
- 所有修改為純插入，未動任何 CSS 規則或功能程式碼
- VISUAL_SPEC.md 採「加棄用聲明」不重寫，降低當前風險
- --cold-* / --story-* token 整合列入技術債務，Phase 5 完成後處理

---

## 2026-07-15 Modal 顏色方向：遊戲導演規格優先於設計稿

**決策**：不套用 @perfume-art-director 設計稿中的暖色 rgba 佔位值（如 rgba(28,32,36,0.80)）。
**理由**：@perfume-game-director 規格明確要求灰藍色（cool gray-blue）scrim，現有 --cold-* token 方向正確，以導演規格為最高依據。
**影響**：Modal overlay 與 panel 維持現有冷調 token，不引入暖色調。
**相關 commit**：2452bd4
**影響檔案**：`theme-perfume-night.css`（`--cold-overlay: color-mix(in srgb, color-mix(in srgb, var(--cold-wash) 88%, var(--cold-dim) 12%) 86%, transparent)`；`--cold-modal-fill: color-mix(in srgb, color-mix(in srgb, var(--cold-dim) 25%, var(--cold-wash) 75%) 88%, transparent)`）

---

## 2026-07-15 decisions.md 重複條目合併

**決策**：合併兩條近重複的 Modal 顏色記錄，保留「遊戲導演規格優先於設計稿」標題，刪除舊條目「Modal 顏色 token 不套用設計稿佔位值」。
**理由**：兩條說的是同一件事，舊條目的影響檔案數值（rgba 佔位值）已在 commit 48f4247 後過時，合併時以讀取 CSS 實際值為準。
**相關 commit**：a71f232
**影響檔案**：decisions.md（刪一條、補入 commit 與影響檔案欄位）

---

## 2026-07-15 story/world.md 納入版控

**決策**：將 story/world.md 從 untracked 狀態納入 git 版控。
**理由**：story/world.md 是整個新視覺方向的根基文件，角色檔案、CSS token、材質語言均以它為準，需要版控保護。
**相關 commit**：df9aa50
**影響檔案**：story/world.md（新增追蹤）

---

## 2026-07-16 Phase 5g 完成確認

**執行內容**：
- 瀏覽器實測（DevTools）確認背景 → 起霧遮罩 → Modal 三層亮度差可感知
- color-mix() 比例有效，三層呈灰黑色系，符合遊戲導演規格（cool gray-blue）

**結論**：
- 灰黑色系為預期行為，非未完成狀態；`--story-amber` 琥珀色待 Phase 6 故事弧線時情境出現
- Phase 5g 完成條件正式達成：`.word-card` 材質 + Modal + 三層亮度差均符合小說世界觀視覺語言

**下一步**：Phase 4.5 前端 UI 實作（三個頁籤 + 自訂單字功能）

---

## 2026-07-17 Phase 4.5 UI 設計決策定案

經 @ui-designer、@perfume-art-director、@perfume-game-director 三方審閱後定案：

- **按鈕層級**：【挑出單字】用 .btn-outline-m；【中文翻譯】【文法重點】降階為 .btn-ghost-m。amber 色保留給間隔重複「已掌握」正向回饋，不用於操作列
- **#resultActionRow 間距**：與下方 tab bar 保持 16px（折中：有視覺分層，不完全切開）
- **PDF 說明文字**：加一行敘事語氣說明「這份文件只帶出了字——其他的，靠你自己了。」用 --cold-dim 小字，不加 icon
- **出現動畫**：opacity 0→1，0.35–0.4s ease-out，無彈跳無慶祝特效
- **自訂單字功能**：維持現有直接加入單字庫行為（Option B），只修正 PDF session 的 context 來源 bug；sidebar accordion UI 元件略過不實作
- **PDF 存到 Notion**：只同步單字清單，不抓翻譯和文法重點

---

## Phase 4.5 UX 修正（2026-07-17）

- #resultActionRow 標籤更新：「中文翻譯」→「翻譯這篇」、「文法重點」→「拆解文法」
- 漸進式隱藏：「翻譯這篇」「拆解文法」在成功 fetch 後 fade-out，失敗時保留供重試
- 「挑出單字」永遠可見（重跑動作，非一次性觸發）
- 新增 resetActionButtonsVisible()：同時清除 class 與行內 opacity 樣式，確保重新分析後按鈕正確還原
- 設計依據：@ux-architect 分析建議方案 3 + 方案 2 非對稱組合

---

## 2026-07-17｜PDF 功能限制確認與設計決策

### 確認事項
Phase 4.5 測試後確認：pdf-parse 只能讀取有文字層的 PDF，無法處理圖片型 PDF。

| PDF 類型 | 可否使用上傳 PDF 頁籤 |
|---|---|
| Word / 網頁直接轉存的 PDF | ✅ 可以 |
| FireShot 截圖存成 PDF | ❌ 無法，改用上傳圖片頁籤 |
| 掃描機掃出的 PDF（單頁或多頁） | ❌ 無法，改用上傳圖片頁籤（一次一頁）|
| Adobe 掃描後自動 OCR 的 PDF | ✅ 可以（已有文字層）|

### 設計決策
不實作「掃描 PDF 自動逐頁 OCR」功能（需 pdf2pic 逐頁轉圖再送 Gemini，API 成本高、速度慢）。現有使用場景（教材截圖、單頁文章）以圖片上傳頁籤即可滿足，待有明確需求再評估。

### 待辦（技術債）
錯誤訊息優化：將「此 PDF 沒有可擷取的文字層（可能是掃描檔）」改為更清楚的說明文字，引導使用者切換到圖片頁籤。優先級低，不阻塞 Phase 6。

---

## 2026-07-17｜Phase 6 故事觸發時機

**決策**：在答對率統計與故事文字之間加入安靜過渡態（同容器內，不跳頁）。

**理由**：答對率顯示後玩家處於評估認知語域，與故事沉浸式閱讀是不同認知狀態，0.35s fade-in 解決不了拼接感。緩衝格讓兩個認知狀態自然分隔，再進入故事。

**排除選項**：直接 fade-in 接故事——雖然實作最簡單，但拼接感無法靠轉場速度解決。

---

## 2026-07-17｜Phase 6 故事里程碑觸發條件

**決策**：用相異日曆天數作為故事解鎖條件，而非測驗次數。不放進度條或倒數計數器。

**理由**：天數機制呼應 app 現有間隔重複天數階梯（0/1/3/7/14/30 天），有儀式感且可預期但不可被短時間刷完。次數可被單日大量刷完，破壞里程碑的稀有感。

commit: 4b9dde3

---

## 2026-07-17｜蠟燭系統重寫決策（Game Designer 第二輪診斷）

### 核心診斷
Phase 5f 的蠟燭換皮屬於「貼皮，不是重新設計」。
pixel_pet.js 檔頭已記錄：「只換 sprite 與命名，資料邏輯完全不動」。
機制骨架仍是電子雞養成邏輯（蛋→小雞→公雞），與小說世界觀直接衝突。

### 具體衝突點
- getPetStage 終點為「鑲金燭台」（練得越多越值錢/華麗）→ 累積財富語彙，與末日孤存角色矛盾
- triggerPetAnim 的 ♥ 愛心 bubble、Zzz 睡覺 bubble、30 秒隨機 idle →可愛系電子雞語彙，與角色經歷錯位
- hunger/mood 背景常駐衰減（「牠需要你」→依附驅動）→ 與角色心理現實（「我今晚要不要點這根蠟燭」→稀缺/儀式驅動）完全不同的心理機制

### 意象保留判斷
蠟燭意象本身保留。理由：world.md 的「不開燈」是主動的拒絕，蠟燭需要主動點燃、會燒完、需要維持，貼合「還沒決定完全停止存在，但只保留最低限度的光」。不換成更重的意象（如「沒被下毒的那杯酒」），份量太重，做成每日互動道具會廉價化。

### 決策：機制骨架重寫，非調細節
需要重寫的三件事：
1. 移除「升級=變華麗/鍍金」終點 → 改為「規律使用→火焰變穩定」（確認腦子還在正常運作，不是累積財富）
2. 拿掉擬人化寵物語彙（愛心/睡覺 bubble、隨機頭部轉動）→ 換成蠟燭真實行為（搖曳幅度、燭淚凝結/垂落、風吹飄動）
3. 「不回來就衰減」常駐邏輯 → 換成「每次使用時重新點燃」的儀式感（驅動力從情感勒索換成稀缺感）

### 與前序決策的關係
重寫完成後，「不可逆燃燒痕跡與可逆照顧視覺分離」自然成立——整個物件語言已是「會耗盡的東西」而非「會成長的寵物」，不再有「這是獎勵還是懲罰」的混亂。

### 實作時機
蠟燭重寫列為 Phase 6 前置工作，與故事系統同步規劃，不單獨提前實作。技術方案待 @backend-architect 和 @frontend-developer 評估後確認。

commit: fd3639d

---

## 2026-07-20 v2 正式上線

- 決策：feature/v2-agency-rebuild 合併至 main，正式部署至 Render
- 合併方式：Fast-forward，無衝突，22 個檔案變更
- Commit hash：13caadf05bd27f9b65a39dcb29ff1fd0c49cb63c
- 上線範圍：Phase 4.5（PDF/圖片上傳）+ Phase 5（全站視覺重設計，小說世界觀視覺語言）
- 未上線範圍：Phase 6 沉浸式文本小說（仍在開發中）
- 待處理：story/segments/ 資料夾尚未納入版控，需另行 commit
