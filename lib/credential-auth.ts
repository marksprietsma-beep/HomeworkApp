import { AccountStatus, type User } from "@prisma/client";
import { verifyPassword } from "./passwords";

const DUMMY_PASSWORD_HASH = "scrypt:131072:8:1:63c770d21364584b4347047b367058ec:b1fa87f683018878f866a94fe67ecc8950f8486a972d25e39a0a8d78e47fc4a32ee1550511bf96334f404ae0efbd23151e19448ca662b38c401bd30b3ecb4b47";

export function getDummyPasswordHash() {
  return DUMMY_PASSWORD_HASH;
}

type CredentialStore = {
  user: { findUnique(args: { where: { email: string } }): Promise<User | null> };
};

export async function authenticateCredentials(
  email: string,
  password: string,
  store: CredentialStore,
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = normalizedEmail ? await store.user.findUnique({ where: { email: normalizedEmail } }) : null;
  const passwordHash = user?.passwordHash ?? getDummyPasswordHash();
  const valid = await verifyPassword(password, passwordHash);
  if (!user || !valid || user.accountStatus === AccountStatus.DISABLED) return null;
  return user;
}
