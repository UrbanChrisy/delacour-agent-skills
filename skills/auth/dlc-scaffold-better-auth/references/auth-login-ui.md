# Login UI Templates (coss primitives)

All files below go in `apps/<app>/`. Only scaffold these when `--app` argument is provided.

## 1. Login Page - `src/_routes/login/index.tsx`

```typescript
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginForm } from "@/modules/auth/components/login-form";

export const Route = createFileRoute("/login/")({
	beforeLoad: ({ context }) => {
		if (context.session) {
			throw redirect({ to: "/" });
		}
	},
	head: () => ({
		meta: [
			{ title: "Sign In" },
			{ name: "description", content: "Sign in to your account." },
		],
	}),
	component: LoginPage,
});

function LoginPage() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<LoginForm />
			</div>
		</div>
	);
}
```

## 2. OTP Verification Page - `src/_routes/login/code-confirm.tsx`

```typescript
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { OtpVerificationForm } from "@/modules/auth/components/otp-verification-form";

export interface CodeConfirmSearch {
	email: string;
}

export const Route = createFileRoute("/login/code-confirm")({
	beforeLoad: ({ context }) => {
		if (context.session) {
			throw redirect({ to: "/" });
		}
	},
	head: () => ({
		meta: [{ title: "Verify Code" }, { name: "robots", content: "noindex, nofollow" }],
	}),
	validateSearch: (search: Record<string, unknown>): CodeConfirmSearch => {
		const email = search.email;
		if (typeof email !== "string" || !email.includes("@")) {
			throw redirect({ to: "/login" });
		}
		return { email };
	},
	component: CodeConfirmPage,
});

function CodeConfirmPage() {
	const navigate = useNavigate();
	const { email } = Route.useSearch();

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<OtpVerificationForm
					email={email}
					onSuccess={() => navigate({ to: "/" })}
					onBack={() => navigate({ to: "/login" })}
				/>
			</div>
		</div>
	);
}
```

## 3. Login Form - `src/modules/auth/components/login-form.tsx`

Uses coss: `Button`, `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Field`, `FieldGroup`, `FieldLabel`, `FieldSeparator`, `Input`.

```typescript
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sendOtp } from "@/core/api/auth.api";
import { cn } from "@/lib/utils";

function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
			<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
			<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
			<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
			<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
		</svg>
	);
}

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");

	const googleMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch("/api/auth/sign-in/social", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ provider: "google", callbackURL: "/" }),
			});
			const data = await res.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				throw new Error(data.message ?? "Failed to start Google sign-in");
			}
		},
	});

	const otpMutation = useMutation({
		mutationFn: async (data: { email: string }) => {
			const result = await sendOtp({ data: data.email });
			if (!result.success) throw new Error("Failed to send OTP");
			return data.email;
		},
		onSuccess: (emailValue) => {
			navigate({ to: "/login/code-confirm", search: { email: emailValue } });
		},
	});

	function handleOtpSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		otpMutation.mutate({ email });
	}

	const error = googleMutation.error?.message ?? otpMutation.error?.message;

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Sign in to continue</CardTitle>
					<CardDescription>Choose your preferred sign-in method</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<Button
								variant="outline"
								type="button"
								className="w-full gap-2"
								disabled={googleMutation.isPending}
								onClick={() => googleMutation.mutate()}
							>
								{!googleMutation.isPending && <GoogleIcon />}
								{googleMutation.isPending ? "Redirecting..." : "Continue with Google"}
							</Button>
						</Field>
						<FieldSeparator>or</FieldSeparator>
						<form onSubmit={handleOtpSubmit}>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="email">Email</FieldLabel>
									<Input
										id="email"
										type="email"
										placeholder="you@example.com"
										autoComplete="email"
										required
										value={email}
										onChange={(e) => setEmail(e.target.value)}
									/>
								</Field>
								{error && <p className="text-destructive text-sm text-center">{error}</p>}
								<Field>
									<Button type="submit" className="w-full" disabled={otpMutation.isPending}>
										{otpMutation.isPending ? "Sending code..." : "Send Code"}
									</Button>
								</Field>
							</FieldGroup>
						</form>
					</FieldGroup>
				</CardContent>
			</Card>
			<p className="px-6 text-center text-muted-foreground text-xs">
				By continuing, you agree to our Terms of Service and Privacy Policy.
			</p>
		</div>
	);
}
```

## 4. OTP Verification Form - `src/modules/auth/components/otp-verification-form.tsx`

Uses coss: `Button`, `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Field`, `FieldGroup`, `InputOTP`, `InputOTPGroup`, `InputOTPSlot`.

```typescript
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { sendOtp, verifyOtp } from "@/core/api/auth.api";
import { cn } from "@/lib/utils";

interface OtpVerificationFormProps {
	email: string;
	onSuccess: () => void;
	onBack?: () => void;
}

export function OtpVerificationForm({
	email,
	onSuccess,
	onBack,
	...props
}: OtpVerificationFormProps & React.ComponentProps<"div">) {
	const [otp, setOtp] = useState("");

	const verifyMutation = useMutation({
		mutationFn: async (code: string) => {
			const result = await verifyOtp({ data: { email, otp: code } });
			if (!result.success) throw new Error(result.error);
		},
		onSuccess,
	});

	const resendMutation = useMutation({
		mutationFn: async () => {
			const result = await sendOtp({ data: email });
			if (!result.success) throw new Error("Failed to resend OTP");
		},
	});

	// Auto-submit when all 6 digits entered
	useEffect(() => {
		if (otp.length === 6) {
			verifyMutation.mutate(otp);
		}
	}, [otp, verifyMutation.mutate]);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (otp.length === 6) {
			verifyMutation.mutate(otp);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6")} {...props}>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Verify your email</CardTitle>
					<CardDescription>Enter the 6-digit code sent to {email}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field className="items-center">
								<InputOTP value={otp} onChange={setOtp} maxLength={6} autoFocus>
									<InputOTPGroup>
										<InputOTPSlot index={0} />
										<InputOTPSlot index={1} />
										<InputOTPSlot index={2} />
										<InputOTPSlot index={3} />
										<InputOTPSlot index={4} />
										<InputOTPSlot index={5} />
									</InputOTPGroup>
								</InputOTP>
							</Field>
							{verifyMutation.error && (
								<p className="text-destructive text-sm text-center">{verifyMutation.error.message}</p>
							)}
							<Field>
								<Button type="submit" className="w-full" disabled={verifyMutation.isPending || otp.length !== 6}>
									{verifyMutation.isPending ? "Verifying..." : "Verify Code"}
								</Button>
							</Field>
							<div className="flex flex-col items-center gap-2">
								<Button
									type="button"
									variant="link"
									className="h-auto p-0 text-sm"
									disabled={resendMutation.isPending}
									onClick={() => resendMutation.mutate()}
								>
									{resendMutation.isPending ? "Resending..." : "Resend code"}
								</Button>
								{resendMutation.isSuccess && <p className="text-muted-foreground text-xs">Code resent!</p>}
								{onBack && (
									<Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onBack}>
										Use a different email
									</Button>
								)}
							</div>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
```

## 5. Role Types - `src/modules/auth/types/roles.ts`

Prefer re-exporting the canonical `Role` type from the auth package (defined in `permissions.ts`) so server and client stay in sync:

```typescript
import type { Role } from "@<org>/auth";

export type UserRole = Role; // "user" | "admin"
```

## 6. Role Utilities - `src/modules/auth/utils/role.ts`

```typescript
import type { AuthSession } from "@<org>/auth";
import type { UserRole } from "../types/roles";

export function getUserRole(session: AuthSession): UserRole {
	return session.user.role === "admin" ? "admin" : "user";
}

export function isAdmin(session: AuthSession): boolean {
	return getUserRole(session) === "admin";
}
```

## 7. useIsAdmin Hook - `src/modules/auth/hooks/use-is-admin.ts`

```typescript
import { useRouteContext } from "@tanstack/react-router";

export function useIsAdmin(): boolean {
	const { user } = useRouteContext({ from: "/_authed" });
	return user.user.role === "admin";
}
```

## 8. ViewMode Context (optional) - `src/modules/auth/view-mode.context.tsx`

Allows ADMIN users to preview the app as a regular user.

```typescript
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useContext, useState } from "react";

export type ViewMode = "admin" | "user";

interface ViewModeContextValue {
	viewMode: ViewMode;
	setViewMode: Dispatch<SetStateAction<ViewMode>>;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
	const [viewMode, setViewMode] = useState<ViewMode>("admin");
	return <ViewModeContext.Provider value={{ viewMode, setViewMode }}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
	const context = useContext(ViewModeContext);
	if (!context) {
		throw new Error("useViewMode must be used within a ViewModeProvider");
	}
	return context;
}
```

## coss Components Required

Ensure these coss primitives are installed in the app before scaffolding:
- `Button` - `@/components/ui/button`
- `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` - `@/components/ui/card`
- `Field`, `FieldGroup`, `FieldLabel`, `FieldSeparator` - `@/components/ui/field`
- `Input` - `@/components/ui/input`
- `InputOTP`, `InputOTPGroup`, `InputOTPSlot` - `@/components/ui/input-otp`
