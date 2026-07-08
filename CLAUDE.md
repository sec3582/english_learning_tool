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

The UI uses a **Morandi/apothecary aesthetic** inspired by the film *Perfume: The Story of a Murderer* (2006). Key constraints:

- **Never** use pure black or pure white — always warm brown/parchment tones
- Color hue range: 36–44° (warm yellows/browns); desaturated Morandi palette
- Shadows must be warm brown (not cold grey); simulated light from upper-left at 30–40°
- No glass morphism, no Material Design 3
- Parchment texture on all surfaces

CSS theme files:
- `theme-perfume-day.css` — Day Mode (primary, ~40KB)
- `theme-perfume-wc.css` — Word card component styles (~71KB)
- `compiled-spec.md` — Full Day Mode specification (color tokens, shadow ladder, typography, spacing, motion)
- `decisions.md` — Design rationale and visual North Star

Always read `compiled-spec.md` before making CSS changes to ensure new styles conform to the established token system.

## Language Conventions

- UI text and definitions use **Traditional Chinese** (繁體中文), specifically **Taiwan vocabulary** (台灣用語)
- Example: scones → 司康餅 or 英式鬆餅 (not mainland equivalents)
- CEFR levels used throughout: A1, A2, B1, B2, C1, C2
