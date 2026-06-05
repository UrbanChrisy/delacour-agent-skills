---
name: dlc-scaffold-tauri
description: Scaffold a Tauri v2 desktop app inside an existing Bun/Turborepo monorepo. Creates Rust backend, invoke() wrappers, TanStack Router frontend, and AGENTS.md files. Run /dlc-scaffold-monorepo first.
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: desktop
  tags: [tauri, desktop, rust, tanstack-router, monorepo]
  argument-hint: <app-name>
---

# Scaffold Tauri v2 Desktop App

Add a Tauri v2 desktop app to an existing monorepo scaffolded with `/dlc-scaffold-monorepo`.

## Arguments

- `$1` - **app name** (required). Creates `apps/$1/`. Example: `launchpad`

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
    "dev": "tauri dev",
    "dev:frontend": "vite",
    "build": "tauri build",
    "build:frontend": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "fmt": "biome format --write ./src",
    "lint": "biome lint --write ./src",
    "check": "biome check ./src",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### `apps/$1/tsconfig.json`

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

### `apps/$1/biome.jsonc`

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

### `apps/$1/src-tauri/tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "{AppName}",
  "identifier": "dev.{org}.{app}",
  "version": "0.1.0",
  "build": {
    "beforeDevCommand": "bun run dev:frontend",
    "beforeBuildCommand": "bun run build:frontend",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "{AppName}",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "decorations": true
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### `apps/$1/src-tauri/capabilities/default.json`

```json
{
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default",
    "dialog:default",
    "log:default"
  ]
}
```

---

## Step 2 - Directory Structure

```
apps/$1/src/
├── _routes/                    # TanStack Router file-based routes
│   ├── __root.tsx
│   ├── index.tsx
│   ├── landing.tsx
│   └── settings.tsx
├── core/
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   ├── api/
│   │   └── {domain}.api.ts           # invoke() wrappers
│   ├── types/
│   │   └── {domain}.types.ts
│   ├── queries/
│   │   ├── {domain}.query-client.ts   # QueryClient subclass
│   │   └── index.ts                   # createApiClients()
│   └── lib/
│       ├── query-client.ts
│       └── result.ts
├── modules/
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   └── {module-name}/
│       ├── components/
│       ├── types/
│       └── utils/
├── components/
│   ├── ui/
│   └── layouts/
├── hooks/
├── lib/
│   └── utils.ts
├── main.tsx
├── app.css
└── routeTree.gen.ts

apps/$1/src-tauri/
├── src/
│   ├── main.rs
│   ├── lib.rs
│   └── {domain}.rs
├── Cargo.toml
├── tauri.conf.json
└── capabilities/default.json
```

---

## Step 3 - Key Patterns

### Rust Tauri Command

```rust
// src-tauri/src/colors.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Color {
    pub id: String,
    pub name: String,
    pub hex: String,
}

#[tauri::command]
pub async fn list_colors(api_key: String) -> Result<Vec<Color>, String> {
    // Backend logic here
    Ok(vec![])
}
```

### Register in `lib.rs`

```rust
// src-tauri/src/lib.rs
mod colors;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            colors::list_colors,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### invoke() Wrapper

```typescript
// core/api/colors.api.ts
import { invoke } from "@tauri-apps/api/core";
import type { Color } from "../types/colors.types";

export async function listColors(apiKey: string): Promise<Color[]> {
  return invoke<Color[]>("list_colors", { apiKey });
}
```

### Query Client

```typescript
// core/queries/colors.query-client.ts
import { QueryClient } from "../lib/query-client";
import { listColors } from "../api/colors.api";

export class ColorsClient extends QueryClient<"colors"> {
  constructor(queryClient: TanStackQueryClient) {
    super(queryClient, "colors");
  }

  list = (apiKey: string) =>
    this.query("list", {
      queryFn: () => listColors(apiKey),
    });
}
```

### `createApiClients()` Factory

```typescript
// core/queries/index.ts
export function createApiClients(queryClient: TanStackQueryClient) {
  return {
    colors: new ColorsClient(queryClient),
  };
}

export type ApiClients = ReturnType<typeof createApiClients>;
```

### Tauri Store for Credentials

```typescript
// lib/storage.ts
import { Store } from "@tauri-apps/plugin-store";

const store = await Store.load("credentials.json");

export async function getApiKey(): Promise<string | null> {
  return store.get<string>("api_key");
}

export async function setApiKey(key: string): Promise<void> {
  await store.set("api_key", key);
  await store.save();
}
```

### Data Flow

```
Tauri Store (credentials)
       ↓
api.ts (invoke → Rust command)
       ↓
QueryClient subclass (caches via TanStack Query)
       ↓
Component → useQuery / useMutation
```

---

## Step 4 - AGENTS.md Files

### `apps/$1/AGENTS.md`

Contains:
- Stack: Tauri v2, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, Rust
- Dev commands (`bun run dev` - starts Vite + Tauri)
- Full `src/` and `src-tauri/` directory trees
- TDD workflow
- Key patterns: Tauri commands, invoke wrappers, credential flow

### `apps/$1/src/core/AGENTS.md`

Contains:
- Overview: "Data layer - Tauri invoke wrappers, query clients, and shared utilities"
- File structure tree
- Naming conventions table (includes Rust files)
- Architecture: Rust command → invoke wrapper → QueryClient → useQuery
- Rules 1-4 (see below)
- "Adding a New Domain" checklist (8 steps):
  1. Create Rust commands in `src-tauri/src/{domain}.rs`
  2. Register commands in `src-tauri/src/lib.rs`
  3. Create types in `core/types/{domain}.types.ts`
  4. Create `core/api/{domain}.api.ts` with invoke wrappers
  5. Create `core/queries/{domain}.query-client.ts`
  6. Register in `core/queries/index.ts`
  7. Add capabilities if new plugins needed
  8. Write tests: `{domain}.test.ts`

### `apps/$1/src/modules/AGENTS.md`

Contains:
- Purpose: "Feature modules - self-contained UI features"
- Structure template per module
- 5 rules: no barrel exports, colocate tests, import from core/ not between modules, single responsibility, keep components small

### Additional naming conventions (Tauri-specific)

| Type | Pattern | Example |
|------|---------|---------|
| API wrapper (invoke) | `{domain}.api.ts` | `s3.api.ts` |
| Query client | `{domain}.query-client.ts` | `s3.query-client.ts` |
| Rust commands | `{domain}.rs` (in `src-tauri/src/`) | `s3.rs` |

---

## Step 5 - Tauri v2 Rules

In addition to the 8 shared rules from `/dlc-scaffold-monorepo`:

9. **All backend ops via Rust Tauri commands** - `#[tauri::command]` + `invoke()`
10. **Frontend never holds SDK instances** - only `invoke()` calls to Rust
11. **Credentials passed per-call** - from Tauri Store to Rust, never stored in JS memory long-term

---

## Step 6 - Verify

1. `bun install` - resolves workspace deps
2. `cargo check` (in `src-tauri/`) - Rust compiles
3. `bun run typecheck` - zero TS errors
4. `bun run check` - biome passes
5. `bun run test` - all tests pass
6. `bun run dev` - Tauri dev starts (Vite + Rust)
7. Verify `capabilities/default.json` permissions match plugins
8. Verify `tauri.conf.json` build commands are correct
9. Verify AGENTS.md files at: app root, `src/core/`, `src/modules/`
