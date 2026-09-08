import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/passwords.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { hashPassword, verifyPassword } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("new hashes store and use the OWASP scrypt parameters", () => {
  const hash = hashPassword("correct horse battery staple");

  assert.match(hash, /^scrypt:N=131072,r=8,p=1:[a-f\d]{32}:[a-f\d]{128}$/);
  assert.equal(verifyPassword("correct horse battery staple", hash), true);
  assert.equal(verifyPassword("wrong password", hash), false);
});

test("legacy hashes created with the Node defaults remain valid", () => {
  const password = "existing password";
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64, {
    N: 2 ** 14,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  }).toString("hex");
  const legacyHash = `scrypt:${salt}:${derivedKey}`;

  assert.equal(verifyPassword(password, legacyHash), true);
  assert.equal(verifyPassword("wrong password", legacyHash), false);
});

test("malformed or unsupported hashes are rejected", () => {
  assert.equal(verifyPassword("password", "not-a-hash"), false);
  assert.equal(
    verifyPassword("password", `scrypt:N=16384,r=8,p=1:salt:${"00".repeat(64)}`),
    false,
  );
});
