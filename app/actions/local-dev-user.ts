"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  canUseLocalDevelopmentSwitcher,
  getLocalDevelopmentUsers,
  LOCAL_DEV_USER_COOKIE,
} from "../../lib/local-dev-user";

export async function switchLocalDevelopmentUser(formData: FormData) {
  if (!canUseLocalDevelopmentSwitcher()) {
    throw new Error(
      "The local development user switcher is disabled in production.",
    );
  }

  const requestedUserId = Number(formData.get("userId"));
  const developmentUsers = await getLocalDevelopmentUsers();
  const selectedUser = developmentUsers.find(
    (user) => user.id === requestedUserId,
  );

  if (!selectedUser) {
    throw new Error("Choose one of the seeded local development users.");
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCAL_DEV_USER_COOKIE, String(selectedUser.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/");
}
