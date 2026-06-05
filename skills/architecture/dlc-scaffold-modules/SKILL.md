---
name: dlc-scaffold-modules
description: Scaffold the colocated module pattern under `src/modules/` for any app. Creates `src/modules/` plus `AGENTS.md` and `CLAUDE.md` documenting the per-domain convention (`components/`, `sheets/`, `contexts/`, `hooks/`, `utils/` added on demand). No code, no empty folders, no example module. Delegates the full procedure to `references/modules.md`. Use when the user asks to set up a module structure, scaffold `src/modules`, establish a colocated feature/domain folder convention, or add the module pattern to an existing app. Triggers on phrases like "scaffold module structure", "set up src/modules", "module pattern", "colocated modules", "domain folder structure".
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: architecture
  tags: [architecture, modules, scaffolding, project-structure, conventions, agents-md]
---

# Scaffold Module Structure

Establish the colocated **module pattern** under `src/modules/` so domain code has a consistent home. Each domain (e.g. `auth`, `trade`, `transactions`) owns its own `components/`, `sheets/`, `contexts/`, `hooks/`, and `utils/` subfolders, created on demand. This skill writes only `src/modules/` plus two markdown files, no code, so future agents follow the same convention when adding features.

## When to Use

- User asks to set up a module structure or scaffold `src/modules`
- User wants a colocated feature/domain folder convention for a new app
- User asks to add the module pattern to an existing app that lacks one
- Triggers: "scaffold module structure", "set up src/modules", "module pattern", "colocated modules", "domain folder structure"

## Rules / Steps

Follow the full procedure in [references/modules.md](./references/modules.md). Do not skip steps and do not paraphrase the file contents, copy them exactly as written.

High-level outline:

1. Create the `src/modules/` directory.
2. Write `src/modules/AGENTS.md` documenting the per-domain `components/` / `sheets/` / `contexts/` / `hooks/` / `utils/` convention.
3. Write `src/modules/CLAUDE.md` pointing at `AGENTS.md`.
4. Do not create subfolders up front, do not add `.gitkeep` files, and do not scaffold an example module. Subfolders are added on demand the first time a module needs them.
