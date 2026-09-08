"use server";

import { redirect } from "next/navigation";
import { changeRequiredPassword, type ChangePasswordResult } from "../../lib/auth";

export async function changePasswordAction(
  _previousState: ChangePasswordResult,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const result = await changeRequiredPassword(
    String(formData.get("password") ?? ""),
    String(formData.get("confirmation") ?? ""),
  );
  if (result.error) return result;
  redirect("/");
}
