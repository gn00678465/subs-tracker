# Sprint Contract — Dual-viewport (mobile + desktop) before/after visual review of the Starbucks-theme UI redesign

## Version
- Current: v2
- Supersedes: v1 (P3 contract-review = Revise; this revision resolves all 5 defects)

## Revision v2 — P3 defects resolved
- **MAJOR (AC#6/#9 oracle):** primary-CTA target is now an explicit per-page id, not a broad `.btn-primary`. Login=`#submitBtn`, admin=`#addSubscriptionBtn`, config=`#submitBtn` (the 保存配置 submit). Row-action `btn-xs` buttons, `btn-square`/`join-item` utility variants are EXCLUDED from AC#6/#9. (Note: login `#submitBtn` carries `btn-square`, but `src/style.css` global rule `.btn { border-radius: 9999px }` overrides it to a pill — AC#9 holds for the named CTA.)
- **MINOR (AC#6 disposition):** AC#6 is a HARD gate scoped to the three named full-size CTAs only (expected ~48px). New AC#6b is a NON-BLOCKING probe that records `btn-xs` row-action heights on mobile as a documented RWD finding (never fails the suite).
- **MINOR (AC#7 oracle):** names the real scroll container `.overflow-x-auto` wrapping the `/admin` table and asserts its computed `overflow-x`; also notes the header is `hidden md:grid` (rows stack to `grid-cols-1` on mobile → no overflow expected).
- **MINOR (AC#2/3/4 capture count):** capture-count checks now assert EXACTLY 6 light PNGs per dir and flag the dependency on the AC#2 `shoot()` path-prefix change.
- **MINOR (restore guard):** Verification Plan step 4 adds a hard post-restore integrity check before AC#4/#12 are declared met.

## Summary
The Starbucks `DESIGN.md` theme redesign was committed at `cc07b1a feat(ui): apply Starbucks DESIGN.md theme` ("after"); its parent `72d335b` is the pre-redesign "before". The redesign is behaviour-preserving and lives almost entirely in `src/style.css` (DaisyUI theme tokens + signature class rules) plus a one-line `Layout.tsx` theme-color change. The existing visual harness (`e2e/visual.spec.ts` + `playwright.config.ts`) captures only a SINGLE desktop viewport (`devices['Desktop Chrome']`, ~1280x720); there is no mobile capture today.

This story extends the harness to capture BOTH a mobile viewport (Pixel 5, 393x851) AND the existing desktop viewport for all three pages (`/`, `/admin`, `/admin/config`), then produces organized before/after screenshot sets at both viewports so a reviewer can diff page x viewport, and adds runnable responsive-design (RWD) assertions (no horizontal overflow, navbar/table reflow, tap-target sizing). It is a test/infra-only change: no application behaviour, routes, API envelope, or KV logic may change.

NOTE: This is a greenfield story — `.harness/rubric.md` does not exist yet. ACs below are self-contained falsifiable checks; novel rule candidates are flagged for the P4 propose-rubric phase in `rubric_coverage_notes`.

## Open Questions — Resolved (writer/orchestrator, Mode A)
1. **Mobile device descriptor** → `devices['Pixel 5']` (393x851), within the AC#1 360–414px range.
2. **Tap-target floor** → 40px (DESIGN.md §8: base pills ~32px, "may be visually expanded" on mobile; 44px WCAG-AAA is the ideal, 40px the enforced floor). A button below 40px is a reported finding, not a silently-relaxed pass.
3. **Dark theme reachability** → `Layout.tsx` hardcodes `<html data-theme="light">`, so OS `prefers-color-scheme` does NOT flip DaisyUI's theme. Dark is reached by setting `data-theme="dark"` on `<html>` (the app's own toggle does the same). Harness forces dark via `page.evaluate` before the dark capture — reliable, no click-timing flake. Dark captured at both viewports for all three pages.
4. **Before/after login reproducibility** → CONFIRMED. `git diff --name-only 72d335b cc07b1a` = `DESIGN.md`, `docs/...`, `src/components/Layout.tsx`, `src/style.css` only. No routes/services/api/login/seed changes → the `/api/login` + seed flow is identical at `72d335b`, so before-authenticated captures are reproducible.

## Acceptance Criteria

1. [ ] The Playwright config defines at least two named projects: an existing desktop project (~1280px-wide, `devices['Desktop Chrome']`) and a NEW mobile project `devices['Pixel 5']` (393x851). `bunx playwright test --list` enumerates test cases under both project names.
   Tested across: viewports=[mobile, desktop], states=[any]

2. [ ] For EACH of the three pages (`login` => `/`, `admin` => `/admin`, `admin-config` => `/admin/config`), the spec runs under BOTH projects, yielding 6 logical captures (3 pages x 2 viewports). Mobile and desktop screenshot artifacts are written to distinct, non-colliding paths (project name or a `mobile-`/`desktop-` prefix in the filename) so no capture overwrites another.
   Tested across: viewports=[mobile, desktop], states=[logged-out (login), logged-in (admin, admin-config)]

3. [ ] Capture mode produces a complete "after" set from current HEAD (`cc07b1a`): running the documented capture command writes 6 full-page PNGs (3 pages x 2 viewports) under `e2e/__screenshots__/after/`. Every expected file exists and is a non-empty PNG (size > 0 bytes).
   Tested across: viewports=[mobile, desktop], states=[logged-out, logged-in]

4. [ ] Capture mode produces a complete "before" set from the pre-redesign tree: after checking out `src/style.css` and `src/components/Layout.tsx` (only) from `72d335b` and re-running the documented capture command into `e2e/__screenshots__/before/`, 6 full-page PNGs (3 pages x 2 viewports) exist and are non-empty, then the working tree is restored to HEAD. The before/after directories together let a reviewer diff each page at each viewport (12 PNGs total).
   Tested across: viewports=[mobile, desktop], states=[logged-out, logged-in]

5. [ ] No horizontal overflow on mobile: for each of the three pages under the mobile project, an assertion verifies `document.documentElement.scrollWidth <= window.innerWidth + 1` (1px tolerance). The test FAILS if any page overflows horizontally at 390px width.
   Tested across: viewports=[mobile], states=[logged-out, logged-in]

6. [ ] Primary CTA meets a minimum tap-target height on mobile: for the named primary CTA of each page — login `#submitBtn`, admin `#addSubscriptionBtn`, config `#submitBtn` (保存配置) — an assertion verifies its rendered bounding-box height is >= 40px under the mobile project (40px is the enforced fail-threshold; ~48px is the informational expected value for a default DaisyUI `.btn`). Scoped to these three ids ONLY; `btn-xs` row actions and `btn-square`/`join-item` utility buttons are excluded. FAILS if a named primary CTA is shorter than 40px on mobile.
   Tested across: viewports=[mobile], states=[logged-out, logged-in]

6b. [ ] (NON-BLOCKING probe) Row-action tap-target finding: under the mobile project on `/admin`, the harness measures the rendered height of the `btn-xs` row-action buttons (`.btn-xs` inside `#subscriptionsBody`) and records the min/observed height to test output (annotation or console). This is a REPORTING probe for the reviewer/evaluator — it MUST NOT fail the suite regardless of value (DESIGN.md §8 flags sub-44px as a known mobile concern). Surfaces whether row actions are below the 40px/44px comfort target without blocking.
   Tested across: viewports=[mobile], states=[logged-in]

7. [ ] The admin list (`/admin`) reflows on mobile without forcing the page wider than the viewport: under the mobile project, (a) the page body satisfies AC#5 (no body-level horizontal overflow), AND (b) the table scroll container `div.overflow-x-auto` wrapping `div[role="table"]` exists with computed `overflow-x` ∈ {auto, scroll} (intentional scroll is confined there, not the body). The table header is `hidden md:grid` so rows collapse to `grid-cols-1` on mobile → no overflow is expected in the first place. FAILS if the body exceeds the viewport width OR the `.overflow-x-auto` wrapper is absent.
   Tested across: viewports=[mobile], states=[logged-in]

8. [ ] Signature theme token renders at BOTH viewports: on each page, an assertion verifies the computed background color of the page canvas (`body`) is the warm-cream token, NOT pure white (`rgb(255, 255, 255)`) and NOT fully transparent, in the default (light) theme. Guards the DESIGN.md "warm cream canvas, never pure white" invariant at both sizes.
   Tested across: viewports=[mobile, desktop], states=[logged-out, logged-in]

9. [ ] Pill-button radius holds at both viewports: for the named primary CTA of each page (login `#submitBtn`, admin `#addSubscriptionBtn`, config `#submitBtn`), an assertion verifies the computed `border-radius` resolves to a full-pill value (>= 24px) at both mobile and desktop — validating the `src/style.css` global `.btn { border-radius: 9999px }` (which also overrides login's `btn-square`). Scoped to these three ids ONLY; `join-item`/`btn-square` utility buttons excluded. FAILS if a named primary CTA renders with squared corners (< 24px radius).
   Tested across: viewports=[mobile, desktop], states=[logged-out, logged-in]

10. [ ] Dark theme is captured at both viewports: the harness forces `data-theme="dark"` on `<html>` (resolution #3) and captures each of the three pages in dark theme at both viewports under a `*-dark` artifact name, asserting the canvas is a dark (non-cream, non-white) surface. Reviewer can see a dark variant per page x viewport.
   Tested across: viewports=[mobile, desktop], states=[light, dark]

11. [ ] Comparison (non-capture) mode stays green against locally-generated baselines: after `bun run test:visual:update` regenerates baselines for BOTH projects, a plain `bun run test:visual` run passes for all page x viewport combinations, with the per-second `#systemTime` clock masked.
   Tested across: viewports=[mobile, desktop], states=[logged-out, logged-in]

12. [ ] Scope guardrails preserved + suite green: the diff for this story touches ONLY files under the Expected-files globs (test/e2e/playwright/package-scripts) and produced screenshot dirs — NO changes under `src/routes/**`, `src/utils/response.ts`, `src/types/api.d.ts`, or KV read/write semantics in `src/services/**`, and NOT `src/style.css`/`src/components/**` runtime code. `bun run lint && bun run typecheck && bun run test && bun run build` all exit 0.
   Tested across: viewports=[any], states=[any]

## In Scope
- Extending `playwright.config.ts` to add a mobile project (`Pixel 5`) alongside the existing desktop project.
- Extending `e2e/visual.spec.ts` to (a) name/prefix artifacts per viewport so mobile and desktop sets do not collide, (b) add RWD assertions (no-overflow, tap-target, table reflow), (c) add token assertions (cream canvas, pill radius) at both viewports, and (d) capture a forced-dark variant.
- Adding/adjusting `package.json` visual scripts for dual-project capture and before/after capture directories.
- Producing before/after PNG sets under `e2e/__screenshots__/before/` and `e2e/__screenshots__/after/` (review artifacts; intentionally uncommitted per existing harness convention — platform/darwin-specific).

## Out of Scope
- Any change to application rendering, components, or styles to "fix" RWD issues surfaced by the new assertions. A genuine overflow/under-size is a FINDING to report — remediation is a SEPARATE follow-up story. The writer must NOT edit `src/style.css`/components to force an assertion green.
- Changes to route handlers (`src/routes/**`), the API envelope (`src/utils/response.ts`, `src/types/api.d.ts`), or KV storage logic (`src/services/**`).
- Editing `DESIGN.md` or creating/editing `.harness/rubric.md`.
- Tablet/XL breakpoints beyond the required mobile + desktop pair.
- Committing screenshot binaries to the repo.

### Expected files touched
```
playwright.config.ts
e2e/visual.spec.ts
package.json            # visual-related scripts only
e2e/__screenshots__/before/**   # generated review artifacts (uncommitted)
e2e/__screenshots__/after/**    # generated review artifacts (uncommitted)
e2e/__screenshots__/<project>/**  # locally-generated comparison baselines (uncommitted)
```
(Explicitly NOT touched: `.harness/rubric.md`, `DESIGN.md`, `src/routes/**`, `src/utils/response.ts`, `src/types/api.d.ts`, KV logic in `src/services/**`, `src/style.css`, `src/components/**` runtime code.)

## Routes
```
/             # login page (logged-out)
/admin        # admin subscription list (logged-in)
/admin/config # admin config (logged-in)
```

## Design References
```
DESIGN.md                         # Starbucks theme: cream canvas, four-tier green, 50px pill, scale(0.95) active, 12px cards, tight -0.01em tracking, light+dark, color-block (no gradients)
src/style.css                     # DaisyUI theme tokens + signature class rules (the redesign surface)
src/components/Layout.tsx         # one-line theme-color change; hardcodes data-theme="light"
e2e/visual.spec.ts                # existing single-viewport harness being extended
playwright.config.ts              # existing single (desktop) project config being extended
```

## E2E Flows
```
login (logged-out): GET / -> screenshot + RWD/token asserts
authenticated: POST /api/login {admin/visual-harness-pw} -> add cookies
  -> GET /admin -> screenshot + RWD/token/table-reflow asserts
  -> GET /admin/config -> screenshot + RWD/token asserts
(each flow executed once per Playwright project: mobile + desktop; plus a forced-dark capture pass)
```

## Verification Plan
```bash
# 0. Baseline green (scope guard + full suite) — AC #12
bun run lint && bun run typecheck && bun run test && bun run build
git status --short   # working tree: only Expected-files globs; NO src/routes, response.ts, api.d.ts, KV services, style.css

# 1. Two projects (mobile + desktop) are registered — AC #1
bunx playwright test --list   # expect cases under a desktop project AND a mobile (Pixel 5) project

# 2. RWD + token assertions run and pass in comparison mode for both projects — AC #5..#10
bun run test:visual:update    # (re)generate per-project baselines locally first
bun run test:visual           # all page x viewport cases pass; #systemTime masked; no unexpected diffs

# 3. Capture the AFTER set (current HEAD cc07b1a) — AC #2, #3
#    NOTE: presupposes the AC#2 shoot() path-prefix change (per-viewport filenames);
#    against unmodified capture logic mobile/desktop collide and you'd see 3, not 6.
VISUAL_CAPTURE_DIR=after bun run test:visual
# light-only count excludes dark variants so a missing light capture can't be masked by dark files
[ "$(ls e2e/__screenshots__/after/*-{mobile,desktop}.png 2>/dev/null | grep -v -- '-dark-' | wc -l | tr -d ' ')" -eq 6 ] \
  && echo "AFTER: exactly 6 light PNGs OK" || { echo "AFTER: expected exactly 6 light PNGs"; exit 1; }
# dark variants (AC#10) additionally present as *-dark-{mobile,desktop}.png

# 4. Capture the BEFORE set from 72d335b (style/layout only), then restore — AC #4
git checkout 72d335b -- src/style.css src/components/Layout.tsx
VISUAL_CAPTURE_DIR=before bun run test:visual
[ "$(ls e2e/__screenshots__/before/*-{mobile,desktop}.png 2>/dev/null | grep -v -- '-dark-' | wc -l | tr -d ' ')" -eq 6 ] \
  && echo "BEFORE: exactly 6 light PNGs OK" || { echo "BEFORE: expected exactly 6 light PNGs"; exit 1; }
git checkout HEAD -- src/style.css src/components/Layout.tsx   # restore working tree to HEAD
# Hard post-restore integrity guard (defect #5) — before AC#4/#12 may be declared met:
git diff --quiet HEAD -- src/style.css src/components/Layout.tsx \
  || { echo "TREE NOT RESTORED — aborting"; exit 1; }

# 5. Confirm diffable matrix — AC #4
ls e2e/__screenshots__/before/ e2e/__screenshots__/after/   # >=12 light PNGs total (before6 + after6)
```

Reviewer sign-off (human gate, per AGENTS.md "PV visual sign-off"): inspect the before/after PNG pairs at mobile and desktop for each of the three pages and confirm the Starbucks theme renders correctly (cream canvas, green CTAs, pill buttons, readable type) with no regressions vs the before set. Record any RWD finding surfaced by AC #5–#10 for a follow-up remediation story.
