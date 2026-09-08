import assert from "node:assert/strict";
import { scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";
import { authenticateCredentials, DUMMY_PASSWORD_HASH } from "../lib/auth-credentials.mjs";
import { hashPassword, verifyPassword } from "../lib/passwords.mjs";

const scrypt = promisify(nodeScrypt);
const password = "correct horse battery staple";
const salt = "0123456789abcdef0123456789abcdef";

async function encodedKey(N = 16384) {
  const key = await scrypt(password, salt, 64, { N, r: 8, p: 1, maxmem: N === 131072 ? 192 * 1024 * 1024 : 32 * 1024 * 1024 });
  return key.toString("hex");
}

test("new hashes encode the strong N, r, and p parameters", async () => {
  const hash = await hashPassword(password);
  assert.match(hash, /^scrypt:131072:8:1:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("verifies original three-field hashes", async () => {
  const hash = `scrypt:${salt}:${await encodedKey()}`;
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("verifies intermediate four-field hashes", async () => {
  const legacy = `scrypt:16384:${salt}:${await encodedKey()}`;
  const strong = `scrypt:131072:${salt}:${await encodedKey(131072)}`;
  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(await verifyPassword(password, strong), true);
});

test("rejects malformed and unsupported hashes", async () => {
  for (const hash of ["", "bcrypt:salt:key", "scrypt:salt", "scrypt:32768:salt:key", "scrypt:131072:8:2:salt:key", "scrypt:131072:8:1:not-hex:not-hex"]) {
    assert.equal(await verifyPassword(password, hash), false, hash);
  }
});

test("unknown users exercise a valid strong fallback hash", async () => {
  assert.match(DUMMY_PASSWORD_HASH, /^scrypt:131072:8:1:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("anything", DUMMY_PASSWORD_HASH), false);
  let lookupEmail;
  const result = await authenticateCredentials(
    { email: " Missing@Example.COM ", password: "anything" },
    async (email) => { lookupEmail = email; return null; },
  );
  assert.equal(lookupEmail, "missing@example.com");
  assert.equal(result, null);
});
