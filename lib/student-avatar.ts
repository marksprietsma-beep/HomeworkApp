export function studentInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) || "?").toUpperCase();
}
