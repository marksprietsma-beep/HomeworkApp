import assert from "node:assert/strict";
import { promisify } from "node:util";
import { scrypt as scryptCallback } from "node:crypto";
import test from "node:test";
import { AccountStatus, UserRole, type User } from "@prisma/client";
import { authenticateCredentials, getDummyPasswordHash } from "../lib/credential-auth";
import { requireAuthenticatedUserValue, requireRoleValue, selectIdentitySource } from "../lib/auth-guards";
import { hashPassword, SCRYPT_PARAMETERS, verifyPassword } from "../lib/passwords";

const scrypt = promisify(scryptCallback);
const baseUser: User = {
  id: 1, email: "teacher@example.test", displayName: "Teacher", role: UserRole.TEACHER,
  passwordHash: null, accountStatus: AccountStatus.ACTIVE, yearGroup: null,
  isDevelopmentUser: false, createdAt: new Date(), updatedAt: new Date(),
};

test("creates and verifies a parameterised strong scrypt hash", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, new RegExp(`^scrypt:${SCRYPT_PARAMETERS.N}:8:1:[0-9a-f]{32}:[0-9a-f]{128}$`));
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("rejects a wrong password", async () => {
  assert.equal(await verifyPassword("wrong", await hashPassword("right")), false);
});

test("verifies legacy three-field Node-default hashes", async () => {
  const salt = "00112233445566778899aabbccddeeff";
  const key = (await scrypt("legacy password", salt, 64)) as Buffer;
  assert.equal(await verifyPassword("legacy password", `scrypt:${salt}:${key.toString("hex")}`), true);
});

test("rejects malformed and unsupported hashes without throwing", async () => {
  for (const hash of ["", "argon2:x:y", "scrypt:bad:key", "scrypt:2:8:1:00:00", "scrypt:131072:8:2:" + "00".repeat(16) + ":" + "00".repeat(64)]) {
    assert.equal(await verifyPassword("password", hash), false);
  }
});

test("unknown email uses a valid current-strength dummy hash and returns null", async () => {
  const dummy = await getDummyPasswordHash();
  assert.equal(await verifyPassword("clarion-invalid-credential-dummy-secret", dummy), true);
  let lookedUp = "";
  const result = await authenticateCredentials(" Missing@Example.Test ", "anything", { user: { async findUnique({ where }) { lookedUp = where.email; return null; } } });
  assert.equal(lookedUp, "missing@example.test");
  assert.equal(result, null);
});

test("disabled accounts cannot authenticate", async () => {
  const user = { ...baseUser, passwordHash: await hashPassword("password123"), accountStatus: AccountStatus.DISABLED };
  assert.equal(await authenticateCredentials(user.email, "password123", { user: { async findUnique() { return user; } } }), null);
});

test("unauthenticated guard rejects", () => {
  assert.throws(() => requireAuthenticatedUserValue(null), /Authentication required/);
});

test("role guard permits and denies correctly", () => {
  assert.equal(requireRoleValue(baseUser, [UserRole.TEACHER]), baseUser);
  assert.throws(() => requireRoleValue(baseUser, [UserRole.ADMIN]), /permission/);
});

test("production identity never falls back to development identity", () => {
  const development = { id: 99 };
  assert.equal(selectIdentitySource(true, null, development), null);
  assert.equal(selectIdentitySource(false, null, development), development);
});
