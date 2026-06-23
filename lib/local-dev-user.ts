import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

export const LOCAL_DEV_USER_COOKIE = "homework_local_dev_user_id";

export type LocalDevUser = {
  id: number;
  displayName: string;
  email: string;
  role: UserRole;
};

export async function getLocalDevelopmentUsers(): Promise<LocalDevUser[]> {
  return prisma.user.findMany({
    where: {
      isDevelopmentUser: true,
      OR: [
        { email: "admin.dev@example.test" },
        { email: "teacher.dev@example.test" },
        { email: "student.ada.dev@example.test" },
        { email: "student.ben.dev@example.test" },
        { email: "student.cleo.dev@example.test" },
      ],
    },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  });
}

export async function getSelectedLocalDevelopmentUser(): Promise<{
  selectedUser: LocalDevUser | null;
  developmentUsers: LocalDevUser[];
}> {
  const cookieStore = await cookies();
  const selectedUserId = Number(cookieStore.get(LOCAL_DEV_USER_COOKIE)?.value);
  const developmentUsers = await getLocalDevelopmentUsers();

  const selectedUser =
    developmentUsers.find((user) => user.id === selectedUserId) ??
    developmentUsers.find((user) => user.email === "teacher.dev@example.test") ??
    developmentUsers[0] ??
    null;

  return { selectedUser, developmentUsers };
}

export function canUseLocalDevelopmentSwitcher() {
  return process.env.NODE_ENV !== "production";
}
