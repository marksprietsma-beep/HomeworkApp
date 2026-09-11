import assert from "node:assert/strict";
import test from "node:test";
import { TextSizePreference, ThemePreference } from "@prisma/client";
import { appearanceRootAttributes, DEFAULT_APPEARANCE, parseAppearancePreferences, resolveTheme, updateStudentAppearance } from "../lib/appearance";

test("existing users receive safe appearance defaults", () => {
  assert.deepEqual(DEFAULT_APPEARANCE, {
    themePreference: ThemePreference.SYSTEM,
    textSizePreference: TextSizePreference.STANDARD,
  });
  assert.deepEqual(appearanceRootAttributes(null), {
    "data-theme": "system",
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

test("appearance persistence scopes writes to the authenticated student", async () => {
  let received: unknown;
  const result = await updateStudentAppearance({ user: { async updateMany(args) { received = args; return { count: 1 }; } } }, 42, {
    themePreference: ThemePreference.LIGHT,
    textSizePreference: TextSizePreference.LARGE,
  });
  assert.equal(result.count, 1);
  assert.deepEqual(received, {
    where: { id: 42, role: "STUDENT" },
    data: { themePreference: ThemePreference.LIGHT, textSizePreference: TextSizePreference.LARGE },
  });
  assert.equal(JSON.stringify(received).includes("userId"), false);
});
