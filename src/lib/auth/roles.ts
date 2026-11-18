// App roles, lowest to highest. Stored per email in public.mr_members and enforced by RLS.
export const ROLES = ["viewer", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ALLOWED_DOMAIN = "hydraspecma.com";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True when `role` is at least `minimum`. A missing role never passes. */
export function hasRole(role: Role | null | undefined, minimum: Role) {
  if (!role) return false;
  return ROLES.indexOf(role) >= ROLES.indexOf(minimum);
}

/** Only HydraSpecma work addresses may use the app. */
export function isAllowedEmail(email: string) {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(e) && e.endsWith("@" + ALLOWED_DOMAIN);
}
