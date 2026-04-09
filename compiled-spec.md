# compiled-spec.md — Day Mode Full Application
**Film**: Perfume: The Story of a Murderer (2006) — Dir. Tom Tykwer, DP Frank Griebe
**Date**: 2026-04-09
**Phase**: 3 — Compiled Specification

> This document is the sole source of truth for Day Mode implementation.
> Appendix contains illustrative CSS snippets only — not complete implementation.

---

## 1. Scope & Inputs

| Input | File | Last confirmed |
|-------|------|----------------|
| Design decisions | `decisions.md` | 2026-04-09 |
| Scene storyboard | `storyboard.md` | 2026-04-09 |
| Existing wc-card styles | `theme-perfume-wc.css` | Prior session (do not re-implement) |
| Application markup | `index.html` | Current |

**Implementation scope — Day Mode only:**

| # | Component | HTML target |
|---|-----------|-------------|
| 1 | Page background + vignette | `body`, `.bg-gray-100` |
| 2 | Section cards | `#articleInputSection`, `#aiResult`, `#readerSection` |
| 3 | Word List panel | `#wordListCard` (full interior) |
| 4 | Modals | `#quizModal .modal`, `#quizSettings .modal`, `#grammarQuizModal .modal` |
| 5 | Primary / secondary buttons | `.btn-primary-m`, `.quiz-btn-primary`, `.btn-outline-m`, `.btn-ghost-m` |
| 6 | Inputs / textarea / select | `input`, `textarea`, `select` global + named fields |
| 7 | Tabs | `#tabGroup` buttons, `.input-tab` |
| 8 | Badges / chips / tags | `.chip`, `.enrich-badge`, `.reader-enrich-tag`, `.tab--active` |

**Not in scope:** Night Mode, `.wc-card` component CSS (already in `theme-perfume-wc.css`), JS logic, Python backend.

---

## 2. Global Tokens

### 2A. Color Tokens

All values derived from decisions.md HSL descriptions and existing wc-card token palette.
`*` tokens denote values new in this spec (not previously in `theme-perfume-wc.css`).

```
/* ── Background & Surface ── */
--color-bg:               #EDEBE4   /* * page floor; hue ~43°, L ~92%, sat ~18%; green-grey suppressed */
--color-surface-card:     #F0E8D4   /* * section card surface; hue ~40°, L ~89%, sat ~26%; fresh parchment */
--color-surface-panel:    #E8DCCA   /* * word list panel base; 3–5% darker than surface-card; old book cover */
--color-surface-recessed: #DFD0B8   /* * AI block, input bg, modal inner area; visibly deeper */
--color-surface-modal:    #F3ECDF   /* * modal container; 2–3% lighter than surface-card; "paper held up" */

/* ── Ink (text) ── */
--color-ink-1:            #1C1208   /* primary text; dried brown-black ink; from wc-card palette */
--color-ink-2:            #7A6045   /* secondary/muted text; faded brown ink; from wc-card palette */
--color-ink-3:            #A08568   /* * placeholder, disabled label; even lighter brown */

/* ── Accent ── */
--color-accent:           #C8952A   /* amber gold; sun through glass vessel; from wc-card palette */
--color-accent-dim:       #9E7B38   /* * mastered badge bg; desaturated accent; less saturated, same hue */
--color-accent-focus:     rgba(200, 149, 42, 0.25)  /* focus ring spread; amber, not blue */

/* ── Ledger Lines (CG-13) ── */
/* Alpha varies by row index (index % 3): 0=0.20, 1=0.15, 2=0.12 */
--color-ledger-hi:        rgba(120, 85, 30, 0.20)   /* index % 3 === 0 */
--color-ledger-mid:       rgba(120, 85, 30, 0.15)   /* index % 3 === 1 */
--color-ledger-lo:        rgba(120, 85, 30, 0.12)   /* index % 3 === 2 */
--color-ledger-section:   rgba(120, 85, 30, 0.22)   /* section/header dividers; slightly stronger */

/* ── Rim Light (CG-5) ── */
--color-rim-card:         rgba(255, 220, 140, 0.30) /* section card top rim */
--color-rim-panel:        rgba(255, 220, 140, 0.38) /* word list panel top rim; stronger */
--color-rim-modal-top:    rgba(255, 220, 140, 0.35) /* modal top rim */
--color-rim-modal-left:   rgba(255, 220, 140, 0.20) /* modal left rim */
--color-rim-btn:          rgba(255, 220, 140, 0.28) /* primary button top rim */
--color-rim-hover:        rgba(255, 220, 140, 0.38) /* hover state rim (transient; 0 accent points) */

/* ── Input Borders (CG-13 special rule) ── */
--color-input-border:     rgba(120, 85, 30, 0.22)   /* default groove edge */
--color-input-border-foc: rgba(160, 100, 30, 0.55)  /* left border on focus; warmer, deeper */

/* ── Modal Overlay ── */
--color-overlay:          rgba(40, 25, 8, 0.55)     /* warm brown; day-mode air preserved */

/* ── Shadow base color (all shadows use this family) ── */
/* Used in shadow ladder below — never use cold rgba(0,0,0,x) */
/* Base: rgba(80, 50, 15, x) */

/* ── Badge Semantic Colors ── */
--color-badge-pos-bg:     #3E3018   /* part-of-speech stamp; dark warm ink */
--color-badge-pos-fg:     #E8DCCA   /* part-of-speech text; pale parchment */
--color-badge-mastered-bg: #4A5C2F  /* mastered stamp; dark moss-olive */
--color-badge-mastered-fg: #D8E0C4  /* mastered text; pale moss-cream */
--color-badge-due-bg:     #7A5020   /* due stamp; dark amber-brown */
--color-badge-due-fg:     #EAD9BC   /* due text; parchment */
--color-badge-enrich-bg:  #E4D5BA   /* enrich badge (TR/GR) bg; warm tan */
--color-badge-enrich-fg:  #5C3D1A   /* enrich badge text; dark brown ink */
--color-chip-navbar:      rgba(200, 180, 140, 0.35) /* navbar .chip; warm semi-transparent */
```

---

### 2B. Shadow Ladder

**Light source: upper-left 30–40°.**
All shadows use `rgba(80, 50, 15, x)` — warm brown. Never `rgba(0,0,0,x)`.
x-offset is always positive (rightward). y-offset is always positive and larger than x (downward-dominant).

| Level | Used on | box-shadow value | Rim inset |
|-------|---------|-----------------|-----------|
| **SH-0** | Body, grid wrapper (no elevation) | none | none |
| **SH-1** | Section cards (fresh parchment on desk) | `2px 4px 16px rgba(80,50,15,0.10)` | `inset 0 1px 0 var(--color-rim-card)` |
| **SH-2** | Word list panel (thick old ledger) | `3px 6px 20px rgba(80,50,15,0.14)` | `inset 0 1px 0 var(--color-rim-panel)` |
| **SH-3** | Modal container (paper held above desk) | `3px 8px 28px rgba(80,50,15,0.22)` | `inset 0 1px 0 var(--color-rim-modal-top), inset 1px 0 0 var(--color-rim-modal-left)` |
| **SH-groove** | Inputs, recessed blocks (pressed-in) | `inset 0 1px 3px rgba(80,50,15,0.12)` | none (recessed, no rim) |
| **SH-btn** | Primary button (wax seal on paper) | `1px 2px 6px rgba(80,50,15,0.18)` | `inset 0 1px 0 var(--color-rim-btn)` |

**Validation rule (CG-1/CG-2):** Remove all `box-shadow` from any container. If the container edge is still clearly visible (via a border property), the shadow-as-border system is not working — the border must be removed and depth rebuilt from shadows alone.

---

### 2C. Material Layers (CG-3)

Three layers must all be present simultaneously. They are additive but must not visually compete.

| Layer | Applied to | Texture type | Opacity | blend-mode | Pseudo-element | SVG params |
|-------|-----------|-------------|---------|------------|----------------|------------|
| **M-1: Ground** | `body::before` | Fine powder grain (stone dust) | 2–3% | `overlay` | `::before`, `pointer-events:none`, `position:fixed`, `inset:0`, `z-index:0` | `feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4"` |
| **M-2: Parchment** | Each container `::after` | Short fiber — slight directional randomness | 3–4% | `soft-light` | `::after`, `pointer-events:none`, `inset:0`, `border-radius:inherit` | `feTurbulence type="turbulence" baseFrequency="0.45 0.35" numOctaves="3"` |
| **M-3: Wear** | Not a real texture layer — simulated via SH-btn shadow edges | Worn edge (press/lift micro-shadow) | 1–2% effective via shadow | `multiply` (shadow approach) | none | n/a — use box-shadow SH-btn pattern |

**Container isolation requirement:** Any element with M-2 applied must have `isolation: isolate` to prevent `soft-light` from bleeding into sibling elements.

**Non-perfect rules (CG-8):** Texture randomness is fixed at CSS render time — not re-randomized per interaction or page load. Use `seed` attribute in `feTurbulence` to lock the pattern. Alpha jitter in ledger lines is driven by `row-index % 3`, not by random().

---

### 2D. Typography

**Font domain assignment (CG-14):**

| Domain | Text types | Font stack | Weights used |
|--------|-----------|------------|-------------|
| **D1 — Protagonist** (serif) | English word title (`.wc-title strong`), section main headings (`.section-h`), H1–H2 | `"EB Garamond", "Lora", "Crimson Pro", Georgia, serif` | 700 (word title), 600 (section heading) |
| **D2 — UI Label** (humanist sans) | Buttons, tabs, badges, form labels, tooltips, nav items, small UI text | `"Jost", "DM Sans", "Source Sans 3", system-ui, sans-serif` | 600 (primary btn), 500 (secondary btn, tab label), 400 (placeholder, muted) |
| **D3 — Chinese** | All Chinese UI copy, definitions, AI translations, placeholders | `"Noto Sans TC", system CJK fallback` | Match surrounding English weight; readability primary |
| **D4 — Numeric** | NT$, %, scores, token counts, page numbers, progress | Same as D2 + `font-variant-numeric: tabular-nums; font-feature-settings: "tnum"` | Match surrounding label weight |

**Size scale:**

| Role | Size | Weight | Line-height | Letter-spacing | Domain |
|------|------|--------|------------|----------------|--------|
| English word title | 1.4375rem (23px) | 700 | 1.2 | -0.015em | D1 |
| Section heading | 1.0625rem (17px) | 600 | 1.3 | -0.01em | D1 |
| Body / definition | 0.9375rem (15px) | 400 | 1.78 | 0 | D1 (reading) / D2 (UI) |
| AI analysis text | 0.9375rem (15px) | 400 | 1.78 | +0.005em | D1 |
| UI label (btn, tab) | 0.875rem (14px) | 500–600 | 1.35 | 0 | D2 |
| Badge / chip text | 0.6875rem (11px) | 600 | 1.2 | +0.04em | D2 |
| Placeholder | 0.875rem (14px) | 400 | — | 0 | D2 |
| Numeric (scores, $) | 0.875rem–1rem | 500 | — | 0 (tabular) | D4 |
| Chinese muted | 0.875rem (14px) | 400 | 1.7 | 0 | D3 |

**Mixing rule:** In mixed CJK+Latin sentences, Latin uses its domain font; CJK falls to D3 via `unicode-range`. Do not force D1 serif onto Chinese characters.

---

### 2E. Radius & Spacing

| Token | Value | Applied to |
|-------|-------|-----------|
| `--radius-container` | 8px | Section cards, word list panel |
| `--radius-modal` | 8px | Modal containers (not 16px) |
| `--radius-btn` | 6px | All buttons |
| `--radius-input` | 6px | Inputs, textarea, select |
| `--radius-badge` | 3px | Badges, chips, tags — maximum 4px |
| `--radius-badge-max` | 4px | Hard ceiling — never `border-radius: 9999px` on badges |

| Spacing token | Value | Used for |
|---------------|-------|---------|
| `--pad-card` | 20px 22px | Section card internal padding (top/bottom × left/right) |
| `--pad-panel` | 18px 20px | Word list panel internal padding |
| `--pad-modal` | 22px 24px | Modal container padding |
| `--gap-btn-row` | 8px | Gap between sibling buttons |
| `--gap-card-list` | 8px | space-y between `.wc-card` items (Today/Review tabs) |

---

### 2F. Motion Tokens

| Interaction | Duration | Easing | Notes |
|-------------|---------|--------|-------|
| Card expand (grid-rows) | 280ms | ease-out | `grid-template-rows: 0fr → 1fr` |
| Card collapse | 250ms | ease-in | Slightly faster than expand |
| Modal appear | 230ms | ease-out | `translateY(-10px → 0)` + `opacity 0→1` |
| Modal disappear | 200ms | ease-in | Reverse of appear |
| Tab underline slide | 180–220ms | ease-out | Sliding left position; no glow; no spring |
| Hover transition (surface) | 150ms | ease-out | Rim light alpha change only |
| Hover off | 150ms | ease-out | Return to base |
| Focus ring appear | 120ms | ease-out | Box-shadow spread `0 → 3px` |
| List item entrance (stagger) | 160ms base + 40ms/item | ease-out | `opacity 0→1` + `translateY(-4px→0)` |
| Input border focus | 150ms | ease-out | Left border deepens |
| Accordion (wc-card) | 280ms | ease-out | Matches card expand; already in theme-perfume-wc.css |

**Hard prohibitions (CG-10/CG-9):**
- No spring easing (`cubic-bezier` with overshoot)
- No bounce on any element
- No glow animation (`text-shadow` or `box-shadow` pulsing)
- No `translateY(-2px)` card lift on hover
- No horizontal slide-in for modals or panels

---

### 2G. Accent Budget (CG-11)

Maximum **3–4 amber-gold accent points** visible simultaneously per viewport.

| Element | Points | Condition |
|---------|--------|-----------|
| Active tab bottom border (2px amber) | 1 | Any tab is active |
| Focus ring on focused element | 1 | One element focused at a time; cannot stack |
| Save-marked state on `.wc-btn-save` | 1 | Word is saved/starred |
| `.wc-card` header separator line | See note ↓ | Depends on implementation choice — see Alternative A/B |
| Ledger lines (rgba alpha 0.12–0.20) | 0 | Low saturation —墨色 not accent |
| Hover rim light (transient) | 0 | Not persistent; below saturation threshold |

**Header separator line — choose one implementation:**

| Option | Header line treatment | Points | When to choose |
|--------|----------------------|--------|---------------|
| **Option A (recommended)** | Desaturate the line to low-saturation gold-brown: `rgba(160, 110, 30, 0.35)` — same hue family as accent but below the high-saturation threshold; counts as 0 points like a ledger line | 0 | Default; maximises accent budget for focus ring + active tab + save marker without constraint |
| **Option B** | Keep full accent saturation `var(--color-accent)` but only render the line on the **currently hovered or selected expanded card** — at most 1 visible simultaneously | 1 | If the gold line at full accent saturation is a visual priority and the team is willing to track hover state |

**If Option A is chosen:** The header separator is reclassified as a ledger line. Add token `--color-card-separator: rgba(160, 110, 30, 0.35)` and use it instead of `var(--color-accent)`. The 3–4 accent point budget then applies only to: active tab line + focus ring + save-marked state.

**If Option B is chosen:** The count rule from storyboard CG-11 still applies — ensure the 3–4 total is not exceeded across all simultaneously-visible amber elements.

**Forbidden uses of accent color (regardless of budget):**
- Any container background fill
- Entire button fill color
- Any badge background color
- Background gradient component

---

## 3. Component Specs

---

### 3.1 Page Background + Vignette

**CG rules: CG-3, CG-4, CG-6, CG-8**

| Property | Value | Rule |
|----------|-------|------|
| Background color | `var(--color-bg)` = `#EDEBE4` | CG-6: outermost, coolest |
| Texture | M-1 (body::before, feTurbulence grain, 2–3% overlay) | CG-3 |
| Vignette | `body::after`: `radial-gradient(ellipse at center, transparent 55%, rgba(40,25,8,0.12) 100%)` fixed cover | CG-4 |
| Vignette pointer events | none | — |
| Vignette layer ordering | texture (`body::before`) < vignette (`body::after`) < page content — implement as stacking context: `body::before` at the lowest paint order, `body::after` above it but below all child elements. Suggested z-index: texture = 0, vignette = 1, content wrapper = 2 (or use `isolation: isolate` on the content wrapper instead of relying on bare z-index values) | — |
| Border | none | CG-2 |
| Box-shadow | SH-0 (none) | CG-1 |

**Verification (CG-4):** Open browser. Navigate to any corner of the page. The corner must appear measurably darker than the center. Remove the `::after` vignette — the page must feel "flat" or "floating." If the difference is imperceptible either direction, the opacity is wrong.

**Prohibited:**
- `#FFFFFF` or near-white `#F9FAFB` background
- Any gradient that runs left-right, top-bottom, or diagonal
- Repeating tile pattern
- Pure flat color with no texture overlay

---

### 3.2 Section Cards (`#articleInputSection`, `#aiResult`, `#readerSection`)

**CG rules: CG-1, CG-2, CG-3, CG-5, CG-6, CG-9, CG-12**

| State | Background | Shadow | Rim inset | Border |
|-------|-----------|--------|-----------|--------|
| **Base** | `var(--color-surface-card)` | SH-1 | `var(--color-rim-card)` on top edge | none |
| **Hover** (section containers don't hover) | — | — | — | — |
| **Active** (not applicable to passive containers) | — | — | — | — |
| **Focus** (keyboard focus on section — rare) | No visual change on container; focus indicator on active child element | — | — | — |

**Internal depth:**

| Sub-element | Background | Treatment |
|-------------|-----------|-----------|
| Section heading (`.section-h`) | inherit | D1 serif, 600wt, ink-1; ledger section line below |
| Main content area | `var(--color-surface-card)` | M-2 texture, isolation: isolate |
| AI analysis block (`.wc-ai`) | `var(--color-surface-recessed)` | SH-groove inset; deeper = recessed, not floating |
| Reader body text | `var(--color-surface-card)` | D1 serif, 400wt, 1.78 line-height |

**Padding:** `--pad-card` (20px top/bottom × 22px left/right).
**Border-radius:** `--radius-container` (8px).
**Transition on appearance:** `opacity 0→1` + `translateY(-4px → 0)`, 160ms ease-out — the card falls lightly onto the desk surface from above. A positive `translateY` (rising upward into view) is prohibited: that reads as SaaS float-in, not paper being placed down.

**Prohibited:**
- `background: #ffffff`
- `border: 1px solid` any color (depth is from SH-1 only)
- Shadow with `x=0` (symmetric = no light source)

#### 3.2a Shared Wrapper Override

The legacy Tailwind pattern `bg-white rounded-xl shadow p-6` is applied to `#articleInputSection`, `#aiResult`, `#readerSection`, and any unnamed `<section>` with the same classes (常用字, 文法分析, etc.). All instances must be overridden:

| Tailwind class | Override value | Spec ref |
|---------------|---------------|---------|
| `bg-white` | `background: var(--color-surface-card)` | CG-6, §2A |
| `rounded-xl` (12px) | `border-radius: var(--radius-container)` (8px) | §2E |
| `shadow` (symmetric, cold) | `box-shadow: SH-1` (warm directional) | §2B |
| `p-6` | `padding: var(--pad-card)` (20px 22px) | §2E |

**Hover contract:** Section containers have **no hover state**. No background change, no shadow change on mouse-over. Child elements (`.section-h`, buttons) have their own interaction specs.

**Title rules:**
- `.section-h` elements: `color: var(--color-ink-1)`, D1 serif weight 600; `border-bottom: 1px solid var(--color-ledger-section)` below the heading (ledger line, not UI border).
- `#readerTitle`: does **not** carry the `.section-h` class — must be explicitly targeted with `color: var(--color-ink-1)` and the same D1 serif 600wt treatment.

**Muted copy:**
- `#readerSavedAt` and any timestamp / status line: `color: var(--color-ink-3)`. Never `text-gray-*` or any cold-grey value.

---

### 3.3 Word List Panel (`#wordListCard`)

**CG rules: CG-1, CG-2, CG-3, CG-5, CG-6, CG-7, CG-8, CG-11, CG-12, CG-13**

**Storyboard:** Hero scene — the open ledger on the right side of the worktable.

| State | Background | Shadow | Rim inset |
|-------|-----------|--------|-----------|
| **Base** | `var(--color-surface-panel)` | SH-2 | `var(--color-rim-panel)` on top edge |
| **Internal hover** (child `.wc-card`) | See 3.3a | — | — |

**Panel is deliberately heavier than section cards:** `--color-surface-panel` is 3–5% darker than `--color-surface-card`. SH-2 has larger y-offset and blur than SH-1.

#### 3.3a Row Divider System

**Selection rule — Phase 3 must enforce this:**

| Tab active | Divider scheme | Rationale |
|-----------|----------------|-----------|
| 今日 / 複習 (Today / Due) | **Scheme A:** `space-y: --gap-card-list` + bottom ledger line per card | Few items; space gives each card breathing room |
| 全部 (All) | **Scheme B:** Alternating background + lighter ledger line | Many items; alternating guides eye without excessive gap |

**Scheme A detail:**
- Gap between cards: `--gap-card-list` (8px)
- Each `.wc-card` (except last): `border-bottom` = ledger line using alpha from `row-index % 3` map:
- **Semantic note:** Although `border-bottom` is used as the CSS mechanism, this line is classified as a **ledger line** (CG-13), not a UI border. It must: use only warm-brown transparent color (one of the `--color-ledger-*` tokens); appear only as a horizontal divider; never be reused as a container outline. If a future engineer replaces this with any cold-grey value — including `var(--border)` or any Tailwind color — it violates the spec regardless of the CSS property used.
  - 0 → `var(--color-ledger-hi)` (0.20)
  - 1 → `var(--color-ledger-mid)` (0.15)
  - 2 → `var(--color-ledger-lo)` (0.12)
- Last card in list: no bottom line

**Scheme B detail:**
- Even-index rows: `var(--color-surface-panel)`
- Odd-index rows: `color-mix(in srgb, var(--color-surface-panel) 97%, var(--color-ink-1) 3%)` (approximately 1% darker). **Fallback:** If `color-mix` is unavailable in the target environment, define a static token `--color-surface-panel-alt: #E3D7C0` (a pre-computed value ~1% darker than `--color-surface-panel`) and use it in place of the `color-mix` expression.
- All rows: `border-top` = `var(--color-ledger-lo)` (lightest alpha, 0.12)
- Alpha index map same as Scheme A for top-border variation

**Prohibited in both schemes:**
- `border-bottom: 1px solid var(--border)` (old cold-grey variable)
- `border-bottom: 1px solid #e5e7eb` (Tailwind cold-grey)
- Gap > 12px (destroys ledger-page continuity)

#### 3.3b Tab Group (`#tabGroup`: 今日 / 複習 / 全部)

| State | Background | Text color | Bottom border | Transition |
|-------|-----------|------------|---------------|------------|
| **Base (inactive)** | `var(--color-surface-panel)` | `var(--color-ink-2)` | none (transparent 2px) | — |
| **Hover** | `var(--color-surface-panel)` | `var(--color-ink-1)` | none | 150ms ease-out on color |
| **Active** | 4–6% darker than base (use `color-mix`) | `var(--color-ink-1)` | **2px solid `var(--color-accent)`** (amber) | Underline slides: 180–220ms ease-out, no spring, no glow |
| **Tab group container** | — | — | Top: `1px solid var(--color-ledger-section)` | — |

**Tab underline animation spec:**
- Implemented via a single sliding `<div>` or CSS custom property tracking active tab's `left`/`width`
- Duration: 180–220ms
- Easing: `cubic-bezier(0.25, 0, 0.0, 1)` — ease-out, no overshoot
- No `filter: drop-shadow` or `box-shadow` glow on the underline element
- No opacity animation on the underline (it slides, it does not fade)
- Speed below 150ms = too fast (no physical weight), above 250ms = too slow (feels broken)

#### 3.3c Interaction States for `.wc-card` within panel

| Interaction | Visual change | Duration |
|-------------|--------------|---------|
| **Hover** | Rim top-edge: alpha 0.25 → 0.38 | 150ms ease-out |
| **Hover off** | Rim alpha 0.38 → 0.25 | 150ms ease-out |
| **Expand** | `grid-template-rows: 0fr → 1fr` | 280ms ease-out |
| **Collapse** | `grid-template-rows: 1fr → 0fr` | 250ms ease-in |
| **Save (marked)** | `.wc-btn-save` text/icon color → `var(--color-accent)` | 150ms |

**Prohibited hover behavior:** `translateY(-2px)` lift. Cards do not float.

#### 3.3d Filter Row (All tab)

| Element | State | Treatment |
|---------|-------|-----------|
| `#allSearch` input | Base | `var(--color-surface-recessed)` bg, SH-groove, ledger border |
| `#allSearch` input | Focus | Left border deepens to `var(--color-input-border-foc)`, focus ring `var(--color-accent-focus)` 3px |
| `#allPos`, `#allLevel`, `#allSort` | Base | Same as input; `transform-origin: top` for dropdown open |
| Placeholder text | — | `var(--color-ink-3)` |

---

### 3.4 Modals (`#quizModal`, `#quizSettings`, `#grammarQuizModal`)

**CG rules: CG-1, CG-2, CG-3, CG-5, CG-9, CG-10, CG-13**

| State | Property | Value |
|-------|----------|-------|
| **Overlay (backdrop)** | Background | `var(--color-overlay)` = `rgba(40,25,8,0.55)` |
| **Overlay** | Day-mode air check | Background texture behind overlay must remain faintly visible; if background becomes opaque/black, reduce alpha to 0.45–0.50 |
| **Modal container — Base** | Background | `var(--color-surface-modal)` |
| **Modal container — Base** | Shadow | SH-3 |
| **Modal container — Base** | Rim | `inset 0 1px 0 var(--color-rim-modal-top), inset 1px 0 0 var(--color-rim-modal-left)` (top + left only) |
| **Modal container — Base** | Border | none |
| **Modal container — Base** | Border-radius | `--radius-modal` (8px) |
| **Appear animation** | Transform + opacity | `translateY(-10px) opacity:0` → `translateY(0) opacity:1`, 230ms ease-out |
| **Disappear animation** | Transform + opacity | Reverse, 200ms ease-in |

**Internal structure:**

| Sub-area | Treatment |
|---------|-----------|
| Title row | D1 serif weight 600, `var(--color-ink-1)`; bottom: `1px solid var(--color-ledger-section)` |
| Content area | `var(--color-surface-recessed)` bg for recessed feel; M-2 texture |
| Button row | Top: `1px solid var(--color-ledger-section)`; buttons spaced `--gap-btn-row` |
| Close button (✕) | Base: `var(--color-ink-2)`; Hover: `var(--color-ink-1)`, 150ms; no background; no border |

**Prohibited:**
- `background: rgba(0,0,0,0.5)` for overlay (cold black)
- `background: #ffffff` for modal container
- `border-radius: 16px` (too modern/SaaS)
- Modal sliding in from left or right

---

### 3.5 Buttons

**CG rules: CG-9, CG-11 (no full accent fill), CG-13 (btn border = groove edge)**

#### Primary Button (`.btn-primary-m`, `.quiz-btn-primary`)

| State | Background | Text | Shadow | Rim | Border |
|-------|-----------|------|--------|-----|--------|
| **Base** | `var(--color-ink-1)` approx (dark warm ink, L ~18%) | `var(--color-surface-card)` (cream text) | SH-btn | `var(--color-rim-btn)` inset top | none |
| **Hover** | 5–8% lighter than base (stays warm dark) | same | SH-btn + 1px stronger | Rim slightly brighter | — |
| **Active/Press** | 5% darker than base | same | SH-groove (inset) replaces SH-btn | Rim dims | — |
| **Focus** | Base | same | SH-btn + focus ring `var(--color-accent-focus)` 3px | — | — |
| **Disabled** | Base at 40% opacity | 40% opacity | none | none | — |

**Rule:** The top-edge rim light on the primary button is its only amber-gold element. The button body is dark ink, never amber.

#### Secondary / Outline Button (`.btn-outline-m`)

| State | Background | Text | Border | Transition |
|-------|-----------|------|--------|-----------|
| **Base** | transparent | `var(--color-ink-2)` | `1px solid var(--color-ledger-section)` (warm brown, not cold grey) | — |
| **Hover** | transparent | `var(--color-ink-1)` | `1px solid rgba(120,85,30,0.45)` (deepens) | 150ms ease-out |
| **Active/Press** | `rgba(120,85,30,0.06)` | `var(--color-ink-1)` | Same as hover | — |
| **Focus** | transparent | `var(--color-ink-1)` | Hover state + focus ring `var(--color-accent-focus)` 3px | — |
| **Disabled** | transparent at 40% opacity | 40% opacity | 40% opacity | — |

#### Ghost Button (`.btn-ghost-m`)

| State | Background | Text | Treatment |
|-------|-----------|------|-----------|
| **Base** | transparent | `var(--color-ink-2)` | No border, no shadow |
| **Hover** | `rgba(120,85,30,0.06)` | `var(--color-ink-1)` | 150ms ease-out |
| **Active** | `rgba(120,85,30,0.10)` | `var(--color-ink-1)` | — |
| **Disabled** | transparent 40% opacity | 40% opacity | — |

---

### 3.6 Inputs / Textarea / Select

**CG rules: CG-9, CG-13 (input border = groove edge special rule), CG-14**

| State | Background | Border | Left border | Shadow | Placeholder |
|-------|-----------|--------|-------------|--------|-------------|
| **Base** | `var(--color-surface-recessed)` | `1px solid var(--color-input-border)` (all sides) | same | SH-groove | `var(--color-ink-3)` |
| **Hover** | `var(--color-surface-recessed)` | slightly deeper: `rgba(120,85,30,0.32)` | same | SH-groove | — |
| **Focus** | `var(--color-surface-recessed)` | 3 sides stay `var(--color-input-border)`; **left border** → `3px solid var(--color-input-border-foc)` | `var(--color-input-border-foc)` | SH-groove + focus ring `var(--color-accent-focus)` 3px spread | — |
| **Disabled** | `color-mix(in srgb, var(--color-surface-recessed) 80%, var(--color-bg) 20%)` | 40% opacity border | — | none | 40% opacity |
| **Error** (if applicable) | same | Left border → warm rust: `rgba(160,60,20,0.65)` | warm rust | SH-groove | — |

**Textarea:** Add `resize: none` (or allow vertical only). Hide system resize handle via `::webkit-resizer` or use CSS `resize: vertical` with a custom warm indicator.

**Select:** System arrow replaced or hidden; custom chevron using `var(--color-ink-2)` color; open animation `transform-origin: top center`, 180ms ease-out.

**Font:** D2 humanist sans (labels) or D1 serif (if reading-type input). Placeholder always D2.

---

### 3.7 Tabs

Two tab systems exist. Both follow the same CG rules but differ in context.

**CG rules: CG-9, CG-11 (amber bottom line = 1 accent point), CG-13**

#### Word List Tabs (`#tabGroup`: 今日 / 複習 / 全部)
— See Section 3.3b for full spec.

#### Article Input Tabs (`.input-tab`: 手動 / 網址 / 圖書館)

| State | Background | Text | Bottom line | Transition |
|-------|-----------|------|-------------|-----------|
| **Base (inactive)** | transparent | `var(--color-ink-2)` | `2px solid transparent` | — |
| **Hover** | transparent | `var(--color-ink-1)` | `2px solid transparent` | 150ms color |
| **Active** | transparent | `var(--color-ink-1)`, weight 600 | `2px solid var(--color-accent)` | Underline slides 180–220ms ease-out |
| **Focus** | transparent | `var(--color-ink-1)` | Active state + focus ring | — |

**Same animation rules apply as 3.3b:** no glow, no spring, no fade — the line slides.

---

### 3.8 Badges / Chips / Tags

**CG rules: CG-7 (badges are environment, not anchors), CG-11 (no amber badge bg), CG-14 (D2 sans + tabular for numbers)**

**Global badge rules:**
- `border-radius`: maximum `--radius-badge-max` (4px) — no `border-radius: 9999px`
- Font: D2 humanist sans, weight 600, size 0.6875rem, letter-spacing +0.04em
- No shadow on badges (they are small, flat marks)

| Badge type | Background | Text color | Border | Radius |
|-----------|-----------|------------|--------|--------|
| **Part-of-speech** (n., v., adj.) | `var(--color-badge-pos-bg)` | `var(--color-badge-pos-fg)` | none | 3px |
| **Mastered** | `var(--color-badge-mastered-bg)` | `var(--color-badge-mastered-fg)` | none | 3px |
| **Due** | `var(--color-badge-due-bg)` | `var(--color-badge-due-fg)` | none | 3px |
| **Enrich TR** | `var(--color-badge-enrich-bg)` | `var(--color-badge-enrich-fg)` | none | 3px |
| **Enrich GR** | `var(--color-badge-enrich-bg)` | `var(--color-badge-enrich-fg)` | none | 3px |
| **Navbar `.chip`** (Mastered / Due count) | `var(--color-chip-navbar)` = `rgba(200,180,140,0.35)` | `#fff` (on dark header bg) | none | 4px |
| **`.reader-enrich-tag`** | `var(--color-badge-enrich-bg)` | `var(--color-badge-enrich-fg)` | none | 3px |

**Numeric values in badges:** Apply D4 rules — `font-variant-numeric: tabular-nums`.

**Prohibited:**
- `border-radius: 9999px` (pill shape)
- `var(--color-accent)` as badge background color
- Cold-green (`#EEF2E8` / `#7a9068`) or cold-blue (`#EAF0FB` / `#5577AA`) backgrounds — replace with warm brown system

---

### 3.9 Pager

**Storyboard:** Scene F — ledger chapter-end page marker.
**CG rules: CG-9, CG-11 (no amber bg fill), CG-13**

**HTML target:** Prev/Next `<button>` elements + page-count `<span>` at the bottom of each word-list tab (今日 / 複習 / 全部) inside `#wordListCard`.

#### State Machine

| State | Background | Text | Border | Shadow | Outline |
|-------|-----------|------|--------|--------|---------|
| **Base** | transparent | `var(--color-ink-2)` | `1px solid var(--color-input-border)` | none | none |
| **Hover** | transparent | `var(--color-ink-1)` | `1px solid var(--color-input-border-foc)` | none | none |
| **Active (press)** | transparent | `var(--color-ink-1)` | hover border | `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(42,35,22,0.18)` | none |
| **`:focus`** | — | — | — | — | `none` (remove browser default) |
| **`:focus-visible`** | — | — | — | — | `2px solid var(--color-accent-focus)` + `outline-offset: 2px` |
| **Disabled** | transparent | `var(--color-ink-3)` | 45% opacity | none | none |

**Disabled isolation:** `opacity: 0.45` on the disabled button + `pointer-events: none` as defensive layer. Project JS uses native `btn.disabled = true/false` — native `disabled` removes the element from tab order automatically. No `aria-disabled` attribute needed.

#### Visual Contract

- **Hover must not fill background.** `hover:bg-gray-*` is prohibited in pager scope. Only text and border deepen on hover.
- **Active is an inset press-mark, not a fill.** Upper inset highlight + lower inset shadow = physical press against paper.
- **`:focus` and `:focus-visible` are split.** Mouse click clears to `outline: none`. Keyboard navigation shows amber ring via `:focus-visible` only.
- **Disabled is visually distinct from base.** `opacity: 0.45` + `ink-3` text — faded old ink, not the same grey as an inactive button.

#### Page Count Span

- Color: `var(--color-ink-2)` — muted warm brown. Never `text-gray-500`.
- Font: D4 numeric rules (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum"`).

#### Prohibited

- `bg-gray-100`, `hover:bg-gray-200`, `text-gray-500` — all cold-grey classes cleared
- Amber (`var(--color-accent)`) as background on any pager element — page number can use accent as **text color** only, never background
- `:focus` and `:focus-visible` sharing the same outline declaration — they must be in separate rule blocks
- `aria-disabled` attribute — not used; native `disabled` only

---

## 4. Acceptance Checklist

All items are visually verifiable without code inspection.

| # | Item | How to verify |
|---|------|---------------|
| 1 | **Background is never a flat solid color** | Zoom browser to 50%. Background must show faint grain texture at close inspection. A completely smooth, zero-grain surface is a failure. |
| 2 | **No pure-white surface exists anywhere** | Use browser color picker (DevTools eyedropper) on any "white-looking" surface. RGB must show R > G > B with measurable warm offset. `rgb(255,255,255)` anywhere is a failure. |
| 3 | **No cold-grey or cold-blue text exists** | Use color picker on any grey-appearing text. Hue must be in the 20–50° range (warm brown). Any text with hue 180–270° (cool) is a failure. |
| 4 | **All shadows point right-and-down (not symmetric)** | On any card or container, the right and bottom edges must appear darker/further than the top and left edges. A shadow with equal dark on all four sides is a failure. |
| 5 | **Modal overlay is warm brown, not cold black; background texture remains visible** | Open any modal. Look at the page area outside the modal. The area should appear in a warm brownish dim, and the parchment texture of the background should still be faintly perceptible. If the background appears pure black or textureless, the overlay alpha is too high. |
| 6 | **Page corners are darker than page center** | Take a screenshot. Sample a pixel from the center and from each corner. The corner lightness value must be 5–12% lower than the center. |
| 7 | **Primary button is dark ink, not amber gold** | The primary button body must appear in the dark warm-brown family. If the button is visually amber or gold-colored, the accent rule has been violated. |
| 8 | **Input focus ring is amber, not blue or purple** | Click any input. The focus ring/outline must appear in the amber-gold family. Any blue or indigo focus ring is a failure. |
| 9 | **Active tab uses only a bottom underline for emphasis, not a background fill** | Activate any tab. The tab's differentiation must come from its bottom border color, not from a background color change that covers the full tab area. |
| 10 | **Tab underline slides (does not appear/disappear instantly or bounce)** | Click between tabs quickly. The amber bottom line must appear to slide from one tab to the next in 180–220ms. An instant jump, a fade, or a spring-back bounce are all failures. |
| 11 | **All badge shapes have visible corners (no pill shape)** | Inspect any badge. The corners must be slightly rounded (≤4px) and visibly angular. A fully rounded pill shape is a failure. |
| 12 | **Word list panel appears heavier/deeper than section cards** | Compare the background color of `#wordListCard` to `#articleInputSection`. The panel must appear measurably darker. If they are identical in shade, the depth hierarchy is missing. |
| 13 | **Shadow color is warm, not cold black** | Use DevTools to inspect the `box-shadow` of any card. The color component must be `rgba(80, 50, 15, x)` or a visually equivalent warm brown, never `rgba(0,0,0,x)`. |
| 14 | **Row dividers use the correct scheme per tab** | Switch to "今日" tab — row separation is gap + faint line. Switch to "全部" tab — alternating slight tone difference visible. The two tabs must have visually different row-separation approaches. |
| 15 | **No container edge is visible after removing shadows** | In DevTools, temporarily set `box-shadow: none` on a section card. The card boundary must become unclear or invisible (it fades into the background). If the card stays clearly outlined, there is a `border` that must be removed. |
| 16 | **Ledger lines are warm brown, not cold grey** | Use color picker on any horizontal row divider. The color must be in the warm brown family (hue 25–45°). Any divider with hue > 180° (cold) is a failure. |
| 17 | **Amber accent appears in at most 3–4 visible points at once** | Scroll to a state where 2 word cards are expanded, one tab is active, and one input is focused. Count the amber-gold elements. Should be ≤4. If more amber appears, there is a budget violation. |
| 18 | **Card expand/collapse feels like paper unrolling, not a toggle** | Expand a word card. The motion must unfold downward over 280ms with ease-out deceleration. Any bounce, snap, or spring finish is a failure. |
| 19 | **Parchment texture is present on card surfaces but not distracting** | Look at an open word card at normal reading distance. If the texture is immediately obvious and calls attention to itself, the opacity is too high. If a screenshot converted to grayscale shows no surface variation at all, the texture is missing. |
| 20 | **The design reads as a period workshop, not a SaaS with a warm color palette** | Convert a full screenshot to grayscale. The layout hierarchy, depth relationships, and spatial rhythm must still feel different from a generic card-based productivity app. If the grayscale version is indistinguishable from the Morandi SaaS version, the material and depth system has not been implemented — only the colors changed. |

---

## Appendix: Illustrative CSS Snippets

> These are illustrative only — not complete implementation. They exist to clarify specific spec behaviours that are hard to describe in prose. Do not use these directly without integrating with the full token system.
>
> **Implementation flexibility:** Snippets show one viable approach per spec requirement, not the only approach. Where a snippet relies on JS/DOM (e.g., `data-row-mod` attributes, CSS custom property updates via script), pure-CSS alternatives are equally valid — for example, `:nth-child(3n)` / `:nth-child(3n+1)` / `:nth-child(3n+2)` for ledger-line alpha cycling, or inline `style` written once at render time. The constraint is the visual output specified in Section 3, not the mechanism used to achieve it.

### A1. Shadow Ladder (two examples)

```css
/* SH-1: Section card — directional, warm */
.section-card {
  box-shadow:
    2px 4px 16px rgba(80, 50, 15, 0.10),        /* directional drop */
    inset 0 1px 0 rgba(255, 220, 140, 0.30);     /* top rim light */
}

/* SH-3: Modal — elevated, warm, double rim */
.modal {
  box-shadow:
    3px 8px 28px rgba(80, 50, 15, 0.22),
    inset 0 1px 0 rgba(255, 220, 140, 0.35),     /* top rim */
    inset 1px 0 0 rgba(255, 220, 140, 0.20);     /* left rim */
}
```

### A2. Body Texture Layer (M-1)

```css
/* M-1: Ground texture — fine grain on body */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.025;                /* 2–3% */
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,...");
  /* SVG uses <feTurbulence type="fractalNoise" baseFrequency="0.75"
     numOctaves="4" seed="12" /> — seed is fixed, not random */
}
```

### A3. Vignette (CG-4)

```css
/* Full-page lens vignette — fixed, pointer-events off */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 55%,
    rgba(40, 25, 8, 0.12) 100%
  );
}
```

### A4. Input Focus (CG-13 special rule)

```css
/* Left border deepens on focus; other three sides stay base */
input:focus {
  outline: none;
  border-color: var(--color-input-border);       /* 3 sides stay base */
  border-left-color: var(--color-input-border-foc);  /* left deepens */
  border-left-width: 3px;
  box-shadow:
    inset 0 1px 3px rgba(80, 50, 15, 0.12),     /* SH-groove retained */
    0 0 0 3px var(--color-accent-focus);          /* amber focus ring */
  transition: border-left-color 150ms ease-out, box-shadow 120ms ease-out;
}
```

### A5. Tab Underline Slide (CG-11 / motion tokens)

```css
/* The underline is a single pseudo-element that translates to active tab */
.tab-underline {
  position: absolute;
  bottom: 0;
  height: 2px;
  background: var(--color-accent);
  /* width and left set via JS/CSS custom properties */
  transition: left 200ms cubic-bezier(0.25, 0, 0.0, 1),
              width 200ms cubic-bezier(0.25, 0, 0.0, 1);
  /* NO filter/box-shadow glow on this element */
  /* NO spring overshoot in easing */
}
```

### A6. Ledger Line Alpha by Row Index

```css
/* Applied by JS setting data-row-index on each card */
.wc-card:not(:last-child) { border-bottom-width: 1px; border-bottom-style: solid; }
.wc-card[data-row-mod="0"]:not(:last-child) { border-bottom-color: var(--color-ledger-hi); }
.wc-card[data-row-mod="1"]:not(:last-child) { border-bottom-color: var(--color-ledger-mid); }
.wc-card[data-row-mod="2"]:not(:last-child) { border-bottom-color: var(--color-ledger-lo); }
/* data-row-mod = index % 3 — set once on render/sort, not on every paint */
```

---

## 5. Spec Deviation Notes

### 5.1 border vs SH-1 Conflict

**Background:** The section card spec (§3.2) requires depth from shadow only — `border: none`, depth established by SH-1. This conflicts with any legacy or future version of the component that applies `border: 1px solid` as a structural edge.

**Current implementation decision:** `border: none` — depth is built from `--shadow-sh1` (SH-1 drop shadow + rim inset) alone. Acceptance Checklist item 15 is the verification test: set `box-shadow: none` on a section card; the card boundary must become unclear or invisible. If the card edge remains clearly visible, a `border` property is present and must be removed.

**If a groove border is introduced in future:** Before adding any `border` to section cards, update **both** of the following in sync:

1. **§3.2 Section Cards** — change the `Border` column from `none` to the new groove border token, and add a sentence classifying the border as a groove-edge (CG-13 special rule, same semantic as input borders) rather than a UI border.
2. **CG-2 in `storyboard.md`** — update the "唯一例外" rule to include the new border type, and re-run the "remove box-shadow" verification to confirm the card still passes.

Keeping both documents in sync prevents the spec from drifting into contradiction between the storyboard constraint and the compiled implementation.
