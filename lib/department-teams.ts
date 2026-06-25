import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export function parsePositiveId(value: FormDataEntryValue | null, label = "item") {
  const id = Number(String(value ?? ""));
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Choose a valid ${label}.`);
  return id;
}

export async function getShareableTeamsForUser(user: { id: number; role: UserRole } | null) {
  if (!user || user.role === UserRole.STUDENT) return [];
  return prisma.departmentTeam.findMany({
    where: user.role === UserRole.ADMIN ? {} : { memberships: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
}

export async function canUserShareToTeam(user: { id: number; role: UserRole }, teamId: number) {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.STUDENT) return false;
  const membership = await prisma.departmentTeamMembership.findUnique({ where: { teamId_userId: { teamId, userId: user.id } }, select: { id: true } });
  return Boolean(membership);
}
