"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "../../lib/auth";
import { LocalMediaValidationError, removeOwnedProfileImage, storeProfileImage } from "../../lib/local-media";
import { prisma } from "../../lib/prisma";

export type ProfileImageActionState = { error: string | null; success: string | null };
export const initialProfileImageActionState: ProfileImageActionState = { error: null, success: null };

function refreshProfileViews() { revalidatePath("/profile"); revalidatePath("/students"); revalidatePath("/"); }

export async function updateOwnProfileImage(_state: ProfileImageActionState, formData: FormData): Promise<ProfileImageActionState> {
  let storedPath: string | null = null;
  try {
    const viewer = await requireRole(UserRole.STUDENT);
    const file = formData.get("profileImage");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a PNG, JPEG, or WEBP image.");
    const stored = await storeProfileImage(file);
    storedPath = stored.path;
    const previous = await prisma.user.findUnique({ where: { id: viewer.id }, select: { profileImagePath: true } });
    await prisma.user.update({ where: { id: viewer.id }, data: { profileImagePath: stored.path } });
    await removeOwnedProfileImage(previous?.profileImagePath);
    refreshProfileViews();
    return { error: null, success: "Your profile picture was updated." };
  } catch (error) {
    if (storedPath) await removeOwnedProfileImage(storedPath).catch(() => undefined);
    return { error: error instanceof LocalMediaValidationError || error instanceof Error ? error.message : "Could not update your profile picture.", success: null };
  }
}

export async function removeOwnProfileImage(_state: ProfileImageActionState): Promise<ProfileImageActionState> {
  void _state;
  try {
    const viewer = await requireRole(UserRole.STUDENT);
    const previous = await prisma.user.findUnique({ where: { id: viewer.id }, select: { profileImagePath: true } });
    await prisma.user.update({ where: { id: viewer.id }, data: { profileImagePath: null } });
    await removeOwnedProfileImage(previous?.profileImagePath);
    refreshProfileViews();
    return { error: null, success: "Your profile picture was removed." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not remove your profile picture.", success: null }; }
}
