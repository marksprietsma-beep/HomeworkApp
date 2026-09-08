export function validatePermanentPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Enter a password of at least 8 characters.";
  if (password !== confirmation) return "The password confirmation does not match.";
  return null;
}
