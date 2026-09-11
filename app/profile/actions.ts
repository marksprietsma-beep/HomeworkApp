"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "../../lib/auth";
import { LocalMediaValidationError, removeOwnedProfileImage, storeProfileImage } from "../../lib/local-media";
import { prisma } from "../../lib/prisma";
import { ownStudentProfileWhere } from "../../lib/student-management";
import { parseAppearancePreferences, updateStudentAppearance } from "../../lib/appearance";

export type ProfileImageActionState = { error: string | null; success: string | null };
export const initialProfileImageActionState: ProfileImageActionState = { error: null, success: null };
export type AppearanceActionState = { error: string | null; success: string | null };
export const initialAppearanceActionState: AppearanceActionState = { error: null, success: null };

function refreshProfileViews() { revalidatePath("/profile"); revalidatePath("/students"); revalidatePath("/"); }

export async function updateOwnAppearance(_state: AppearanceActionState, formData: FormData): Promise<AppearanceActionState> {
  void _state;
  try {
    const viewer = await requireRole(UserRole.STUDENT);
    const preferences = parseAppearancePreferences({
      themePreference: formData.get("themePreference"),
      textSizePreference: formData.get("textSizePreference"),
    });
    if (!preferences) return { error: "Choose a supported theme and text size.", success: null };
    const updated = await updateStudentAppearance(prisma, viewer.id, preferences);
    if (updated.count !== 1) return { error: "Your student account could not be found.", success: null };
    revalidatePath("/", "layout");
    return { error: null, success: "Appearance settings saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save appearance settings.", success: null };
  }
}

export async function updateOwnProfileImage(_state: ProfileImageActionState, formData: FormData): Promise<ProfileImageActionState> {
  let storedPath: string | null = null;
  let databaseUpdated = false;
  try {
    const viewer = await requireRole(UserRole.STUDENT);
    const file = formData.get("profileImage");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a PNG, JPEG, or WEBP image.");
    const stored = await storeProfileImage(file);
    storedPath = stored.path;
    const ownProfileWhere = ownStudentProfileWhere(viewer);
    const previous = await prisma.user.findFirst({ where: ownProfileWhere, select: { profileImagePath: true } });
    if (!previous) throw new Error("Your student account could not be found.");
    const updated = await prisma.user.updateMany({
      where: { ...ownProfileWhere, profileImagePath: previous.profileImagePath },
      data: { profileImagePath: stored.path },
    });
    if (updated.count !== 1) throw new Error("Your profile picture changed. Refresh and try again.");
    databaseUpdated = true;
    await removeOwnedProfileImage(previous.profileImagePath).catch(() => undefined);
    refreshProfileViews();
    return { error: null, success: "Your profile picture was updated." };
  } catch (error) {
    if (storedPath && !databaseUpdated) await removeOwnedProfileImage(storedPath).catch(() => undefined);
    return { error: error instanceof LocalMediaValidationError || error instanceof Error ? error.message : "Could not update your profile picture.", success: null };
  }
}

export async function removeOwnProfileImage(_state: ProfileImageActionState): Promise<ProfileImageActionState> {
  void _state;
  try {
    const viewer = await requireRole(UserRole.STUDENT);
    const ownProfileWhere = ownStudentProfileWhere(viewer);
    const previous = await prisma.user.findFirst({ where: ownProfileWhere, select: { profileImagePath: true } });
    if (!previous) throw new Error("Your student account could not be found.");
    const updated = await prisma.user.updateMany({
      where: { ...ownProfileWhere, profileImagePath: previous.profileImagePath },
      data: { profileImagePath: null },
    });
    if (updated.count !== 1) throw new Error("Your profile picture changed. Refresh and try again.");
    await removeOwnedProfileImage(previous.profileImagePath).catch(() => undefined);
    refreshProfileViews();
    return { error: null, success: "Your profile picture was removed." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not remove your profile picture.", success: null }; }
}
