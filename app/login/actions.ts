"use server";

import { redirect } from "next/navigation";
import { loginWithCredentials, logout } from "../../lib/auth";

export type LoginState = { error: string | null };

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const user = await loginWithCredentials(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!user) return { error: "Invalid email or password." };
  redirect(user.mustChangePassword ? "/change-password" : "/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
