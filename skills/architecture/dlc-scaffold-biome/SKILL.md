---
name: dlc-scaffold-biome
description: Scaffold the shared `@{org}/biome-config` package (root.jsonc + react.jsonc), the root biome.jsonc, and apply the correct per-app biome.jsonc variant for any app or package in a Bun/Turborepo monorepo. Run as part of /dlc-scaffold-monorepo, or standalone to add or refresh Biome config. Use when setting up Biome, adding a biome.jsonc, configuring lint and format rules, or organizing imports. Triggers on "biome", "biome config", "linter", "formatter", "organizeImports", "biome.jsonc".
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: architecture
  tags: [biome, linting, formatting, monorepo, bun, scaffolding]
  argument-hint: <org-name>
---

# Scaffold Shared Biome Config

Single source of truth for all Biome configuration across the monorepo. Creates the root `biome.jsonc`, the shared `@$1/biome-config` package (`root.jsonc` + `react.jsonc`), and documents the exact per-app `biome.jsonc` variant every app and package uses.

Run as part of `/dlc-scaffold-monorepo`, or standalone inside an existing monorepo to add or refresh Biome config.

## Arguments

- `$1` - **org name** (required). Used as the `@$1` scope in package names. Example: `mycompany`

If `$1` is empty, detect the scope from the root `package.json` `name` field, or ask the user.

## Placeholder Note

`$1` and `@{org}` both denote the org scope (e.g. `mycompany`). The shared package uses `$1` (matching `/dlc-scaffold-monorepo`); the per-app variants use `@{org}`, which consuming apps detect from the root `package.json`. They are the same value.

---

## Step 1 - Root `biome.jsonc`

At the monorepo root. Marks the root config and extends the shared base.

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": ["./packages/biome-config/root.jsonc"],
  "root": true
}
```

> The `pre-commit-biome.ts` script and `.pre-commit-config.yaml` that run `biome check` on commit are owned by `/dlc-scaffold-monorepo` (hook infra, not config).

---

## Step 2 - Shared `packages/biome-config`

Create `packages/biome-config/` with these four files.

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

**`packages/biome-config/root.jsonc`** (base config every app and package extends):

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

**`packages/biome-config/react.jsonc`** (adds Tailwind directive parsing for React apps):

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": ["./root.jsonc"],
  "css": {
    "parser": { "tailwindDirectives": true }
  }
}
```

---

## Step 3 - Per-App Variant Reference

Every package and app gets a `biome.jsonc` with `"extends": "//"` (inherit the root config). Drop in the matching variant below.

### `packages/biome-config` (self)

Limits scope to its own jsonc and package.json.

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": "//",
  "root": false,
  "files": { "includes": ["*.jsonc", "package.json"] }
}
```

### `packages/tsconfig`

Limits scope to its own json and package.json.

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": "//",
  "root": false,
  "files": { "includes": ["*.json", "package.json"] }
}
```

### Minimal variant - Elysia / UI / DB / Auth packages and apps

Backend and non-React packages: cover all of `src`, no Tailwind, no route overrides. Used by `/dlc-scaffold-elysia`, `/dlc-scaffold-ui-package`, `/dlc-scaffold-db`, `/dlc-scaffold-better-auth`.

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

### React app variant - TanStack / Tauri

React apps with file-based routing: enable Tailwind directives, exclude the generated route tree, and relax the filename convention inside `src/_routes/**`. Used by `/dlc-scaffold-tanstack` and `/dlc-scaffold-tauri`.

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": "//",
  "root": false,
  "files": {
    "includes": ["src/**/*", "!src/routeTree.gen.ts"]
  },
  "css": {
    "parser": { "tailwindDirectives": true }
  },
  "overrides": [
    {
      "includes": ["src/_routes/**/*"],
      "linter": {
        "rules": {
          "style": { "useFilenamingConvention": "off" }
        }
      }
    }
  ]
}
```

---

## Step 4 - Rules

1. **`root.jsonc` is the single source of truth** - all rules, formatter, and VCS settings live there; everything else extends it.
2. **`"extends": "//"`** - every package/app `biome.jsonc` inherits from the workspace root via `//`, never re-declares rules.
3. **Tab indent, 120 width** - formatter defaults from `root.jsonc`; do not override per package.
4. **Double quotes, ES5 trailing commas, always semicolons** - JavaScript/TypeScript formatting from `root.jsonc`.
5. **organizeImports is on** - import sorting runs via `biome check`; never sort imports by hand.
6. **React variant adds Tailwind only** - use the React app variant for anything with `@apply`/Tailwind directives and file-based routes.
7. **Exclude generated files** - add `!`-prefixed globs (e.g. `!src/routeTree.gen.ts`) rather than disabling rules wholesale.
