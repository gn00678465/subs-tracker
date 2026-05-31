# PRODUCT.md

> Product scope and current-phase goals for **subs-tracker** (SubsTracker).

## What it is

A self-hosted **subscription expiry & renewal manager** running on Cloudflare Workers.
A single admin signs in, records their paid subscriptions, and the Worker sends
reminders before each one renews/expires — so nothing auto-charges unnoticed.

## Feature scope (current)

- **Auth**: single-admin login (username + password, password stored hashed) with
  optional **WebAuthn / passkey** sign-in. JWT in a `Secure` cookie.
- **Subscriptions**: CRUD with category, currency/price, start/expiry dates, billing
  period (day/month/year × method), free-trial flag, active/inactive, per-item reminder lead time.
- **Auto-renewal**: expired + `autoRenew` items roll their expiry date forward.
- **Reminders (cron)**: scheduled checks honor `config.TIMEZONE` and allowed-hours window;
  send via multiple channels — **Telegram, Webhook, Email (Resend), Bark, NotifyX**.
- **Config page**: manage admin credentials, timezone, notification hours, channels, and WebAuthn settings.
- **UX**: zh-TW UI, light/dark themes, PWA (service worker offline caching), DaisyUI styling.

## Out of scope (today)

Multi-user/tenancy, payment integration, mobile-native apps, analytics/reporting.
KV is the only datastore (no SQL/D1).

## Current phase

**Frontend client-layer refactor** on branch `refactor/frontend-client-layer` — a behavior-preserving
cleanup, not a feature change. Goals (see `docs/superpowers/specs/` + `docs/superpowers/plans/`):

1. **S0 foundation** — supply-chain hardening, gitleaks, Vitest, AI/harness assets. ✅
2. **Visual harness** — Playwright screenshots over `wrangler dev` for before/after review.
3. **Client lib layer** — `src/client/lib/` (`api`/`dom`/`async-ui`/`icons`/`store`) to kill duplicated fetch/loading/render boilerplate.
4. **Cron fixes** — unify timezone (`getCurrentHour`) and make `processSubscriptionReminder` immutable.
5. **Island refactors** — migrate admin/config/login islands onto the lib layer; remove `any`, `window.*` globals, inline `onclick`.
6. **Visual uplift (PV)** — custom DaisyUI theme + Tailwind tokens (user-selected direction).
7. **Finishing cleanup** — slop removal, all-green checks, ready-for-PR.

Success = `bun run lint && bun run typecheck && bun run test && bun run build` green,
client layer has zero `any` with one standard way to fetch/load/render, lib+adaptor+cron ≥ 80% covered,
and visual review approved with no functional regressions.
