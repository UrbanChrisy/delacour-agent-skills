# AGENTS.md

Guidance for AI agents working in this repository.

## What This Repo Is

This is the Delacour Agent Skills depot - a collection of reusable, versioned agent skills. Each skill is a directory containing a `SKILL.md` file. The repo is consumed by the [Vercel Skills CLI](https://github.com/vercel-labs/skills) (`bunx skills add`).

## Repository Structure

```
skills/
└── mobile/        # React Native / Expo scaffolding and mobile patterns
```

Each category directory contains skill subdirectories. Each skill subdirectory contains a `SKILL.md` file and optional supporting files (`scripts/`, `templates/`, `references/`). Add new category directories under `skills/` as needed.

## When Creating a New Skill

1. Determine the correct category directory under `skills/`
2. Copy `SKILL-TEMPLATE.md` to `skills/<category>/<skill-name>/SKILL.md`
3. Fill in the frontmatter and body following the annotations in the template
4. Commit with a conventional commit message

### SKILL.md Frontmatter (Required)

```yaml
---
name: dlc-skill-name      # kebab-case, unique, prefixed `dlc-` (Delacour)
description: >            # What the skill does AND when to use it.
  Include trigger phrases so agents know when to activate it.
---
```

### SKILL.md Frontmatter (Optional)

```yaml
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"        # Always quoted. Start new skills at 0.1.0.
  category: mobile        # Matches the parent directory name under skills/
  tags: [tag1, tag2]      # Searchable tags
  internal: false         # Set true for WIP/experimental skills
  argument-hint: <path>   # Hint for skill arguments
license: UNLICENSED        # All skills are internal for now
```

### SKILL.md Body Structure

```markdown
# Skill Title

One paragraph explaining the skill.

## When to Use

Scenarios where this skill should be activated.

## Rules / Steps

Numbered, specific, actionable instructions.

## Examples

Before/after or usage examples if helpful.
```

### Rules for Skill Content

- **Specific and actionable.** Write instructions an agent can follow, not vague guidance.
- **Tool-agnostic.** Never reference specific agent UI elements. Skills work across Claude Code, Codex, OpenCode, Cursor, etc.
- **Self-contained.** All instructions belong in SKILL.md. Use `scripts/` or `templates/` subdirectories only when a skill genuinely needs supporting files.
- **Trigger phrases in description.** The description is how the CLI and agents discover skills. Include phrases like "use when debugging" or "use when writing blog posts".

## When Editing an Existing Skill

- Bump `metadata.version` in the frontmatter according to semver:
  - **PATCH** (`0.1.0` -> `0.1.1`): typo fixes, clarifications, minor wording
  - **MINOR** (`0.1.0` -> `0.2.0`): new rules, expanded coverage, backward-compatible additions
  - **MAJOR** (`1.0.0` -> `2.0.0`): breaking changes to instructions or expected behavior
- Use conventional commits:
  - `feat(skill-name): add new rule for X`
  - `fix(skill-name): clarify step 3 wording`
  - `feat(skill-name)!: restructure entire format`

## When Reviewing a Skill PR

Check that:

- [ ] `name` is kebab-case, unique (no duplicates across the repo), and prefixed `dlc-` (short for Delacour)
- [ ] `description` includes trigger phrases
- [ ] Instructions are specific and actionable
- [ ] No references to specific agent UI
- [ ] `metadata.version` is set and bumped if editing an existing skill
- [ ] Category directory matches `metadata.category`
- [ ] No em dashes in content (Delacour writing convention)

## Do Not

- Do not create skills outside the `skills/` directory
- Do not modify the README, AGENTS.md, or CI workflow without explicit instruction
- Do not add NPM packages or build tooling - this is a content-only repo
- Do not reference pricing, individual plans, or competitor tools in skill content
- Do not batch unrelated skill changes in a single commit - one skill per commit
