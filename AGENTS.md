# AGENTS.md

> This document is for AI coding agents. For human-readable project info, see [README.md](README.md).

## Project Overview

Subscription tracker on Cloudflare Workers: Hono (API, JSX SSR, OpenAPI via `@hono/zod-openapi`), Vite 8 with `@cloudflare/vite-plugin`, TypeScript, Tailwind CSS v4 + daisyUI. Package manager: bun. Storage: KV (`SUBSCRIPTIONS_KV`). A daily Cron Trigger sends renewal reminders.

**Layout**:

- `src/index.tsx` - Worker entry (`main` in wrangler.toml); exports `fetch` and the cron `scheduled` handler
- `src/routes/` - API routes (`OpenAPIHono` sub-apps mounted by `src/openapi.ts`)
- `src/services/` - business logic and KV access
- `src/pages/`, `src/components/` - server-rendered JSX; `src/client/` - browser scripts
- `src/middleware/`, `src/types/`, `src/utils/`
- `public/` - static assets (service worker)
- `docs/research/` - dated research notes

## Commands

Scripts live in `package.json`. The ones with non-obvious behavior:

- `bun run dev` - Vite dev server; `@cloudflare/vite-plugin` runs the Worker in workerd with local KV.
- `bun run check` - `fmt:check` + `lint` (oxlint) + `typecheck` (tsc). Run it with `bun run build` before a PR.
- `bun run fmt` - oxfmt writes formatting in place.
- `bun run preview` - build, then serve the production bundle locally. Use it for UI changes and dependency upgrades: some failures appear only in the bundled Worker.
- `bun run cf-typegen` - regenerate `worker-configuration.d.ts` after changing `wrangler.toml`.
- `bun run deploy` - `wrangler deploy` without `--env`, so it deploys the top-level `subs-tracker` Worker, not `production`.

No test runner is configured.

## Code Style

- TypeScript strict mode. Do not use `any`: oxlint enforces `typescript/no-explicit-any` as an error. Use `unknown` and narrow it, or a concrete type.
- oxfmt owns formatting (`.oxfmtrc.json`: no semicolons, single quotes, `printWidth` 120, sorted imports). Run `bun run fmt`; do not hand-format.
- Lint rules are in `.oxlintrc.json`. Override globs must be plain globs (`**/*.ts`); oxlint does not match extglob patterns such as `**/*.?([cm])ts`, and the rules under them silently stop applying.
- Browser globals that inline `onclick` handlers call are declared with `declare global { interface Window { ... } }` in the module that assigns them.

## Git Hooks

`simple-git-hooks` installs hooks from `.simple-git-hooks.mjs`. Run `bunx simple-git-hooks` after you change that file.

- pre-commit: gitleaks (skipped when not installed), `bun run fmt:check`, `bun run lint`. The hook only checks; fix with `bun run fmt` and `bun run lint:fix`, then stage again.
- pre-push: `bun run typecheck`.

`.git-blame-ignore-revs` lists the bulk oxfmt commit. Keep that commit's hash stable: do not rebase across it.

## Commit Messages

Angular convention: `<type>(<scope>): <summary>`, with scopes such as `subscriptions`, `webauthn`, `routes`, `ui`, `config`, `deps`. Add a `BREAKING CHANGE:` footer for API contract changes. `bun run changelog` (conventional-changelog, angular preset) builds `CHANGELOG.md` from these messages; it currently produces no entries for this repository's history, cause unknown.

`bun run release`, `release:minor`, and `release:major` bump the version, tag, amend the changelog into the release commit, and push with tags. Run them only when the user asks for a release.

## API Contracts

- `@hono/zod-openapi` returns 415 for a Content-Type the route does not declare. A route that accepts form posts must declare `application/x-www-form-urlencoded` and `multipart/form-data` in `request.body.content` (see `loginRoute` in `src/routes/auth.ts`).
- Validation errors from every sub-app use the parent `defaultHook` in `src/openapi.ts`: `{ success: false, message, errors: [{ path, message }] }` with status 400. External callers of `/api/notify/{token}` depend on this shape.

## Dependency Notes

- `@simplewebauthn/*` stays on 13.2.2. Versions 13.3.x and 14.x pull in `@peculiar/x509`, and the bundled Worker then fails at startup with `Cannot get schema for 'AlgorithmIdentifier' target`. Verify any upgrade with `bun run preview`, not only `tsc`.
- `@types/psl` is required: the `psl` package ships types, but its `exports` map does not expose them to `tsc`.
- `@cloudflare/workers-types` v5 has no dated entry points; `tsconfig.json` uses the package root.
- `typescript` is a direct dev dependency; nothing else installs `tsc`.
- Vite+ (`vite-plus`) was evaluated and deferred until its 1.0 release; see `docs/research/2026-09-26-toolchain-upgrade.md`.

## Cloudflare Workers

Environments in `wrangler.toml`: top-level `subs-tracker`, `production` (`subscription-manager`), `staging` (`subscription-manager-staging`).

- Secrets: `wrangler secret put <NAME> --env production`. Keep KV namespace IDs and API keys out of the repository.
- Local KV: `wrangler kv key list --binding SUBSCRIPTIONS_KV --local`. The subscription list is under the key `subscriptions`; passkeys are under `webauthn:credential:<id>` (see `src/services/webauthn.ts`). For production KV, replace `--local` with `--env production`.
- Cron: the `scheduled` handler runs on the `crons` schedule. Trigger it in production from Cloudflare Dashboard → Workers → Triggers → Cron Triggers → "Trigger Now".
- Logs: `wrangler tail --env production`.
- Crypto: use `src/utils/crypto.ts` (Web Crypto API).

## Architecture Decisions

KV holds subscription data for fast global reads. Consider D1 if the data needs SQL queries or relationships. Durable Objects are not used: they cost more and this app does not need coordination.

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
