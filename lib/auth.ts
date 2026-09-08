import { createHash, randomBytes } from "node:crypto";
import { AccountStatus, type UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { authenticateCredentials } from "./credential-auth";
import { getSelectedLocalDevelopmentUser, type LocalDevUser } from "./local-dev-user";
import { prisma } from "./prisma";
import { requireAuthenticatedUserValue, requireRoleValue } from "./auth-guards";

export { requireAuthenticatedUserValue, requireRoleValue } from "./auth-guards";

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
    include: { user: { select: { id: true, displayName: true, email: true, role: true, accountStatus: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.accountStatus !== AccountStatus.ACTIVE) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { id: session.user.id, displayName: session.user.displayName, email: session.user.email, role: session.user.role };
}

export async function getCurrentUserState() {
  if (process.env.NODE_ENV !== "production") return getSelectedLocalDevelopmentUser();
  return { selectedUser: await getCurrentUser(), developmentUsers: [] };
}

export async function requireAuthenticatedUser() {
  return requireAuthenticatedUserValue(await getCurrentUser());
}

export async function requireRole(...roles: UserRole[]) {
  return requireRoleValue(await getCurrentUser(), roles);
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
