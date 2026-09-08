import { createHash, randomBytes } from "node:crypto";
import { AccountStatus, type User, type UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { assertAuthenticated, assertRole } from "./auth-guards.mjs";
import { canUseLocalDevelopmentSwitcher, getSelectedLocalDevelopmentUser, type LocalDevUser } from "./local-dev-user";

export { canUseLocalDevelopmentSwitcher } from "./local-dev-user";

export const SESSION_COOKIE = "homework_session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.session.create({ data: { id: digestToken(token), userId, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function invalidateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: digestToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | LocalDevUser | null> {
  if (canUseLocalDevelopmentSwitcher()) {
    return (await getSelectedLocalDevelopmentUser()).selectedUser;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { id: digestToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || session.user.accountStatus !== AccountStatus.ACTIVE) return null;
  return session.user;
}

export async function getAuthenticationState() {
  if (canUseLocalDevelopmentSwitcher()) return getSelectedLocalDevelopmentUser();
  return { selectedUser: await getCurrentUser(), developmentUsers: [] };
}

export async function requireAuthenticatedUser() {
  return assertAuthenticated(await getCurrentUser());
}

export async function requireRole(...roles: UserRole[]) {
  return assertRole(await getCurrentUser(), roles);
}
