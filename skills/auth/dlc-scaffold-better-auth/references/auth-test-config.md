# Test Config - `packages/<name>/src/auth.test-config.ts`

A test-only auth factory used by E2E and unit tests. It mirrors the production config so route guards and UI behave identically, but never sends real email and exposes the `testUtils()` helpers (`auth.$context.test`) for creating users/orgs/sessions and capturing OTPs. Never import this from production code paths - only from tests or behind an `E2E=1` flag.

```typescript
import type { BetterAuthOptions } from "@better-auth/core";
import type { DrizzleDb } from "@<org>/db/src/client";
import { type Auth as BetterAuth, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, organization, testUtils } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { ac, roles } from "./permissions";

export type CreateTestAuthOptions = {
	db: DrizzleDb;
	siteUrl: string;
	betterAuthSecret: string;
};

const createTestAuthOptions = (options: CreateTestAuthOptions) => {
	const { db, siteUrl, betterAuthSecret } = options;
	return {
		baseURL: siteUrl,
		basePath: "/api/auth",
		secret: betterAuthSecret,
		database: drizzleAdapter(db, { provider: "pg" }),
		advanced: {
			database: {
				generateId: "uuid",
			},
		},
		plugins: [
			tanstackStartCookies(),
			organization(),
			admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),
			// emailOTP is kept so route guards/UI behave identically to prod,
			// but we never actually send mail in E2E - testUtils.login bypasses it.
			emailOTP({
				async sendVerificationOTP() {
					/* no-op in E2E */
				},
				otpLength: 6,
				expiresIn: 600,
			}),
			testUtils({ captureOTP: true }),
		],
	} satisfies BetterAuthOptions;
};

export type TestAuthOptions = ReturnType<typeof createTestAuthOptions>;
export const createTestAuth = (options: CreateTestAuthOptions) => betterAuth(createTestAuthOptions(options));
export type TestAuth = ReturnType<typeof createTestAuth>;
export type { BetterAuth };
```

## Package barrel - `packages/<name>/src/index.ts`

Re-export the production factory, the test factory, and the shared permissions:

```typescript
export {
	type Auth,
	type AuthOptions,
	type AuthSession,
	type AuthUser,
	type BetterAuth,
	type BetterAuthOptions,
	type CreateAuthOptions,
	createAuth,
} from "./auth.config";
export {
	type CreateTestAuthOptions,
	createTestAuth,
	type TestAuth,
	type TestAuthOptions,
} from "./auth.test-config";
export { ac, type Role, roles, statement } from "./permissions";
```

## Key Points

- Differs from production: no Google OAuth, no `sentinel()`/`dash()`, `sendVerificationOTP` is a no-op, and `testUtils({ captureOTP: true })` is added
- `captureOTP: true` records issued OTPs so tests can read and submit them without parsing email
- Keeping `admin()` + `organization()` + `emailOTP()` ensures guards and UI flows under test match production exactly
- Only `db`, `siteUrl`, and `betterAuthSecret` are required - no API keys, so tests run without external services