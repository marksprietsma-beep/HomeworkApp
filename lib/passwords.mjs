import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const keyLength = 64;
const cost = 16384;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, keyLength, { N: cost });
  return `scrypt:${cost}:${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split(":");
    const [scheme] = parts;
    const legacy = parts.length === 3;
    const encodedCost = legacy ? String(cost) : parts[1];
    const salt = legacy ? parts[1] : parts[2];
    const derivedKey = legacy ? parts[2] : parts[3];
    if (scheme !== "scrypt" || !salt || !derivedKey) return false;
    const parsedCost = Number(encodedCost);
    if (!Number.isInteger(parsedCost) || parsedCost < cost) return false;
    const candidate = Buffer.from(await scrypt(password, salt, keyLength, { N: parsedCost }));
    const expected = Buffer.from(derivedKey, "hex");
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
  } catch {
    return false;
  }
}
