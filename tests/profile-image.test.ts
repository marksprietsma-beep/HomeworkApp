import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_MEDIA_MAX_BYTES, LocalMediaValidationError, validateLocalImageBytes } from "../lib/local-media";
import { studentInitials } from "../lib/student-avatar";

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
