# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案背景

這是一個英文學習工具，部署於 Render 免費方案。

**v2 優化目標（開發分支：`feature/v2-agency-rebuild`）：**

1. 全站視覺重設計（《香水》電影美學，Suminagashi 墨流動畫）
2. MD 描述文件清理（移除冗長形容詞）
3. 收藏文章同步到 Notion
4. 評估並處理文法測驗 bug
5. 學習進度追蹤（利用現有 WordObject 的 stage/dueAt 欄位補充統計與視覺化）
6. 沉浸式文本小說（背單字推進劇情，主角是使用者自己，失去嗅覺的調香師學徒）

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start server with auto-reload (node --watch server.js)
npm start            # Start server in production mode
```

App runs at `http://localhost:3000` (configurable via `PORT` in `.env`).

Requires `GEMINI_API_KEY` in `.env` — obtain from https://aistudio.google.com/app/apikey.

There is no build step, test runner, or linter configured.

## Architecture

**Stack:** Node.js/Express backend + Vanilla JS SPA frontend. No framework, no bundler, no database.

### Backend (`server.js`)
- Serves static files (index.html, js/, css/)
- `/api` — POST proxy to Google Gemini API; accepts a JSON `action` field to route different AI tasks
- `/scrape` — fetches YouTube captions or web article text for analysis

### Frontend Entry Points
| File | Role |
|------|------|
| `index.html` | Single-page app shell; loads all CSS and JS modules |
| `js/main.js` | App init, event binding, imports all submodules |
| `js/ui.js` | All DOM rendering (~117KB; the largest file) |

### Frontend Modules (`js/`)
| File | Responsibility |
|------|----------------|
| `storage.js` | All localStorage reads/writes for `myWords` |
| `api.js` | Gemini API calls + monthly token usage tracking |
| `quiz.js` | Quiz logic: typing, choice (EN↔ZH), dictation modes |
| `grammarStorage.js` | Grammar practice point persistence |
| `pixel_pet.js` | Gamification pet system (XP, leveling, mood) |
| `speech.js` | Text-to-speech (Web Speech API) |
| `gsheets_*.js` / `sheets_*.js` | Google Sheets optional backup/sync |
| `wordRelations.js` | Synonym/antonym relationship helpers |

### Data Layer
All user data lives in **browser localStorage** — no server-side persistence. Google Sheets integration is optional secondary backup.

Key localStorage keys:
- `myWords` — `Array<WordObject>` — the entire vocabulary library
- `quizPref` — quiz settings (audio mode, show Chinese, quiz type)
- `grammarPracticePoints` — saved grammar points from articles
- `wordgarden_cache_<hash>` — article analysis cache (keyed by content hash)
- `wordgarden_usage_YYYY-MM` — monthly Gemini API token usage
- Various `pet*` keys — pixel pet state

**WordObject shape:**
```javascript
{
  word, pos, level,           // "example", "noun", "B1"
  definition,                 // Traditional Chinese
  example1, example1_zh,      // source sentence + translation
  example2, example2_zh,      // AI-generated sentence + translation
  synonyms, antonyms,
  addedAt,                    // ISO timestamp
  dueAt,                      // ISO timestamp (spaced repetition schedule)
  stage                       // 0–5 (maps to 0,1,3,7,14,30-day intervals)
}
```

Deleted words must be excluded from quiz selection — check `storage.js` filtering logic before modifying quiz word pools.

## Core Features

1. **Article Analysis** — user pastes/scrapes text; Gemini extracts 8–15 vocabulary cards (word, CEFR level, Traditional Chinese definition, two example sentences with translations, synonyms/antonyms)
2. **Spaced Repetition** — 6-stage schedule (0→1→3→7→14→30 days); `dueAt` governs when words surface for review
3. **Quiz Modes** — typing (fill-in-blank), choice EN→ZH, choice ZH→EN, dictation (audio → type); graded A/B/C. **Current state (2026-07, Phase 5g review): only typing has a wired-up entry point.** `openQuizModePicker()`/`startQuizFlowWithMode()` (`js/ui.js`) implement choice/dictation but no button ever calls them — verify before assuming these modes are user-reachable.
4. **Grammar Practice** — Gemini extracts grammar points; quiz generator produces rewriting exercises; AI grades responses. **Current state (2026-07, Phase 5g review): extraction/storage works, but the quiz UI is unmounted.** `openGrammarQuiz()` (`js/ui.js`) targets `#grammarQuizModal`, which doesn't exist in `index.html`.
5. **Pixel Pet** — leveling system tied to words added and reviews completed
6. **Google Sheets Sync** — optional; bootstraps word list from Sheets on startup, pushes additions back

**Also unmounted (2026-07, Phase 5g review):** the Library/Reader Mode (`_renderLibraryPage_()`/`showReaderMode()` in `js/ui.js`) has no DOM entry point in `index.html` — collected articles have no in-app way to be browsed or reread. Treat all three of the above as "built but not shipped" until wired up or formally dropped.

## Design System

**視覺基礎已從《香水》電影美學（2026-04-09 至 2026-07-14）改為小說世界觀本身（2026-07-15 起）。** 故事背景與情感弧線見 `story/world.md`；現行視覺語言（色盤、卡片材質、Modal 規格）見 `.claude/agents/perfume-game-director.md`。`decisions.md` 與 `compiled-spec.md` 的舊內容保留作歷史參考，不再作為執行依據。

**禁止清單（絕對不能出現）：**
- 禁止 glassmorphism（玻璃擬態）
- 禁止純黑（`#000000`）或純白（`#ffffff`）
- 禁止慶祝式彈跳動畫與彩帶特效
- 禁止鮮豔飽和色
- 禁止銳利直角科技感邊框

CSS theme files:
- `theme-perfume-day.css` — Day Mode (primary, ~40KB)
- `theme-perfume-wc.css` — Word card component styles (~71KB)
- `compiled-spec.md` — Day Mode 舊規格（色彩、陰影、字體、間距、動效），2026-07-15 前基礎已棄用
- `decisions.md` — 舊決策記錄與視覺 North Star，2026-07-15 前基礎已棄用

修改 CSS 前，先讀 `.claude/agents/perfume-game-director.md` 確認現行規格，再視需要參考 `compiled-spec.md` 的舊 token 系統是否仍適用。

## Language Conventions

- UI text and definitions use **Traditional Chinese** (繁體中文), specifically **Taiwan vocabulary** (台灣用語)
- Example: scones → 司康餅 or 英式鬆餅 (not mainland equivalents)
- CEFR levels used throughout: A1, A2, B1, B2, C1, C2
