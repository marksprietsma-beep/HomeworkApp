"use server";

import { AccountStatus, Prisma, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { hashPassword } from "../../lib/passwords";
import { prisma } from "../../lib/prisma";

export type FirstRunSetupState = { error: string | null };

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function createInitialAdmin(
  _previousState: FirstRunSetupState,
  formData: FormData,
): Promise<FirstRunSetupState> {
  let created = false;

  try {
    const displayName = readTrimmed(formData, "displayName");
    const email = normalizeEmail(readTrimmed(formData, "email"));
    const password = String(formData.get("password") ?? "");

    if (!displayName) throw new Error("Enter the initial admin display name.");
    if (!email) throw new Error("Enter an email or login identifier.");
    if (!email.includes("@")) throw new Error("Use an email-style login identifier for now.");
    if (password.length < 8) throw new Error("Enter a password of at least 8 characters.");

    await prisma.$transaction(
      async (tx) => {
        const existingAdmin = await tx.user.count({ where: { role: UserRole.ADMIN } });
        if (existingAdmin > 0) {
          throw new Error("Initial setup is closed because an ADMIN user already exists.");
        }

        await tx.user.create({
          data: {
            displayName,
            email,
            role: UserRole.ADMIN,
            accountStatus: AccountStatus.ACTIVE,
            passwordHash: hashPassword(password),
            isDevelopmentUser: false,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    created = true;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "A user with this email/login identifier already exists." };
    }
    return { error: error instanceof Error ? error.message : "Could not create the initial admin." };
  }

  if (created) redirect("/");
  return { error: "Could not create the initial admin." };
}
