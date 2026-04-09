# Design Decisions

- Entry mode: Direct project settings (user pre-answered questionnaire)
- Genre: Period / Baroque / Sensory-psychological
- Director: Tom Tykwer
- Film: Perfume: The Story of a Murderer (Das Parfum, 2006) — DP: Frank Griebe
- Niche: English vocabulary learning tool (single-page application)
- Pages: Single-page app — scope is ONE component only: the main word display section (`.wc-card` and its children)
- Major page roles: Word card (`.wc-card`) — header, body, AI analysis block, footer action row
- Image placeholders: None (application UI, not marketing site)
- Sub-agent delegation plan: None — scope is small enough for one lead agent

---

## Demo Uniqueness Audit

- Previous-work audit: Current design is Morandi sage-green SaaS flat-card theme. Light mode uses `#F2F3EE` background, `#A3B18A` primary, white cards, gray borders. Dark mode uses deep navy `#0d1321` with `#1d2d44` cards and `#748cab` accents. Entirely neutral and cold — no material depth, no warmth, no cinematic quality. Typography is system-default.
- Recurring traits to avoid: Flat white/navy cards, pill badges in sage green, cold gray muted text, border-only visual hierarchy
- Shell-ban list:
  - ❌ White or near-white card on neutral gray background
  - ❌ Navy/slate dark mode with cold blue-gray accents
  - ❌ Sage-green primary accent in any form
  - ❌ Generic rounded-12px card with 1px border only
  - ❌ Muted text in cool gray tones (#6B7280)
  - ❌ Icon-heavy action rows as the primary visual anchor
- Primary composition family: **Alchemical document** — each word card is a specimen page from an 18th-century perfumer's ledger, not a SaaS data widget
- Why this family differs from the most recent output: Current shell is "productivity app card"; new shell is "period document with material depth and atmospheric light"
- Wireframe-level uniqueness test: If all color and type styling were removed, the current card reads as a generic accordion list. The new card must read as a columnar document fragment with distinct typographic hierarchy — word as headline, definition as subtitle, examples as body text with a physically distinct container.

---

## Research Notes

### Research Boundary
- Film research is observational input, not a spec: The Grasse and Paris cellar scenes are emotional sources — they give light quality, material texture, and atmospheric temperature. They are NOT component blueprints.
- What is being translated into web language: The *quality of light* (prismatic day vs. amber candlenight), the *material feel* of surfaces (parchment, vellum, dark wax, stone), and the *typographic posture* (a ledger or specimen label, not a product card)
- What must not be flattened into product-template logic: The prismatic refraction effect must not become a gradient strip decoration. The candlelight must not become a generic orange dark-mode theme. Both must feel *atmospheric*, not *cosmetic*.

### Research Sources
- Director source: Tom Tykwer, known for Run Lola Run (kinetic) and Perfume (sensory-baroque) — for this project, drawing ONLY from Perfume's visual grammar
- Film source: Perfume: The Story of a Murderer (2006) — cinematographer Frank Griebe; shooting locations include Perfume Museum Grasse and Prague standing sets for Paris
- Secondary analysis: The film's palette has been described as "old master painting with modern depth of field" — Caravaggio-quality chiaroscuro for interior night, Vermeer-quality warm daylight for exterior
- Niche source 1: N/A (application UI — no premium marketing site comparisons needed for a component redesign)
- Niche source 2: N/A

### Film Palette — Grasse (Day Mode)

| Role | Token name | Value | Source |
|------|-----------|-------|--------|
| Card surface | `--wc-bg` | `#F5EDDA` | Parchment/vellum in open-air market |
| Deep card (AI block) | `--wc-ai-bg` | `#EAD9BC` | Aged paper, deeper parchment |
| Primary text (word) | `--wc-text` | `#1C1208` | Dried ink on vellum |
| Secondary text (def) | `--wc-muted` | `#7A6045` | Brown ink, faded with age |
| Border / edge | `--wc-border` | `#C9AC78` | Amber-tinted ruled line |
| Accent glow | `--wc-accent` | `#C8952A` | Sun through amber glass |
| Refraction shimmer | `--wc-prism` | `rgba(200,149,42,0.10)` | Prismatic light scatter, warm |
| Footer divider | `--wc-rule` | `#D4BB8E` | Ruled ledger line |

### Film Palette — Paris Cellar (Night Mode)

| Role | Token name | Value | Source |
|------|-----------|-------|--------|
| Card surface | `--wc-bg` | `#18100A` | Deep cellar stone, near-black with warm undertone |
| Deep card (AI block) | `--wc-ai-bg` | `#0E0906` | Recess below candlelight reach |
| Primary text (word) | `--wc-text` | `#EFE1C0` | Vellum lit by candle |
| Secondary text (def) | `--wc-muted` | `#956F42` | Amber-tinted shadow text |
| Border / edge | `--wc-border` | `#3A2710` | Barely-visible edge in shadow |
| Accent glow | `--wc-accent` | `#C8782A` | Candleflame amber |
| Candlelight ambient | `--wc-glow` | `rgba(200,120,42,0.10)` | Warm inner glow on card surface |
| Footer divider | `--wc-rule` | `#2E1E0C` | Shadow-level ruled line |

### Director Signatures
1. **Extreme close-up as meaning** → Applied as: The English word is typographically oversized, treated as a specimen label. It occupies more vertical space than current implementation. It does not compete with badges or icons.
2. **Split between overexposed warmth and deep chiaroscuro** → Applied as: Day mode uses near-overexposed warm parchment (slightly high luminosity); night mode drops to very deep near-black — no compromise mid-tones in either mode.
3. **Tactile surface as sensory poetry** → Applied as: The card has a material depth via layered box-shadows (day: warm spread glow; night: sharp inner shadow + amber edge glow). A noise/grain texture overlay at ~3% opacity on the card surface.

### Film Translation Notes
- Framing: Each word card is framed like a herbarium specimen or perfumer's entry — the word is the specimen name, the definition is the classification line, the example sentence is the field note
- Rhythm: Cards expand downward like a scroll being unrolled — expand/collapse should feel deliberate, not snappy
- Lighting: Day — scattered warm light from above-left (parchment lit by window); Night — single point of amber light from below (candle on desk)
- Space: Internal padding increases slightly from current (12–14px → 16–18px) to give the document feel more breathing room
- Materiality: Box-shadow replaces hard borders as the primary depth cue; both modes use shadow layers instead of border-only separation
- What should stay ambiguous or restrained: The grain/texture effect must stay below visible threshold during reading — it only becomes perceptible when the eye is at rest. Never animate the texture. Never make refraction a moving rainbow stripe.
