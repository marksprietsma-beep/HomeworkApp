import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
export const SCRYPT_PARAMETERS = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 } as const;
const LEGACY_PARAMETERS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const;

function scrypt(password: string, salt: string, keyLength: number, options: typeof SCRYPT_PARAMETERS | typeof LEGACY_PARAMETERS) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

function isHex(value: string, bytes: number) {
  return value.length === bytes * 2 && /^[0-9a-f]+$/i.test(value);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMETERS)) as Buffer;
  return `scrypt:${SCRYPT_PARAMETERS.N}:${SCRYPT_PARAMETERS.r}:${SCRYPT_PARAMETERS.p}:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const fields = storedHash.split(":");
  let salt: string;
  let expectedHex: string;
  let parameters: typeof SCRYPT_PARAMETERS | typeof LEGACY_PARAMETERS;

  if (fields.length === 3 && fields[0] === "scrypt") {
    [, salt, expectedHex] = fields;
    parameters = LEGACY_PARAMETERS;
  } else if (fields.length === 6 && fields[0] === "scrypt") {
    const [, n, r, p, parsedSalt, parsedKey] = fields;
    if (n !== String(SCRYPT_PARAMETERS.N) || r !== String(SCRYPT_PARAMETERS.r) || p !== String(SCRYPT_PARAMETERS.p)) return false;
    salt = parsedSalt;
    expectedHex = parsedKey;
    parameters = SCRYPT_PARAMETERS;
  } else {
    return false;
  }

  if (!isHex(salt, 16) || !isHex(expectedHex, KEY_LENGTH)) return false;
  try {
    const candidate = (await scrypt(password, salt, KEY_LENGTH, parameters)) as Buffer;
    const expected = Buffer.from(expectedHex, "hex");
    return timingSafeEqual(expected, candidate);
  } catch {
    return false;
  }
}
