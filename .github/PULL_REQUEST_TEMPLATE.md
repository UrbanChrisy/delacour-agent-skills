## Skill

<!-- Which skill is this PR for? -->

**Name:** `<!-- e.g. git-atomic-pr -->`
**Category:** `mobile`

## Type of Change

<!-- Check one -->

- [ ] New skill
- [ ] Edit existing skill
- [ ] Remove skill

## Quality Checklist

<!-- All items must be checked before merge -->

- [ ] `name` is kebab-case and unique within the repo
- [ ] `description` includes trigger phrases (when the skill should activate)
- [ ] Instructions are specific and actionable (not vague guidance)
- [ ] No references to specific agent UI (skills are tool-agnostic)
- [ ] `metadata.version` is set (new skills start at `"0.1.0"`, edits bump per semver)
- [ ] Category directory matches `metadata.category`
- [ ] No em dashes in content
- [ ] CI validation passes (`bun run scripts/validate-skills.ts`)

## Version Change

<!-- If editing an existing skill, what version bump? -->

- [ ] PATCH - typo fixes, clarifications, minor wording
- [ ] MINOR - new rules, expanded coverage (backward-compatible)
- [ ] MAJOR - breaking changes to instructions or expected behavior
- [ ] N/A - new skill

## Summary

<!-- What does this skill do and why is it needed? -->
