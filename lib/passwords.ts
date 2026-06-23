import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, keyLength).toString("hex");

  return `scrypt:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, derivedKey] = storedHash.split(":");

  if (scheme !== "scrypt" || !salt || !derivedKey) {
    return false;
  }

  const candidate = scryptSync(password, salt, keyLength);
  const expected = Buffer.from(derivedKey, "hex");

  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}
