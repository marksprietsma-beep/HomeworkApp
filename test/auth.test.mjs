import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/passwords.mjs";
import { authenticateCredentials } from "../lib/auth-credentials.mjs";
import { assertAuthenticated, assertRole } from "../lib/auth-guards.mjs";

test("password hashes verify only the correct password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.equal(await verifyPassword("anything", "malformed"), false);
});

test("credentials reject invalid and disabled accounts", async () => {
  const passwordHash = await hashPassword("temporary-password");
  const findUser = async (email) => email === "active@example.test" ? { id: 1, role: "TEACHER", accountStatus: "ACTIVE", passwordHash } : email === "disabled@example.test" ? { id: 2, role: "STUDENT", accountStatus: "DISABLED", passwordHash } : null;
  const options = { password: "temporary-password", findUser, verifyPassword };
  assert.equal((await authenticateCredentials({ ...options, email: " ACTIVE@example.test " }))?.id, 1);
  assert.equal(await authenticateCredentials({ ...options, email: "active@example.test", password: "wrong" }), null);
  assert.equal(await authenticateCredentials({ ...options, email: "disabled@example.test" }), null);
  assert.equal(await authenticateCredentials({ ...options, email: "missing@example.test" }), null);
});

test("authentication and role guards reject unauthenticated or unauthorized users", () => {
  assert.throws(() => assertAuthenticated(null), /Authentication required/);
  assert.throws(() => assertRole({ role: "STUDENT" }, ["TEACHER"]), /permission/);
  assert.equal(assertRole({ id: 1, role: "TEACHER" }, ["TEACHER"]).id, 1);
});
