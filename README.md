# Delacour Agent Skills

Reusable, versioned agent skills for Delacour. One command to install any skill into any AI coding tool.

## Quick Start

```bash
# Install a skill
bunx skills add https://github.com/UrbanChrisy/delacour-agent-skills.git --skill dlc-expo

# List available skills
bunx skills add https://github.com/UrbanChrisy/delacour-agent-skills.git --list

# Install for a specific agent
bunx skills add https://github.com/UrbanChrisy/delacour-agent-skills.git --skill dlc-expo -a claude-code

# Install to all detected agents globally
bunx skills add https://github.com/UrbanChrisy/delacour-agent-skills.git --skill dlc-expo -g --all
```

**Prerequisites:** Access to the Delacour `delacour-agent-skills` repo and SSH/HTTPS auth configured.

## How It Works

The [Vercel Skills CLI](https://github.com/vercel-labs/skills) (`bunx skills`) does the heavy lifting:

- **Discovers** skills by scanning for `SKILL.md` files in this repo
- **Converts** the agnostic SKILL.md format to each target tool's native format
- **Installs** to the correct path for the chosen agent
- **Manages** symlinks, updates, and removal

Our responsibility is simple: maintain well-crafted `SKILL.md` files in the right directory structure.

## Skill Categories

Skills are organized by line of business and cross-cutting concern:

| Directory | Category | Description |
| --- | --- | --- |
| `skills/mobile/` | Mobile | React Native / Expo scaffolding and mobile patterns |
| `skills/architecture/` | Architecture | Monorepo root and project structure scaffolding |
| `skills/backend/` | Backend | Backend API app scaffolding (Elysia) |
| `skills/frontend/` | Frontend | Web app and UI package scaffolding (TanStack, UI components) |
| `skills/desktop/` | Desktop | Desktop app scaffolding (Tauri) |
| `skills/database/` | Database | Shared database package scaffolding (Drizzle + Postgres) |
| `skills/auth/` | Auth | Authentication scaffolding (better-auth) |

The CLI recursively discovers `SKILL.md` files regardless of nesting depth, so the category directory is for human organization, not a CLI requirement. Add new categories as new directories under `skills/` when needed.

## Skill Format

Each skill is a directory containing a `SKILL.md` with YAML frontmatter and Markdown body:

```markdown
---
name: human-style-writing
description: Write like a human, not an LLM. Practical checklist of AI writing patterns to avoid and natural alternatives. Use when drafting blog posts, documentation, emails, or any prose content.
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: writing
  tags: [writing, content, anti-ai-patterns]
---

# Human Style Writing

Write like a human, not an LLM...

## When to Use

- Blog posts
- Documentation
- Emails

## Rules / Steps

1. Never use em dashes
2. Avoid "delve", "leveraging", "robust"
...
```

### Required Frontmatter

| Field | Description |
|-------|-------------|
| `name` | Unique kebab-case identifier |
| `description` | What the skill does and when to use it. Include trigger phrases. |

### Optional Frontmatter

| Field | Description |
|-------|-------------|
| `metadata.author` | Author email or identifier |
| `metadata.version` | Semantic version string (start at `0.1.0`) |
| `metadata.category` | Lifecycle category |
| `metadata.tags` | Array of searchable tags |
| `metadata.internal` | Set `true` to hide from normal discovery (WIP skills) |
| `metadata.argument-hint` | Hint for skill arguments, e.g. `<file-or-pattern>` |
| `license` | License identifier |

## Adding a New Skill

1. Copy `SKILL-TEMPLATE.md` to `skills/<category>/<skill-name>/SKILL.md`
2. Fill in the frontmatter and body following the annotations in the template
3. Commit and push
4. Team members can immediately install via the CLI

### Quality Checklist

Before submitting a skill:

- [ ] `name` is kebab-case and unique within the repo
- [ ] `description` includes trigger phrases (when the skill should activate)
- [ ] Instructions are specific and actionable (not vague guidance)
- [ ] No references to specific agent UI (skills are tool-agnostic)
- [ ] Version is set (start at `0.1.0`)
- [ ] Category and tags are filled in for discoverability

### Versioning

Each skill is independently versioned via `metadata.version`:

- **MAJOR:** Breaking changes to instructions or expected behavior
- **MINOR:** New features, additional rules, expanded coverage (backward-compatible)
- **PATCH:** Typo fixes, clarifications, minor wording improvements

Use conventional commits for version bumps:

```
feat(skill-name): add new rule for X          # MINOR
fix(skill-name): clarify step 3 wording        # PATCH
feat(skill-name)!: restructure entire format   # MAJOR (breaking)
```

## CI / Validation

A GitHub Actions workflow validates skills on every push and PR. It checks frontmatter, name uniqueness, schema, and structure.

### Running Locally

Validate skills before pushing:

```bash
bun run scripts/validate-skills.ts
```

Check that URLs in skills are reachable (runs automatically on main pushes):

```bash
bun run scripts/validate-skills.ts --check-links
```

### Local Git Hooks (prek)

The same validation runs locally via [prek](https://prek.j178.dev) (a fast, drop-in pre-commit replacement) so issues are caught before they reach CI:

- **pre-commit** runs the fast structural check (frontmatter, naming, uniqueness, schema, em-dash ban). Offline, no network.
- **pre-push** additionally runs `--check-links` to verify external URLs are reachable, mirroring the CI check on `main`.

Hooks install automatically after `bun install` (via the `prepare` script). To install them manually:

```bash
bunx prek install --hook-type pre-commit --hook-type pre-push
```

The hooks only run when a `SKILL.md` is staged. In an emergency, bypass with `git commit --no-verify` or `git push --no-verify`. Config lives in [.pre-commit-config.yaml](.pre-commit-config.yaml).
