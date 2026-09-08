import { verifyPassword } from "./passwords.mjs";

// This is a valid current-format hash, so an unknown email incurs the same
// OWASP-strength scrypt work as a known account rather than returning early.
export const DUMMY_PASSWORD_HASH = "scrypt:131072:8:1:9f89f91e9e6407c2f2ea912f461a4935:319908417d92c6e0339240f22c08030ce35ba55b537e790665638c537b17c11bf3334d463d914ef383acfb5fcd75265c0c8ab90cf3a73d0a60997cb7438c1187";

export async function authenticateCredentials({ email, password }, findUserByEmail) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const user = normalizedEmail ? await findUserByEmail(normalizedEmail) : null;
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches || user.accountStatus === "DISABLED") return null;
  return user;
}
