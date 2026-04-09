# decisions.md — Day Mode Full Application
**Film**: Perfume: The Story of a Murderer (2006) — Dir. Tom Tykwer, DP Frank Griebe
**Scope**: Day Mode only — full application shell (not wc-card component only)
**Date**: 2026-04-09

---

## 1. The Brief（一句話）

每一個畫面都是 18 世紀格拉斯香料作坊的工作桌——羊皮紙泛黃、墨水已乾、陽光斜射進木格窗，整間屋子聞起來像乾燥花材和舊蠟，而不是矽谷軟體介面。

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

> **Word List 是 Day Mode 的主鏡頭（hero scene）。** 使用者停留最久、最常反覆掃視這個面板。它的場景定義是「香料作坊帳冊攤開在桌上」——每一列單字都是帳冊裡的一個條目，不是 SaaS list item。視覺重量、紋理深度、row 分隔方式都應是全頁面中最考究的，而非與左側卡片等同對待。
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
