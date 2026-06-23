"use server";

import { AccountStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { hashPassword } from "../../../lib/passwords";
import { canManageUsers } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";

export type AdminUserFormState = {
  error: string | null;
  success: string | null;
};

const manageableRoles = [UserRole.TEACHER, UserRole.STUDENT] as const;
const statuses = [AccountStatus.ACTIVE, AccountStatus.DISABLED] as const;

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseManageableRole(value: string) {
  const role = value as UserRole;
  if (!manageableRoles.includes(role as (typeof manageableRoles)[number])) {
    throw new Error("Choose either TEACHER or STUDENT for this manual account.");
  }
  return role;
}

function parseStatus(value: string) {
  const status = value as AccountStatus;
  if (!statuses.includes(status as (typeof statuses)[number])) {
    throw new Error("Choose a supported account status.");
  }
  return status;
}

async function assertAdminUser() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  if (!canManageUsers(selectedUser)) {
    throw new Error("User management is only available to ADMIN users.");
  }
  return selectedUser;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function createManagedUser(
  _previousState: AdminUserFormState,
  formData: FormData,
): Promise<AdminUserFormState> {
  try {
    await assertAdminUser();

    const displayName = readTrimmed(formData, "displayName");
    const email = normalizeEmail(readTrimmed(formData, "email"));
    const role = parseManageableRole(readTrimmed(formData, "role"));
    const accountStatus = parseStatus(readTrimmed(formData, "accountStatus") || AccountStatus.ACTIVE);
    const temporaryPassword = String(formData.get("temporaryPassword") ?? "");

    if (!displayName) {
      throw new Error("Enter a display name.");
    }
    if (!email) {
      throw new Error("Enter an email or login identifier.");
    }
    if (!email.includes("@")) {
      throw new Error("Use an email-style login identifier for now.");
    }
    if (temporaryPassword.length < 8) {
      throw new Error("Enter a temporary password of at least 8 characters.");
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new Error("A user with this email/login identifier already exists.");
    }

    await prisma.user.create({
      data: {
        displayName,
        email,
        role,
        accountStatus,
        passwordHash: hashPassword(temporaryPassword),
        isDevelopmentUser: false,
      },
    });

    revalidatePath("/admin/users");
    revalidatePath("/");
    return { error: null, success: `${displayName} was created.` };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "A user with this email/login identifier already exists.", success: null };
    }
    return { error: error instanceof Error ? error.message : "Could not create this user.", success: null };
  }
}

export async function updateManagedUser(
  _previousState: AdminUserFormState,
  formData: FormData,
): Promise<AdminUserFormState> {
  try {
    const adminUser = await assertAdminUser();
    const userId = Number(readTrimmed(formData, "userId"));
    const displayName = readTrimmed(formData, "displayName");
    const role = parseManageableRole(readTrimmed(formData, "role"));
    const accountStatus = parseStatus(readTrimmed(formData, "accountStatus"));

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("Choose a valid user to update.");
    }
    if (userId === adminUser?.id) {
      throw new Error("Use a future admin profile workflow to edit your own account.");
    }
    if (!displayName) {
      throw new Error("Enter a display name.");
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) {
      throw new Error("This user no longer exists.");
    }
    if (target.role === UserRole.ADMIN) {
      throw new Error("Seeded/admin accounts are read-only in this first management workflow.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { displayName, role, accountStatus },
    });

    revalidatePath("/admin/users");
    revalidatePath("/");
    return { error: null, success: `${displayName} was updated.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update this user.", success: null };
  }
}
