export type CredentialUser = { passwordHash: string | null; accountStatus: "ACTIVE" | "DISABLED" };
export function authenticateCredentials<T extends CredentialUser>(options: { email: string; password: string; findUser(email: string): Promise<T | null>; verifyPassword(password: string, hash: string): Promise<boolean> }): Promise<T | null>;
