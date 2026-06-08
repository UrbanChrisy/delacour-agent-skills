# Client Config - `packages/<name>/src/auth.client.ts`

```typescript
import { dashClient, sentinelClient } from "@better-auth/infra/client";
import { type AuthClient, type BetterAuthClientOptions, createAuthClient } from "better-auth/client";
import { adminClient, emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import z from "zod";
import { ac, roles } from "./permissions";

export const AuthConfig = z.object({
	VITE_<APP>_SITE_URL: z.string(),
});

const config = AuthConfig.parse(Bun.env);

export const authClient: AuthClient<BetterAuthClientOptions> = createAuthClient({
	baseURL: config.VITE_<APP>_SITE_URL,
	basePath: "/api/auth",
	plugins: [
		organizationClient(),
		emailOTPClient(),
		tanstackStartCookies(),
		sentinelClient(),
		dashClient(),
		adminClient({ ac, roles }),
	],
});
```

## Key Points

- Env var name uses `VITE_` prefix so it's exposed to the client in Vite-based frameworks
- `<APP>` should be replaced with the app name (e.g., `VITE_ATLAS_SITE_URL`)
- Every client plugin is the counterpart of a server plugin: `organizationClient()` ↔ `organization()`, `emailOTPClient()` ↔ `emailOTP()`, `adminClient({ ac, roles })` ↔ `admin()`. `adminClient` consumes the same shared `ac`/`roles` from `./permissions` so authorization resolves identically on both sides
- Infra client plugins (`sentinelClient`, `dashClient`) import from `@better-auth/infra/client`; their server counterparts (`sentinel`, `dash`) import from `@better-auth/infra`
- The explicit `AuthClient<BetterAuthClientOptions>` annotation keeps the exported type portable across the monorepo
- `Bun.env` is used for validation - in non-Bun runtimes use `process.env` or `import.meta.env`
- Cookie plugin must match the server (see auth-server-config.md for framework swaps)
