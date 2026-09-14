import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isProfileImageStorageKey, LOCAL_MEDIA_MAX_BYTES, LocalMediaValidationError, removeOwnedProfileImage, storeProfileImage, validateLocalImageBytes } from "../lib/local-media";
import { studentInitials } from "../lib/student-avatar";
import { getProfileImageValidationError, PROFILE_IMAGE_MAX_BYTES } from "../lib/profile-image-policy";

test("avatar initials provide a clean null-image fallback", () => {
  assert.equal(studentInitials("Ada Lovelace"), "AL");
  assert.equal(studentInitials("Prince"), "PR");
  assert.equal(studentInitials("  "), "?");
});

test("profile-compatible raster signatures are accepted and SVG is rejected", () => {
  assert.equal(validateLocalImageBytes(Buffer.from([0xff, 0xd8, 0xff])).mimeType, "image/jpeg");
  assert.equal(validateLocalImageBytes(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])).mimeType, "image/png");
  assert.throws(() => validateLocalImageBytes(Buffer.from("<svg><script/></svg>")), LocalMediaValidationError);
});

test("oversized uploads are rejected server-side", () => {
  assert.throws(() => validateLocalImageBytes(Buffer.alloc(LOCAL_MEDIA_MAX_BYTES + 1)), /5 MB or smaller/);
});

test("profile upload policy rejects invalid files before the Server Action request", () => {
  assert.equal(getProfileImageValidationError(null), "Choose a PNG, JPEG, or WEBP image.");
  assert.equal(getProfileImageValidationError({ size: PROFILE_IMAGE_MAX_BYTES + 1, type: "image/png" }), "Profile image must be 5 MB or smaller.");
  assert.equal(getProfileImageValidationError({ size: 100, type: "image/gif" }), "Profile image must be PNG, JPEG, or WEBP.");
  assert.equal(getProfileImageValidationError({ size: PROFILE_IMAGE_MAX_BYTES, type: "image/webp" }), null);
});

test("valid profile images store and owned cleanup removes only the generated file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "clarion-profile-image-"));
  const previousRoot = process.env.LOCAL_MEDIA_ROOT;
  process.env.LOCAL_MEDIA_ROOT = root;
  try {
    const png = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });
    const stored = await storeProfileImage(png);
    assert.match(stored.path, /^\/media\/profile-images\//);
    assert.equal((await readdir(path.join(root, "profile-images"))).length, 1);
    assert.equal(await removeOwnedProfileImage(stored.path), true);
    assert.deepEqual(await readdir(path.join(root, "profile-images")), []);
  } finally {
    if (previousRoot === undefined) delete process.env.LOCAL_MEDIA_ROOT;
    else process.env.LOCAL_MEDIA_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("assignment media remains outside profile-specific authorization", () => {
  assert.equal(isProfileImageStorageKey("profile-images/generated.jpg"), true);
  assert.equal(isProfileImageStorageKey("assignment-question-images/generated.jpg"), false);
});
