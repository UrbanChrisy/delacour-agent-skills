---
name: dlc-scaffold-tsconfig
description: Scaffold the shared `@{org}/tsconfig` package (tsconfig.base.json + tsconfig.react.json) and apply the correct per-app tsconfig.json variant for any app or package in a Bun/Turborepo monorepo. Run as part of /dlc-scaffold-monorepo, or standalone to add or refresh TypeScript config. Use when setting up tsconfig, adding a tsconfig.json to an app or package, or changing shared compiler options. Triggers on "tsconfig", "typescript config", "compilerOptions", "shared tsconfig package".
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: architecture
  tags: [typescript, tsconfig, monorepo, bun, scaffolding]
  argument-hint: <org-name>
---

# Scaffold Shared TypeScript Config

Single source of truth for all TypeScript configuration across the monorepo. Creates the shared `@$1/tsconfig` package and documents the exact per-app `tsconfig.json` variant every app and package uses.

Run as part of `/dlc-scaffold-monorepo`, or standalone inside an existing monorepo to add or refresh TypeScript config.

## Arguments

- `$1` - **org name** (required). Used as the `@$1` scope in package names. Example: `mycompany`

If `$1` is empty, detect the scope from the root `package.json` `name` field, or ask the user.

## Placeholder Note

`$1` and `@{org}` both denote the org scope (e.g. `mycompany`). The shared package files below use `$1` (matching `/dlc-scaffold-monorepo`); the per-app variants use `@{org}`, which consuming apps detect from the root `package.json`. They are the same value.

---

## Step 1 - Shared `packages/tsconfig`

Create `packages/tsconfig/` with these four files.

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

**`packages/tsconfig/tsconfig.base.json`** (foundation every package and app extends):

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

**`packages/tsconfig/tsconfig.react.json`** (adds JSX + DOM libs for React packages and apps):

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

---

## Step 2 - Per-App Variant Reference

Each app and package gets its own `tsconfig.json` that extends one of the two shared configs. Drop in the matching variant below.

### `packages/types`

Extends base, emits to `dist`.

```json
{
  "extends": "@$1/tsconfig/tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist" },
  "include": ["src"]
}
```

### `packages/db` (`/dlc-scaffold-db`)

Extends base; includes build scripts and `drizzle.config.ts` in the program.

```json
{
  "extends": "@{org}/tsconfig/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src", "scripts", "drizzle.config.ts"]
}
```

### `packages/auth` (`/dlc-scaffold-better-auth`)

Extends base with bundler module resolution and no declaration output (per the better-auth scaffold).

```json
{
  "extends": "@{org}/tsconfig/tsconfig.base.json",
  "compilerOptions": {
    "moduleResolution": "bundler",
    "declaration": false
  }
}
```

### `packages/ui` (`/dlc-scaffold-ui-package`)

Extends react; type-only (`noEmit`) with component path aliases.

```json
{
  "extends": "@{org}/tsconfig/tsconfig.react.json",
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"],
      "@{org}/core/components": ["./src/components/*"],
      "@{org}/core/ui": ["./src/components/ui/*"],
      "@{org}/core/lib": ["./src/lib/*"],
      "@{org}/core/hooks": ["./src/hooks/*"]
    }
  }
}
```

### Elysia app (`/dlc-scaffold-elysia`)

Extends base; app entry point (`composite: false`) with `@/*` alias and explicit excludes.

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

### TanStack Start app (`/dlc-scaffold-tanstack`)

Extends react; app entry point with `@/*` alias.

```json
{
  "extends": "@{org}/tsconfig/tsconfig.react.json",
  "compilerOptions": {
    "composite": false,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

### Tauri desktop app (`/dlc-scaffold-tauri`)

Extends react; app entry point with `@/*` alias, `noUnusedLocals` relaxed, and a project reference to `tsconfig.node.json` (the standard Vite node config for `vite.config.ts`, defined by the Tauri scaffold).

```json
{
  "extends": "@{org}/tsconfig/tsconfig.react.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": ".",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "noUnusedLocals": false
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## Step 3 - Rules

1. **Packages are composite** - inherit `composite: true` from the base for incremental builds.
2. **Apps are entry points** - set `composite: false` (apps are not consumed as dependencies).
3. **React variant for anything with JSX** - extend `tsconfig.react.json`; everything else extends `tsconfig.base.json`.
4. **Path aliases are per-app** - `@/*` and any package aliases live in the app/package `tsconfig.json`, never in the shared base.
5. **No `any`** - `strict` is on; type everything, use discriminated unions.
6. **Never widen the shared base for one consumer** - override in that consumer's `tsconfig.json` instead.
