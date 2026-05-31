# ARCHITECTURE.md

> Structure, layer responsibilities, and data flow for **subs-tracker**.
> Runtime is **Cloudflare Workers** (edge), not Electron — the "layers" below are
> the Worker's request/render/storage tiers, not desktop process tiers.

## Stack

Hono + Vite + TypeScript (strict, no `any`) on Cloudflare Workers (`nodejs_compat`).
SSR via `hono/jsx`; client islands via `hono/jsx/dom`. UI: Tailwind v4 + DaisyUI.
Storage: Workers KV (`SUBSCRIPTIONS_KV`). Scheduling: Cron Triggers. Package manager: **bun**.

## Layers

| Layer | Path | Responsibility |
|------|------|----------------|
| **Worker entry** | `src/index.tsx` | Builds the Hono app, mounts middleware/routes, serves SSR pages, and exports `{ fetch, scheduled }`. `scheduled()` is the cron entry. |
| **Middleware** | `src/middleware/auth.ts` | `authMiddleware` (API JWT), `pageAuthMiddleware` (protect `/admin*` pages), `optionalAuthMiddleware` (`/`). |
| **Routes (API)** | `src/routes/*.ts` | Hono + zod-openapi handlers: `auth` (login), `subscriptions` (CRUD), `config`, `notify`, `webauthn`. Return the `{ success, data, message }` envelope (`src/utils/response.ts`). |
| **Services (domain)** | `src/services/**` | Business logic, the only layer that touches KV. `config.ts` (getConfig/saveConfig, `getCurrentHour`), `subscription.ts` (auto-renewal), `subscription_cron.ts` (`processSubscriptionReminder`), `notifier/**` (multi-channel send), `webauthn.ts`. |
| **SSR pages** | `src/pages/*.tsx` | `Login`, `Admin`, `Config` — server-rendered `hono/jsx` pages. |
| **Components** | `src/components/**` | Shared SSR components (`Layout`, `Navbar`, `ToggleTheme`, `admin/*`). |
| **Client islands** | `src/client/**` | Vite-built browser scripts (`admin/`, `config/`, `login/`) rendered with `hono/jsx/dom`. New shared base layer: `src/client/lib/` (`api`/`dom`/`async-ui`/`icons`/`store`). |
| **Utils** | `src/utils/**` | `crypto` (hash/JWT/cookies), `time` (timezone parts), `formAdaptor`, `response` (envelope), `toast`, `url`, `logger`, `constants`. |
| **Types** | `src/types/**` | `index.ts` (`Subscription`, `Config`), `api.d.ts` (envelope), `webauthn.ts`, `error.ts`. |

## Data flow — HTTP

```
Browser → Worker (src/index.tsx)
  → middleware (auth) → route handler (src/routes/*) → service (src/services/*) → KV
  → response envelope { success, data, message }
SSR page (src/pages/*) rendered on GET → HTML references Vite island bundles
  → island (src/client/*) hydrates with hono/jsx/dom → calls /api/* via fetch (→ lib/api unwraps envelope)
```

## Data flow — Cron

```
Cron Trigger → scheduled() (src/index.tsx)
  → getConfig(env) → getCurrentHour(config) (config.TIMEZONE) → isNotificationAllowedAtHour
  → for each subscription: processSubscriptionReminder() (pure; returns updatedSubscription)
  → applyAutoRenewal / sendSubscriptionReminder (src/services/notifier) → persist updates to KV
```

## Invariants (do not break in the current refactor)

- API response envelope shape `{ success, data, message }`.
- Route paths and handler contracts (`src/routes/**`).
- KV key schema / storage semantics (`config`, `subscriptions`, webauthn credentials).

See **AGENTS.md → Refactor Harness** for the active scope boundary and verification workflow,
and `docs/superpowers/` for the spec and per-phase plans.
