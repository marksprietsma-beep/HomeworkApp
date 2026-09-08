import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// OWASP Password Storage Cheat Sheet's first recommended scrypt configuration.
const CURRENT_PARAMETERS = Object.freeze({ N: 131_072, r: 8, p: 1 });
// Node's historical defaults, used only to read hashes created by the old app.
const LEGACY_PARAMETERS = Object.freeze({ N: 16_384, r: 8, p: 1 });

// Scrypt needs approximately 128 * N * r bytes. Leave headroom for Node and
// OpenSSL's bookkeeping while retaining an explicit resource ceiling.
const CURRENT_MAX_MEMORY = 192 * 1024 * 1024;
const LEGACY_MAX_MEMORY = 32 * 1024 * 1024;

function isHex(value, bytes) {
  return typeof value === "string" && value.length === bytes * 2 && /^[0-9a-f]+$/i.test(value);
}

function parseStoredHash(storedHash) {
  if (typeof storedHash !== "string") {
    return null;
  }

  const fields = storedHash.split(":");

  if (fields.length === 3) {
    const [scheme, salt, derivedKey] = fields;
    if (scheme !== "scrypt" || !isHex(salt, SALT_LENGTH) || !isHex(derivedKey, KEY_LENGTH)) {
      return null;
    }

    return { salt, derivedKey, parameters: LEGACY_PARAMETERS, maxmem: LEGACY_MAX_MEMORY };
  }

  if (fields.length === 6) {
    const [scheme, N, r, p, salt, derivedKey] = fields;
    if (
      scheme !== "scrypt" ||
      N !== String(CURRENT_PARAMETERS.N) ||
      r !== String(CURRENT_PARAMETERS.r) ||
      p !== String(CURRENT_PARAMETERS.p) ||
      !isHex(salt, SALT_LENGTH) ||
      !isHex(derivedKey, KEY_LENGTH)
    ) {
      return null;
    }

    return { salt, derivedKey, parameters: CURRENT_PARAMETERS, maxmem: CURRENT_MAX_MEMORY };
  }

  return null;
}

async function deriveKey(password, salt, parameters, maxmem) {
  return scryptAsync(password, salt, KEY_LENGTH, { ...parameters, maxmem });
}

export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = await deriveKey(password, salt, CURRENT_PARAMETERS, CURRENT_MAX_MEMORY);

  return [
    "scrypt",
    CURRENT_PARAMETERS.N,
    CURRENT_PARAMETERS.r,
    CURRENT_PARAMETERS.p,
    salt,
    derivedKey.toString("hex"),
  ].join(":");
}

export async function verifyPassword(password, storedHash) {
  const parsed = parseStoredHash(storedHash);
  if (!parsed) {
    return false;
  }

  const candidate = await deriveKey(password, parsed.salt, parsed.parameters, parsed.maxmem);
  const expected = Buffer.from(parsed.derivedKey, "hex");

  return timingSafeEqual(expected, candidate);
}
