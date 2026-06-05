#!/usr/bin/env bun

/**
 * Syncs Android and iOS build numbers by:
 * 1. Getting current build numbers for both platforms
 * 2. Taking the maximum of the two
 * 3. Incrementing by 1
 * 4. Setting both platforms to that new synchronized value
 *
 * Usage: bun scripts/eas-sync-build-numbers.ts
 *
 * Note: Uses `expect` to automate the interactive EAS CLI prompts.
 */

import { $ } from "bun";

console.log("🔍 Fetching current build numbers...\n");

// Get current versions (parse text output since JSON may not include both)
const output = await $`eas build:version:get -p all --non-interactive`.text();

// Parse: "Android versionCode - 67" and "iOS buildNumber - 65"
const androidMatch = output.match(/Android versionCode - (\d+)/);
const iosMatch = output.match(/iOS buildNumber - (\d+)/);

const androidVersion = androidMatch ? Number.parseInt(androidMatch[1], 10) : 0;
const iosVersion = iosMatch ? Number.parseInt(iosMatch[1], 10) : 0;

if (androidVersion === 0 && iosVersion === 0) {
	console.error("❌ Could not parse build numbers from EAS output");
	console.error("Output was:", output);
	process.exit(1);
}

console.log(`📱 Current Android versionCode: ${androidVersion}`);
console.log(`🍎 Current iOS buildNumber: ${iosVersion}`);

const newVersion = Math.max(androidVersion, iosVersion) + 1;
console.log(`\n✨ New synchronized version: ${newVersion}\n`);

// Create expect script to automate interactive prompt
const expectScript = (platform: string, version: number) => `
spawn eas build:version:set -p ${platform}
expect "What version would you like to set?"
send "${version}\\r"
expect eof
`;

// Set Android version
console.log(`📱 Setting Android versionCode to ${newVersion}...`);
try {
	await $`expect -c ${expectScript("android", newVersion)}`;
	console.log(`✅ Android versionCode set to ${newVersion}`);
} catch (error) {
	console.error("❌ Failed to set Android version:", error);
}

// Set iOS version
console.log(`\n🍎 Setting iOS buildNumber to ${newVersion}...`);
try {
	await $`expect -c ${expectScript("ios", newVersion)}`;
	console.log(`✅ iOS buildNumber set to ${newVersion}`);
} catch (error) {
	console.error("❌ Failed to set iOS version:", error);
}

console.log("\n✅ Done! Both platforms are now at version", newVersion);
