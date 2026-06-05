---
name: dlc-scaffold-monorepo
description: Scaffold the shared Bun/Turborepo monorepo root - packages, configs, pre-commit hooks, and shared types. Run this FIRST, then use /dlc-scaffold-tanstack, /dlc-scaffold-tauri, or /dlc-expo to add an app.
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: architecture
  tags: [monorepo, turborepo, bun, scaffolding, workspace]
  argument-hint: <org-name>
---

# Scaffold Monorepo (Shared Base)

Scaffold the monorepo root with shared packages and tooling. Does NOT create an app - use `/dlc-scaffold-tanstack`, `/dlc-scaffold-tauri`, or `/dlc-expo` after this.

## Arguments

- `$1` - **org name** (required). Used as `@{org}` scope in package names. Example: `mycompany`

If `$1` is empty, ask the user for an org name before proceeding.

---

## Step 1 - Monorepo Root

Create root directory structure and config files.

### `package.json`

```json
{
  "name": "@$1/source",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "packageManager": "bun@1.3.9",
  "scripts": {
    "postinstall": "git rev-parse --git-dir > /dev/null 2>&1 && prek install || true",
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "check": "turbo check",
    "lint": "turbo lint",
    "fmt": "turbo fmt",
    "test": "turbo test",
    "nuke": "rm -rf node_modules ./apps/**/node_modules ./packages/**/node_modules && bun install --no-cache -f"
  },
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "@biomejs/biome": "^2.4.6",
    "@j178/prek": "^0.3.5",
    "@$1/tsconfig": "workspace:*",
    "@types/bun": "^1.3.8",
    "@types/node": "^22.15.0",
    "turbo": "^2.8.2",
    "typescript": "^5.9.3"
  }
}
```

### `turbo.jsonc`

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "concurrency": "30",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "cache": false,
      "outputs": ["dist/**"]
    },
    "dev": { "persistent": true },
    "typecheck": { "cache": false, "outputs": [] },
    "lint": { "cache": false, "outputs": [] },
    "fmt": { "cache": false, "outputs": [] },
    "check": { "cache": false, "outputs": [] },
    "test": { "cache": false, "outputs": [] }
  }
}
```

### `biome.jsonc`

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": ["./packages/biome-config/root.jsonc"],
  "root": true
}
```

### `.pre-commit-config.yaml`

```yaml
repos:
  - repo: local
    hooks:
      - id: biome-check
        name: biome check
        language: system
        entry: bun run scripts/pre-commit-biome.ts
        pass_filenames: false
        stages: [pre-commit]

      - id: typecheck
        name: typecheck
        language: system
        entry: bun run typecheck
        pass_filenames: false
        stages: [pre-push]
```

### `scripts/pre-commit-biome.ts`

```typescript
#!/usr/bin/env bun
import { $ } from "bun";

async function main() {
  const stagedFilesResult = await $`git diff --cached --name-only --diff-filter=ACM`.text();
  const stagedFiles = stagedFilesResult
    .trim()
    .split("\n")
    .filter((f) => f.match(/\.(js|jsx|ts|tsx|json|jsonc|css|scss|md|mdx)$/));

  if (stagedFiles.length === 0) {
    console.log("No staged files to check");
    process.exit(0);
  }

  console.log(`Checking ${stagedFiles.length} staged files with biome...`);

  const biomeResult = await $`bun x biome check --write --no-errors-on-unmatched ${stagedFiles}`.quiet();

  for (const file of stagedFiles) {
    const diffResult = await $`git diff --name-only -- ${file}`.quiet().text();
    if (diffResult.trim()) {
      console.log(`Re-staging fixed file: ${file}`);
      await $`git add ${file}`.quiet();
    }
  }

  if (biomeResult.exitCode !== 0) {
    const recheckResult = await $`bun x biome check --no-errors-on-unmatched ${stagedFiles}`.quiet();
    process.exit(recheckResult.exitCode);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Pre-commit biome check failed:", error);
  process.exit(1);
});
```

---

## Step 2 - Shared Packages

Create `packages/` with three shared packages.

### 2.1 `packages/biome-config`

**`packages/biome-config/package.json`**:

```json
{
  "name": "@$1/biome-config",
  "version": "1.0.0",
  "description": "Shared Biome configurations",
  "exports": {
    "./root.jsonc": "./root.jsonc",
    "./react.jsonc": "./react.jsonc"
  },
  "files": ["root.jsonc", "react.jsonc"],
  "peerDependencies": {
    "@biomejs/biome": "^2.0.0"
  }
}
```

**`packages/biome-config/biome.jsonc`**:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": "//",
  "root": false,
  "files": { "includes": ["*.jsonc", "package.json"] }
}
```

**`packages/biome-config/root.jsonc`** (base config all apps/packages extend):

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": { "ignoreUnknown": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 120,
    "indentWidth": 2
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": { "organizeImports": "on" }
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "a11y": {
        "useKeyWithClickEvents": "off",
        "useAnchorContent": "off"
      },
      "correctness": {
        "noEmptyPattern": "off",
        "useExhaustiveDependencies": "warn",
        "useUniqueElementIds": "off"
      },
      "suspicious": {
        "noArrayIndexKey": "off",
        "noExplicitAny": "warn"
      },
      "style": {
        "noUnusedTemplateLiteral": "off",
        "useSelfClosingElements": "off",
        "useFilenamingConvention": "error",
        "noParameterAssign": "error",
        "useAsConstAssertion": "error",
        "useDefaultParameterLast": "error",
        "useEnumInitializers": "error",
        "useSingleVarDeclarator": "error",
        "useNumberNamespace": "error",
        "noInferrableTypes": "error",
        "noUselessElse": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "es5",
      "semicolons": "always"
    }
  },
  "json": { "formatter": { "enabled": true } }
}
```

**`packages/biome-config/react.jsonc`**:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": ["./root.jsonc"],
  "css": {
    "parser": { "tailwindDirectives": true }
  }
}
```

### 2.2 `packages/tsconfig`

**`packages/tsconfig/package.json`**:

```json
{
  "name": "@$1/tsconfig",
  "version": "1.0.0",
  "description": "Shared TypeScript configurations",
  "files": ["tsconfig.base.json", "tsconfig.react.json"]
}
```

**`packages/tsconfig/biome.jsonc`**:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": "//",
  "root": false,
  "files": { "includes": ["*.json", "package.json"] }
}
```

**`packages/tsconfig/tsconfig.base.json`**:

```json
{
  "compilerOptions": {
    "strictNullChecks": true,
    "composite": true,
    "isolatedModules": true,
    "lib": ["es2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmitOnError": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "es2022",
    "customConditions": ["@$1/source"]
  }
}
```

**`packages/tsconfig/tsconfig.react.json`**:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "jsx": "react-jsx",
    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

### 2.3 `packages/types`

**`packages/types/package.json`**:

```json
{
  "name": "@$1/types",
  "version": "1.0.0",
  "description": "Shared TypeScript utility types",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "fmt": "biome format --write ./src",
    "lint": "biome lint --write ./src",
    "check": "biome check ./src",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@$1/tsconfig": "workspace:*",
    "typescript": "^5.9.3"
  }
}
```

**`packages/types/tsconfig.json`**:

```json
{
  "extends": "@$1/tsconfig/tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist" },
  "include": ["src"]
}
```

**`packages/types/src/index.ts`**:

```typescript
export * from "./result";
```

**`packages/types/src/result.ts`**:

```typescript
export type SuccessResult<Success> = { success: true; data: Success };
export type ErrorResult<Error = string> = { success: false; error: Error };
export type Result<Success, Error = string> = SuccessResult<Success> | ErrorResult<Error>;
export type AsyncResult<Success, Error = string> = Promise<Result<Success, Error>>;

export function ok<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

export function err(error: unknown): ErrorResult<string> {
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error),
  };
}
```

---

## Step 3 - Core Patterns (Shared)

Create these shared patterns in `packages/` or document them for app-level `core/` directories.

### 3.1 `core/lib/result.ts` (app-level)

```typescript
export type AsyncResult<TData, TError = string> =
  | { success: true; data: TData }
  | { success: false; error: TError };

export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export function ensureError(error: unknown, fallback = "Unknown error"): Error {
  if (error instanceof Error) return error;
  return new Error(getErrorMessage(error, fallback));
}
```

### 3.2 `core/logger.ts` (app-level)

```typescript
export const LogLevel = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 } as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export abstract class Logger {
  constructor(private readonly loggerOptions: { name: string; logLevel?: LogLevel }) {}

  get prefix() {
    return `[${new Date().toISOString()}] [${this.loggerOptions.name}]`;
  }

  protected info(message: string, ...args: unknown[]) {
    if ((this.loggerOptions.logLevel ?? LogLevel.INFO) >= LogLevel.INFO) {
      console.info(`${this.prefix} ${message}`, ...args);
    }
  }

  protected error(message: string, ...args: unknown[]) {
    if ((this.loggerOptions.logLevel ?? LogLevel.INFO) >= LogLevel.ERROR) {
      console.error(`${this.prefix} ${message}`, ...args);
    }
  }

  protected debug(message: string, ...args: unknown[]) {
    if ((this.loggerOptions.logLevel ?? LogLevel.INFO) >= LogLevel.DEBUG) {
      console.debug(`${this.prefix} ${message}`, ...args);
    }
  }

  protected warn(message: string, ...args: unknown[]) {
    if ((this.loggerOptions.logLevel ?? LogLevel.INFO) >= LogLevel.WARN) {
      console.warn(`${this.prefix} ${message}`, ...args);
    }
  }
}
```

### 3.3 `core/lib/query-client.ts` (app-level)

Create the abstract `QueryClient<Resource>` base class that wraps TanStack React Query with:

- Namespaced key generation: `["@{app}", resource, "query"|"mutation", subResource, ...args]`
- Typed `query()` method returning `{ queryKey, queryFn, fetch, prefetch, set, get, refresh, extend }`
- Typed `mutation()` method returning `{ mutationKey, mutationFn, mutateAsync, extend }`
- `infiniteQuery()` method for paginated data
- `refresh()` for cache invalidation
- `shutdown()` for cleanup

---

## Step 4 - File Naming Conventions

Follow these conventions when creating any files:

| Type | Pattern | Example |
|------|---------|---------|
| Server function module | `{domain}.api.ts` | `colors.api.ts` |
| Schema/validation | `{domain}.schema.ts` | `colors.schema.ts` |
| Client class | `{domain}.ts` (in `clients/`) | `colors.ts` |
| Middleware | `{name}.middleware.ts` | `logging.middleware.ts` |
| Types | `{domain}.types.ts` | `colors.types.ts` |
| Hooks | `{domain}.hook.ts` | `colors.hook.ts` |
| Tests | `{name}.test.ts` / `.test.tsx` | Colocated next to source |
| Data/defaults | `{name}.data.ts` / `{name}.defaults.ts` | `tokens.defaults.ts` |

---

## Step 5 - Key Rules (Shared Across All Variants)

1. **Route context for shared data** - fetch in `beforeLoad`, access via `useRouteContext()`
2. **TanStack Query is the cache** - no global state stores
3. **No barrel exports** - import directly from source files
4. **Colocate tests** - `{name}.test.ts` next to `{name}.ts`
5. **TDD** - write failing tests first, implement to pass
6. **No `any`** - type everything, use discriminated unions
7. **Biome for linting + formatting** - shared config via `@$1/biome-config`
8. **prek for pre-commit hooks** - biome check on commit, typecheck on push

---

## Step 6 - AGENTS.md & CLAUDE.md Conventions

Every significant directory gets an `AGENTS.md` and a `CLAUDE.md` (containing only `See @AGENTS.md`).

### Directories that need AGENTS.md

- App root (`apps/{app-name}/`)
- `src/core/`
- `src/modules/`

### AGENTS.md template structure

```markdown
# {Directory Name}

> One-liner purpose

## Stack / Dependencies

## Directory Structure

## Key Patterns

## Rules

## Checklists (e.g., "Adding a New Domain")
```

### Root CLAUDE.md template

```markdown
# Claude Context

See @AGENTS.md for full documentation.

## Quick Reference

- **Stack**: [variant-specific]
- **Port**: [variant-specific]

## Commands

bun run dev       # Dev server
bun run typecheck # Type check
bun run build     # Production build
bun run check     # Biome lint + format
```

---

## Step 7 - Initialize & Verify

After creating all files:

1. Run `git init` if not already a repo
2. Run `bun install` - installs all workspace deps
3. Run `bun run typecheck` - zero errors
4. Run `bun run check` - biome passes everywhere
5. Verify AGENTS.md / CLAUDE.md template files exist

Then tell the user to run `/dlc-scaffold-tanstack`, `/dlc-scaffold-tauri`, or `/dlc-expo` to add an app.
