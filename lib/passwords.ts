import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// OWASP's minimum recommended scrypt work factor (approximately 128 MiB).
// maxmem must be raised explicitly because Node's default is too low for N=2^17.
const SCRYPT_PARAMETERS = {
  N: 2 ** 17,
  r: 8,
  p: 1,
  maxmem: 192 * 1024 * 1024,
} as const;

const LEGACY_SCRYPT_PARAMETERS = {
  N: 2 ** 14,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
} as const;

const PARAMETER_PREFIX = `scrypt:N=${SCRYPT_PARAMETERS.N},r=${SCRYPT_PARAMETERS.r},p=${SCRYPT_PARAMETERS.p}`;

export function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMETERS).toString("hex");

  return `${PARAMETER_PREFIX}:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const parts = storedHash.split(":");
  let salt: string;
  let derivedKey: string;
  let parameters: typeof SCRYPT_PARAMETERS | typeof LEGACY_SCRYPT_PARAMETERS;

  if (parts.length === 4 && parts[0] === "scrypt") {
    const [scheme, parameterString, storedSalt, storedDerivedKey] = parts;

    if (scheme !== "scrypt" || parameterString !== PARAMETER_PREFIX.slice("scrypt:".length)) {
      return false;
    }

    salt = storedSalt;
    derivedKey = storedDerivedKey;
    parameters = SCRYPT_PARAMETERS;
  } else if (parts.length === 3 && parts[0] === "scrypt") {
    // Hashes created before the parameters were included used Node's scrypt
    // defaults: N=2^14, r=8 and p=1.
    [, salt, derivedKey] = parts;
    parameters = LEGACY_SCRYPT_PARAMETERS;
  } else {
    return false;
  }

  if (!salt || !derivedKey || !/^[a-f\d]+$/i.test(derivedKey) || derivedKey.length !== KEY_LENGTH * 2) {
    return false;
  }

  const candidate = scryptSync(password, salt, KEY_LENGTH, parameters);
  const expected = Buffer.from(derivedKey, "hex");

  return timingSafeEqual(expected, candidate);
}
