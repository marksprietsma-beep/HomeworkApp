import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);

export const SCRYPT_PARAMETERS = Object.freeze({
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 192 * 1024 * 1024,
});

const LEGACY_PARAMETERS = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
});
const KEY_LENGTH = 64;
const HEX_PATTERN = /^[0-9a-f]+$/i;

async function derive(password, salt, parameters) {
  return scrypt(password, salt, KEY_LENGTH, parameters);
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await derive(password, salt, SCRYPT_PARAMETERS);

  return `scrypt:${SCRYPT_PARAMETERS.N}:${SCRYPT_PARAMETERS.r}:${SCRYPT_PARAMETERS.p}:${salt}:${derivedKey.toString("hex")}`;
}

function parseStoredHash(storedHash) {
  if (typeof storedHash !== "string") return null;

  const fields = storedHash.split(":");
  if (fields[0] !== "scrypt") return null;

  let parameters;
  let salt;
  let encodedKey;

  if (fields.length === 6) {
    const [N, r, p] = fields.slice(1, 4).map(Number);
    if (N !== SCRYPT_PARAMETERS.N || r !== SCRYPT_PARAMETERS.r || p !== SCRYPT_PARAMETERS.p) return null;
    parameters = SCRYPT_PARAMETERS;
    [, , , , salt, encodedKey] = fields;
  } else if (fields.length === 4) {
    const N = Number(fields[1]);
    if (N !== LEGACY_PARAMETERS.N && N !== SCRYPT_PARAMETERS.N) return null;
    parameters = { ...LEGACY_PARAMETERS, N, maxmem: N === SCRYPT_PARAMETERS.N ? SCRYPT_PARAMETERS.maxmem : LEGACY_PARAMETERS.maxmem };
    [, , salt, encodedKey] = fields;
  } else if (fields.length === 3) {
    parameters = LEGACY_PARAMETERS;
    [, salt, encodedKey] = fields;
  } else {
    return null;
  }

  if (!salt || !encodedKey || encodedKey.length !== KEY_LENGTH * 2 || !HEX_PATTERN.test(salt) || !HEX_PATTERN.test(encodedKey)) return null;
  return { parameters, salt, expected: Buffer.from(encodedKey, "hex") };
}

export async function verifyPassword(password, storedHash) {
  const parsed = parseStoredHash(storedHash);
  if (!parsed) return false;

  try {
    const candidate = await derive(password, parsed.salt, parsed.parameters);
    return timingSafeEqual(parsed.expected, candidate);
  } catch {
    return false;
  }
}
