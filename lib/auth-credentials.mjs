export async function authenticateCredentials({ email, password, findUser, verifyPassword }) {
  const user = await findUser(email.trim().toLowerCase());
  // Always perform a hash verification so missing users do not have an obvious fast path.
  const fallbackHash = "scrypt:16384:00000000000000000000000000000000:4f31f4471c053d85a8a79a87314a8b4f8e1b4e1931d44554e953bb05c79e074dd52a20b00df67a1c72f1d7f7310f27b6597483fc1bca1f19960ed186a20e8ce";
  const valid = await verifyPassword(password, user?.passwordHash ?? fallbackHash);
  if (!user || user.accountStatus !== "ACTIVE" || !user.passwordHash || !valid) return null;
  return user;
}
