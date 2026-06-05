---
name: dlc-scaffold-ui-package
description: Scaffold a shared UI component package inside an existing Bun/Turborepo monorepo. Base UI primitives, CVA variants, Tailwind v4 theming, Central Icons, auto-export script. Run /dlc-scaffold-monorepo first.
license: UNLICENSED
allowed-tools: Read, Write, Edit, Bash(*), Glob, Grep
metadata:
  author: chris@delacour.co.nz
  version: "0.1.0"
  category: frontend
  tags: [ui, components, base-ui, cva, tailwind, monorepo]
  argument-hint: <package-name>
---

# Scaffold UI Component Package

Add a shared UI component package to an existing monorepo scaffolded with `/dlc-scaffold-monorepo`.

## Arguments

- `$1` - **package name** (default: `ui`). Creates `packages/$1/`.

If `$1` is empty, use `ui`. Detect `@{org}` scope from root `package.json`.

---

## Step 1 - Package Config Files

### `packages/$1/package.json`

```json
{
  "name": "@{org}/$1",
  "version": "1.0.0",
  "description": "Shared UI components, styles, fonts, and theme tokens (COSS UI + Base UI + Central Icons)",
  "type": "module",
  "exports": {},
  "scripts": {
    "check": "biome check ./src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.3.0",
    "@central-icons-react/round-outlined-radius-1-stroke-1.5": "^1.1.178",
    "@fontsource-variable/geist": "^5.2.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "shadcn": "^4.1.2",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
  "peerDependencies": {
    "react": "^19",
    "react-dom": "^19",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "@{org}/biome-config": "workspace:*",
    "@{org}/tsconfig": "workspace:*",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.9.3"
  }
}
```

> **Note:** `exports` is left empty - Step 6 auto-generates it.

### `packages/$1/tsconfig.json`

```json
{
  "extends": "@{org}/tsconfig/tsconfig.react.json",
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"],
      "@{org}/core/components": ["./src/components/*"],
      "@{org}/core/ui": ["./src/components/ui/*"],
      "@{org}/core/lib": ["./src/lib/*"],
      "@{org}/core/hooks": ["./src/hooks/*"]
    }
  }
}
```

### `packages/$1/biome.jsonc`

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "extends": "//",
  "root": false,
  "files": {
    "includes": ["src/**/*"]
  }
}
```

### `packages/$1/components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/global.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "central",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@{org}/$1/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {
    "@coss": "https://coss.com/ui/r/{name}.json"
  }
}
```

---

## Step 2 - Utility Files

### `packages/$1/src/lib/utils.ts`

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
```

### `packages/$1/src/icons/central.ts`

```typescript
export * from "@central-icons-react/round-outlined-radius-1-stroke-1.5";
```

### `packages/$1/src/hooks/use-media-query.ts`

```typescript
"use client";

import { useCallback, useSyncExternalStore } from "react";

const BREAKPOINTS = {
	"2xl": 1536,
	"3xl": 1600,
	"4xl": 2000,
	lg: 1024,
	md: 800,
	sm: 640,
	xl: 1280,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

type BreakpointQuery = Breakpoint | `max-${Breakpoint}` | `${Breakpoint}:max-${Breakpoint}`;

function resolveMin(value: Breakpoint | number): string {
	const px = typeof value === "number" ? value : BREAKPOINTS[value];
	return `(min-width: ${px}px)`;
}

function resolveMax(value: Breakpoint | number): string {
	const px = typeof value === "number" ? value : BREAKPOINTS[value];
	return `(max-width: ${px - 1}px)`;
}

function parseQuery(query: BreakpointQuery | MediaQueryInput | (string & {})): string {
	if (typeof query !== "string") {
		const parts: string[] = [];
		if (query.min != null) parts.push(resolveMin(query.min));
		if (query.max != null) parts.push(resolveMax(query.max));
		if (query.pointer === "coarse") parts.push("(pointer: coarse)");
		if (query.pointer === "fine") parts.push("(pointer: fine)");
		if (parts.length === 0) return "(min-width: 0px)";
		return parts.join(" and ");
	}

	if (query.startsWith("(")) return query;

	const parts: string[] = [];
	for (const segment of query.split(":")) {
		if (segment.startsWith("max-")) {
			const bp = segment.slice(4);
			if (bp in BREAKPOINTS) parts.push(resolveMax(bp as Breakpoint));
		} else if (segment in BREAKPOINTS) {
			parts.push(resolveMin(segment as Breakpoint));
		}
	}

	return parts.length > 0 ? parts.join(" and ") : query;
}

function getServerSnapshot(): boolean {
	return false;
}

export type MediaQueryInput = {
	min?: Breakpoint | number;
	max?: Breakpoint | number;
	/** Touch-like input (finger). Use "fine" for mouse/trackpad. */
	pointer?: "coarse" | "fine";
};

export function useMediaQuery(query: BreakpointQuery | MediaQueryInput | (string & {})): boolean {
	const mediaQuery = parseQuery(query);

	const subscribe = useCallback(
		(callback: () => void) => {
			if (typeof window === "undefined") return () => {};
			const mql = window.matchMedia(mediaQuery);
			mql.addEventListener("change", callback);
			return () => mql.removeEventListener("change", callback);
		},
		[mediaQuery]
	);

	const getSnapshot = useCallback(() => {
		if (typeof window === "undefined") return false;
		return window.matchMedia(mediaQuery).matches;
	}, [mediaQuery]);

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsMobile(): boolean {
	return useMediaQuery("max-md");
}
```

---

## Step 3 - Style System

### `packages/$1/src/styles/index.css`

```css
@import "./base.css";
@import "./fonts.css";
@import "./tokens.css";
@import "./theme.css";

@source "../**/*.{ts,tsx}";
```

### `packages/$1/src/styles/base.css`

```css
@import "tailwindcss";
@import "tw-animate-css";

@layer base {
	* {
		@apply border-border outline-ring/50;
	}
	body {
		@apply bg-background text-foreground;
	}
}
```

### `packages/$1/src/styles/fonts.css`

```css
@import "@fontsource-variable/geist";
```

### `packages/$1/src/styles/tokens.css`

```css
@theme inline {
	--font-sans: var(--font-sans);
	--font-heading: var(--font-heading);
	--font-mono: var(--font-mono);
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-sidebar-ring: var(--sidebar-ring);
	--color-sidebar-border: var(--sidebar-border);
	--color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
	--color-sidebar-accent: var(--sidebar-accent);
	--color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
	--color-sidebar-primary: var(--sidebar-primary);
	--color-sidebar-foreground: var(--sidebar-foreground);
	--color-sidebar: var(--sidebar);
	--color-ring: var(--ring);
	--color-input: var(--input);
	--color-border: var(--border);
	--color-destructive: var(--destructive);
	--color-destructive-foreground: var(--destructive-foreground);
	--color-info: var(--info);
	--color-info-foreground: var(--info-foreground);
	--color-success: var(--success);
	--color-success-foreground: var(--success-foreground);
	--color-warning: var(--warning);
	--color-warning-foreground: var(--warning-foreground);
	--color-accent-foreground: var(--accent-foreground);
	--color-accent: var(--accent);
	--color-muted-foreground: var(--muted-foreground);
	--color-muted: var(--muted);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-secondary: var(--secondary);
	--color-primary-foreground: var(--primary-foreground);
	--color-primary: var(--primary);
	--color-popover-foreground: var(--popover-foreground);
	--color-popover: var(--popover);
	--color-card-foreground: var(--card-foreground);
	--color-card: var(--card);
	--animate-skeleton: skeleton 2s -1s infinite linear;
	@keyframes skeleton {
		to {
			background-position: -200% 0;
		}
	}
}
```

### `packages/$1/src/styles/theme.css`

```css
:root {
	--radius: 0.625rem;
	--background: var(--color-white);
	--foreground: var(--color-neutral-800);
	--card: var(--color-white);
	--card-foreground: var(--color-neutral-800);
	--popover: var(--color-white);
	--popover-foreground: var(--color-neutral-800);
	--primary: var(--color-neutral-800);
	--primary-foreground: var(--color-neutral-50);
	--secondary: --alpha(var(--color-black) / 4%);
	--secondary-foreground: var(--color-neutral-800);
	--muted: --alpha(var(--color-black) / 4%);
	--muted-foreground: color-mix(in srgb, var(--color-neutral-500) 90%, var(--color-black));
	--accent: --alpha(var(--color-black) / 4%);
	--accent-foreground: var(--color-neutral-800);
	--destructive: var(--color-red-500);
	--destructive-foreground: var(--color-red-700);
	--info: var(--color-blue-500);
	--info-foreground: var(--color-blue-700);
	--success: var(--color-emerald-500);
	--success-foreground: var(--color-emerald-700);
	--warning: var(--color-amber-500);
	--warning-foreground: var(--color-amber-700);
	--border: --alpha(var(--color-black) / 8%);
	--input: --alpha(var(--color-black) / 10%);
	--ring: var(--color-neutral-400);
	--sidebar: var(--color-neutral-50);
	--sidebar-foreground: color-mix(in srgb, var(--color-neutral-800) 64%, var(--sidebar));
	--sidebar-primary: var(--color-neutral-800);
	--sidebar-primary-foreground: var(--color-neutral-50);
	--sidebar-accent: --alpha(var(--color-black) / 4%);
	--sidebar-accent-foreground: var(--color-neutral-800);
	--sidebar-border: --alpha(var(--color-black) / 6%);
	--sidebar-ring: var(--color-neutral-400);
}

.dark {
	--background: color-mix(in srgb, var(--color-neutral-950) 95%, var(--color-white));
	--foreground: var(--color-neutral-100);
	--card: color-mix(in srgb, var(--background) 98%, var(--color-white));
	--card-foreground: var(--color-neutral-100);
	--popover: color-mix(in srgb, var(--background) 98%, var(--color-white));
	--popover-foreground: var(--color-neutral-100);
	--primary: var(--color-neutral-100);
	--primary-foreground: var(--color-neutral-800);
	--secondary: --alpha(var(--color-white) / 4%);
	--secondary-foreground: var(--color-neutral-100);
	--muted: --alpha(var(--color-white) / 4%);
	--muted-foreground: color-mix(in srgb, var(--color-neutral-500) 90%, var(--color-white));
	--accent: --alpha(var(--color-white) / 4%);
	--accent-foreground: var(--color-neutral-100);
	--destructive: color-mix(in srgb, var(--color-red-500) 90%, var(--color-white));
	--destructive-foreground: var(--color-red-400);
	--info: var(--color-blue-500);
	--info-foreground: var(--color-blue-400);
	--success: var(--color-emerald-500);
	--success-foreground: var(--color-emerald-400);
	--warning: var(--color-amber-500);
	--warning-foreground: var(--color-amber-400);
	--border: --alpha(var(--color-white) / 6%);
	--input: --alpha(var(--color-white) / 8%);
	--ring: var(--color-neutral-500);
	--sidebar: color-mix(in srgb, var(--color-neutral-950) 97%, var(--color-white));
	--sidebar-foreground: color-mix(in srgb, var(--color-neutral-100) 64%, var(--sidebar));
	--sidebar-primary: var(--color-neutral-100);
	--sidebar-primary-foreground: var(--color-neutral-800);
	--sidebar-accent: --alpha(var(--color-white) / 4%);
	--sidebar-accent-foreground: var(--color-neutral-100);
	--sidebar-border: --alpha(var(--color-white) / 5%);
	--sidebar-ring: var(--color-neutral-400);
}
```

---

## Step 4 - Starter Components

Scaffold these 4 components to demonstrate all component patterns. Each file goes in `packages/$1/src/components/ui/`.

### Pattern A - Styled Wrapper: `spinner.tsx`

Simplest pattern: wrap an icon with styling, no Base UI primitive needed.

```tsx
import type React from "react";
import { IconLoadingCircle } from "../../icons/central";
import { cn } from "../../lib/utils";

export function Spinner({ className, ...props }: React.ComponentProps<typeof IconLoadingCircle>): React.ReactElement {
	return <IconLoadingCircle aria-label="Loading" className={cn("animate-spin", className)} role="status" {...props} />;
}
```

### Pattern B - useRender Wrapper: `card.tsx`

Polymorphic styled wrapper using `useRender` + `mergeProps` + `data-slot`.

```tsx
"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@{org}/$1/lib/utils";
import type React from "react";

export function Card({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
	const defaultProps = {
		className: cn(
			"relative flex flex-col rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
			className
		),
		"data-slot": "card",
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(defaultProps, props),
		render,
	});
}

export function CardHeader({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
	const defaultProps = {
		className: cn(
			"grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 in-[[data-slot=card]:has(>[data-slot=card-panel])]:pb-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
			className
		),
		"data-slot": "card-header",
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(defaultProps, props),
		render,
	});
}

export function CardTitle({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
	const defaultProps = {
		className: cn("font-semibold text-lg leading-none", className),
		"data-slot": "card-title",
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(defaultProps, props),
		render,
	});
}

export function CardDescription({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
	const defaultProps = {
		className: cn("text-muted-foreground text-sm", className),
		"data-slot": "card-description",
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(defaultProps, props),
		render,
	});
}

export function CardAction({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
	const defaultProps = {
		className: cn("col-start-2 row-span-2 row-start-1 inline-flex self-start justify-self-end", className),
		"data-slot": "card-action",
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(defaultProps, props),
		render,
	});
}

export function CardPanel({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
	const defaultProps = {
		className: cn(
			"flex-1 p-6 in-[[data-slot=card]:has(>[data-slot=card-header]:not(.border-b))]:pt-0 in-[[data-slot=card]:has(>[data-slot=card-footer]:not(.border-t))]:pb-0",
			className
		),
		"data-slot": "card-panel",
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(defaultProps, props),
		render,
	});
}

export function CardFooter({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
	const defaultProps = {
		className: cn("flex items-center p-6 in-[[data-slot=card]:has(>[data-slot=card-panel])]:pt-4", className),
		"data-slot": "card-footer",
	};

	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(defaultProps, props),
		render,
	});
}

export { CardPanel as CardContent };
```

### Pattern C - CVA Variant Component: `button.tsx`

Variant-based component using `class-variance-authority` + `useRender`.

```tsx
"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@{org}/$1/lib/utils";
import { Spinner } from "@{org}/$1/spinner";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

export const buttonVariants = cva(
	"relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
	{
		defaultVariants: {
			size: "default",
			variant: "default",
		},
		variants: {
			size: {
				default: "h-9 px-[calc(--spacing(3)-1px)] sm:h-8",
				icon: "size-9 sm:size-8",
				lg: "h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9",
				sm: "h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7",
				xl: "h-11 px-[calc(--spacing(4)-1px)] text-lg sm:h-10 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
				xs: "h-7 gap-1 rounded-md px-[calc(--spacing(2)-1px)] text-sm before:rounded-[calc(var(--radius-md)-1px)] sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
			},
			variant: {
				default:
					"not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90 data-pressed:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
				destructive:
					"not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90 data-pressed:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-white [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
				ghost:
					"border-transparent text-foreground hover:bg-accent data-pressed:bg-accent *:data-[slot=button-loading-indicator]:text-foreground",
				link: "border-transparent text-foreground underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-foreground",
				outline:
					"border-input bg-popover not-dark:bg-clip-padding text-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-accent/50 data-pressed:bg-accent/50 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:data-pressed:bg-input/64 dark:hover:bg-input/64 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 data-pressed:bg-secondary/90 *:data-[slot=button-loading-indicator]:text-secondary-foreground [:active,[data-pressed]]:bg-secondary/80",
			},
		},
	}
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
	variant?: VariantProps<typeof buttonVariants>["variant"];
	size?: VariantProps<typeof buttonVariants>["size"];
	loading?: boolean;
}

export function Button({
	className,
	variant,
	size,
	render,
	children,
	loading = false,
	disabled: disabledProp,
	...props
}: ButtonProps): React.ReactElement {
	const isDisabled: boolean = Boolean(loading || disabledProp);
	const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] = render ? undefined : "button";

	const defaultProps = {
		children: (
			<>
				{children}
				{loading && <Spinner className="pointer-events-none absolute" data-slot="button-loading-indicator" />}
			</>
		),
		className: cn(buttonVariants({ className, size, variant })),
		"aria-disabled": loading || undefined,
		"data-loading": loading ? "" : undefined,
		"data-slot": "button",
		disabled: isDisabled,
		type: typeValue,
	};

	return useRender({
		defaultTagName: "button",
		props: mergeProps<"button">(defaultProps, props),
		render,
	});
}
```

### Pattern D - Base UI Primitive Wrapper: `input.tsx`

Wrap a Base UI primitive with custom styling and size variants.

```tsx
"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@{org}/$1/lib/utils";
import type * as React from "react";

export type InputProps = Omit<InputPrimitive.Props & React.RefAttributes<HTMLInputElement>, "size"> & {
	size?: "sm" | "default" | "lg" | number;
	unstyled?: boolean;
	nativeInput?: boolean;
};

export function Input({
	className,
	size = "default",
	unstyled = false,
	nativeInput = false,
	...props
}: InputProps): React.ReactElement {
	const inputClassName = cn(
		"h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5",
		size === "sm" && "h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5",
		size === "lg" && "h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5",
		props.type === "search" &&
			"[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
		props.type === "file" &&
			"text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm"
	);

	return (
		<span
			className={
				cn(
					!unstyled &&
						"relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
					className
				) || undefined
			}
			data-size={size}
			data-slot="input-control"
		>
			{nativeInput ? (
				<input
					className={inputClassName}
					data-slot="input"
					size={typeof size === "number" ? size : undefined}
					{...props}
				/>
			) : (
				<InputPrimitive
					className={inputClassName}
					data-slot="input"
					size={typeof size === "number" ? size : undefined}
					{...props}
				/>
			)}
		</span>
	);
}

export { InputPrimitive };
```

### Pattern E - Base UI Composite Wrapper: `scroll-area.tsx`

Wrap a multi-part Base UI primitive (root + viewport + scrollbar + thumb).

```tsx
"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@{org}/$1/lib/utils";
import type React from "react";

export function ScrollArea({
	className,
	children,
	scrollFade = false,
	scrollbarGutter = false,
	...props
}: ScrollAreaPrimitive.Root.Props & {
	scrollFade?: boolean;
	scrollbarGutter?: boolean;
}): React.ReactElement {
	return (
		<ScrollAreaPrimitive.Root className={cn("size-full min-h-0", className)} {...props}>
			<ScrollAreaPrimitive.Viewport
				className={cn(
					"h-full rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain",
					scrollFade &&
						"mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]",
					scrollbarGutter && "data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5"
				)}
				data-slot="scroll-area-viewport"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar orientation="vertical" />
			<ScrollBar orientation="horizontal" />
			<ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
		</ScrollAreaPrimitive.Root>
	);
}

export function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: ScrollAreaPrimitive.Scrollbar.Props): React.ReactElement {
	return (
		<ScrollAreaPrimitive.Scrollbar
			className={cn(
				"m-1 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100",
				className
			)}
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				className="relative flex-1 rounded-full bg-foreground/20"
				data-slot="scroll-area-thumb"
			/>
		</ScrollAreaPrimitive.Scrollbar>
	);
}

export { ScrollAreaPrimitive };
```

---

## Step 5 - Auto-Export Script

### `packages/$1/scripts/gen-exports.ts`

```typescript
/**
 * Generates the exports map in package.json from component files.
 *
 * Usage: bun scripts/gen-exports.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const COMPONENTS_DIR = join(ROOT, "src", "components", "ui");
const HOOKS_DIR = join(ROOT, "src", "hooks");

async function getExportableFiles(dir: string, prefix: string): Promise<Record<string, string>> {
	const exports: Record<string, string> = {};
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
				const name = entry.name.replace(/\.tsx?$/, "");
				exports[`./${prefix}${name}`] = `./${dir.replace(`${ROOT}/`, "")}/${entry.name}`;
			}
		}
	} catch {
		// Directory doesn't exist yet
	}
	return exports;
}

async function main() {
	const pkgPath = join(ROOT, "package.json");
	const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));

	const componentExports = await getExportableFiles(COMPONENTS_DIR, "");
	const hookExports = await getExportableFiles(HOOKS_DIR, "hooks/");

	const newExports: Record<string, string> = {
		"./styles": "./src/styles/index.css",
		"./styles/base": "./src/styles/base.css",
		"./styles/fonts": "./src/styles/fonts.css",
		"./styles/tokens": "./src/styles/tokens.css",
		"./styles/theme": "./src/styles/theme.css",
		"./icons/central": "./src/icons/central.ts",
		"./lib/utils": "./src/lib/utils.ts",
		...Object.fromEntries(Object.entries(componentExports).sort(([a], [b]) => a.localeCompare(b))),
		...Object.fromEntries(Object.entries(hookExports).sort(([a], [b]) => a.localeCompare(b))),
	};

	pkg.exports = newExports;

	await writeFile(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf-8");

	const count = Object.keys(newExports).length;
	console.log(`Generated ${count} exports in package.json`);
	for (const [key, value] of Object.entries(newExports)) {
		console.log(`  ${key} → ${value}`);
	}
}

main();
```

---

## Step 6 - Wire Up

After creating all files:

1. Run `bun scripts/gen-exports.ts` from `packages/$1/` to populate `package.json` exports
2. Run `bun install` from root to resolve workspace deps
3. Run `bun run typecheck` to verify zero TS errors

---

## Step 7 - AGENTS.md

### `packages/$1/AGENTS.md`

````markdown
# {PackageName} - Shared UI Components

Shared component library with Base UI primitives, CVA variants, Tailwind v4, and Central Icons.

## Stack

- **React 19** - UI framework
- **Tailwind CSS v4** - Utility-first CSS
- **@base-ui/react** - Headless UI primitives
- **class-variance-authority** - Variant management
- **Central Icons** - Icon library (never Lucide/Hugeicons)
- **shadcn** - Component scaffolding CLI

## Commands

```bash
bun run typecheck    # Type check
bun run check        # Biome lint + format
bun scripts/gen-exports.ts  # Regenerate package.json exports
```

## Directory Structure

```
src/
├── components/
│   └── ui/              # All UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
├── hooks/
│   └── use-media-query.ts
├── icons/
│   └── central.ts       # Central Icons re-export
├── lib/
│   └── utils.ts         # cn() helper
└── styles/
    ├── index.css         # Main entry (imports all)
    ├── base.css          # Tailwind + tw-animate-css
    ├── fonts.css         # Geist Variable font
    ├── tokens.css        # Tailwind theme tokens
    └── theme.css         # Light/dark CSS variables
```

## Component Patterns

Every component follows one of these patterns:

### Pattern A - Styled Wrapper
Simple styled component, no Base UI primitive. Example: `Spinner`.

### Pattern B - useRender Wrapper
Polymorphic component using `useRender` + `mergeProps` + `data-slot`. Example: `Card`.

```typescript
export function Card({ className, render, ...props }: useRender.ComponentProps<"div">): React.ReactElement {
  const defaultProps = {
    className: cn("...", className),
    "data-slot": "card",
  };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}
```

### Pattern C - CVA Variant Component
Component with size/variant props using `class-variance-authority`. Example: `Button`.

```typescript
export const buttonVariants = cva("base classes...", {
  variants: { size: { ... }, variant: { ... } },
  defaultVariants: { size: "default", variant: "default" },
});
```

### Pattern D - Base UI Primitive Wrapper
Wrap `@base-ui/react` primitive with custom styling. Example: `Input`, `ScrollArea`.

## Adding Components

1. Create `src/components/ui/{component}.tsx`
2. Follow one of the patterns above
3. Run `bun scripts/gen-exports.ts` to auto-update exports
4. Import from consuming apps: `import { Component } from "@{org}/$1/{component}"`

## Rules

1. **`"use client"`** directive on all components using hooks or interactivity
2. **`data-slot`** attribute on every component root element
3. **`cn()`** for all className merging
4. **Central Icons only** - never Lucide, Hugeicons, or other icon libraries
5. **No barrel exports** - import directly from `@{org}/$1/{component}`
6. **Props extend `useRender.ComponentProps<"tag">`** for polymorphic rendering
7. **No `any`** - type everything with discriminated unions
8. **Biome** for linting + formatting

## Consuming in Apps

```typescript
// Import styles (usually in app root CSS)
@import "@{org}/$1/styles";

// Import components
import { Button } from "@{org}/$1/button";
import { Card, CardHeader, CardTitle } from "@{org}/$1/card";
import { Input } from "@{org}/$1/input";

// Import utilities
import { cn } from "@{org}/$1/lib/utils";
import { useMediaQuery } from "@{org}/$1/hooks/use-media-query";

// Import icons
import { IconSearch } from "@{org}/$1/icons/central";
```

## Adding New Components via shadcn

```bash
cd packages/$1
bunx shadcn@latest add {component}   # From default registry
bunx shadcn@latest add @coss/{name}  # From COSS registry
bun scripts/gen-exports.ts           # Regenerate exports
```
````

---

## Step 8 - Verify

1. `bun install` - workspace deps resolve
2. `bun run typecheck` - zero TS errors
3. `bun scripts/gen-exports.ts` from `packages/$1/` - exports populated
4. Verify `packages/$1/package.json` exports include all 5 starter components + styles + utils
5. Verify AGENTS.md exists at package root

---

## UI Package Rules

In addition to the shared rules from `/dlc-scaffold-monorepo`:

9. **`"use client"` directive** - on all components that use hooks or interactivity
10. **`data-slot` attributes** - every component root gets a semantic `data-slot` name
11. **Central Icons only** - `@central-icons-react/round-outlined-radius-1-stroke-1.5`, never Lucide/Hugeicons
12. **Base UI for headless** - use `@base-ui/react` primitives, not Radix
13. **CVA for variants** - `class-variance-authority` for size/variant patterns
14. **Auto-exports** - run `gen-exports.ts` after adding/removing components, never edit exports manually
