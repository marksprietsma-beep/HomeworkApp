import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export async function hasInitialAdminUser() {
  const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
  return adminCount > 0;
}
