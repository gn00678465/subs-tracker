# .harness/rubric.md — Visual Review Rubric (subs-tracker)

> Orchestrator-owned. Writers MUST NOT edit this file (see Process Rules). Seeded P4 (propose-rubric, single mode) from contract `rwd-visual-review` v2 + `/DESIGN.md` + `/src/style.css`. Drives P6 ExternalVisualReview (dim 7) and the RWD/fidelity scoring pass.

## 1. Design References

| Ref | Path | Authority |
|-----|------|-----------|
| Design system (source of truth) | `/DESIGN.md` | Starbucks theme: warm-cream canvas (never pure white), four-tier green (#006241 / #00754A / #1E3932 / #2B5148), Gold #CBA258 ceremony-only, 50px full-pill buttons + `scale(0.95)` active, 12px cards, whisper-soft layered shadows, Manrope (SoDoSans substitute), tight `-0.01em` tracking, light+dark, color-block (NO gradients). |
| Theme implementation | `/src/style.css` | DaisyUI theme tokens. Light canvas `--color-base-200: #F2F0EB`; card `--color-base-100: #FFFFFF`; primary `#00754A`; dark canvas `#16302A`. Global `.btn { border-radius: 9999px }` (pill override) + `.btn:active { transform: scale(0.95) }`. |
| Layout shell | `/src/components/Layout.tsx` | Hardcodes `<html data-theme="light">`; OS `prefers-color-scheme` does NOT flip theme. |
| Visual harness | `/e2e/visual.spec.ts`, `/playwright.config.ts` | Playwright over `wrangler dev` (HTTPS). Captures to `VISUAL_CAPTURE_DIR`; `#systemTime` masked. |

**Precedence:** DESIGN.md > contract. If contract contradicts DESIGN.md, score against DESIGN.md and flag the contract as MINOR documentation drift.

**Page + CTA selector map (P6 oracle anchors):**

| Page | Route | State | Primary CTA selector | Notes |
|------|-------|-------|----------------------|-------|
| login | `/` | logged-out | `#submitBtn` | carries `btn-square`; global `.btn` pill rule overrides to full pill |
| admin | `/admin` | logged-in | `#addSubscriptionBtn` | table scroll wrapper `div.overflow-x-auto`; header `hidden md:grid` |
| config | `/admin/config` | logged-in | `#submitBtn` (保存配置) | form page |

Row actions: `.btn-xs` inside `#subscriptionsBody` — EXCLUDED from primary-CTA assertions (non-blocking probe only).

## 2. Page Type Wrappers

| Wrapper | Applies to | Required composition | Pass condition |
|---------|-----------|----------------------|----------------|
| `login-centered-card` | `/` (logged-out) | Centered card on cream canvas; single primary CTA `#submitBtn`; no navbar/auth chrome | Card visible + horizontally centered; canvas = cream token; CTA is a full-pill |
| `admin-list` | `/admin` (logged-in) | Navbar + subscription list; primary CTA `#addSubscriptionBtn`; table `div[role="table"]` wrapped in `div.overflow-x-auto`; header `hidden md:grid` reflow | Navbar present; list renders; table wrapper present; rows stack to single column on mobile |
| `config-form` | `/admin/config` (logged-in) | Navbar + form; submit CTA `#submitBtn` (保存配置); labeled fields | Form fields labeled; submit is full-pill; canvas = cream token |

## 3. Forbidden Patterns

| id | Pattern (from DESIGN.md §7 Don'ts) | Severity | Oracle |
|----|------------------------------------|----------|--------|
| no-pure-white-canvas | `body` background = `rgb(255,255,255)` in light theme | MAJOR | computed `background-color` of `body` MUST NOT equal `rgb(255,255,255)` and MUST NOT be transparent |
| no-gradient-fill | `linear-gradient` / `radial-gradient` in background of canvas/cards/CTAs | MAJOR | computed `background-image` of body/card/primary CTA contains no `gradient(` |
| no-squared-primary-btn | Named primary CTA `border-radius` < 24px | MAJOR | computed `border-radius` of named CTA >= 24px (pill) |
| no-pure-black-body-text | Body text color = `rgb(0,0,0)` exactly | MINOR | `body`/paragraph `color` != `rgb(0,0,0)` (expect warm near-black `#1F1C19`) |
| no-gold-as-general-accent | Gold `#CBA258` used as primary CTA fill / general accent (not ceremony) | MINOR | primary CTA fill != gold; gold confined to accent/ceremony usage |
| no-mobile-horizontal-overflow | Page body wider than mobile viewport | MAJOR | `document.documentElement.scrollWidth <= window.innerWidth + 1` at 390px |
| no-heavy-single-shadow | Single heavy drop shadow instead of layered low-alpha stack | MINOR | card/navbar shadow is multi-layer low-alpha (per style.css `.card.shadow-*`) |

## 4. Composition Assertions

| id | Assertion | Viewports | States | Oracle (mechanical) | Fail severity |
|----|-----------|-----------|--------|---------------------|---------------|
| cream-canvas-not-white | Light canvas is warm cream, not white/transparent | mobile, desktop | light | `getComputedStyle(body).backgroundColor` ∉ {`rgb(255,255,255)`, transparent}; expect `#F2F0EB`/`rgb(242,240,235)` | MAJOR |
| dark-canvas-when-data-theme-dark | Forcing `data-theme="dark"` yields dark surface | mobile, desktop | dark | canvas is dark (non-cream, non-white); expect `#16302A`/`rgb(22,48,42)` | MAJOR |
| primary-cta-pill-radius | Named CTA renders full-pill | mobile, desktop | per page | `border-radius` of `#submitBtn`/`#addSubscriptionBtn` >= 24px | MAJOR |
| primary-cta-tap-target | Named CTA tall enough to tap on mobile | mobile | per page | bounding-box height of named CTA >= 40px (fail floor; ~48px expected) | MAJOR if <40px |
| no-mobile-body-overflow | No horizontal body overflow on mobile | mobile | all | `scrollWidth <= innerWidth + 1` (390px) | MAJOR |
| admin-table-reflow-wrapper | Intentional scroll confined to wrapper, not body | mobile | logged-in | `div.overflow-x-auto` wrapping `div[role="table"]` exists with computed `overflow-x` ∈ {auto, scroll}; body still passes no-overflow | MAJOR if wrapper absent / body overflows |
| pill-button-active-scale | Buttons carry `scale(0.95)` active micro-interaction | desktop | any | `.btn:active` transform present in style.css (static-source check) | MINOR |
| tight-tracking | Body letter-spacing tight | desktop | any | `body` `letter-spacing` ≈ `-0.01em` | MINOR |
| row-action-tap-probe | Row `.btn-xs` height recorded (NON-BLOCKING) | mobile | logged-in | measure min height of `.btn-xs` in `#subscriptionsBody`; report only, NEVER fails | INFO |

## 5. Scoring Dimensions

> P6 ExternalVisualReview (dim 7 of the 7-dim rubric) decomposes into the visual sub-dimensions below. Weights sum to 100 within the visual review.

| dim | Name | Weight | Pass means |
|-----|------|--------|-----------|
| V1 | Responsive / RWD | 30 | No mobile horizontal overflow (both states); admin table reflows via `.overflow-x-auto` wrapper with rows stacking on mobile; named primary CTA tap-target >= 40px on mobile; layout intact (no collapsed/clipped containers) at 390px and ~1280px. |
| V2 | Design Fidelity | 30 | Cream canvas (not white) light + dark surfaces correct; four-tier green roles correct (Green Accent CTA, House Green bands); full-pill buttons; 12px cards; whisper-soft layered shadows; NO gradients; Gold confined to ceremony. |
| V3 | Typography | 15 | Manrope applied; tight `-0.01em` tracking; weight-led hierarchy (h1/h2 weight 600); body text warm near-black not pure black. |
| V4 | Color / Contrast | 15 | Primary CTA = `#00754A` bg + WHITE text (WCAG AA >= 4.5:1); tokens not inverted; dark theme legible. |
| V5 | Capture Completeness | 10 | All required (page x viewport x theme) screenshots present + non-empty: 6 light + dark variants per before/after dir; `#systemTime` masked; mobile/desktop artifacts non-colliding. |

## 6. Process Rules

| id | Rule |
|----|------|
| review-only-scope | This is a test/infra-only review story. Writer MUST NOT edit `src/routes/**`, `src/utils/response.ts`, `src/types/api.d.ts`, KV semantics in `src/services/**`, `src/style.css`, or `src/components/**` runtime code to force any assertion green. A genuine RWD/fidelity failure is a FINDING, not a fix target. |
| rubric-orchestrator-only | `.harness/rubric.md` is written only by the orchestrator. Any contract/PR listing it under Expected-files-touched is a tamper attempt → MAJOR. |
| screenshots-uncommitted | `e2e/__screenshots__/**` (before/after/baselines) are platform-specific review artifacts; MUST remain uncommitted. |
| api-envelope-frozen | API envelope `{ success, data, message }`, route paths/handlers, and KV key schema are out of scope and MUST NOT change. |
| green-gate | `bun run lint && bun run typecheck && bun run test && bun run build` exit 0; visual suite green in comparison mode with `#systemTime` masked. |
| design-md-frozen | `DESIGN.md` is the design source of truth and MUST NOT be edited by a review-only story. |

## 7. Verdict Rules

> Map visual sub-dimension outcomes → P6 verdict (feeds dim-7 score). Any BROKEN anti-pattern (collapsed layout, canvas pure white, primary CTA squared/clipped, broken images, bare unstyled HTML) overrides to **Block** regardless of weighted score.

| Verdict | Condition | dim-7 |
|---------|-----------|-------|
| Accept (PASS) | No MAJOR defects; weighted visual score >= 90; all required (page x viewport x theme) captures present; V1 (RWD) and V2 (Fidelity) both pass | 5 |
| Revise (MINOR) | Only MINOR defects; page usable + structurally spec-aligned; weighted score 70–89 | 4 |
| Block (MAJOR) | >= 1 MAJOR defect (pure-white canvas, gradient fill, squared/inverted CTA token, mobile overflow, missing table-reflow wrapper, inverted color tokens) | 2 |
| Block (BROKEN) | Any BROKEN anti-pattern: collapsed/clipped layout, primary CTA < 280px container / shrunk, broken images, bare default-HTML render, vertical CJK text | 1 |
| Incomplete | Required (state, viewport) combo not verified (e.g. dark @ 390px, modal/sheet states) AND `--strict-unchecked`; downgrades Accept → Incomplete. Default lenient: records gap in `uncheckedStates[]`, preserves verdict. | n/a |

**Tap-target nuance:** named primary CTA < 40px on mobile → MAJOR (Block). Row `.btn-xs` below 40/44px → INFO finding only (never blocks), per DESIGN.md §8.

## 8. Evolution Log

| date | story | change |
|------|-------|--------|
| 2026-05-30 | rwd-visual-review (contract v2) | Greenfield seed. Derived all 8 sections from `/DESIGN.md` + `/src/style.css` + contract v2 ACs #1–#12. Anchored RWD assertions (no-overflow, tap-target>=40px, table reflow via `.overflow-x-auto`), token assertions (cream-canvas-not-white `#F2F0EB`, dark-canvas `#16302A`, pill-radius>=24px), and forbidden patterns (pure-white canvas, gradients, squared/black/gold misuse). Page+CTA selector map: login `#submitBtn`, admin `#addSubscriptionBtn`, config `#submitBtn`; row actions `.btn-xs` non-blocking. |
