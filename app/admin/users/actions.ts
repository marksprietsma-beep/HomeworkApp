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

const studentYearGroups = ["", "Y7", "Y8", "Y9", "Y10", "Y11", "Y12", "Y13"] as const;

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

function parseYearGroup(value: string) {
  const yearGroup = value.toUpperCase();
  if (!studentYearGroups.includes(yearGroup as (typeof studentYearGroups)[number])) {
    throw new Error("Choose a supported year group from Y7 to Y13, or leave it blank.");
  }
  return yearGroup || null;
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
    const yearGroup = parseYearGroup(readTrimmed(formData, "yearGroup"));
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
        yearGroup: role === UserRole.STUDENT ? yearGroup : null,
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
    const yearGroup = parseYearGroup(readTrimmed(formData, "yearGroup"));
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
      data: { displayName, role, accountStatus, yearGroup: role === UserRole.STUDENT ? yearGroup : null },
    });

    revalidatePath("/admin/users");
    revalidatePath("/");
    return { error: null, success: `${displayName} was updated.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update this user.", success: null };
  }
}


export async function deleteOrDeactivateManagedUser(
  _previousState: AdminUserFormState,
  formData: FormData,
): Promise<AdminUserFormState> {
  try {
    const adminUser = await assertAdminUser();
    const userId = Number(readTrimmed(formData, "userId"));

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("Choose a valid user to remove.");
    }
    if (userId === adminUser?.id) {
      throw new Error("For safety, you cannot remove or deactivate your own active admin access here.");
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        role: true,
        isDevelopmentUser: true,
        accountStatus: true,
        _count: {
          select: {
            teachingClasses: true,
            classEnrollments: true,
            createdAssignments: true,
            homeworkSubmissions: true,
            feedbackEntries: true,
          },
        },
      },
    });

    if (!target) throw new Error("This user no longer exists.");
    if (target.role === UserRole.ADMIN) {
      const activeAdminCount = await prisma.user.count({ where: { role: UserRole.ADMIN, accountStatus: AccountStatus.ACTIVE } });
      if (activeAdminCount <= 1) throw new Error("Cannot remove the only active ADMIN user.");
      throw new Error("Admin removal is blocked in this first management workflow.");
    }
    if (target.isDevelopmentUser) {
      throw new Error("Seeded development users are protected. Create a non-seeded test user to test removal.");
    }

    const linkedDataCount = Object.values(target._count).reduce((total, count) => total + count, 0);
    if (linkedDataCount > 0) {
      if (target.accountStatus === AccountStatus.DISABLED) {
        return { error: null, success: `${target.displayName} already has linked data and is disabled.` };
      }
      await prisma.user.update({ where: { id: userId }, data: { accountStatus: AccountStatus.DISABLED } });
      revalidatePath("/admin/users");
      revalidatePath("/");
      return { error: null, success: `${target.displayName} has linked history, so the account was safely deactivated instead of deleted.` };
    }

    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");
    revalidatePath("/");
    return { error: null, success: `${target.displayName} was permanently deleted because no linked data was found.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not remove this user.", success: null };
  }
}
