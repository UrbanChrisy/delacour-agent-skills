# Permissions (RBAC) - `packages/<name>/src/permissions.ts`

Access-control statements and roles shared by the better-auth server (`admin()` plugin) and the web client (`adminClient()`), so role checks resolve identically on both sides. Both `auth.config.ts` and `auth.client.ts` import `ac` and `roles` from here.

```typescript
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Access-control statements shared by the better-auth server (`admin()` plugin)
 * and the web client (`adminClient()`), so role checks resolve identically on
 * both sides. Start from the admin plugin's default resources (`user`,
 * `session`); add app-specific resources here as they're needed.
 */
export const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

/** Regular users have no administrative capabilities. */
export const user = ac.newRole({ user: [], session: [] });

/** Admins inherit the full set of admin-plugin capabilities. */
export const admin = ac.newRole({ ...adminAc.statements });

export const roles = { user, admin };

export type Role = keyof typeof roles;
```

## Tests - `packages/<name>/src/permissions.test.ts`

```typescript
import { describe, expect, it } from "bun:test";
import { admin, roles, user } from "./permissions";

describe("access-control roles", () => {
	it("grants admins user-management permissions", () => {
		expect(admin.authorize({ user: ["ban"] }).success).toBe(true);
		expect(admin.authorize({ user: ["delete"] }).success).toBe(true);
		expect(admin.authorize({ session: ["revoke"] }).success).toBe(true);
	});

	it("denies regular users user-management permissions", () => {
		expect(user.authorize({ user: ["ban"] }).success).toBe(false);
		expect(user.authorize({ session: ["revoke"] }).success).toBe(false);
	});

	it("exposes both roles under the roles map", () => {
		expect(Object.keys(roles).sort()).toEqual(["admin", "user"]);
	});
});
```

## Key Points

- `statement` starts from the admin plugin's `defaultStatements` (`user`, `session` resources). Spread additional app resources into it as your app grows, e.g. `{ ...defaultStatements, project: ["create", "delete"] }`
- `ac = createAccessControl(statement)` is the single access-control instance both sides share
- The `user` role is intentionally empty (no admin powers); the `admin` role inherits every admin-plugin capability via `...adminAc.statements`
- `roles` is the map passed to both `admin({ ac, roles, ... })` on the server and `adminClient({ ac, roles })` on the client
- `Role` (`"user" | "admin"`) is the canonical role type - re-export it from `index.ts` and use it across the app instead of redeclaring a literal union
- Run with `bun test packages/<name>/src/permissions.test.ts`