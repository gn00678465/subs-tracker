# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SubsTracker is a subscription management and reminder system built as a Cloudflare Worker. The application uses:
- **Hono** framework with OpenAPI support for routing and API documentation
- **TypeScript** with JSX for server-side rendering (Hono JSX)
- **Vite** for development and bundling
- **Cloudflare Workers** runtime with KV for data persistence
- **Bun** as the package manager (defined in package.json)
- **Tailwind CSS 4.x** with DaisyUI for styling
- **htmx** for client-side interactivity

## Build & Development Commands

```bash
# Install dependencies
bun install

# Development server (runs on http://localhost:5173)
bun run dev

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix

# Build for production
bun run build

# Preview production build locally
bun run preview

# Deploy to Cloudflare Workers
bun run deploy

# Generate TypeScript types from wrangler config
bun run cf-typegen
```

## Architecture

### Application Entry Point

`src/index.tsx` is the main entry point (configured in `wrangler.toml`). It exports:
- `fetch`: Handles HTTP requests using Hono router
- `scheduled`: Handles cron tasks (configured to run daily at 8:00 AM)

### Directory Structure

```
src/
├── index.tsx              # Application entry (fetch + scheduled handlers)
├── openapi.ts             # OpenAPI Hono instance factory
├── renderer.tsx           # JSX rendering utilities
├── types/
│   ├── index.ts           # Core types (Bindings, Subscription, Config, JWTPayload)
│   ├── api.ts             # API response types
│   └── htmx.d.ts          # htmx type definitions
├── middleware/
│   └── auth.ts            # JWT authentication middlewares
├── routes/                # Hono route handlers
│   ├── auth.ts            # Login/logout endpoints
│   ├── subscriptions.ts   # CRUD for subscriptions
│   ├── config.ts          # System configuration
│   └── notify.ts          # Third-party notification triggers
├── services/              # Business logic
│   ├── subscription.ts    # Subscription CRUD & auto-renewal
│   └── config.ts          # Config management
├── utils/
│   ├── crypto.ts          # JWT & password hashing (hono/jwt, HMAC-SHA256)
│   ├── time.ts            # Date/time utilities (Gregorian only)
│   ├── logger.ts          # Logging utilities
│   └── response.ts        # Standardized API response helpers
├── components/            # Reusable JSX components
│   ├── Layout.tsx         # Base HTML layout
│   └── Navbar.tsx         # Navigation bar
├── pages/                 # Full page JSX components
│   ├── Login.tsx          # Login page
│   ├── Admin.tsx          # Subscription management UI
│   └── Config.tsx         # Settings page
└── client/                # Client-side TypeScript modules
    ├── login/index.ts     # Login form handling
    └── admin/index.ts     # Admin page interactivity
```

### Key Architectural Patterns

**OpenAPI Integration**: The app uses `@hono/zod-openapi` for schema validation and automatic API documentation. Create the Hono instance via `createOpenAPIApp()` from `src/openapi.ts`.

**Authentication Flow**:
- Three middlewares in `src/middleware/auth.ts`:
  - `authMiddleware`: Strict JWT validation for API routes (returns 401 on failure)
  - `pageAuthMiddleware`: JWT validation for pages (redirects to `/` on failure)
  - `optionalAuthMiddleware`: Non-blocking JWT check (used on login page)
- JWT tokens stored in cookies (`auth_token`) and verified against `JWT_SECRET` from config
- Password hashing uses HMAC-SHA256 (see `src/utils/crypto.ts`)

**API Response Standard**:
All API responses follow the format defined in `src/types/api.ts`:
- Success: `{ success: true, data?: T, message?: string }`
- Error: `{ success: false, message: string, errors?: [...], code?: string }`
- Use helpers from `src/utils/response.ts`: `success()`, `created()`, `notFound()`, `validationError()`, etc.

**Data Layer**:
- All data stored in Cloudflare KV (`SUBSCRIPTIONS_KV` binding)
- Services (`src/services/`) encapsulate KV operations
- No database migrations required (this is a refactored greenfield project)

**Frontend Rendering**:
- Server-side JSX using Hono JSX (`jsxImportSource: "hono/jsx"`)
- Client-side interactivity via htmx and vanilla TypeScript modules
- Vite handles both SSR and client-side bundling via `vite-ssr-components`

## Important Implementation Notes

### Removed Features

This project has deliberately **removed** the following features during refactoring:
- **Lunar calendar support**: All date calculations are Gregorian-only
- **WeChat Bot notifications**: Removed as a notification channel
- Do not re-introduce these features or reference them in code

### Subscription Data Model

The `Subscription` type (in `src/types/index.ts`) has:
- `reminderValue` + `reminderUnit` (preferred)
- `reminderDays` / `reminderHours` (deprecated, kept for backward compatibility)
- Auto-renewal logic in `src/services/subscription.ts` handles Gregorian date calculations only

### Environment & Configuration

**Cloudflare Bindings** are typed in `src/types/index.ts` as `Bindings`:
- Always pass `Bindings` as the generic to Hono: `new Hono<{ Bindings: Bindings }>()`
- Run `bun run cf-typegen` after modifying `wrangler.toml` to update types

**Configuration** is stored in KV and managed by `src/services/config.ts`:
- Defaults are defined in `getConfig()`
- Sensitive values (JWT_SECRET, ADMIN_PASSWORD) are auto-generated if missing
- `NOTIFICATION_HOURS` is parsed from comma-separated string to number array

### Refactoring Status

Check `.serena/memories/SubsTracker_Refactoring_Plan.md` for the full refactoring plan. Current status:
- ✅ Phases 1-4: Infrastructure, core logic, services, and API routes complete
- 🚧 Phase 5: Frontend template migration (partially complete)
- ⏳ Phases 6-7: Notification system and cron tasks (pending)

## Testing

Currently no test framework is configured. When writing tests:
- Use Cloudflare Workers testing patterns
- Mock KV bindings
- Test API routes using Hono's test utilities

## Deployment

The app is configured for Cloudflare Workers:
- **Production**: `subscription-manager.workers.dev` (env: `production`)
- **Staging**: `subscription-manager-staging.workers.dev` (env: `staging`)
- **Default/Preview**: `subs-tracker.workers.dev`

KV namespace ID is shared across environments (configured in `wrangler.toml`).

## Code Style

- ESLint configured with `@antfu/eslint-config`
- TypeScript strict mode enabled
- Use Hono JSX for components (not React)
- Prefer functional components and arrow functions
- Import from `hono/jsx` for JSX types (e.g., `FC`, `PropsWithChildren`)
