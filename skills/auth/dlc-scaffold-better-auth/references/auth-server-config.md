# Server Config - `packages/<name>/src/auth.config.ts`

```typescript
import type { BetterAuthOptions } from "@better-auth/core";
import { dash, sentinel } from "@better-auth/infra";
import type { DrizzleDb } from "@<org>/db/src/client";
import { type Auth as BetterAuth, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { ac, roles } from "./permissions";

export type CreateAuthOptions = {
	db: DrizzleDb;
	siteUrl: string;
	betterAuthSecret: string;
	resendApiKey: string;
	googleClientId: string;
	googleClientSecret: string;
};

export type { BetterAuthOptions };

const createAuthOptions = (options: CreateAuthOptions) => {
	const { db, siteUrl, betterAuthSecret, resendApiKey, googleClientId, googleClientSecret } = options;
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
			emailOTP({
				async sendVerificationOTP({ email, otp }) {
					const { Resend } = await import("resend");
					const resend = new Resend(resendApiKey);
					await resend.emails.send({
						from: "noreply@mail.<domain>",
						to: email,
						subject: "Your sign-in code",
						text: `Your sign-in code is: ${otp}`,
					});
				},
				otpLength: 6,
				expiresIn: 600,
			}),
			sentinel(),
			dash(),
		],
		socialProviders: {
			google: {
				prompt: "select_account",
				accessType: "offline",
				clientId: googleClientId,
				clientSecret: googleClientSecret,
			},
		},
	} satisfies BetterAuthOptions;
};

export type AuthOptions = ReturnType<typeof createAuthOptions>;

export const createAuth = (options: CreateAuthOptions) => betterAuth(createAuthOptions(options));
export type Auth = ReturnType<typeof createAuth>;

export type { BetterAuth };

export type AuthSession = ReturnType<typeof createAuth>["$Infer"]["Session"];
export type AuthUser = ReturnType<typeof createAuth>["$Infer"]["Session"]["user"];
```

## Key Points

- `CreateAuthOptions` keeps all secrets as explicit params - no direct `process.env` access in the package
- `createAuthOptions` is a separate internal function so `AuthOptions` type can be derived
- `satisfies BetterAuthOptions` ensures type safety while preserving literal types
- Dynamic `import("resend")` keeps the email SDK out of client bundles
- RBAC comes from the `admin()` plugin wired to the shared `ac`/`roles` from `./permissions` (see auth-permissions.md). Roles are lowercase `user`/`admin`; `defaultRole: "user"` assigns new users automatically. The plugin also adds `role`, `banned`, `banReason`, `banExpires` columns to the user table
- `sentinel()` and `dash()` are server-side and import from `@better-auth/infra` (not `/client`)
- Cookie plugin must match framework: swap `tanstackStartCookies()` for `nextCookies()` in Next.js

## Framework Cookie Plugin Swaps

| Framework | Server Plugin | Client Plugin |
|---|---|---|
| TanStack Start | `tanstackStartCookies()` from `better-auth/tanstack-start` | `tanstackStartCookies()` from `better-auth/tanstack-start` |
| Next.js | `nextCookies()` from `better-auth/next-js` | `nextCookies()` from `better-auth/next-js` |
| Express/Hono | (none needed) | (none needed) |
