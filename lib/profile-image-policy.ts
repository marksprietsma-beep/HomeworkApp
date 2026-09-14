export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const PROFILE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type ProfileImageCandidate = {
  size: number;
  type: string;
};

export function getProfileImageValidationError(file: ProfileImageCandidate | null | undefined) {
  if (!file || file.size === 0) return "Choose a PNG, JPEG, or WEBP image.";
  if (file.size > PROFILE_IMAGE_MAX_BYTES) return "Profile image must be 5 MB or smaller.";
  if (!PROFILE_IMAGE_MIME_TYPES.has(file.type)) return "Profile image must be PNG, JPEG, or WEBP.";
  return null;
}
