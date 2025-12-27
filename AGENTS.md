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