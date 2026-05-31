<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS.md

> This document is for AI coding agents. For human-readable project info, see [README.md](README.md).

## Project Overview

**Type**: Single Project (Cloudflare Workers)  
**Stack**: Hono + Vite + TypeScript + Tailwind CSS v4  
**Runtime**: Cloudflare Workers (Node.js compatibility enabled)  
**Package Manager**: bun  
**Key Services**: KV Storage (`SUBSCRIPTIONS_KV`), Cron Triggers  

**Key Directories**:
- `src/` - Application source code
  - `client/` - Client Script
  - `components/` - UI components
  - `routes/` - Hono route handlers
  - `pages/` - Frontend page
  - `services/` - Business logic (KV operations, scheduling)
  - `types/` - TypeScript type definitions
  - `utils/` - Helper functions (crypto, time)
- `public/` - Static assets
- `index.js` - Worker entry point (built output)
- `wrangler.toml` - Cloudflare Workers configuration

---

## Dev Environment Tips

### Local Development with Wrangler
```bash
bun run dev
```
This starts Vite dev server AND Wrangler local mode, providing:
- Live reload for code changes
- Local KV namespace simulation (bindings auto-injected)
- Miniflare runtime (mimics Workers environment)

### Type Generation for Cloudflare Bindings
```bash
bun run cf-typegen
```
**When to run**: After modifying `wrangler.toml` (adding KV, Durable Objects, etc.)  
**Why**: Generates `CloudflareBindings` interface for type-safe access to `env.*` in Hono context.

### Common Issues
- **KV not working locally**: Ensure `wrangler dev` is running (via `bun run dev`), not plain Vite.
- **Type errors on `env.SUBSCRIPTIONS_KV`**: Run `bun run cf-typegen` and restart TypeScript server.
- **Tailwind classes not applying**: Check `@tailwindcss/vite` is in `vite.config.ts` plugins array.

---

## Setup Commands

### Initial Setup
```bash
bun install
```

### Adding Dependencies
```bash
# Production dependency
bun add <package>

# Dev dependency
bun add -d <package>
```

### Generate Cloudflare Types
```bash
bun run cf-typegen
```
Run this after installing/removing dependencies that interact with Workers bindings.

---

## Build and Test Commands

### Full Check Suite (Run Before PR)
```bash
bun run lint && bun run typecheck && bun run test && bun run build
```

### Individual Checks

**Linting**:
```bash
bun run lint          # Check only
bun run lint:fix      # Auto-fix issues
```
Uses `@antfu/eslint-config` (opinionated rules for TS/Hono projects).

**Type Checking**:
```bash
bun run typecheck
```
Runs `tsc --noEmit` to validate TypeScript without emitting files.

**Testing**:
```bash
bun run test          # Run all tests
bun run test:watch    # Watch mode
bun run test:coverage # Generate coverage report
```
Uses Vitest (fast Vite-native test runner).

**Build**:
```bash
bun run build
```
Outputs to `index.js` (Worker entry point). Must succeed before deployment.

**Preview**:
```bash
bun run preview
```
Builds and starts local preview server (tests production build locally).

---

## Code style
- TypeScript strict mode
- TypeScript 一律不使用 any 型別

## Testing Instructions

### Test Structure Expectations
- **Unit tests**: `src/**/*.test.ts` - Test individual functions/components
- **Integration tests**: `src/**/*.spec.ts` - Test route handlers with mocked KV
- **Coverage requirement**: Aim for >80% on `src/services/` and `src/utils/`

### Writing Tests for KV-Dependent Code
Use Miniflare's `unstable_dev` or mock KV:
```typescript
// Example: Mock KV in Vitest
import { describe, it, expect, vi } from 'vitest'

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

// Test your service with mockKV
```

### Pre-Commit Checklist
1. Run `bun run lint:fix` - Auto-fix linting issues
2. Run `bun run typecheck` - Ensure no type errors
3. Run `bun run test` - All tests pass
4. Run `bun run build` - Build succeeds without warnings
5. Verify changes in `bun run preview` (if UI changes)

---

## PR Instructions

### Commit Message Format (Angular Convention)
```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature (e.g., `feat(subscriptions): add renewal reminder`)
- `fix`: Bug fix (e.g., `fix(crypto): handle invalid cipher text`)
- `docs`: Documentation only
- `style`: Formatting, missing semicolons (no code change)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests
- `chore`: Build process, dependency updates

**Scopes** (examples):
- `subscriptions`, `crypto`, `kv`, `routes`, `ui`, `config`

**Example**:
```
feat(kv): add batch delete operation

Implements deleteMany() in KV service to handle bulk deletions
efficiently using Promise.all().

Closes #42
```

### PR Checklist
- [ ] All commits follow Angular convention
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes (coverage ≥80% for new code)
- [ ] `bun run build` succeeds
- [ ] Updated types after schema changes (`bun run cf-typegen`)
- [ ] Tested locally with `bun run preview`
- [ ] Updated README.md if adding user-facing features

---

## Cloudflare Workers Specific

### Environment Management
**Environments defined in `wrangler.toml`**:
- `production` → `subscription-manager`
- `staging` → `subscription-manager-staging`
- (default/local) → `sub`

### Deployment Commands

**To Production**:
```bash
bun run deploy
```
Deploys to `production` environment (default per wrangler.toml).

**To Staging**:
```bash
bun run build && wrangler deploy --env staging
```

**Deploy Specific Version**:
```bash
wrangler deploy --env production --var VERSION:$(git rev-parse --short HEAD)
```

---

## Release Management

### Version Management System
This project uses **bumpp** for automated version bumping and **conventional-changelog** for changelog generation, following semantic versioning (semver) and Conventional Commits.

### Local Release Commands

**Patch Release** (bug fixes - 1.0.0 → 1.0.1):
```bash
bun run release
```
This command:
1. Prompts for version confirmation (default: patch)
2. Updates version in `package.json`
3. Creates git commit with `chore(release): bump version to vX.X.X`
4. Generates/updates `CHANGELOG.md` from commit history
5. Amends the commit to include changelog
6. Creates git tag `vX.X.X`
7. Pushes commit and tags to remote

**Minor Release** (new features - 1.0.0 → 1.1.0):
```bash
bun run release:minor
```

**Major Release** (breaking changes - 1.0.0 → 2.0.0):
```bash
bun run release:major
```

**Dry Run** (preview version bump without committing):
```bash
bun run release:dry
```

### CI/CD Release Workflow

**GitHub Actions Release** (recommended for team projects):
1. Navigate to GitHub → Actions → "Release" workflow
2. Click "Run workflow"
3. Select version type: `patch`, `minor`, or `major`
4. Workflow automatically:
   - Bumps version
   - Generates changelog
   - Commits and pushes changes
   - Creates GitHub Release with release notes

**Automatic Deployment**: Pushing tags to `main` branch triggers the deploy workflow, which:
- Extracts version from `package.json`
- Injects version into Workers via `--var VERSION:X.X.X`
- Deploys to production with version metadata

### Version Access in Code

Version is available in Workers runtime via environment variables:

```typescript
// In Hono route handler
app.get('/version', (c) => {
  return c.json({ version: c.env.VERSION })
})

// Access in service
const version = env.VERSION // e.g., "1.2.3"
```

### Changelog Generation

Changelog is auto-generated from Conventional Commits:
- `feat:` commits → Listed under "Features"
- `fix:` commits → Listed under "Bug Fixes"
- `perf:` commits → Listed under "Performance Improvements"
- `BREAKING CHANGE:` footer → Listed under "BREAKING CHANGES"

**Manual changelog generation**:
```bash
bun run changelog
```

### Release Best Practices

1. **Before releasing**:
   - Ensure all tests pass (`bun run typecheck && bun run lint`)
   - Verify build succeeds (`bun run build`)
   - Update documentation if needed

2. **Commit message discipline**:
   - Follow Conventional Commits strictly
   - Use `feat:` for user-facing features
   - Use `fix:` for bug fixes
   - Add `BREAKING CHANGE:` footer for API changes

3. **Version selection guide**:
   - `patch` - Bug fixes, dependency updates, internal refactors
   - `minor` - New features, non-breaking API additions
   - `major` - Breaking changes, major refactors, API removals

4. **After releasing**:
   - Verify deployment in production
   - Check version endpoint: `https://subscription-manager.workers.dev/version`
   - Monitor logs for issues: `wrangler tail --env production`

### Troubleshooting Releases

**Error: "fatal: tag already exists"**
- Delete local tag: `git tag -d vX.X.X`
- Force push: `git push origin :refs/tags/vX.X.X`
- Re-run release command

**Error: "Permission denied (publickey)"**
- Check GitHub SSH keys or use HTTPS
- For CI: ensure `GITHUB_TOKEN` has write permissions

**Changelog not updating**
- Verify commits follow Conventional Commits format
- Check commit history: `git log --oneline`
- Manually generate: `bun run changelog`

### KV Operations (Development)

**List all keys in local KV**:
```bash
wrangler kv:key list --binding SUBSCRIPTIONS_KV --local
```

**Get a key**:
```bash
wrangler kv:key get "user:12345" --binding SUBSCRIPTIONS_KV --local
```

**Put a key**:
```bash
wrangler kv:key put "user:12345" '{"plan":"premium"}' --binding SUBSCRIPTIONS_KV --local
```

**For production KV**, remove `--local` and add `--env production`.

### Cron Trigger Testing
**Trigger cron manually** (production):
```bash
wrangler deploy && curl -X POST https://subscription-manager.workers.dev/__scheduled
```
Or use Cloudflare Dashboard → Workers → Triggers → Cron Triggers → "Trigger Now".

**Local testing**: Cron handlers run on schedule in `wrangler dev`, or manually invoke:
```typescript
// In test: simulate scheduled event
const request = new Request('http://localhost/__scheduled', {
  method: 'POST',
})
await app.fetch(request, env)
```

### Viewing Logs
**Real-time (production)**:
```bash
wrangler tail --env production
```

**Historical logs**: Use Cloudflare Dashboard → Workers → Logs → Logpush.

---

## Architecture Decisions

### Why Hono over other frameworks?
- Lightweight (~10KB), perfect for Workers' size limits
- Native Workers/Edge runtime support
- Type-safe routing and middleware

### Why Vite for Workers?
- Fast HMR during development
- Tree-shaking for minimal bundle size
- SSR support via `vite-ssr-components`

### KV vs D1 vs Durable Objects?
- **Current**: KV for subscription metadata (fast global reads)
- **Future**: Consider D1 if needing SQL queries or complex relationships
- **Avoid**: Durable Objects (overkill for this use case; higher costs)

---

## Adding New Features (Workflow)

1. **Update types**: Add/modify in `src/types/*.type.ts`
2. **Run type generation**: `bun run cf-typegen` (if touching Workers bindings)
3. **Implement service logic**: In `src/services/`
4. **Add route handler**: In `src/routes/`
5. **Write tests**: Co-located `*.test.ts` files
6. **Verify**: Run full check suite (`lint + typecheck + test + build`)
7. **Preview**: `bun run preview` to test production build
8. **Commit**: Follow Angular convention
9. **Deploy**: Push to trigger CI, or manual `bun run deploy`

---

## CI/CD Pipeline

**GitHub Actions** configuration expected at `.github/workflows/ci.yml`:
```yaml
# Expected stages:
1. Install dependencies (bun install --frozen-lockfile)
2. Lint (bun run lint)
3. Type check (bun run typecheck)
4. Test (bun run test)
5. Build (bun run build)
6. Deploy (on main branch merge)
```

**PR gate**: All checks must pass before merge.

---

## Security Considerations

### Secrets Management
**Never commit**:
- KV namespace IDs (use wrangler.toml with placeholders)
- API keys (use Wrangler secrets or env vars in dashboard)

**Add secrets**:
```bash
wrangler secret put API_KEY --env production
```

### Crypto Operations
- Use `src/utils/crypto.ts` for encryption/decryption
- Ensure keys are stored in Cloudflare Secrets, not code
- Use Web Crypto API (available in Workers)

---

## Troubleshooting

### Build Failures
**Error**: `ReferenceError: process is not defined`  
**Fix**: Ensure `compatibility_flags = ["nodejs_compat"]` in wrangler.toml.

**Error**: `Cannot find module 'tailwindcss'`  
**Fix**: Reinstall dependencies (`rm -rf node_modules && bun install`).

### Deployment Failures
**Error**: `KV namespace not found`  
**Fix**: Update `wrangler.toml` with correct namespace ID from dashboard.

**Error**: `Exceeded Workers size limit (1MB)`  
**Fix**: Check bundle size (`npm run build` output), enable minification, remove unused deps.

### Type Errors
**Error**: `Property 'SUBSCRIPTIONS_KV' does not exist on type 'Env'`  
**Fix**: Run `npm run cf-typegen` and restart TS server (`Cmd+Shift+P` → "Restart TS Server").

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `bun run dev` |
| Run tests | `bun run test` |
| Type check | `bun run typecheck` |
| Lint & fix | `bun run lint:fix` |
| Build | `bun run build` |
| Preview production | `bun run preview` |
| Deploy to prod | `bun run deploy` |
| Generate types | `bun run cf-typegen` |
| **Release patch** | `bun run release` |
| **Release minor** | `bun run release:minor` |
| **Release major** | `bun run release:major` |
| **Preview version bump** | `bun run release:dry` |
| **Generate changelog** | `bun run changelog` |
| Tail logs | `wrangler tail --env production` |
| Full pre-commit check | `bun run lint && bun run typecheck && bun run test && bun run build` |

---

**Last Updated**: 2025-12-27  
**Maintainer**: AI Coding Agent  
**Related Docs**: [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Hono](https://hono.dev/), [Vite](https://vite.dev/)

<!-- harness:refactor-frontend:start -->
# Refactor Harness — `refactor/frontend-client-layer`

> Lightweight harness for the in-flight frontend-refactor work. Added by `/harness-creator`; integrates with (does not replace) the OpenSpec and GitNexus managed blocks. Remove this block once the branch is merged.

## Scope Boundary

**In scope (edit freely):**
- Frontend client layer: `src/client/**` (islands + new `src/client/lib/`), `src/components/**`.
- Two backend cron defects only: timezone unification via `getCurrentHour(config)` (`src/services/config.ts`, `src/index.tsx`, `src/services/notifier/index.ts`); immutable `processSubscriptionReminder` (`src/services/subscription_cron.ts`).
- Test/infra scaffolding: `vitest.config.ts`, `e2e/**`, `src/**/*.{test,spec}.{ts,tsx}`, `bunfig.toml`, `.simple-git-hooks.mjs`, `apm.yml`.

**Out of scope — MUST NOT change (behaviour-preserving refactor only):**
- API response envelope shape `{ success, data, message }` (`src/utils/response.ts`, `src/types/api.d.ts`).
- Route paths and handler contracts (`src/routes/**`).
- KV storage logic / key schema (`src/services/**` KV read/write semantics).

If a task seems to require touching an out-of-scope item, STOP and surface it instead of proceeding.

## Verification Workflow (definition of done)

The automated gate — run before claiming any task done, and before PR:

```bash
bun run lint && bun run typecheck && bun run test && bun run build
```

Coverage gate (enforced): `src/client/lib/**`, `src/utils/formAdaptor.ts`,
`src/services/subscription_cron.ts` each ≥ 80% — `bun run test:coverage` exits
non-zero below threshold (per-file thresholds in `vitest.config.ts`).

### Visual harness — a LOCAL human-review tool, NOT a CI/PR gate

The Playwright `toHaveScreenshot` baselines are intentionally **untracked**
(`.gitignore` → `e2e/*-snapshots/`) and **platform-specific** (darwin), so the
visual harness is not reproducible on a clean checkout or Linux CI. It is the
operator-run before/after diff backing the **PV human sign-off gate**, not part
of the green automated gate above. Local usage:

```bash
bun run test:visual:update   # establish/refresh the LOCAL baseline (first run)
bun run test:visual          # compare current render against the local baseline
bun run test:visual:capture  # write full-page PNGs to e2e/__screenshots__/ for eyeball review
```

With no local baseline present, `bun run test:visual` errors ("snapshot does not
exist") rather than silently passing — it never reports a false green.

## Tool Safety — high-risk operations (require explicit authorization)

- KV writes against real namespaces (`wrangler kv key put` without `--local`).
- `bun run deploy` / `wrangler deploy` (any environment).
- Releases: `bun run release*` / `bumpp` (bumps version, tags, pushes).
- `git push` and opening PRs — user-gated; do not auto-push or auto-merge.

Local-only KV seeding (`wrangler kv key put --local`) and read-only commands are safe.

## Feature State & Lifecycle Handoff

State of record = the seven implementation plans in `docs/superpowers/plans/` (checkbox steps track progress) against spec `docs/superpowers/specs/2026-05-30-frontend-refactor-design.md`.

Execution order (dependencies): **S0 foundation → S0 visual harness (capture baseline) → [lib layer ∥ cron] → island refactors → visual uplift (PV) → finishing cleanup (P7)**.

To resume across sessions: read the plan files, run the Verification Workflow to see current green/red state, then continue the first plan whose steps are not all checked. Hard user gates (do not self-approve): PV visual-direction selection and final visual sign-off.

## Harness Artifacts

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Project structure, Worker layer responsibilities, HTTP + cron data flow, invariants. |
| `PRODUCT.md` | Product scope and current-phase (refactor) goals + success criteria. |
| `init.sh` | One-click restore to a known-good state: `bun install` → lint → typecheck → test → build (no deploy / no remote KV). |
| `docs/superpowers/specs/`, `docs/superpowers/plans/` | Authoritative spec + the seven phase plans (state of record). |

Startup: run `./init.sh` to reach green, then read `ARCHITECTURE.md` + `PRODUCT.md` for context and the plans for the next step.
<!-- harness:refactor-frontend:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **subs-tracker** (1498 symbols, 2741 relationships, 116 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/subs-tracker/context` | Codebase overview, check index freshness |
| `gitnexus://repo/subs-tracker/clusters` | All functional areas |
| `gitnexus://repo/subs-tracker/processes` | All execution flows |
| `gitnexus://repo/subs-tracker/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
