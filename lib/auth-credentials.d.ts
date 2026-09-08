type CredentialUser = { passwordHash: string | null; accountStatus: string; [key: string]: unknown };
export const DUMMY_PASSWORD_HASH: string;
export function authenticateCredentials(
  credentials: { email: string; password: string },
  findUserByEmail: (normalizedEmail: string) => Promise<CredentialUser | null>,
): Promise<CredentialUser | null>;
