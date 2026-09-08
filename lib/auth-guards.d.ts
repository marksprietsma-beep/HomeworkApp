export function assertAuthenticated<T>(user: T | null | undefined): T;
export function assertRole<T extends { role: string }>(user: T | null | undefined, roles: string[]): T;
