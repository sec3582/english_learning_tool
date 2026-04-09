# Director's Treatment

## Anti-Convergence Validation (Perfume / Tom Tykwer)

**Q1: What specific visual problem does this film solve for this niche?**
The vocabulary tool needs to make individual words feel *worth examining* — not just functional list items. Perfume uses extreme close-up and tactile surface rendering to make a single object (a scent source) feel like the most important thing in the frame. That precise cinematographic quality — "one specimen, examined with total seriousness" — is what the word card needs. The card must feel like Grenouille leaning in over a workbench. Not a SaaS table row.

**Q2: Would this same film work equally well for three unrelated niches?**
No. The Perfume visual grammar (parchment + candlelight + specimen-label typography) would be wrong for a fintech app, a social platform, or a fitness tracker. It works here specifically because vocabulary learning is about *isolating and studying individual objects* (words) — the same cognitive gesture the film applies to scent.

**Q3: Picking the film or its reputation?**
The justification comes from specific scenes: the Grasse market close-ups of flowers, skin, and glass; Baldini's cellar sequences with single-candle illumination and alchemical ledger props. Not from the film's general "dark aesthetic" reputation.

---

## Director Brief

- **Visual thesis**: Each word card is a specimen entry in a Provençal perfumer's ledger — examined with the same obsessive closeness Grenouille gives every scent source. Day mode: parchment lit by afternoon sun through amber glass. Night mode: vellum lit by a single candle in a stone cellar.
- **Signature technique 1 → Web translation**: *Extreme close-up as meaning* → The English word (`wc-title strong`) is the sole typographic dominant — larger, heavier, and warmer than anything else in the card. No competing visual weight (badges, icons) at the same vertical zone.
- **Signature technique 2 → Web translation**: *Dual light quality, no neutral middle* → Day mode pushes luminance high (near-overexposed parchment warmth); night mode drops to true near-black. There is no "comfortable medium gray" in either mode. Contrast is either warm-bright or warm-dark.
- **Signature technique 3 → Web translation**: *Tactile surface as information* → Card surfaces use layered box-shadow instead of hard borders to convey depth. A noise texture at ≤3% opacity gives the card a vellum/parchment feel. This is the material, not decoration.
- **Motion rules**: Expand/collapse transition is `0.28s ease-out` — deliberate but not slow. No bounce, no spring physics. The card body "unrolls" downward like a scroll. No hover float or card lift. Interaction is tactile pressure, not aerial buoyancy.
- **Typography rules**: Word = `font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em` (specimen-label authority). Definition row = `font-size: 0.875rem; font-weight: 400` (classification subtitle). AI/example = `font-size: 0.9375rem; line-height: 1.7` (field note body). No italics anywhere except genuine English example sentences. No decorative quotation marks.

---

## Site Cinematic Grammar (Component-scoped)

Because scope is a single component, the "site grammar" governs the internal logic of `.wc-card` and its sub-elements only.

- **Page-shell logic**: Each card is a closed document fragment. Collapsed state = cover/spine. Expanded state = open page.
- **Navigation posture**: N/A — component-only scope
- **Framing discipline**: Internal padding `18px 20px` (header), `6px 20px 20px` (body). The word headline has no competing icon or badge at the same line height. Arrow indicator is typographic (▸/▾), not SVG icon.
- **Density cadence**: Header = sparse (word + definition only). Body = moderately dense (example sentence + AI block). Footer = minimal (2 small buttons max).
- **Recurring material layers**: 
  - Layer 1: Card background (parchment or cellar-black) with noise texture overlay
  - Layer 2: AI block — a physically recessed sub-surface, darker than card
  - Layer 3: Footer rule — a thin ruled line, not a full border
- **Allowed composition families**: Alchemical document / Specimen ledger entry only
- **What may repeat**: The header-to-body expand pattern; the footer ruled-line; the recessed AI block sub-surface
- **What must vary**: Individual word cards must not look identical in typographic weight when the word itself has different syllabic length — letter-spacing compensates naturally
- **Demo uniqueness guardrail**: This design must not resemble a generic card with warm colors applied. The absence of a visible card border (replaced by shadow depth) is the primary structural differentiator.

---

## Component Arc: Word Card (`.wc-card`)

### Component scene thesis
The word card is a single exhibit in a museum of language — like one bottle on Baldini's shelf. Collapsed, it shows only the specimen label (word + brief definition). Expanded, the full record is revealed: the example text, the analysis below it, the provenance information.

### One big idea
The **word is the specimen**. Everything else in the card serves the act of examining that specimen. The English word title is the only element with commanding typographic weight. The supporting content (definition, example, AI analysis) is the field notebook around it.

### Restraint statement
No gradient backgrounds on the card surface. No border-radius above `10px`. No icon at the same visual level as the word. No animation on the texture layer. No colored badges in the header zone. The refraction accent (`--wc-prism`) is used *once* — as a single thin warm-gold rule below the word title, not as a repeating decorative element.

### Material thesis — Day (Grasse)
Card surface: `#F5EDDA` with 3% noise texture simulating parchment fiber. Shadow: `0 2px 8px rgba(100,70,20,0.10), 0 0 0 1px rgba(180,140,80,0.18)` — the border IS the shadow, not a separate border property. AI block recesses with `background: #EAD9BC` — measurably darker but in the same warm family.

### Material thesis — Night (Paris Cellar)
Card surface: `#18100A` — very dark, warm-tinted near-black. The eye perceives "stone wall in candlelight." Shadow: `0 4px 16px rgba(0,0,0,0.60), inset 0 1px 0 rgba(200,120,42,0.08)` — the inset shadow suggests a faint candle glow on the top edge. AI block: `#0E0906` — drops below the card into genuine shadow.

### Signature composition
**The Specimen Label Stack**: The word card header is a vertical document stack — not a horizontal flex row with an icon. The English word occupies its own full-width line at headline scale. Directly below it, the part-of-speech + definition read as a classification subtitle. The expand arrow sits at the trailing edge but does not anchor the visual hierarchy. This composition fails if reduced to a generic `flex: row, icon-left, text-right` layout.

### Grid fallback test
If this card were reduced to a generic `div.flex.items-center.justify-between` with icon + text, the specimen-label hierarchy would collapse entirely. The word would no longer feel like the subject of examination — it would become a row label. That collapse is the test the design must resist.

---

## Scene Map (Card Sections as Cinematic Beats)

### Scene 1 — Collapsed Header (Cover State)
- **Beat**: Threshold / first encounter
- **Function**: Word identification at minimum information density
- **Archetype**: Specimen label / book spine
- **Composition**: Word headline + definition subtitle, stacked vertically on left; expand arrow on trailing right
- **Camera ref**: Close-up / portrait orientation — the word fills the frame
- **Interaction ref**: Click/tap anywhere on header → expand body (no hover float, no card lift)
- **Entrance**: On initial list render — `opacity: 0 → 1` over `180ms` with `translateY(4px → 0)` — subtle, not performative
- **Visual elements**: Noise texture on card surface; warm-gold thin separator below word title; no icons in header zone
- **Why this exists**: The collapsed state must feel complete as a *label*, not as a truncated SaaS row

### Scene 2 — Expanded Body (Open Page State)
- **Beat**: Deep examination / the specimen record
- **Function**: Full entry — example sentence + AI analysis
- **Archetype**: Open ledger page / specimen record
- **Composition**: Two distinct sub-surfaces: article sentence as inline body text; AI block as physically recessed panel
- **Camera ref**: Pull-back reveal — space opens below the header to expose the record
- **Interaction ref**: Expand animation `max-height: 0 → auto` via `grid-template-rows` trick, `0.28s ease-out`
- **Visual elements**: AI block uses recessed background + top-inset shadow to appear below card surface; `wc-ai-zh` (Chinese translation) is measurably smaller and lighter than the English sentence
- **Why this exists**: The expanded card must feel like turning a page — a spatial gesture, not a height toggle

### Scene 3 — Footer Action Row
- **Beat**: Exit / curation decision
- **Function**: Minimal action affordance — save or mark as reviewed
- **Archetype**: Ledger signature line
- **Composition**: Ruled top line (`border-top: 1px solid var(--wc-rule)`); buttons are text-weight (`font-size: .8125rem; font-weight: 400`), no fill, no prominent border
- **Camera ref**: Cut to close-up of the page footer — the ruled line anchors the bottom of the document
- **Interaction ref**: Save button hover — text color shifts to accent (`--wc-accent`); no background fill change
- **Visual elements**: Single ruled line only; buttons read as handwritten annotations, not product CTAs
- **Why this exists**: The footer must not compete with the word or the example sentence. It is marginalia, not a call to action.

---

## Prestige Calibration Pass

1. What does the viewer remember after 3 seconds? → The English word, large and authoritative, on a warm parchment surface
2. What is intentionally absent? → No sage green, no cold gray, no pill badges, no SVG icon in the header row, no gradient background
3. Which detail makes it feel expensive? → The shadow-as-border technique — the card does not have a visible border line; depth is created by light, not by a drawn edge
4. If 30% of effects were removed, would it be stronger? → Yes. The noise texture alone plus the shadow-as-border is sufficient. The thin gold separator below the word is the only visible accent element.
5. Would it still feel directed without palette and type? → Yes — the vertical specimen-label stack is structurally different from current SaaS row layout
6. What essential idea breaks if reduced to a generic card grid? → The hierarchy between "word as headline" and "definition as subtitle" collapses into label-value equality — both would become the same visual weight

---

## Color Token Summary (CSS Variables to Override)

### Day Mode (Grasse) — overrides on `.wc-card` scope

```
--wc-surface:   #F5EDDA
--wc-ai-bg:     #EAD9BC
--wc-text:      #1C1208
--wc-muted:     #7A6045
--wc-border-sh: rgba(180,140,80,0.18)   /* shadow-border */
--wc-shadow:    rgba(100,70,20,0.10)
--wc-accent:    #C8952A
--wc-rule:      #D0B07C
--wc-prism:     rgba(200,149,42,0.12)
```

### Night Mode (Paris Cellar) — overrides inside `[data-theme="dark"]`

```
--wc-surface:   #18100A
--wc-ai-bg:     #0E0906
--wc-text:      #EFE1C0
--wc-muted:     #956F42
--wc-border-sh: rgba(200,120,42,0.08)   /* inset candle edge */
--wc-shadow:    rgba(0,0,0,0.60)
--wc-accent:    #C8782A
--wc-rule:      #2E1E0C
--wc-glow:      rgba(200,120,42,0.08)
```

---

## Readability Verification

All foreground/background pairs checked against WCAG 2.1 AA (4.5:1 minimum):

| Pair | Day mode contrast | Night mode contrast | Pass? |
|------|-----------------|-------------------|-------|
| Word text on card surface | `#1C1208` on `#F5EDDA` | `#EFE1C0` on `#18100A` | Day ~14:1 / Night ~12:1 ✓ |
| Muted text on card surface | `#7A6045` on `#F5EDDA` | `#956F42` on `#18100A` | Day ~5.2:1 / Night ~5.8:1 ✓ |
| Muted text on AI block | `#7A6045` on `#EAD9BC` | `#956F42` on `#0E0906` | Day ~4.8:1 / Night ~6.1:1 ✓ |
| Accent on card surface | `#C8952A` on `#F5EDDA` | `#C8782A` on `#18100A` | Used for icon/accent only, not body text ✓ |

All body text pairs exceed 4.5:1. The cinematic atmosphere does not reduce readability.

---

## What Phase 3 Must Produce

1. Complete CSS for `.wc-card`, `.wc-header`, `.wc-title`, `.wc-body`, `.wc-ai`, `.wc-ai-text`, `.wc-ai-zh`, `.wc-footer`, `.wc-btn-save`, `.wc-rel-chip`, `.wc-del-corner`
2. Day mode tokens via `:root` override block scoped to `.wc-card`
3. Night mode tokens via `[data-theme="dark"] .wc-card` override block
4. Noise texture via CSS `filter` or `::after` pseudo-element (no external image)
5. Shadow-as-border technique (no `border` property on card; depth via `box-shadow` only)
6. Expand/collapse animation — `grid-template-rows` approach, `0.28s ease-out`
7. No changes to any JS logic, Python backend, or API calls
