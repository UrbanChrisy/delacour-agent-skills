# Client Config - `packages/<name>/src/auth.client.ts`

```typescript
import { dash } from "@better-auth/infra";
import { sentinel } from "@better-auth/infra";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import z from "zod";

export const AuthConfig = z.object({
	VITE_<APP>_SITE_URL: z.string(),
});

const config = AuthConfig.parse(Bun.env);

export const authClient = createAuthClient({
	baseURL: config.VITE_<APP>_SITE_URL,
	basePath: "/api/auth",
	plugins: [organization(), emailOTPClient(), tanstackStartCookies(), sentinel(), dash()],
});
```

## Key Points

- Env var name uses `VITE_` prefix so it's exposed to the client in Vite-based frameworks
- `<APP>` should be replaced with the app name (e.g., `VITE_ATLAS_SITE_URL`)
- Plugins must match the server config - `emailOTPClient()` is the client counterpart of `emailOTP()`, `organization()` is shared
- Client uses `sentinel()` from `@better-auth/infra`, server uses `sentinelClient()` from `@better-auth/infra/client`
- `Bun.env` is used for validation - in non-Bun runtimes use `process.env` or `import.meta.env`
- Cookie plugin must match the server (see auth-server-config.md for framework swaps)
