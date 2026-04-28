#!/usr/bin/env bun
/**
 * Guard: ensure `expo prebuild` has been run before dev/ios/android.
 *
 * We never want to launch against Expo Go; this project uses expo-dev-client
 * and requires the native `ios/` and `android/` projects to exist.
 *
 * If either directory is missing, run `bun expo prebuild` first.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const iosDir = join(root, "ios");
const androidDir = join(root, "android");

const hasIos = existsSync(iosDir);
const hasAndroid = existsSync(androidDir);

if (!hasIos || !hasAndroid) {
  const missing = [!hasIos && "ios", !hasAndroid && "android"]
    .filter(Boolean)
    .join(", ");
  console.log(`[ensure-prebuild] Missing native project(s): ${missing}. Running \`bun run prebuild\`...`);
  const result = spawnSync("bun", ["run", "prebuild"], {
    stdio: "inherit",
    cwd: root,
  });
  if (result.status !== 0) {
    console.error("[ensure-prebuild] `bun run prebuild` failed.");
    process.exit(result.status ?? 1);
  }
}
