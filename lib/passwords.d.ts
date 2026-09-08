export type ScryptParameters = Readonly<{ N: number; r: number; p: number; maxmem: number }>;
export const SCRYPT_PARAMETERS: ScryptParameters;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, storedHash: string): Promise<boolean>;
