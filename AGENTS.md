# AGENTS.md

> This document is for AI coding agents. For human-readable project info, see [README.md](README.md).

## Project Overview

Subscription tracker on Cloudflare Workers: Hono (API, JSX SSR, OpenAPI via `@hono/zod-openapi`), Vite 8 with `@cloudflare/vite-plugin`, TypeScript, Tailwind CSS v4 (component styles in `src/style.css`, taken from the prototype `docs/design/subs-tracker-design.html`). Package manager: bun. Storage: D1 (`DB`); KV (`SUBSCRIPTIONS_KV`) is read only once, to import data from older versions. An hourly Cron Trigger sends reminders at the user's reminder hour.

**Layout**:

- `src/index.tsx` - Worker entry (`main` in wrangler.toml); exports `fetch` and the cron `scheduled` handler
- `src/routes/` - API routes (`OpenAPIHono` sub-apps mounted by `src/openapi.ts`)
- `src/db/` - D1 row mapping and queries; `src/services/` - business logic
- `migrations/` - D1 schema (`wrangler d1 migrations apply`)
- `src/pages/`, `src/components/` - server-rendered JSX; `src/client/` - browser scripts
- `src/middleware/`, `src/types/`, `src/utils/`
- `public/` - static assets (service worker)
- `docs/research/` - dated research notes

## Commands

Scripts live in `package.json`. The ones with non-obvious behavior:

- `bun run dev` - Vite dev server; `@cloudflare/vite-plugin` runs the Worker in workerd with local D1 and KV. Run `bun run db:migrate:local` first.
- `bun run check` - `fmt:check` + `lint` (oxlint) + `typecheck` (tsc) + `bun test`. Run it with `bun run build` before a PR.
- `bun run fmt` - oxfmt writes formatting in place.
- `bun run preview` - build, then serve the production bundle locally. Use it for UI changes and dependency upgrades: some failures appear only in the bundled Worker.
- `bun run cf-typegen` - regenerate `worker-configuration.d.ts` after changing `wrangler.toml`.
- `bun run deploy` - build, apply D1 migrations to the remote database, then `wrangler deploy`. `wrangler deploy` does not apply migrations by itself.

Tests use `bun test` (`*.test.ts` next to the module). Tests that touch storage call `createTestDb()` from `src/test/d1.ts`, which gives each test an empty local D1 with all migrations applied. `docs/dogfood.md` is the manual walkthrough of the app; run it after UI, flow, or dependency changes and before a release, then add a row to its run log.

## Code Style

- TypeScript strict mode. Do not use `any`: oxlint enforces `typescript/no-explicit-any` as an error. Use `unknown` and narrow it, or a concrete type.
- oxfmt owns formatting (`.oxfmtrc.json`: no semicolons, single quotes, `printWidth` 120, sorted imports). Run `bun run fmt`; do not hand-format.
- Lint rules are in `.oxlintrc.json`. Override globs must be plain globs (`**/*.ts`); oxlint does not match extglob patterns such as `**/*.?([cm])ts`, and the rules under them silently stop applying.
- Styles: `src/style.css` keeps the prototype's component CSS in `@layer components`; change the prototype `docs/design/subs-tracker-design.html` in the same commit. Colors switch with the theme, so they live as CSS variables on `:root` and map to Tailwind through `@theme inline` (`bg-surface`, `text-ink-2`, `bg-plum`); the default palette is removed. The `dark:` variant follows `data-theme` first, then the OS setting. Tailwind scans only `src/` (`source('.')`).
- Browser globals that inline `onclick` handlers call are declared with `declare global { interface Window { ... } }` in the module that assigns them.

## Git Hooks

`simple-git-hooks` installs hooks from `.simple-git-hooks.mjs`. Run `bunx simple-git-hooks` after you change that file.

- pre-commit: gitleaks (skipped when not installed), `bun run fmt:check`, `bun run lint`. The hook only checks; fix with `bun run fmt` and `bun run lint:fix`, then stage again.
- pre-push: `bun run typecheck`.

`.git-blame-ignore-revs` lists the bulk oxfmt commit by hash. Merge branches that contain it with a merge commit; squash and rebase change the hash.

## Commit Messages

Angular convention: `<type>(<scope>): <summary>`, with scopes such as `subscriptions`, `webauthn`, `routes`, `ui`, `config`, `deps`. Add a `BREAKING CHANGE:` footer for API contract changes. `bun run changelog` (conventional-changelog, angular preset) builds `CHANGELOG.md` from these messages; it currently produces no entries for this repository's history (issue #10).

`bun run release`, `release:minor`, and `release:major` bump the version, tag, amend the changelog into the release commit, and push with tags. Run them only when the user asks for a release.

## API Contracts

- `@hono/zod-openapi` returns 415 for a Content-Type the route does not declare. A route that accepts form posts must declare `application/x-www-form-urlencoded` and `multipart/form-data` in `request.body.content` (see `loginRoute` in `src/routes/auth.ts`).
- Validation errors from every sub-app use the parent `defaultHook` in `src/openapi.ts`: `{ success: false, message, errors: [{ path, message }] }` with status 400.

## Dependency Notes

- `@simplewebauthn/*` stays on 13.2.2. Versions 13.3.x and 14.x pull in `@peculiar/x509`, and the bundled Worker then fails at startup with `Cannot get schema for 'AlgorithmIdentifier' target` (issue #9). Verify any upgrade with `bun run preview`, not only `tsc`.
- `@types/psl` is required: the `psl` package ships types, but its `exports` map does not expose them to `tsc`.
- `@cloudflare/workers-types` v5 has no dated entry points; `tsconfig.json` uses the package root.
- `typescript` is a direct dev dependency; nothing else installs `tsc`.
- Vite+ (`vite-plus`) was evaluated and deferred until its 1.0 release; see `docs/research/2026-09-26-toolchain-upgrade.md`.

## Cloudflare Workers

`wrangler.toml` defines one Worker, `subs-tracker`, with no `[env.*]` sections. With `@cloudflare/vite-plugin`, the environment is chosen at build time (`CLOUDFLARE_ENV`) and `wrangler deploy --env` has no effect; bindings are not inherited by environments either (`docs/research/2026-09-26-kv-vs-d1.md` §5.7).

- D1: the binding is `DB`. A new deployment runs `wrangler d1 create subs-tracker --binding DB --update-config` once to add `database_id`. Migrations only add: change a table with a new migration file, never by editing an applied one.
- Local data: `wrangler d1 execute DB --local --command "<SQL>"`. Seed legacy KV data for import tests with `wrangler kv key put <key> --path <file> --binding SUBSCRIPTIONS_KV --local --preview`; `vite preview` reads the `preview_id` namespace.
- Legacy import: when `settings` has no row, the first read (a request or the Cron) imports KV `config`, `subscriptions`, and `webauthn:*` into D1 in one `batch()` (`src/services/legacyImport.ts`). KV is never written.
- Cron: runs every hour; `runReminders()` returns unless the hour in the user's timezone equals `REMINDER_HOUR`. Locally, open `/cdn-cgi/handler/scheduled`. In production, use Cloudflare Dashboard → Workers → Triggers → Cron Triggers → "Trigger Now".
- Secrets: `wrangler secret put <NAME>`. Keep API keys out of the repository.
- Logs: `wrangler tail`.
- Crypto: use `src/utils/crypto.ts` (Web Crypto API).

## Architecture Decisions

D1 is the only store (`docs/research/2026-09-26-kv-vs-d1.md`). `batch()` is a transaction, and Cron writes use conditional `UPDATE`s so they never overwrite a change the user made during the run. Durable Objects are not used: they cost more and this app does not need coordination.

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

| Resource                                      | Use for                                  |
| --------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/subs-tracker/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/subs-tracker/clusters`       | All functional areas                     |
| `gitnexus://repo/subs-tracker/processes`      | All execution flows                      |
| `gitnexus://repo/subs-tracker/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                               |
| -------------------------------------------- | -------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
