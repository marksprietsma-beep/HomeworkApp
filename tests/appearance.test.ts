import assert from "node:assert/strict";
import test from "node:test";
import { TextSizePreference, ThemePreference, UserRole } from "@prisma/client";
import { appearanceForViewer, appearanceRootAttributes, DEFAULT_APPEARANCE, parseAppearancePreferences, resolveTheme, updateOwnAppearancePreferences } from "../lib/appearance";

test("existing users receive safe appearance defaults", () => {
  assert.deepEqual(DEFAULT_APPEARANCE, {
    themePreference: ThemePreference.SYSTEM,
    textSizePreference: TextSizePreference.STANDARD,
  });
  assert.deepEqual(appearanceRootAttributes(null), {
    "data-theme": "light",
    "data-text-size": "standard",
  });
});

test("all supported theme and text-size combinations validate", () => {
  for (const themePreference of Object.values(ThemePreference)) {
    for (const textSizePreference of Object.values(TextSizePreference)) {
      assert.deepEqual(parseAppearancePreferences({ themePreference, textSizePreference }), { themePreference, textSizePreference });
    }
  }
});

test("forged appearance values are rejected", () => {
  assert.equal(parseAppearancePreferences({ themePreference: "SEPIA", textSizePreference: TextSizePreference.STANDARD }), null);
  assert.equal(parseAppearancePreferences({ themePreference: ThemePreference.DARK, textSizePreference: "200_PERCENT" }), null);
  assert.equal(parseAppearancePreferences({ themePreference: null, textSizePreference: null }), null);
});

test("light, dark and system themes resolve correctly", () => {
  assert.equal(resolveTheme(ThemePreference.LIGHT, true), "light");
  assert.equal(resolveTheme(ThemePreference.DARK, false), "dark");
  assert.equal(resolveTheme(ThemePreference.SYSTEM, false), "light");
  assert.equal(resolveTheme(ThemePreference.SYSTEM, true), "dark");
});

test("saved preferences produce root theme and large-text state", () => {
  assert.deepEqual(appearanceRootAttributes({ themePreference: ThemePreference.DARK, textSizePreference: TextSizePreference.LARGE }), {
    "data-theme": "dark",
    "data-text-size": "large",
  });
});

test("student and admin appearance preferences apply at the application root", () => {
  const darkAndLarge = {
    themePreference: ThemePreference.DARK,
    textSizePreference: TextSizePreference.LARGE,
  };
  assert.deepEqual(appearanceForViewer({ role: UserRole.STUDENT, ...darkAndLarge }), darkAndLarge);
  assert.deepEqual(appearanceForViewer({ role: UserRole.ADMIN, ...darkAndLarge }), darkAndLarge);
  assert.deepEqual(appearanceRootAttributes(appearanceForViewer({ role: UserRole.TEACHER, ...darkAndLarge })), {
    "data-theme": "light",
    "data-text-size": "standard",
  });
  assert.deepEqual(appearanceRootAttributes(appearanceForViewer(null)), {
    "data-theme": "light",
    "data-text-size": "standard",
  });
});

test("appearance persistence scopes student and admin writes to the authenticated account", async () => {
  for (const role of [UserRole.STUDENT, UserRole.ADMIN] as const) {
    let received: unknown;
    const result = await updateOwnAppearancePreferences({ user: { async updateMany(args) { received = args; return { count: 1 }; } } }, { id: 42, role }, {
      themePreference: ThemePreference.LIGHT,
      textSizePreference: TextSizePreference.LARGE,
    });
    assert.equal(result.count, 1);
    assert.deepEqual(received, {
      where: { id: 42, role },
      data: { themePreference: ThemePreference.LIGHT, textSizePreference: TextSizePreference.LARGE },
    });
    assert.equal(JSON.stringify(received).includes("userId"), false);
  }
});

test("appearance persistence rejects teacher accounts before any write", async () => {
  let writeAttempted = false;
  await assert.rejects(
    updateOwnAppearancePreferences({ user: { async updateMany() { writeAttempted = true; return { count: 1 }; } } }, { id: 42, role: UserRole.TEACHER }, {
      themePreference: ThemePreference.DARK,
      textSizePreference: TextSizePreference.LARGE,
    }),
    /permission/,
  );
  assert.equal(writeAttempted, false);
});
