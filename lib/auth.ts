import { createHash, randomBytes } from "node:crypto";
import { AccountStatus, type UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateCredentials } from "./credential-auth";
import { getSelectedLocalDevelopmentUser, type LocalDevUser } from "./local-dev-user";
import { prisma } from "./prisma";
import { requireAuthenticatedUserValue, requirePasswordChangeCompleteValue, requireRoleValue } from "./auth-guards";
import { hashPassword, verifyPassword } from "./passwords";
import { validatePermanentPassword } from "./password-change-policy";

export { requireAuthenticatedUserValue, requirePasswordChangeCompleteValue, requireRoleValue } from "./auth-guards";

export const SESSION_COOKIE = "clarion_session";
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export type AuthenticatedUser = LocalDevUser;

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (process.env.NODE_ENV !== "production") {
    return (await getSelectedLocalDevelopmentUser()).selectedUser;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenDigest: digestToken(token) },
    include: { user: { select: { id: true, displayName: true, email: true, role: true, accountStatus: true, mustChangePassword: true, themePreference: true, textSizePreference: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.accountStatus !== AccountStatus.ACTIVE) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { id: session.user.id, displayName: session.user.displayName, email: session.user.email, role: session.user.role, mustChangePassword: session.user.mustChangePassword, themePreference: session.user.themePreference, textSizePreference: session.user.textSizePreference };
}

export async function getCurrentUserState() {
  if (process.env.NODE_ENV !== "production") return getSelectedLocalDevelopmentUser();
  const selectedUser = await getCurrentUser();
  if (selectedUser?.mustChangePassword) redirect("/change-password");
  return { selectedUser, developmentUsers: [] };
}

export async function requireAuthenticatedUser() {
  return requirePasswordChangeCompleteValue(requireAuthenticatedUserValue(await getCurrentUser()));
}

export async function requireRole(...roles: UserRole[]) {
  return requireRoleValue(requirePasswordChangeCompleteValue(requireAuthenticatedUserValue(await getCurrentUser())), roles);
}

export type ChangePasswordResult = { error: string | null };

export async function changeRequiredPassword(password: string, confirmation: string): Promise<ChangePasswordResult> {
  if (process.env.NODE_ENV !== "production") return { error: "Password changes are only available for production accounts." };
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (!user.mustChangePassword) return { error: "This account does not require a password change." };
  const validationError = validatePermanentPassword(password, confirmation);
  if (validationError) return { error: validationError };

  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, mustChangePassword: true } });
  if (!current?.passwordHash || !current.mustChangePassword) return { error: "This password change is no longer required." };
  if (await verifyPassword(password, current.passwordHash)) return { error: "Choose a password different from your temporary password." };

  const passwordHash = await hashPassword(password);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const changed = await prisma.$transaction(async (tx) => {
    const update = await tx.user.updateMany({
      where: { id: user.id, passwordHash: current.passwordHash, mustChangePassword: true },
      data: { passwordHash, mustChangePassword: false },
    });
    if (update.count !== 1) return false;
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.session.create({ data: { tokenDigest: digestToken(token), userId: user.id, expiresAt } });
    return true;
  });
  if (!changed) return { error: "Your credentials changed in another session. Sign in again." };
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt,
  });
  return { error: null };
}

export async function loginWithCredentials(email: string, password: string) {
  const user = await authenticateCredentials(email, password, prisma);
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.session.create({ data: { tokenDigest: digestToken(token), userId: user.id, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt,
  });
  return user;
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenDigest: digestToken(token) } });
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(0) });
}
