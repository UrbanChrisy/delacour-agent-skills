---
name: dlc-scaffold-db
description: Scaffold a shared Drizzle ORM + PostgreSQL database package in a Bun/Turborepo monorepo. Pooled singleton client with connection retry, org-scoped service layer with AsyncResult, zod validation, transactions, soft-deletes, error handling, and migrations. Run /dlc-scaffold-monorepo first.
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.2.0"
  category: database
  tags: [drizzle, postgresql, database, bun, monorepo]
  argument-hint: <package-name>
---

# Scaffold Database Package (Drizzle ORM + PostgreSQL)

Add a shared database package to an existing monorepo scaffolded with `/dlc-scaffold-monorepo`.

## Arguments

- `$1` - **package name** (required). Creates `packages/$1/`. Example: `db`

If `$1` is empty, ask the user for a package name. Detect `@{org}` scope from root `package.json`.

---

## Step 1 - Package Config Files

### `packages/$1/package.json`

```json
{
  "name": "@{org}/$1",
  "version": "1.0.0",
  "description": "Database schema and migrations using Drizzle ORM",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "fmt": "biome format --write ./src",
    "lint": "biome lint --write ./src",
    "check": "biome check ./src",
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate",
    "studio": "drizzle-kit studio",
    "reset": "bun run scripts/reset.ts",
    "seed": "bun run src/seed/demo.ts",
    "seed:production": "bun run src/seed/production.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@{org}/types": "workspace:*",
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.5",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@{org}/tsconfig": "workspace:*",
    "dotenv": "^17.4.1",
    "drizzle-kit": "^0.31.0",
    "typescript": "^5.9.3"
  }
}
```

> **Note:** the source `openroad` package pins `typescript: ^6.0.2`; that is not a
> released TypeScript line, so this skill keeps the stable `^5.9.3`. `postgres` is a
> dependency only for the `reset.ts` / seed scripts (the runtime client uses
> `drizzle-orm/bun-sql`). `dotenv` is used by `drizzle.config.ts` to load the root
> `.env.local` in local dev.

### `packages/$1/tsconfig.json`

Use the **`packages/db`** variant from `/dlc-scaffold-tsconfig` (extends base, includes `src`, `scripts`, `drizzle.config.ts`).

### `packages/$1/biome.jsonc`

Use the **minimal variant (Elysia / UI / DB / Auth)** from `/dlc-scaffold-biome`.

### `packages/$1/.env.example`

```env
# Direct Postgres connection for Drizzle ORM
# Local: postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

### `packages/$1/drizzle.config.ts`

```typescript
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local dev: load root .env.local. In Railway/CI the file is absent (no-op) and
// already-set process.env vars are never overridden, so injected env wins.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env.local"), quiet: true });

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema/index.ts",
	out: "./migrations",
	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
});
```

---

## Step 2 - Core Source Files

### `packages/$1/src/index.ts`

```typescript
// NOTE: `./client` is intentionally NOT re-exported here — it imports
// `drizzle-orm/bun-sql`, which pulls the Bun-only `"bun"` built-in into any
// client-reachable module graph (bundlers like Vite won't tree-shake it out).
// Server-only consumers import `getDb`/`DrizzleDb` from `./client` directly.
export { friendlyDbError } from "./errors";
export * from "./schema";
export * from "./services";
```

> The `schema` barrel re-exports each domain's table file **and** its `.zod` file,
> so newly added zod schemas surface through `@{org}/$1` without editing this file.

### `packages/$1/src/client.ts`

```typescript
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

/** The transaction handle passed to `db.transaction((tx) => ...)`. */
export type DrizzleTx = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

/** Either a pooled connection or an open transaction — anything that can run writes. */
export type DrizzleExecutor = DrizzleDb | DrizzleTx;

let _db: DrizzleDb | undefined;

export function getDb(): DrizzleDb {
	const databaseUrl = Bun.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is not set");
	}

	if (!_db) {
		_db = drizzle({
			schema,
			connection: {
				url: databaseUrl,
				// Close idle sockets before PG's server-side idle timeout can.
				idleTimeout: 30,
				// Hard-recycle long-lived sockets to avoid stale-after-restart state.
				maxLifetime: 60 * 30,
				// Fail fast on initial connect instead of hanging.
				connectionTimeout: 30,
				onconnect: (err) => {
					if (err) console.error("[db] connect failed", err);
				},
				onclose: (err) => {
					// Ignore expected recycles (idle + max-lifetime) — only log real failures.
					if (!err) return;
					if (/idle timeout|lifetime/i.test(err.message)) return;
					console.warn("[db] connection closed", err.message);
				},
			},
		});
	}
	return _db;
}

/** PG/Bun error codes that indicate a stale or broken connection safe to retry. */
const RECONNECTABLE_CODES = new Set<string>([
	"ERR_POSTGRES_CONNECTION_CLOSED",
	"ERR_POSTGRES_CONNECTION_TIMEOUT",
	"ERR_POSTGRES_SERVER_ERROR",
]);

/**
 * Detects whether an error represents a transient connection-level failure
 * that is safe to retry. Drizzle wraps Bun's `PostgresError` as `error.cause`.
 */
export function isReconnectable(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const cause = (error as Error & { cause?: { code?: unknown } }).cause;
	if (!cause || typeof cause !== "object") return false;
	const code = (cause as { code?: unknown }).code;
	return typeof code === "string" && RECONNECTABLE_CODES.has(code);
}

export interface WithDbRetryOptions {
	retries?: number;
	baseDelayMs?: number;
}

/**
 * Runs `fn` and retries on connection-level errors with exponential backoff.
 * Non-reconnectable errors (constraint violations, validation, etc.) are
 * thrown immediately so we never mask real failures.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, opts: WithDbRetryOptions = {}): Promise<T> {
	const retries = opts.retries ?? 2;
	const baseDelayMs = opts.baseDelayMs ?? 50;
	let lastErr: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (e) {
			lastErr = e;
			if (!isReconnectable(e) || attempt === retries) throw e;
			await Bun.sleep(baseDelayMs * 2 ** attempt);
		}
	}
	throw lastErr;
}
```

### `packages/$1/src/errors.ts`

```typescript
/** Maps known constraint names to user-friendly messages */
const CONSTRAINT_MESSAGES: Record<string, string> = {
	// Add constraint mappings as you create schemas, e.g.:
	// user_email_unique: "A user with this email already exists",
	// organisations_slug_unique: "An organisation with this slug already exists",
};

/** Maps PG error codes to generic user-friendly messages */
const PG_CODE_MESSAGES: Record<string, string> = {
	"23505": "This record already exists",
	"23503": "This operation references a record that doesn't exist",
	"23502": "A required field is missing",
	"23514": "A value doesn't meet the required conditions",
};

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Shape of the Bun SQL PostgresError, found on DrizzleQueryError.cause.
 * - `.errno` holds the PG error code (e.g. "23505")
 * - `.constraint` holds the constraint name (e.g. "user_email_unique")
 */
interface PgCause {
	errno?: string;
	code?: string;
	constraint?: string;
	constraint_name?: string;
	detail?: string;
	severity?: string;
	schema?: string;
	table?: string;
}

/**
 * Extracts the PG cause from a Drizzle error.
 * Drizzle wraps Bun SQL's PostgresError as `error.cause`.
 */
function extractPgCause(error: Error): PgCause | undefined {
	const cause = (error as Error & { cause?: unknown }).cause;
	if (cause && typeof cause === "object") return cause as PgCause;
	return undefined;
}

/** Extract constraint name from error message string */
function parseConstraintFromMessage(message: string): string | undefined {
	const match = message.match(/constraint "([^"]+)"/);
	return match?.[1];
}

/**
 * Converts a database error into a user-friendly message.
 * Handles Drizzle's DrizzleQueryError which wraps Bun SQL's PostgresError as `.cause`.
 */
export function friendlyDbError(error: unknown): string {
	if (!(error instanceof Error)) return FALLBACK_MESSAGE;

	const cause = extractPgCause(error);

	// Get constraint from cause, or parse from message
	const constraint = cause?.constraint ?? cause?.constraint_name ?? parseConstraintFromMessage(error.message);

	// PG error code: Bun SQL uses `.errno` for the 5-char PG code, `.code` for the string code
	const pgCode = cause?.errno ?? cause?.code;

	// Check constraint-specific message first
	if (constraint) {
		const msg = CONSTRAINT_MESSAGES[constraint];
		if (msg) return msg;
	}

	// Check PG error code for generic message
	if (pgCode) {
		const msg = PG_CODE_MESSAGES[pgCode];
		if (msg) return msg;
	}

	return FALLBACK_MESSAGE;
}
```

### `packages/$1/src/errors.test.ts`

```typescript
import { describe, expect, test } from "bun:test";
import { friendlyDbError } from "./errors";

/** Simulates Drizzle's DrizzleQueryError which wraps PG errors as .cause */
function makeDrizzleError(cause: { errno?: string; code?: string; constraint?: string; detail?: string }): Error {
	const err = new Error("Failed query: insert into ...");
	(err as Error & { cause: unknown }).cause = cause;
	return err;
}

describe("friendlyDbError", () => {
	test("returns generic unique violation for unknown constraint", () => {
		const err = makeDrizzleError({ errno: "23505", constraint: "some_other_constraint" });
		expect(friendlyDbError(err)).toBe("This record already exists");
	});

	test("returns generic unique violation with no constraint name", () => {
		const err = makeDrizzleError({ errno: "23505" });
		expect(friendlyDbError(err)).toBe("This record already exists");
	});

	test("returns friendly message for foreign key violation", () => {
		const err = makeDrizzleError({ errno: "23503" });
		expect(friendlyDbError(err)).toBe("This operation references a record that doesn't exist");
	});

	test("returns friendly message for not-null violation", () => {
		const err = makeDrizzleError({ errno: "23502" });
		expect(friendlyDbError(err)).toBe("A required field is missing");
	});

	test("returns friendly message for check constraint violation", () => {
		const err = makeDrizzleError({ errno: "23514" });
		expect(friendlyDbError(err)).toBe("A value doesn't meet the required conditions");
	});

	test("returns fallback for unknown PG error code", () => {
		const err = makeDrizzleError({ errno: "99999" });
		expect(friendlyDbError(err)).toBe("Something went wrong. Please try again.");
	});

	test("returns fallback for plain Error without PG fields", () => {
		expect(friendlyDbError(new Error("random error"))).toBe("Something went wrong. Please try again.");
	});

	test("returns fallback for non-Error values", () => {
		expect(friendlyDbError("string error")).toBe("Something went wrong. Please try again.");
		expect(friendlyDbError(null)).toBe("Something went wrong. Please try again.");
		expect(friendlyDbError(undefined)).toBe("Something went wrong. Please try again.");
		expect(friendlyDbError(42)).toBe("Something went wrong. Please try again.");
	});
});
```

---

## Step 3 - Empty Schema & Service Stubs

### `packages/$1/src/schema/index.ts`

```typescript
// Export schemas here as you create them. Re-export BOTH the table file and its
// zod file so types and validators surface through the package barrel:
// export * from "./{name}.schema";
// export * from "./{name}.schema.zod";
```

### `packages/$1/src/services/index.ts`

```typescript
import type { DrizzleDb } from "../client";

// Import services here as you create them:
// import { ExampleService } from "./example.service";

export class Services {
	// Add service properties here, e.g.:
	// example: ExampleService;

	constructor(db: DrizzleDb) {
		// Instantiate services here, e.g.:
		// this.example = new ExampleService(db);
	}
}

export function createServices(db: DrizzleDb) {
	return new Services(db);
}
```

---

## Step 4 - Scripts & AGENTS.md

### `packages/$1/scripts/reset.ts`

```typescript
/**
 * DB Reset Script
 *
 * Drops all public schema tables, re-runs Drizzle migrations.
 *
 * Usage:
 *   DATABASE_URL=<url> bun run scripts/reset.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { join } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const __dirname = new URL(".", import.meta.url).pathname;
const MIGRATIONS_DIR = join(__dirname, "../migrations");

async function run() {
	const client = postgres(DATABASE_URL as string, { max: 1 });
	const db = drizzle(client);

	console.log("Dropping public schema tables...");
	// Add your tables here in dependency order (children first), e.g.:
	// await client`DROP TABLE IF EXISTS public.child_table, public.parent_table CASCADE`;

	// Also drop enums that Drizzle will recreate, e.g.:
	// await client`DROP TYPE IF EXISTS my_enum CASCADE`;

	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

	await client.end();
	console.log("Database reset complete.");
}

run().catch((err) => {
	console.error("Reset failed:", err);
	process.exit(1);
});
```

### `packages/$1/src/seed/demo.ts`

```typescript
/**
 * Demo seed — populates a local/dev database with sample data.
 *
 * Usage:
 *   DATABASE_URL=<url> bun run seed
 */

import { getDb } from "../client";

async function run() {
	const db = getDb();
	void db; // TODO: insert demo rows via the schema, e.g. await db.insert(items).values([...]);
	console.log("Demo seed complete.");
}

run().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
```

### `packages/$1/src/seed/production.ts`

```typescript
/**
 * Production seed — idempotent reference data only (no demo/sample rows).
 *
 * Usage:
 *   DATABASE_URL=<url> bun run seed:production
 */

import { getDb } from "../client";

async function run() {
	const db = getDb();
	void db; // TODO: upsert required reference data (idempotent — safe to re-run).
	console.log("Production seed complete.");
}

run().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
```

### `packages/$1/AGENTS.md`

````markdown
# Database Package (@{org}/$1)

Drizzle ORM + PostgreSQL. Shared schema, services, and DB client.

## Commands

- `bun run generate`        - Generate migration from schema changes
- `bun run migrate`         - Apply migrations
- `bun run studio`          - Drizzle Studio (visual editor)
- `bun run reset`           - Drop tables + re-run migrations
- `bun run seed`            - Seed demo/dev data
- `bun run seed:production` - Seed production reference data (idempotent)
- `bun run test`            - Run unit tests

## Structure

- `src/index.ts`: Barrel export (schema + services + errors; NOT client)
- `src/client.ts`: getDb() pooled singleton, DrizzleDb/DrizzleTx/DrizzleExecutor types, withDbRetry()
- `src/schema/`: Table definitions, enums, relations, inferred types, zod validators
- `src/services/`: Org-scoped service per table/domain
- `src/seed/`: demo + production seed scripts

## Conventions

### File Naming

- Schemas: `{name}.schema.ts` in `src/schema/`
- Services: `{name}.service.ts` in `src/services/`
- Barrels re-export everything

### Schema Files

- One domain per file: `{name}.schema.ts` holds tables + relations + inferred types
- Enums are **string-union types** applied with `text("col").$type<Union>()` — not `pgEnum`
- UUID primary keys: `uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey()`
- Timestamps: `created_at` + `updated_at` with `withTimezone: true`, `.defaultNow().notNull()`
- Auto-update: `.$onUpdate(() => new Date())` on `updated_at`
- Org scoping: `organizationId` FK → the better-auth `organization` table, `onDelete: "cascade"`
- Soft-delete domains include a `"DELETED"` value in their status union (no row deletes)
- JSONB columns are typed: `jsonb("col").$type<Shape>()`
- Array columns: `text("col").array().notNull().default(sql`'{}'::text[]`)`
- `check()` constraints encode cross-field invariants at the DB level
- `relations()` wires one/many between tables; `index()` / `uniqueIndex()` on FKs + hot paths
- Export inferred types per table: `$inferSelect` (`Foo`) & `$inferInsert` (`NewFoo`)

Example (`item.schema.ts`):

```typescript
import { relations, sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth.schema";

export type ItemStatus = "ACTIVE" | "INACTIVE" | "DELETED";

export type ItemMeta = Record<string, unknown>;

export const item = pgTable(
  "item",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status").$type<ItemStatus>().notNull().default("ACTIVE"),
    quantity: integer("quantity").notNull().default(0),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    meta: jsonb("meta").$type<ItemMeta>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("item_org_slug_uidx").on(table.organizationId, table.slug),
    index("item_org_status_idx").on(table.organizationId, table.status),
    check("item_quantity_nonneg", sql`${table.quantity} >= 0`),
  ]
);

export const itemRelations = relations(item, ({ one }) => ({
  organization: one(organization, {
    fields: [item.organizationId],
    references: [organization.id],
  }),
}));

export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
```

### Zod Validators

Each domain gets a sibling `{name}.schema.zod.ts` with hand-written `create*` / `update*`
schemas. Services parse input through these before touching the DB.

- Enum schemas via `z.enum([...])` mirror the table's string-union types
- `create*` requires all fields; `update*` makes them `.optional()`
- Cross-field rules use `.refine()`; `.nullish()` for optional JSON/array columns
- Export input types with `z.input<typeof schema>` (post-default shape: `z.infer`)

Example (`item.schema.zod.ts`):

```typescript
import { z } from "zod";

export const itemStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DELETED"]);

export const createItemSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
  name: z.string().min(1),
  status: itemStatusSchema.default("ACTIVE"),
  quantity: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  meta: z.record(z.string(), z.unknown()).nullish(),
});

export const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  status: itemStatusSchema.optional(),
  quantity: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.unknown()).nullish(),
});

export type CreateItemInput = z.input<typeof createItemSchema>;
export type UpdateItemInput = z.input<typeof updateItemSchema>;
```

### Service Files

- One service class per table/domain; constructor takes a `DrizzleDb`
- Every method is **org-scoped** — takes `orgId` and filters on `organizationId`
- `AsyncResult<T>` return types from `@{org}/types` (`ok()` / `err()`)
- Validate mutation input with the zod `create*`/`update*` schema via `safeParse()` before
  touching the DB; on failure return `err(issues.map((i) => i.message).join(", "))`
- Mutations run inside `this.db.transaction(async (tx) => …)`
- A private `class ServiceError extends Error {}` is thrown inside a transaction to roll
  back and surface a business-rule message; catch it outside and return `err(e.message)`
- Reads exclude soft-deleted rows with `ne(table.status, "DELETED")`
- Delete = soft-delete: set `status: "DELETED"` (never `db.delete()` on org data)
- Single-row reads return `… | null`; wrap all DB calls in try/catch + `friendlyDbError()`
- Register the service in the `Services` class (`src/services/index.ts`)

Example (`item.service.ts`):

```typescript
import { type AsyncResult, err, ok } from "@{org}/types";
import { and, asc, eq, ne } from "drizzle-orm";
import type { DrizzleDb } from "../client";
import { friendlyDbError } from "../errors";
import { type Item, item } from "../schema/item.schema";
import { type CreateItemInput, createItemSchema, type UpdateItemInput, updateItemSchema } from "../schema/item.schema.zod";

/** Thrown inside a transaction to roll back and surface a business-rule message. */
class ServiceError extends Error {}

export class ItemService {
  constructor(private readonly db: DrizzleDb) {}

  async list(orgId: string): AsyncResult<Item[]> {
    try {
      const rows = await this.db
        .select()
        .from(item)
        .where(and(eq(item.organizationId, orgId), ne(item.status, "DELETED")))
        .orderBy(asc(item.name));
      return ok(rows);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }

  async getById(orgId: string, id: string): AsyncResult<Item | null> {
    try {
      const [row] = await this.db
        .select()
        .from(item)
        .where(and(eq(item.organizationId, orgId), eq(item.id, id), ne(item.status, "DELETED")))
        .limit(1);
      return ok(row ?? null);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }

  async create(orgId: string, data: CreateItemInput): AsyncResult<Item> {
    const parsed = createItemSchema.safeParse(data);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join(", "));
    }
    try {
      const row = await this.db.transaction(async (tx) => {
        const [r] = await tx
          .insert(item)
          .values({ organizationId: orgId, ...parsed.data })
          .returning();
        if (!r) throw new ServiceError("Failed to create item");
        return r;
      });
      return ok(row);
    } catch (e) {
      if (e instanceof ServiceError) return err(e.message);
      return err(friendlyDbError(e));
    }
  }

  async update(orgId: string, id: string, patch: UpdateItemInput): AsyncResult<Item> {
    const parsed = updateItemSchema.safeParse(patch);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join(", "));
    }
    try {
      const row = await this.db.transaction(async (tx) => {
        const [r] = await tx
          .update(item)
          .set(parsed.data)
          .where(and(eq(item.organizationId, orgId), eq(item.id, id)))
          .returning();
        if (!r) throw new ServiceError("Item not found");
        return r;
      });
      return ok(row);
    } catch (e) {
      if (e instanceof ServiceError) return err(e.message);
      return err(friendlyDbError(e));
    }
  }

  async softDelete(orgId: string, id: string): AsyncResult<void> {
    try {
      await this.db
        .update(item)
        .set({ status: "DELETED" })
        .where(and(eq(item.organizationId, orgId), eq(item.id, id)));
      return ok(undefined);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }
}
```

Register it in `src/services/index.ts`:

```typescript
import type { DrizzleDb } from "../client";
import { ItemService } from "./item.service";

export { ItemService } from "./item.service";

export class Services {
  readonly items: ItemService;

  constructor(db: DrizzleDb) {
    this.items = new ItemService(db);
  }
}

export function createServices(db: DrizzleDb) {
  return new Services(db);
}
```

### Imports

- External consumers: import from `@{org}/$1` (barrel) — never deep paths
- The client is **not** in the barrel: import `getDb`/`DrizzleDb` from `@{org}/$1/src/client`
- Internal services/schema: import from sibling files (`../schema/item.schema`, `../schema/item.schema.zod`)
- Schema files can cross-import (e.g. FK targets, shared `JsonValue`)

### Migrations

- Run `bun run generate` after schema changes
- NEVER run `bun run migrate` locally / from an agent — applied in deploy pre-step only
- Never manually edit migration SQL
````

---

## Step 5 - Post-scaffold

After creating all files, print these instructions (do NOT execute them):

```
Next steps:
1. Run `bun install` from the monorepo root
2. Set DATABASE_URL: copy `packages/$1/.env.example` to `packages/$1/.env` (or set it in the
   root `.env.local`, which `drizzle.config.ts` also loads)
3. Run `/dlc-scaffold-better-auth` if you need the auth/organization tables that org-scoped
   schemas reference
4. Create your first domain: `packages/$1/src/schema/{name}.schema.ts` + `{name}.schema.zod.ts`
5. Export BOTH from `packages/$1/src/schema/index.ts`, then add a service in `src/services/`
   and register it in `src/services/index.ts`
6. Run `bun run generate` in `packages/$1/` to create the initial migration
7. Run `bun run migrate` to apply it (human-verified only)
```
