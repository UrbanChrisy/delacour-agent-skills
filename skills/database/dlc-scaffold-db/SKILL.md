---
name: dlc-scaffold-db
description: Scaffold a shared Drizzle ORM + PostgreSQL database package in a Bun/Turborepo monorepo. Singleton client, service layer with AsyncResult pattern, error handling, and migrations. Run /dlc-scaffold-monorepo first.
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.1"
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
    "reset": "bun run scripts/reset.ts"
  },
  "dependencies": {
    "@{org}/types": "workspace:*",
    "drizzle-orm": "^0.44.0",
    "postgres": "^3.4.5",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@{org}/tsconfig": "workspace:*",
    "drizzle-kit": "^0.31.0",
    "typescript": "^5.9.3"
  }
}
```

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
import { defineConfig } from "drizzle-kit";

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
export { type DrizzleDb, getDb } from "./client";
export { friendlyDbError } from "./errors";
export * from "./schema";
export * from "./services";
```

### `packages/$1/src/client.ts`

```typescript
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | undefined;

export function getDb(): DrizzleDb {
	const databaseUrl = Bun.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is not set");
	}

	if (!_db) {
		_db = drizzle(databaseUrl, { schema });
	}
	return _db;
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
// Export schemas here as you create them:
// export * from "./{name}.schema";
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

### `packages/$1/AGENTS.md`

````markdown
# Database Package (@{org}/$1)

Drizzle ORM + PostgreSQL. Shared schema, services, and DB client.

## Commands

- `bun run generate`   - Generate migration from schema changes
- `bun run migrate`    - Apply migrations
- `bun run studio`     - Drizzle Studio (visual editor)
- `bun run reset`      - Reset database

## Structure

- `src/index.ts`: Barrel export
- `src/client.ts`: getDb() singleton, DrizzleDb type
- `src/schema/`: Table definitions, enums, inferred types
- `src/services/`: CRUD service per table/domain

## Conventions

### File Naming

- Schemas: `{name}.schema.ts` in `src/schema/`
- Services: `{name}.service.ts` in `src/services/`
- Barrels re-export everything

### Schema Files

- One domain per file
- `pgTable()` for public schema, `pgSchema().table()` for named schemas
- Export inferred types: `$inferSelect` & `$inferInsert`
- Export enums alongside tables
- UUID primary keys with `defaultRandom()`
- Timestamps: `created_at` + `updated_at` with `withTimezone: true`, `defaultNow()`
- Auto-update: `.$onUpdate(() => new Date())` on `updated_at`
- FK: `onDelete: "cascade"` for org-scoped tables
- Indexes on FKs and frequently queried fields

Example:

```typescript
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["ACTIVE", "INACTIVE"]);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: statusEnum("status").notNull().default("ACTIVE"),
    parentId: uuid("parent_id").references(() => parents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("idx_items_parent_id").on(t.parentId)]
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
```

### Service Files

- One service class per table/domain
- Constructor takes `DrizzleDb` instance
- `AsyncResult<T>` return types from `@{org}/types`
- Wrap DB calls in try/catch with `friendlyDbError()`
- Register in `Services` class

Example:

```typescript
import { type AsyncResult, err, ok } from "@{org}/types";
import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../client";
import { friendlyDbError } from "../errors";
import { type Item, type NewItem, items } from "../schema/index";

export class ItemsService {
  constructor(private db: DrizzleDb) {}

  async getAll(): AsyncResult<Item[]> {
    try {
      const rows = await this.db.select().from(items);
      return ok(rows);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }

  async getById(id: string): AsyncResult<Item | undefined> {
    try {
      const rows = await this.db.select().from(items).where(eq(items.id, id)).limit(1);
      return ok(rows[0]);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }

  async create(data: NewItem): AsyncResult<Item> {
    try {
      const rows = await this.db.insert(items).values(data).returning();
      if (rows.length === 0) return err("Failed to create item");
      return ok(rows[0] as Item);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }

  async update(id: string, data: Partial<NewItem>): AsyncResult<Item> {
    try {
      const rows = await this.db.update(items).set(data).where(eq(items.id, id)).returning();
      if (rows.length === 0) return err(`Item ${id} not found`);
      return ok(rows[0] as Item);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }

  async delete(id: string): AsyncResult<void> {
    try {
      await this.db.delete(items).where(eq(items.id, id));
      return ok(undefined);
    } catch (e) {
      return err(friendlyDbError(e));
    }
  }
}
```

### Imports

- External: import from `@{org}/$1` (barrel) - never deep paths
- Internal services: import from `../schema/index`
- Schema files can cross-import

### Migrations

- Run `bun run generate` after schema changes
- NEVER run `bun run migrate` - human-applied only
- Never manually edit migration SQL
````

---

## Step 5 - Post-scaffold

After creating all files, print these instructions (do NOT execute them):

```
Next steps:
1. Run `bun install` from the monorepo root
2. Copy `packages/$1/.env.example` to `packages/$1/.env` and set your DATABASE_URL
3. Create your first schema in `packages/$1/src/schema/{name}.schema.ts`
4. Export it from `packages/$1/src/schema/index.ts`
5. Run `bun run generate` in `packages/$1/` to create the initial migration
6. Run `bun run migrate` to apply it (human-verified only)
```
