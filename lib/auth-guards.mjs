export function assertAuthenticated(user) {
  if (!user) throw new Error("Authentication required.");
  return user;
}

export function assertRole(user, roles) {
  const authenticated = assertAuthenticated(user);
  if (!roles.includes(authenticated.role)) throw new Error("You do not have permission to perform this action.");
  return authenticated;
}
