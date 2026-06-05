---
name: dlc-scaffold-elysia
description: Scaffold an Elysia backend API app inside an existing Bun/Turborepo monorepo. Three-layer architecture (Controller/Service/API), Drizzle ORM, Zod validation, Bun test runner. Run /dlc-scaffold-monorepo first.
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: backend
  tags: [elysia, backend, api, bun, drizzle, monorepo]
  argument-hint: <app-name>
---

# Scaffold Elysia Backend API

Add an Elysia backend API app to an existing monorepo scaffolded with `/dlc-scaffold-monorepo`.

## Arguments

- `$1` - **app name** (required). Creates `apps/$1/`. Example: `api`

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
    "dev": "bun --watch src/server.ts",
    "start": "bun src/server.ts",
    "typecheck": "tsc --noEmit",
    "fmt": "biome format --write ./src",
    "lint": "biome lint --write ./src",
    "check": "biome check ./src",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@elysiajs/swagger": "^1.0.0",
    "drizzle-orm": "^0.38.0",
    "elysia": "^1.0.0",
    "postgres": "^3.4.0",
    "zod": "^3.23.0",
    "@{org}/types": "workspace:*"
  },
  "devDependencies": {
    "@elysiajs/eden": "^1.0.0",
    "@types/bun": "^1.3.8",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.9.3",
    "@{org}/tsconfig": "workspace:*"
  }
}
```

### `apps/$1/tsconfig.json`

```json
{
  "extends": "@{org}/tsconfig/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": ".",
    "baseUrl": ".",
    "outDir": "./dist",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### `apps/$1/biome.jsonc`

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": "//",
  "root": false,
  "files": {
    "includes": ["src/**/*"]
  }
}
```

### `apps/$1/drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### `apps/$1/.env.example`

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/$1

# Server
PORT=3000
NODE_ENV=development
```

---

## Step 2 - Core Source Files

### `apps/$1/src/server.ts`

```typescript
import { createApp } from "./app";

const port = process.env.PORT || 3000;

const app = createApp();

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export type App = ReturnType<typeof createApp>;
```

### `apps/$1/src/app.ts`

```typescript
import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { v1Module } from "./modules/v1/v1.module";
import { TeardownError } from "./errors";

export function createApp() {
  return new Elysia()
    .use(
      swagger({
        documentation: {
          info: {
            title: "$1 API",
            version: "1.0.0",
          },
        },
      })
    )
    .onError(({ code, error, set }) => {
      if (error instanceof TeardownError) {
        set.status = error.status;
        return { error: error.message, status: error.status };
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return { error: "Validation failed", message: error.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    })
    .use(v1Module);
}
```

### `apps/$1/src/errors.ts`

```typescript
export class TeardownError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message);
  }

  get status() {
    return this.code;
  }
}

export class BadRequestError extends TeardownError {
  constructor(message = "Bad request") {
    super(400, message);
  }
}

export class UnauthorizedError extends TeardownError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends TeardownError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class NotFoundError extends TeardownError {
  constructor(message = "Not found") {
    super(404, message);
  }
}
```

### `apps/$1/src/lib/logger.ts`

```typescript
export class Logger {
  constructor(private context: string) {}

  info(message: string, ...args: unknown[]) {
    console.log(`[${this.context}] INFO: ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]) {
    console.error(`[${this.context}] ERROR: ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    console.warn(`[${this.context}] WARN: ${message}`, ...args);
  }
}
```

### `apps/$1/src/lib/db.ts`

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

let db: ReturnType<typeof createDrizzleClient> | null = null;

function createDrizzleClient(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle({ client, schema });
}

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    db = createDrizzleClient(url);
  }
  return db;
}
```

---

## Step 3 - Plugins

### `apps/$1/src/plugins/auth.plugin.ts`

```typescript
import { Elysia } from "elysia";
import { UnauthorizedError } from "@/errors";

export const authGuard = new Elysia({ name: "auth-guard" }).derive(
  { as: "global" },
  async ({ request }) => {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new UnauthorizedError("Missing authorization token");
    }

    // TODO: Replace with actual token validation
    const user = { id: token, email: "user@example.com" };

    return { user };
  }
);
```

---

## Step 4 - Module Structure

### `apps/$1/src/modules/v1/v1.module.ts`

```typescript
import { Elysia } from "elysia";
import { healthModule } from "./health/health.module";

export const v1Module = new Elysia({
  name: "v1",
  prefix: "/v1",
  tags: ["v1"],
}).use(healthModule);
```

### `apps/$1/src/modules/v1/health/health.module.ts`

```typescript
import { Elysia } from "elysia";

export const healthModule = new Elysia({
  name: "health",
  prefix: "/health",
  tags: ["Health"],
}).get(
  "",
  () => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  }),
  {
    detail: {
      summary: "Health check",
      description: "Returns server health status",
      tags: ["Health"],
    },
  }
);
```

### `apps/$1/src/modules/v1/health/health.module.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { edenFetch } from "@elysiajs/eden";
import { createApp } from "@/app";
import type { App } from "@/server";

describe("Health Module", () => {
  let client: ReturnType<typeof edenFetch<App>>;

  beforeEach(() => {
    const app = createApp();
    client = edenFetch<App>(app);
  });

  it("should return health status", async () => {
    const { data, error } = await client("/v1/health", {
      method: "GET",
    });

    expect(error).toBeUndefined();
    expect(data?.status).toBe("ok");
    expect(data?.timestamp).toBeDefined();
  });
});
```

---

## Step 5 - Database Schema Placeholder

### `apps/$1/src/db/schema/index.ts`

```typescript
// Add Drizzle table definitions here.
// Example:
//
// import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
//
// export const users = pgTable("users", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   email: text("email").notNull().unique(),
//   name: text("name").notNull(),
//   created_at: timestamp("created_at").defaultNow().notNull(),
//   updated_at: timestamp("updated_at").defaultNow().notNull(),
// });
```

---

## Step 6 - Types

### `apps/$1/src/types/index.ts`

```typescript
export type { AsyncResult, Result, SuccessResult, ErrorResult } from "@{org}/types";
export { ok, err } from "@{org}/types";
```

---

## Step 7 - AGENTS.md & CLAUDE.md

### `apps/$1/AGENTS.md`

````markdown
# {AppName} API

Elysia backend API with three-layer architecture, Drizzle ORM, and Bun runtime.

## Stack

- **Elysia** - Type-safe web framework
- **Bun** - Runtime, package manager, test runner
- **TypeScript 5** - Strict mode, path aliases
- **Zod** - Schema validation
- **Drizzle ORM** - Type-safe PostgreSQL ORM
- **Bun Test** - Built-in test runner
- **edenFetch** - Type-safe HTTP client for testing

## Commands

```bash
bun run dev          # Watch mode dev server
bun run start        # Production server
bun run typecheck    # Type check
bun run check        # Biome lint + format
bun test             # Run tests
bun test --watch     # Watch tests
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run migrations
bun run db:push      # Push schema to DB
bun run db:studio    # Drizzle Studio
```

## Architecture - Three-Layer

```
Controller (Module) → Service → API
     ↓                  ↓         ↓
  Routes          Business     Database
  Validation      Logic        Operations
  OpenAPI         Orchestration
```

**Rules:**
1. Controllers ONLY call services
2. Services call APIs OR other services
3. APIs ONLY interact with database/external systems
4. No layer skipping

## Directory Structure

```
src/
├── server.ts                    # Entry point
├── app.ts                       # App factory (createApp)
├── errors.ts                    # Error classes
├── lib/
│   ├── logger.ts                # Logger base class
│   └── db.ts                    # Drizzle client singleton
├── plugins/
│   └── auth.plugin.ts           # Auth guard plugin
├── types/
│   └── index.ts                 # Re-exports from @{org}/types
├── db/
│   └── schema/
│       └── index.ts             # Drizzle table definitions
└── modules/
    └── v1/
        ├── v1.module.ts         # Composition root
        └── {feature}/
            ├── {feature}.module.ts
            ├── {feature}.schema.ts
            ├── services/
            │   ├── {feature}.service.ts
            │   └── {feature}.service.test.ts
            └── apis/
                ├── {feature}.api.ts
                └── {feature}.api.test.ts
```

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Controller | `{feature}.module.ts` | `users.module.ts` |
| Service | `services/{feature}.service.ts` | `services/users.service.ts` |
| API | `apis/{feature}.api.ts` | `apis/users.api.ts` |
| Schema | `{feature}.schema.ts` | `users.schema.ts` |
| Test | `{feature}.{layer}.test.ts` | `users.service.test.ts` |
| Plugin | `{name}.plugin.ts` | `auth.plugin.ts` |

## Layer Responsibilities

| Layer | Calls | Returns | Contains |
|-------|-------|---------|----------|
| Controller | Service | HTTP Response | Routes, validation, docs |
| Service | API, Service | AsyncResult<T> | Business logic, orchestration |
| API | DB/External | AsyncResult<T> | CRUD, queries, external calls |

## Adding a New Feature Module

1. Create `src/modules/v1/{feature}/{feature}.module.ts` - routes + validation
2. Create `src/modules/v1/{feature}/{feature}.schema.ts` - Zod schemas
3. Create `src/modules/v1/{feature}/services/{feature}.service.ts` - business logic
4. Create `src/modules/v1/{feature}/apis/{feature}.api.ts` - database ops
5. Register in `src/modules/v1/v1.module.ts` via `.use(featureModule)`
6. Add Drizzle table to `src/db/schema/index.ts` if needed
7. Colocate `.test.ts` files next to each layer

## Patterns

### Result Pattern (Services & APIs)

```typescript
import type { AsyncResult } from "@/types";

async function findUser(id: string): AsyncResult<User> {
  try {
    const user = await db.select().from(users).where(eq(users.id, id));
    if (!user.length) return { success: false, error: "Not found" };
    return { success: true, data: user[0] };
  } catch (error) {
    return { success: false, error: "Database error" };
  }
}
```

### Controller Pattern

```typescript
.get("/:id", async ({ params, user, set }) => {
  const result = await featureService.getById(params.id, user.id);
  if (!result.success) {
    set.status = 404;
    return { error: result.error };
  }
  return result.data;
})
```

### Service Pattern

```typescript
export class FeatureService extends Logger {
  constructor(private featureApi: FeatureApi) {
    super("feature-service");
  }

  async getById(id: string, userId: string): AsyncResult<Feature> {
    const result = await this.featureApi.findById(id);
    if (!result.success) return result;
    if (result.data.ownerId !== userId) {
      return { success: false, error: "Access denied" };
    }
    return result;
  }
}

export const featureService = new FeatureService(featureApi);
```

### API Pattern

```typescript
export class FeatureApi extends Logger {
  constructor() {
    super("feature-api");
  }

  async findById(id: string): AsyncResult<Feature | null> {
    try {
      const db = getDb();
      const result = await db.select().from(features).where(eq(features.id, id)).limit(1);
      if (!result.length) return { success: true, data: null };
      return { success: true, data: FeatureSchema.parse(result[0]) };
    } catch (error) {
      this.error(`Failed to find feature: ${error}`);
      return { success: false, error: "Database error" };
    }
  }
}

export const featureApi = new FeatureApi();
```

## Import Conventions

```typescript
// 1. External packages
import { Elysia } from "elysia";
import { z } from "zod";

// 2. Monorepo packages
import type { AsyncResult } from "@{org}/types";

// 3. Absolute local
import { authGuard } from "@/plugins/auth.plugin";
import { Logger } from "@/lib/logger";

// 4. Relative (within same feature)
import { featureService } from "./services/feature.service";
```

## Testing

- **Module tests**: Integration with edenFetch, spy on services
- **Service tests**: Unit tests with mocked APIs
- **API tests**: Unit tests with mocked DB client
- Coverage targets: Controllers 80%+, Services 90%+, APIs 80%+

## Anti-Patterns

- **Don't** skip layers (controller calling API directly)
- **Don't** put business logic in API layer
- **Don't** pass entire Elysia context to services
- **Don't** use `any` - type everything
- **Don't** forget error handling with Result pattern
````

### `apps/$1/CLAUDE.md`

```markdown
# Claude Context

See @AGENTS.md for full documentation.

## Quick Reference

- **Stack**: Elysia + Bun + Drizzle ORM + Zod
- **Port**: 3000

## Commands

```bash
bun run dev       # Watch mode dev server
bun run typecheck # Type check
bun run check     # Biome lint + format
bun test          # Run tests
```
```

---

## Step 8 - Install & Verify

After creating all files:

1. `bun install` - resolves workspace deps
2. `bun run typecheck` - zero TS errors
3. `bun test apps/$1` - health check test passes
4. `bun run dev --filter=@{org}/$1` - server starts on port 3000
5. `curl http://localhost:3000/v1/health` - returns `{ "status": "ok", "timestamp": "..." }`
6. `curl http://localhost:3000/swagger` - Swagger UI loads
7. Verify AGENTS.md exists at app root

---

## Elysia API Rules

In addition to the 8 shared rules from `/dlc-scaffold-monorepo`:

9. **Three-layer architecture** - Controller → Service → API, no layer skipping
10. **Result pattern for errors** - services and APIs return `AsyncResult<T>`, never throw
11. **Zod for validation** - complex schemas use Zod, simple ones use Elysia.t
12. **Named plugins** - always set `name` on Elysia instances for deduplication
13. **Singleton exports** - services and APIs export singleton instances with constructor injection
