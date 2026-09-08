"use server";

import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { verifyPassword } from "../../lib/passwords.mjs";
import { authenticateCredentials } from "../../lib/auth-credentials.mjs";
import { createSession, invalidateSession } from "../../lib/auth";

export type LoginState = { error: string | null };

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await authenticateCredentials({
    email,
    password,
    findUser: (normalizedEmail: string) => prisma.user.findUnique({ where: { email: normalizedEmail } }),
    verifyPassword,
  });
  if (!user) return { error: "Invalid email or password." };
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await invalidateSession();
  redirect("/login");
}
