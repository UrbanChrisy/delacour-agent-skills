# App Integration Templates

All files below go in `apps/<app>/`. Only scaffold these when `--app` argument is provided.

## 1. Auth Lib Singleton - `src/lib/auth/index.ts`

```typescript
import { type Auth as BetterAuth, createAuth } from "@<org>/auth";
import z from "zod";
import { getDb } from "../db";

export const AuthConfig = z.object({
	VITE_<APP>_SITE_URL: z.string(),
	BETTER_AUTH_SECRET: z.string(),
	RESEND_API_KEY: z.string(),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
});

let _auth: BetterAuth | null = null;

export const getAuth = (): BetterAuth => {
	if (_auth == null) {
		const config = AuthConfig.parse(Bun.env);
		_auth = createAuth({
			db: getDb(),
			siteUrl: config.VITE_<APP>_SITE_URL,
			betterAuthSecret: config.BETTER_AUTH_SECRET,
			resendApiKey: config.RESEND_API_KEY,
			googleClientId: config.GOOGLE_CLIENT_ID,
			googleClientSecret: config.GOOGLE_CLIENT_SECRET,
		});
	}
	return _auth;
};
```

**Why lazy singleton:** Avoids module-level side effects. Auth is only initialized on first use, which is critical for SSR/prerendering where auth may not be needed for every request.

## 2. Session Functions - `src/lib/auth/functions.ts`

```typescript
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getAuth } from ".";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await getAuth().api.getSession({ headers });
	return session;
});

export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await getAuth().api.getSession({ headers });
	if (!session) {
		throw new Error("Unauthorized");
	}
	return session;
});
```

## 3. Auth API Server Functions - `src/core/api/auth.api.ts`

```typescript
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { getAuth } from "@/lib/auth";

export const sendOtp = createServerFn({ method: "POST" })
	.inputValidator((email: string) => email)
	.handler(async ({ data: email }) => {
		try {
			await getAuth().api.sendVerificationOTP({
				body: { email, type: "sign-in" },
			});
			return { success: true as const };
		} catch (err) {
			console.error("[auth] sendOtp failed", email, err);
			throw err;
		}
	});

export const verifyOtp = createServerFn({ method: "POST" })
	.inputValidator((data: { email: string; otp: string }) => data)
	.handler(async ({ data }) => {
		const result = await getAuth().api.signInEmailOTP({
			body: { email: data.email, otp: data.otp },
			asResponse: true,  // CRITICAL: returns Response so we can forward cookies
		});

		// Forward the session cookie to the browser
		const setCookie = result.headers.get("set-cookie");
		if (setCookie) {
			setResponseHeader("set-cookie", setCookie);
		}

		if (!result.ok) {
			return { success: false as const, error: "Invalid or expired OTP" };
		}
		return { success: true as const };
	});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
	const requestHeaders = getRequestHeaders();
	await getAuth().api.signOut({ headers: requestHeaders });
});
```

**Critical:** `asResponse: true` in `verifyOtp` is mandatory. Without it, better-auth returns the session object directly but the `set-cookie` header is lost - the browser never receives the session cookie in SSR frameworks.

## 4. Catch-All Route Handler - `src/_routes/api/auth/$.ts`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				return getAuth().handler(request);
			},
			POST: async ({ request }) => {
				return getAuth().handler(request);
			},
		},
	},
});
```

## 5. Root Route Session Loading - modify `src/_routes/__root.tsx`

Add to `beforeLoad`:
```typescript
import { getSession } from "@/lib/auth/functions";

// In createRootRouteWithContext<RouterContext>():
beforeLoad: async () => {
	const session = await getSession();
	return { session };
},
```

Add `session` to `RouterContext` type:
```typescript
import type { AuthSession } from "@<org>/auth";

export interface RouterContext {
	session: AuthSession | null;
	// ... other context
}
```

## 6. Auth Guard Layout - `src/_routes/_authed/_layout.tsx`

```typescript
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed")({
	head: () => ({
		meta: [{ name: "robots", content: "noindex, nofollow" }],
	}),
	beforeLoad: async ({ context }) => {
		if (!context.session) {
			throw redirect({ to: "/login" });
		}
		return {
			user: context.session,
		};
	},
	component: () => <Outlet />,
});
```

## 7. Admin Guard Layout - `src/_routes/_authed/admin/_layout.tsx`

```typescript
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/admin")({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw redirect({ to: "/login" });
		}
		if (context.user.user.role !== "ADMIN") {
			throw redirect({ to: "/" });
		}
	},
	component: () => <Outlet />,
});
```

## 8. OAuth Callback Route - `src/_routes/auth/callback.tsx`

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/callback")({
	head: () => ({
		meta: [{ title: "Authenticating..." }, { name: "robots", content: "noindex, nofollow" }],
	}),
	beforeLoad: () => {
		// OAuth handled by better-auth at /api/auth/* - session cookie already set
		throw redirect({ to: "/" });
	},
	component: () => null,
});
```
