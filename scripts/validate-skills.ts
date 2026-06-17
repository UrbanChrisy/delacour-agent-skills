#!/usr/bin/env bun
/**
 * Validate SKILL.md files in the repository.
 *
 * Checks:
 * 1. Frontmatter has required fields (name, description)
 * 2. Skill names are unique across the repo
 * 3. Optional metadata fields are correctly typed
 * 4. URLs referenced in skills are reachable
 * 5. SKILL.md files follow consistent structure
 *
 * Usage:
 *   bun run scripts/validate-skills.ts [--check-links] [skills_dir]
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

interface FrontMatter {
  [key: string]: unknown;
}

function parseFrontmatter(
  content: string,
): { fm: FrontMatter; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match?.[1] || match[2] === undefined) return { fm: {}, body: content };

  const fmBlock = match[1];
  const bodyBlock = match[2];
  const fm: FrontMatter = {};
  let currentPrefix = "";

  for (const line of fmBlock.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    // Nested key (e.g. "  author: value" under metadata:)
    const nestedMatch = line.match(/^(\s+)([\w-]+)\s*:\s*(.+)$/);
    if (nestedMatch?.[2] && nestedMatch[3] !== undefined && currentPrefix) {
      const key = `${currentPrefix}.${nestedMatch[2]}`;
      fm[key] = parseValue(nestedMatch[3].trim());
      continue;
    }

    // Top-level key
    const topMatch = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (topMatch?.[1] !== undefined) {
      const key = topMatch[1];
      const value = topMatch[2]?.trim() ?? "";
      if (value) {
        fm[key] = parseValue(value);
      } else {
        // Nested block (like metadata:)
        currentPrefix = key;
        fm[key] = {};
      }
    }
  }

  return { fm, body: bodyBlock };
}

function parseValue(value: string): unknown {
  // Quoted string
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;

  // Array like [tag1, tag2]
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((s: string) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }

  // Number
  const num = Number(value);
  if (!isNaN(num) && value !== "") return num;

  return value;
}

// ---------------------------------------------------------------------------
// Skill discovery
// ---------------------------------------------------------------------------

function findSkills(dir: string): string[] {
  const results: string[] = [];

  function walk(d: string) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "SKILL.md") {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results.sort();
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validateFrontmatter(fm: FrontMatter, path: string): string[] {
  const errors: string[] = [];

  if (!("name" in fm)) {
    errors.push(`${path}: missing required field 'name'`);
  } else if (typeof fm.name !== "string") {
    errors.push(
      `${path}: 'name' must be a string, got ${typeof fm.name}`,
    );
  }

  if (!("description" in fm)) {
    errors.push(`${path}: missing required field 'description'`);
  } else if (typeof fm.description !== "string") {
    errors.push(
      `${path}: 'description' must be a string, got ${typeof fm.description}`,
    );
  }

  return errors;
}

function validateNameFormat(fm: FrontMatter, path: string): string[] {
  const errors: string[] = [];
  const name = fm.name as string | undefined;
  if (name && !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    errors.push(
      `${path}: 'name' must be kebab-case (lowercase, hyphens, no leading/trailing hyphens), got '${name}'`,
    );
  }
  return errors;
}

function validateNameUniqueness(
  skills: [FrontMatter, string][],
): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const [fm, path] of skills) {
    const name = fm.name as string | undefined;
    if (name) {
      if (seen.has(name)) {
        errors.push(
          `Duplicate skill name '${name}': ${path} and ${seen.get(name)}`,
        );
      } else {
        seen.set(name, path);
      }
    }
  }

  return errors;
}

function validateSchema(fm: FrontMatter, path: string): string[] {
  const errors: string[] = [];

  const author = fm["metadata.author"];
  if (author !== undefined && typeof author !== "string") {
    errors.push(`${path}: 'metadata.author' must be a string`);
  }

  const version = fm["metadata.version"];
  if (version !== undefined) {
    if (typeof version !== "string") {
      errors.push(
        `${path}: 'metadata.version' must be a quoted string (not a float), got ${version}`,
      );
    } else if (!/^\d+\.\d+\.\d+$/.test(version as string)) {
      errors.push(
        `${path}: 'metadata.version' must be semver (X.Y.Z), got '${version}'`,
      );
    }
  }

  const category = fm["metadata.category"];
  if (category !== undefined && typeof category !== "string") {
    errors.push(`${path}: 'metadata.category' must be a string`);
  }

  const tags = fm["metadata.tags"];
  if (tags !== undefined && !Array.isArray(tags)) {
    errors.push(`${path}: 'metadata.tags' must be an array`);
  }

  const internal = fm["metadata.internal"];
  if (internal !== undefined && typeof internal !== "boolean") {
    errors.push(`${path}: 'metadata.internal' must be a boolean`);
  }

  return errors;
}

function validateStructure(body: string, path: string): string[] {
  const errors: string[] = [];

  if (!/^## /m.test(body)) {
    errors.push(
      `${path}: body should have at least one ## heading (e.g. '## When to Use')`,
    );
  }

  // Check for em dashes (Delacour writing convention)
  const emDashCount = (body.match(/\u2014/g) || []).length;
  if (emDashCount > 0) {
    errors.push(
      `${path}: found ${emDashCount} em dash(es) - use hyphens or commas instead (Delacour writing convention)`,
    );
  }

  return errors;
}

async function checkLinks(
  body: string,
  path: string,
): Promise<string[]> {
  const errors: string[] = [];
  const urls = body.match(/https?:\/\/[^\s)\]>"'']+/g) || [];

  // Hosts that are never meant to be live external links (dev servers).
  const SKIP_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/;

  for (let url of urls) {
    url = url.replace(/[.,;:`)\]]+$/, "");

    // Skip illustrative URLs that are not real links:
    if (/\$?\{[^}]*\}/.test(url)) continue; // template placeholder (${port}, {name})
    const host = url.replace(/^https?:\/\//, "");
    if (SKIP_HOSTS.test(host)) continue; // local dev server

    try {
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        errors.push(`${path}: URL returned ${res.status}: ${url}`);
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      errors.push(`${path}: URL unreachable: ${url} (${reason})`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const checkLinksFlag = args.includes("--check-links");
  const skillsDir = args.find((a) => !a.startsWith("--")) || "skills";

  if (!existsSync(skillsDir)) {
    console.error(`Error: skills directory not found: ${skillsDir}`);
    process.exit(1);
  }

  const skillPaths = findSkills(skillsDir);

  if (skillPaths.length === 0) {
    console.log("No SKILL.md files found");
    process.exit(0);
  }

  console.log(`Found ${skillPaths.length} skill(s)\n`);

  const allErrors: string[] = [];
  const parsedSkills: [FrontMatter, string][] = [];

  for (const absPath of skillPaths) {
    const path = relative(".", absPath);
    const content = readFileSync(absPath, "utf-8");
    const { fm, body } = parseFrontmatter(content);

    if (!Object.keys(fm).length) {
      allErrors.push(
        `${path}: no valid YAML frontmatter found (must start with ---)`,
      );
      continue;
    }

    parsedSkills.push([fm, path]);

    allErrors.push(...validateFrontmatter(fm, path));
    allErrors.push(...validateNameFormat(fm, path));
    allErrors.push(...validateSchema(fm, path));
    allErrors.push(...validateStructure(body, path));

    if (checkLinksFlag) {
      allErrors.push(...(await checkLinks(body, path)));
    }
  }

  allErrors.push(...validateNameUniqueness(parsedSkills));

  for (const error of allErrors) {
    console.log(`  ✗ ${error}`);
  }

  if (allErrors.length) {
    console.log(`\n${allErrors.length} error(s) found`);
    process.exit(1);
  } else {
    console.log(`  ✓ All ${skillPaths.length} skill(s) valid`);
    process.exit(0);
  }
}

main();
