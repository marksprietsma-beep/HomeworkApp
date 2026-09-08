export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, storedHash: string): Promise<boolean>;
