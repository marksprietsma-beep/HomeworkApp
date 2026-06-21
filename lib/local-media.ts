import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const LOCAL_MEDIA_ROUTE_PREFIX = "/media";
export const LOCAL_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const LOCAL_MEDIA_ASSIGNMENT_QUESTION_DIR = "assignment-question-images";

export type AllowedLocalImageType = {
  extension: "png" | "jpg" | "webp" | "gif";
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
};

export type StoredLocalImage = {
  path: string;
  storageKey: string;
  filename: string;
  mimeType: AllowedLocalImageType["mimeType"];
  sizeBytes: number;
  caption: string | null;
  altText: string | null;
};

const allowedImageTypes: AllowedLocalImageType[] = [
  { extension: "png", mimeType: "image/png" },
  { extension: "jpg", mimeType: "image/jpeg" },
  { extension: "webp", mimeType: "image/webp" },
  { extension: "gif", mimeType: "image/gif" },
];

export class LocalMediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalMediaValidationError";
  }
}

export function getLocalMediaRoot() {
  return path.resolve(process.env.LOCAL_MEDIA_ROOT ?? path.join(process.cwd(), "data", "uploads"));
}

export function getAllowedLocalImageTypes() {
  return [...allowedImageTypes];
}

export function getLocalMediaPublicPath(storageKey: string) {
  const safeStorageKey = normalizeStorageKey(storageKey);
  return `${LOCAL_MEDIA_ROUTE_PREFIX}/${safeStorageKey}`;
}

export function getLocalMediaFilePath(storageKey: string) {
  const safeStorageKey = normalizeStorageKey(storageKey);
  const root = getLocalMediaRoot();
  const filePath = path.resolve(root, safeStorageKey);

  if (!filePath.startsWith(`${root}${path.sep}`)) {
    throw new LocalMediaValidationError("Media path must stay inside the local media folder.");
  }

  return filePath;
}

export async function readLocalMediaFile(storageKey: string) {
  const filePath = getLocalMediaFilePath(storageKey);
  return readFile(filePath);
}

export async function storeAssignmentQuestionImage(
  file: Blob,
  metadata: { caption?: string | null; altText?: string | null } = {},
): Promise<StoredLocalImage> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const imageType = validateLocalImageBytes(bytes);
  const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${imageType.extension}`;
  const storageKey = `${LOCAL_MEDIA_ASSIGNMENT_QUESTION_DIR}/${filename}`;
  const filePath = getLocalMediaFilePath(storageKey);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, { flag: "wx" });

  return {
    path: getLocalMediaPublicPath(storageKey),
    storageKey,
    filename,
    mimeType: imageType.mimeType,
    sizeBytes: bytes.byteLength,
    caption: normalizeOptionalText(metadata.caption),
    altText: normalizeOptionalText(metadata.altText),
  };
}

export function storageKeyFromLocalMediaPath(mediaPath: string) {
  if (!mediaPath.startsWith(`${LOCAL_MEDIA_ROUTE_PREFIX}/`)) {
    throw new LocalMediaValidationError("Media path must use the local media route prefix.");
  }

  return normalizeStorageKey(mediaPath.slice(LOCAL_MEDIA_ROUTE_PREFIX.length + 1));
}

export function validateLocalImageBytes(bytes: Buffer): AllowedLocalImageType {
  if (bytes.byteLength === 0) {
    throw new LocalMediaValidationError("Image file cannot be empty.");
  }

  if (bytes.byteLength > LOCAL_MEDIA_MAX_BYTES) {
    throw new LocalMediaValidationError("Image file must be 5 MB or smaller.");
  }

  const detectedType = detectImageType(bytes);

  if (!detectedType) {
    throw new LocalMediaValidationError("Image file must be PNG, JPEG, WEBP, or GIF.");
  }

  return detectedType;
}

function normalizeStorageKey(storageKey: string) {
  const normalized = storageKey.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new LocalMediaValidationError("Media path is not safe to resolve.");
  }

  if (!normalized.startsWith(`${LOCAL_MEDIA_ASSIGNMENT_QUESTION_DIR}/`)) {
    throw new LocalMediaValidationError("Media path must be for assignment question images.");
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function detectImageType(bytes: Buffer): AllowedLocalImageType | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  const gifHeader = bytes.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return { extension: "gif", mimeType: "image/gif" };
  }

  return null;
}
