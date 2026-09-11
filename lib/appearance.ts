import { TextSizePreference, ThemePreference, UserRole } from "@prisma/client";

export const DEFAULT_APPEARANCE = {
  themePreference: ThemePreference.SYSTEM,
  textSizePreference: TextSizePreference.STANDARD,
} as const;

export const LIGHT_STANDARD_APPEARANCE = {
  themePreference: ThemePreference.LIGHT,
  textSizePreference: TextSizePreference.STANDARD,
} as const;

export type AppearancePreferences = {
  themePreference: ThemePreference;
  textSizePreference: TextSizePreference;
};

type AppearanceRole = typeof UserRole.STUDENT | typeof UserRole.ADMIN;

type AppearanceViewer = AppearancePreferences & { role: UserRole };

export function appearanceForViewer(viewer: AppearanceViewer | null | undefined): AppearancePreferences {
  if (viewer?.role !== UserRole.STUDENT && viewer?.role !== UserRole.ADMIN) return LIGHT_STANDARD_APPEARANCE;
  return {
    themePreference: viewer.themePreference,
    textSizePreference: viewer.textSizePreference,
  };
}

export function parseAppearancePreferences(input: {
  themePreference: unknown;
  textSizePreference: unknown;
}): AppearancePreferences | null {
  if (!Object.values(ThemePreference).includes(input.themePreference as ThemePreference)) return null;
  if (!Object.values(TextSizePreference).includes(input.textSizePreference as TextSizePreference)) return null;
  return input as AppearancePreferences;
}

export function appearanceRootAttributes(preferences: AppearancePreferences | null | undefined) {
  const safe = preferences ?? LIGHT_STANDARD_APPEARANCE;
  return {
    "data-theme": safe.themePreference.toLowerCase(),
    "data-text-size": safe.textSizePreference.toLowerCase(),
  } as const;
}

export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): "light" | "dark" {
  if (preference === ThemePreference.SYSTEM) return systemIsDark ? "dark" : "light";
  return preference === ThemePreference.DARK ? "dark" : "light";
}

type AppearanceUserStore = {
  user: {
    updateMany(args: {
      where: { id: number; role: AppearanceRole };
      data: AppearancePreferences;
    }): Promise<{ count: number }>;
  };
};

export async function updateOwnAppearancePreferences(
  store: AppearanceUserStore,
  authenticatedUser: { id: number; role: UserRole },
  preferences: AppearancePreferences,
) {
  if (authenticatedUser.role !== UserRole.STUDENT && authenticatedUser.role !== UserRole.ADMIN) {
    throw new Error("You do not have permission to update appearance settings.");
  }
  return store.user.updateMany({
    where: { id: authenticatedUser.id, role: authenticatedUser.role },
    data: preferences,
  });
}
