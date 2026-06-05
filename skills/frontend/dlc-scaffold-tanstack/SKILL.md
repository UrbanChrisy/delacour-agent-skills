---
name: dlc-scaffold-tanstack
description: Scaffold a TanStack Start + Vite app inside an existing Bun/Turborepo monorepo. Creates routes, server functions, API clients, and AGENTS.md files. Run /dlc-scaffold-monorepo first.
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.1"
  category: frontend
  tags: [tanstack-start, vite, ssr, frontend, monorepo]
  argument-hint: <app-name>
---

# Scaffold TanStack Start App

Add a TanStack Start + Vite SSR app to an existing monorepo scaffolded with `/dlc-scaffold-monorepo`.

## Arguments

- `$1` - **app name** (required). Creates `apps/$1/`. Example: `web`

If `$1` is empty, ask the user for an app name. Detect `@{org}` scope from root `package.json`.

---

## Step 1 - App Config Files

### `apps/$1/package.json`

```json
{
  "name": "@{org}/$1",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "bun --bun vite dev",
    "build": "bun --bun vite build",
    "serve": "bun --bun vite preview",
    "start": "bun run .output/server/index.mjs",
    "typecheck": "tsc --noEmit",
    "fmt": "biome format --write ./src",
    "lint": "biome lint --write ./src",
    "check": "biome check ./src",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### `apps/$1/biome.jsonc`

Use the **React app variant (TanStack / Tauri)** from `/dlc-scaffold-biome`.

### `apps/$1/tsconfig.json`

Use the **TanStack Start app** variant from `/dlc-scaffold-tsconfig`.

### `apps/$1/vite.config.ts`

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
        crawlLinks: true,
      },
    }),
    nitro({ preset: "bun" }),
    viteReact(),
  ],
});
```

- **Nitro `bun` preset** - builds to `.output/server/index.mjs` for native Bun execution
- **Prerendering** enabled by default - static routes auto-discovered, `crawlLinks` follows `<a>` tags to discover more pages
- Dynamic param routes (`/$orgSlug`) are auto-excluded from prerendering

---

## Step 2 - Directory Structure

```
apps/$1/src/
├── _routes/                    # TanStack Router file-based routes
│   ├── __root.tsx
│   ├── login/
│   ├── auth/
│   └── _authed/
│       ├── _layout.tsx
│       └── $orgSlug/
├── core/
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   ├── index.ts
│   ├── logger.ts
│   ├── api/
│   │   ├── {domain}.api.ts           # createServerFn wrappers
│   │   ├── clients/
│   │   │   ├── {domain}.ts           # QueryClient subclass
│   │   │   └── index.ts              # createApiClients()
│   │   ├── hooks/
│   │   │   └── {domain}.hook.ts
│   │   └── util/
│   │       └── logging.middleware.ts
│   └── lib/
│       ├── query-client.ts
│       ├── result.ts
│       └── result.test.ts
├── modules/
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   └── {module-name}/
│       ├── components/
│       ├── types/
│       └── utils/
├── components/
│   ├── ui/
│   └── layouts/authed/
├── hooks/
├── lib/
│   ├── auth/
│   ├── db.ts
│   ├── api.ts
│   ├── storage.ts
│   └── utils.ts
├── test/
├── router.tsx
├── app.css
└── routeTree.gen.ts
```

---

## Step 3 - Key Patterns

### Server Function Pattern

```typescript
// core/api/colors.api.ts
import { createServerFn } from "@tanstack/react-start";
import { loggingMiddleware } from "./util/logging.middleware";

export const getColors = createServerFn({ method: "GET" })
  .middleware([loggingMiddleware])
  .handler(async () => {
    // DB access or service call here
  });
```

### Logging Middleware

```typescript
// core/api/util/logging.middleware.ts
import { createMiddleware } from "@tanstack/react-start";

export const loggingMiddleware = createMiddleware().server(async ({ next }) => {
  const start = performance.now();
  const result = await next();
  const duration = performance.now() - start;
  console.info(`[${duration.toFixed(0)}ms]`, result);
  return result;
});
```

### Client Class Pattern

```typescript
// core/api/clients/colors.ts
import { QueryClient } from "../lib/query-client";
import { getColors, createColor } from "../colors.api";

export class ColorsClient extends QueryClient<"colors"> {
  constructor(queryClient: TanStackQueryClient) {
    super(queryClient, "colors");
  }

  list = this.query("list", {
    queryFn: () => getColors(),
  });

  create = this.mutation("create", {
    mutationFn: (input: CreateColorInput) => createColor({ data: input }),
    onSuccess: () => this.list.refresh(),
  });
}
```

### `createApiClients()` Factory

```typescript
// core/api/clients/index.ts
export function createApiClients(queryClient: TanStackQueryClient) {
  return {
    colors: new ColorsClient(queryClient),
  };
}

export type ApiClients = ReturnType<typeof createApiClients>;
```

### Router Context

```typescript
// router.tsx - context shape
interface RouterContext {
  queryClient: TanStackQueryClient;
  session: Session | null;
  organisation: Organisation | null;
  clients: ApiClients;
}
```

### Data Flow

```
Route beforeLoad → createServerFn (server) → DB/service
                 ↓
         Route context (queryClient, session, org, clients)
                 ↓
         Component → useQuery / useMutation via client
```

### Prerendering Configuration

Default config in `vite.config.ts` prerenders all static routes. Customise via `tanstackStart()` options:

```ts
// vite.config.ts - full prerender options reference
tanstackStart({
  prerender: {
    enabled: true,
    autoSubfolderIndex: true,       // /page → /page/index.html
    autoStaticPathsDiscovery: true, // auto-discover static routes (default)
    crawlLinks: true,               // follow <a> tags to discover more pages
    concurrency: 14,                // parallel prerender jobs
    filter: ({ path }) => !path.startsWith("/api"),
    retryCount: 2,
    retryDelay: 1000,
    maxRedirects: 5,
    failOnError: true,
    onSuccess: ({ page }) => console.log(`Prerendered ${page.path}`),
  },
})
```

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `enabled` | `boolean` | `false` | Activate prerendering |
| `autoSubfolderIndex` | `boolean` | `false` | Output `/page/index.html` instead of `/page.html` |
| `autoStaticPathsDiscovery` | `boolean` | `true` | Auto-discover routes without params |
| `crawlLinks` | `boolean` | `false` | Follow links to discover additional pages |
| `concurrency` | `number` | - | Parallel prerender jobs |
| `filter` | `(page) => boolean` | - | Include/exclude specific paths |
| `failOnError` | `boolean` | `false` | Halt build on prerender errors |

Dynamic param routes (e.g. `/$orgSlug`) are excluded from auto-discovery but can be prerendered if linked from other pages when `crawlLinks` is enabled.

---

## Step 4 - AGENTS.md Files

### `apps/$1/AGENTS.md`

Contains:
- Stack: TanStack Start, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, Nitro (bun preset)
- Dev commands (`bun run dev` on port 3000)
- Build/deploy: `bun --bun vite build` → `.output/` → `bun run .output/server/index.mjs`
- Static routes prerendered at build time (crawlLinks enabled)
- Full `src/` directory tree
- TDD workflow
- Key patterns: routing, auth guard via `_authed/`, data flow, prerendering
- How to add new pages

### `apps/$1/src/core/AGENTS.md`

Contains:
- Overview: "Data layer - server functions, API clients, and shared utilities"
- File structure tree
- Naming conventions table
- Architecture: server function → client class → hook → component
- Prerendering: server functions run at build time - handle missing auth/session gracefully for prerendered routes
- Rules 1-4 (see below)
- "Adding a New Domain" checklist (6 steps):
  1. Create `core/api/{domain}.api.ts` with server functions
  2. Create `core/api/clients/{domain}.ts` extending QueryClient
  3. Register in `core/api/clients/index.ts`
  4. Create `core/api/hooks/{domain}.hook.ts`
  5. Add types to `core/types/{domain}.types.ts` if needed
  6. Write tests: `{domain}.test.ts`

### `apps/$1/src/modules/AGENTS.md`

Contains:
- Purpose: "Feature modules - self-contained UI features"
- Structure template per module
- 5 rules: no barrel exports, colocate tests, import from core/ not between modules, single responsibility, keep components small

### All `CLAUDE.md` files

Every directory with an `AGENTS.md` also gets `CLAUDE.md` containing only: `See @AGENTS.md`

---

## Step 5 - TanStack Start Rules

In addition to the 8 shared rules from `/dlc-scaffold-monorepo`:

9. **All DB access via server functions** - use `createServerFn` + services, never query DB from client
10. **Never call DB from client code** - all data flows through server functions
11. **Middleware for cross-cutting concerns** - logging, timing, auth checks via `createMiddleware`
12. **Nitro `bun` preset for deployment** - use `nitro({ preset: 'bun' })` in vite.config.ts; build outputs to `.output/server/index.mjs`; start with `bun run .output/server/index.mjs`
13. **Prerender static routes** - prerendering enabled by default; dynamic param routes auto-excluded; use `filter` to exclude additional paths; `crawlLinks` discovers linked pages

---

## Step 6 - Verify

1. `bun install` - resolves workspace deps
2. `bun run typecheck` - zero errors
3. `bun run check` - biome passes
4. `bun run test` - all tests pass
5. `bun run dev` - TanStack Start dev server starts on port 3000
6. `bun --bun vite build` - produces `.output/` directory with server bundle
7. `bun run .output/server/index.mjs` - production server starts on port 3000
8. Check `.output/public/` for prerendered HTML files (e.g. `login/index.html`)
9. Verify AGENTS.md files at: app root, `src/core/`, `src/modules/`
