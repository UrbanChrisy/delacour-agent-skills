---
name: dlc-scaffold-better-auth
description: Scaffold better-auth with Drizzle + PostgreSQL in a Bun monorepo. Email OTP, Google OAuth, admin() RBAC with shared permissions, organizations, TanStack Start integration, test config, and coss login UI. Use when setting up auth, adding authentication, or creating login flows.
license: UNLICENSED
metadata:
  author: chris@delacour.co.nz
  version: "0.2.0"
  category: auth
  tags: [auth, better-auth, drizzle, otp, oauth, rbac, organization]
---

# Scaffold Better Auth

Scaffolds a complete better-auth authentication system in a Bun monorepo with Drizzle ORM + PostgreSQL.

## Arguments

- `$1` - auth package name (default: `auth`). Creates `packages/$1/`.
- `--app <name>` - optional app name to wire integration into. Creates route handler, session functions, login UI in `apps/<name>/`.

Detect `@{org}` scope from root `package.json` `name` field.

## Steps

### Step 1 - Auth Package Setup

Create `packages/<name>/` with the following files:

**`package.json`**
```json
{
  "name": "@<org>/auth",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/auth.client.ts"
  },
  "scripts": {
    "fmt": "biome format --write ./src",
    "lint": "biome lint --write ./src",
    "check": "biome check ./src",
    "typecheck": "tsc --noEmit",
    "schema": "bunx @better-auth/cli generate --output ../db/src/schema/auth.schema.ts --yes"
  },
  "dependencies": {
    "@better-auth/core": "^1.6.2",
    "@better-auth/infra": "^0.2.0",
    "@<org>/db": "workspace:*",
    "better-auth": "^1.6.2",
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.5",
    "resend": "^6.10.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@<org>/biome-config": "workspace:*",
    "@<org>/tsconfig": "workspace:*",
    "drizzle-kit": "^0.31.0",
    "typescript": "^6.0.2"
  }
}
```

**`tsconfig.json`** - use the `packages/auth` variant from `/dlc-scaffold-tsconfig` (extends base, bundler module resolution, no declaration output).

**`biome.jsonc`** - use the minimal variant (Elysia / UI / DB / Auth) from `/dlc-scaffold-biome`.

**`src/index.ts`** - barrel re-exporting `./auth.config` (prod factory + types), `./auth.test-config` (test factory + types), and `./permissions` (`ac`, `Role`, `roles`, `statement`). See `references/auth-test-config.md` for the exact export block.

**`auth.ts`** (root) - export `createAuth()` with empty config for CLI schema generation:
```typescript
import { createAuth } from "./src/auth.config";
export const auth = createAuth({} as Parameters<typeof createAuth>[0]);
```

### Step 2 - Server Config

See `references/auth-server-config.md` for the full template.

Key patterns:
- `CreateAuthOptions` type with all env-driven params (db, siteUrl, secrets, API keys)
- `createAuthOptions()` internal function returning `BetterAuthOptions`
- Drizzle adapter with `provider: "pg"` and UUID generation
- RBAC via `admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] })` wired to the shared `ac`/`roles` from `./permissions` (Step 3). Roles are lowercase `user`/`admin`; the plugin adds `role`/`banned`/`banReason`/`banExpires` columns
- Plugins: `tanstackStartCookies()`, `organization()`, `admin()`, `emailOTP()` (6-digit, 600s, Resend delivery), `sentinel()`, `dash()` - `sentinel`/`dash` import from `@better-auth/infra` (server-side)
- Google OAuth with `prompt: "select_account"` and `accessType: "offline"`
- Type exports: `Auth`, `AuthOptions`, `AuthSession`, `AuthUser`, `BetterAuth`, `BetterAuthOptions`

### Step 3 - Permissions (RBAC)

See `references/auth-permissions.md` for the full template.

Creates `src/permissions.ts` (and `src/permissions.test.ts`) - the access-control statements and `roles` map shared by the server `admin()` plugin and the client `adminClient()` so role checks resolve identically on both sides.

Key patterns:
- `statement = { ...defaultStatements }` from `better-auth/plugins/admin/access` (resources `user`, `session`); extend with app resources as needed
- `ac = createAccessControl(statement)`; `user` role (empty) and `admin` role (`...adminAc.statements`)
- Exports `ac`, `roles`, `statement`, and the `Role` type (`"user" | "admin"`)
- `permissions.test.ts` asserts admin grants (`user:ban`, `user:delete`, `session:revoke`) and user denials

### Step 4 - Client Config

See `references/auth-client-config.md` for the full template.

Key patterns:
- Zod-validated env config for site URL (`VITE_<APP>_SITE_URL`)
- Typed export `authClient: AuthClient<BetterAuthClientOptions>`
- Plugins mirror the server: `organizationClient()`, `emailOTPClient()`, `tanstackStartCookies()`, `sentinelClient()`, `dashClient()`, `adminClient({ ac, roles })`
- Infra client plugins import from `@better-auth/infra/client`; `adminClient` consumes the same `ac`/`roles` from `./permissions`

### Step 5 - Test Config

See `references/auth-test-config.md` for the full template.

Creates `src/auth.test-config.ts` - a `createTestAuth` factory mirroring production for E2E/unit tests, with `testUtils({ captureOTP: true })`, a no-op `sendVerificationOTP`, and no OAuth/`sentinel`/`dash`. Only `db`, `siteUrl`, `betterAuthSecret` are required. Never import from production code paths.

### Step 6 - Database Schema

See `references/auth-schema.md` for the full Drizzle schema reference.

The schema is auto-generated by `bun run schema` (output `../db/src/schema/auth.schema.ts`) but provided as reference. Uses plain `pgTable` (default/public schema, not a dedicated `pgSchema`) with 7 tables: user, session, account, verification, organization, member, invitation. `role` is a plain `text` column (default `user`), not an enum. UUID PKs, cascading deletes, indexed FKs.

### Step 7 - App Integration (only if `--app` provided)

See `references/auth-app-integration.md` for all templates.

Creates:
1. **Auth lib singleton** (`apps/<app>/src/lib/auth/index.ts`) - Zod env validation + lazy `getAuth()`
2. **Session functions** (`apps/<app>/src/lib/auth/functions.ts`) - `getSession`, `ensureSession` server functions
3. **Auth API** (`apps/<app>/src/core/api/auth.api.ts`) - `sendOtp`, `verifyOtp` (with `asResponse: true` cookie forwarding), `signOut`
4. **Route handler** (`apps/<app>/src/_routes/api/auth/$.ts`) - catch-all GET/POST delegating to `getAuth().handler()`
5. **Root route** - add `getSession()` in `beforeLoad`, return `session` in context
6. **Auth guard layout** (`apps/<app>/src/_routes/_authed/_layout.tsx`) - redirect to `/login` if no session
7. **Admin guard** (`apps/<app>/src/_routes/_authed/admin/_layout.tsx`) - redirect if `role !== "admin"`

### Step 8 - Login UI (only if `--app` provided)

See `references/auth-login-ui.md` for all component templates.

Creates:
1. **Login page** (`/login/index.tsx`) - redirects if authenticated, renders LoginForm
2. **OTP page** (`/login/code-confirm.tsx`) - validates `?email=` search param, renders OtpVerificationForm
3. **OAuth callback** (`/auth/callback.tsx`) - immediate redirect (better-auth handles OAuth at `/api/auth/*`)
4. **LoginForm** - Google OAuth button + email input + OTP send using coss Card, Button, Input, Field
5. **OtpVerificationForm** - 6-digit InputOTP with auto-submit, resend, back using coss Card, Button, InputOTP
6. **Role utilities** - `UserRole` (re-exports `Role`), `getUserRole()`, `isAdmin()`, `useIsAdmin()` hook (all check lowercase `admin`)
7. **ViewMode context** - admin/user view switching for `admin` users

### Step 9 - Environment Variables

Create `.env.example` in project root:

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | server | Session signing secret |
| `RESEND_API_KEY` | server | Email OTP delivery via Resend |
| `GOOGLE_CLIENT_ID` | server | Google OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | server | Google OAuth credentials |
| `VITE_<APP>_SITE_URL` | both | Base URL (e.g. `http://localhost:3000`) |

### Step 10 - Verify

1. `bun install`
2. `bun test packages/<name>/src/permissions.test.ts` - RBAC roles pass
3. `bun run typecheck` - zero errors
4. `bun run schema` - generates Drizzle schema in db package
5. `bun run db:generate && bun run db:migrate` - creates auth tables in PostgreSQL
6. If app integration: dev server starts, `/login` renders, `/api/auth/ok` returns 200

## Critical Gotchas

- **`asResponse: true`** in `verifyOtp` is mandatory - without it, session cookies never reach the browser in SSR frameworks
- **Dynamic import** for Resend (`await import("resend")`) keeps it out of client bundles
- **Lazy singleton** `getAuth()` avoids module-level side effects that break SSR/prerendering
- **UUID generation** must use `advanced.database.generateId: "uuid"` - Drizzle adapter defaults to cuid otherwise
- **Cascading deletes** on session/account FKs - always set `onDelete: "cascade"` referencing user.id
- **Cookie forwarding** in `verifyOtp` - must read `set-cookie` from response and call `setResponseHeader("set-cookie", setCookie)`
- **Shared permissions** - `auth.config.ts`, `auth.client.ts`, and `auth.test-config.ts` must all import the same `ac`/`roles` from `./permissions`. Defining roles in only one place desyncs server/client authorization
- **Lowercase roles** - role values are `user`/`admin` (not `USER`/`ADMIN`); the `role` column is plain `text`, so a casing mismatch silently fails every admin check
- **`@better-auth/infra` import paths** - server uses `sentinel`/`dash` from `@better-auth/infra`; client uses `sentinelClient`/`dashClient` from `@better-auth/infra/client`. Swapping them breaks the build
