import type { UserRole } from "@prisma/client";

export const FORCED_PASSWORD_CHANGE_ERROR = "A password change is required before continuing.";

export function requirePasswordChangeCompleteValue<T extends { mustChangePassword?: boolean }>(user: T): T {
  if (user.mustChangePassword) throw new Error(FORCED_PASSWORD_CHANGE_ERROR);
  return user;
}

export function requireAuthenticatedUserValue<T>(user: T | null): T {
  if (!user) throw new Error("Authentication required.");
  return user;
}

export function requireRoleValue<T extends { role: UserRole }>(user: T | null, roles: readonly UserRole[]): T {
  const authenticated = requireAuthenticatedUserValue(user);
  if (!roles.includes(authenticated.role)) throw new Error("You do not have permission to perform this action.");
  return authenticated;
}

export function selectIdentitySource<T>(production: boolean, sessionUser: T | null, developmentUser: T | null) {
  return production ? sessionUser : developmentUser;
}
