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
  - `middleware/` - Hono middleware (auth)
  - `components/` - UI components
  - `routes/` - Hono route handlers
  - `pages/` - Frontend page
  - `services/` - Business logic (KV operations, scheduling)
  - `types/` - TypeScript type definitions
  - `utils/` - Helper functions (crypto, time)
- `public/` - Static assets
- `src/index.tsx` - Worker entry point (`main` in wrangler.toml); exports `fetch` and the cron `scheduled` handler
- `wrangler.toml` - Cloudflare Workers configuration

---

## Dev Environment Tips

### Local Development with Wrangler
```bash
bun run dev
```
This starts Vite with `@cloudflare/vite-plugin`, which runs the Worker in workerd with local KV bindings and live reload.

### Type Generation for Cloudflare Bindings
```bash
bun run cf-typegen
```
**When to run**: After modifying `wrangler.toml` (adding KV, Durable Objects, etc.)  
**Why**: Generates `CloudflareBindings` interface for type-safe access to `env.*` in Hono context.

### Common Issues
- **KV not working locally**: KV bindings come from `@cloudflare/vite-plugin` in `vite.config.ts`; start the app with `bun run dev`.
- **Type errors on `env.SUBSCRIPTIONS_KV`**: Run `bun run cf-typegen` and restart TypeScript server.
- **Tailwind classes not applying**: Check `@tailwindcss/vite` is in `vite.config.ts` plugins array.

---

## Setup Commands

### Initial Setup
```bash
bun install
```

---

## Build and Test Commands

### Full Check Suite (Run Before PR)
```bash
bun run lint && bun run typecheck && bun run build
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

**Build**:
```bash
bun run build
```
Outputs to `dist/`. Must succeed before deployment.

**Preview**:
```bash
bun run preview
```
Builds and starts local preview server (tests production build locally).

---

## Code style
- TypeScript strict mode
- TypeScript 一律不使用 any 型別

## Testing

No test runner is configured: `package.json` has no `test` script and no Vitest dependency. Verify changes with `bun run lint`, `bun run typecheck`, `bun run build`, and `bun run preview` for UI changes.

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
- (default/local) → `subs-tracker`

### Deployment Commands

**To Production**:
```bash
bun run deploy
```
`bun run deploy` runs `wrangler deploy` without selecting an environment, so it deploys the top-level `subs-tracker` Worker.

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
   - Ensure `bun run typecheck && bun run lint` pass
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
   - Monitor logs for issues: `wrangler tail --env production`

### Troubleshooting Releases

**Error: "fatal: tag already exists"**
- Delete local tag: `git tag -d vX.X.X`
- Force push: `git push origin :refs/tags/vX.X.X`
- Re-run release command

**Error: "Permission denied (publickey)"**
- Check GitHub SSH keys or use HTTPS

**Changelog not updating**
- Verify commits follow Conventional Commits format
- Check commit history: `git log --oneline`
- Manually generate: `bun run changelog`

### KV Operations (Development)

**List keys in local KV**:
```bash
wrangler kv key list --binding SUBSCRIPTIONS_KV --local
```

**Get the subscription list**:
```bash
wrangler kv key get "subscriptions" --binding SUBSCRIPTIONS_KV --local
```

Other keys follow `webauthn:credential:<id>` (see `src/services/webauthn.ts`). **For production KV**, remove `--local` and add `--env production`.

### Cron Trigger Testing
The `scheduled` handler in `src/index.tsx` runs on the `crons` schedule in `wrangler.toml`. To run it in production on demand, use Cloudflare Dashboard → Workers → Triggers → Cron Triggers → "Trigger Now".

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

1. **Update types**: Add/modify in `src/types/`
2. **Run type generation**: `bun run cf-typegen` (if touching Workers bindings)
3. **Implement service logic**: In `src/services/`
4. **Add route handler**: In `src/routes/`
5. **Verify**: Run full check suite (`lint + typecheck + build`)
6. **Preview**: `bun run preview` to test production build
7. **Commit**: Follow Angular convention
8. **Deploy**: `bun run deploy`

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
**Fix**: Check bundle size (`bun run build` output), enable minification, remove unused deps.

### Type Errors
**Error**: `Property 'SUBSCRIPTIONS_KV' does not exist on type 'Env'`  
**Fix**: Run `bun run cf-typegen` and restart TS server (`Cmd+Shift+P` → "Restart TS Server").

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `bun run dev` |
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
| Full pre-commit check | `bun run lint && bun run typecheck && bun run build` |

---

**Related Docs**: [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Hono](https://hono.dev/), [Vite](https://vite.dev/)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **subs-tracker**. If the index is stale, run `node .gitnexus/run.cjs analyze --index-only` from the project root. If `.gitnexus/run.cjs` is missing, bootstrap with `bunx gitnexus@latest analyze`.

## Workflow

- Before you change a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` (CLI: `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`) and report callers, processes, and risk. Warn the user about HIGH or CRITICAL `risk` before the edit; `riskSharedAxes` does not waive that warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- `risk: UNKNOWN` means the index could not resolve the callers (plain-object property access, dynamic dispatch, cross-language calls), not that there are none. Confirm with a text search before you treat the symbol as safe to change or delete.
- For read-only questions, query the graph first: `query({search_query: "concept"})` for concepts and flows, `context({name: "symbolName"})` for a named symbol, `impact` for blast radius. Use text search for literals, or when the graph returns empty or `UNKNOWN`.
- Rename symbols with `rename`, which follows the call graph, not with find-and-replace.
- Before you commit, run `detect_changes({scope: "all"})` (CLI: `node .gitnexus/run.cjs detect-changes --scope all --repo .`). A result with `partial: true` or `truncated: true` is incomplete; run it again. For regression review against main, use `detect_changes({scope: "compare", base_ref: "main"})` (CLI: `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`).
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/subs-tracker/context` | Codebase overview, check index freshness |
| `gitnexus://repo/subs-tracker/clusters` | All functional areas |
| `gitnexus://repo/subs-tracker/processes` | All execution flows |
| `gitnexus://repo/subs-tracker/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
