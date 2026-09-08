import assert from "node:assert/strict";
import { scrypt } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";

import { hashPassword, verifyPassword } from "../lib/passwords.mjs";

const scryptAsync = promisify(scrypt);

test("hashPassword stores the OWASP scrypt parameters and verifies asynchronously", async () => {
  const result = hashPassword("correct horse battery staple");
  assert.equal(typeof result.then, "function");

  const hash = await result;
  assert.match(hash, /^scrypt:131072:8:1:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("verifyPassword supports hashes made with the legacy Node scrypt defaults", async () => {
  const salt = "00112233445566778899aabbccddeeff";
  const key = await scryptAsync("legacy password", salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  const legacyHash = `scrypt:${salt}:${key.toString("hex")}`;

  assert.equal(await verifyPassword("legacy password", legacyHash), true);
  assert.equal(await verifyPassword("wrong password", legacyHash), false);
});

test("verifyPassword safely rejects malformed and unsupported hashes", async () => {
  const malformedHashes = [
    "",
    "bcrypt:abc:def",
    "scrypt:131072:8:2:00112233445566778899aabbccddeeff:" + "00".repeat(64),
    "scrypt:1048576:8:1:00112233445566778899aabbccddeeff:" + "00".repeat(64),
    "scrypt:not-a-salt:not-a-key",
  ];

  for (const hash of malformedHashes) {
    assert.equal(await verifyPassword("password", hash), false);
  }
});
