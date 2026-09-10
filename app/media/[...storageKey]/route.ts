import { readFile, stat } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import {
  getLocalMediaFilePath,
  getAllowedLocalImageTypes,
  LocalMediaValidationError,
  LOCAL_MEDIA_PROFILE_IMAGE_DIR,
  getLocalMediaPublicPath,
} from "../../../lib/local-media";
import { getCurrentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

type LocalMediaRouteContext = {
  params: Promise<{ storageKey: string[] }>;
};

export async function GET(_request: NextRequest, context: LocalMediaRouteContext) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Authentication required.", { status: 401 });
  const { storageKey } = await context.params;
  const requestedStorageKey = storageKey.join("/");

  try {
    if (requestedStorageKey.startsWith(`${LOCAL_MEDIA_PROFILE_IMAGE_DIR}/`)) {
      const visibleProfile = await prisma.user.findFirst({
        where: {
          profileImagePath: getLocalMediaPublicPath(requestedStorageKey),
          ...(viewer.role === UserRole.ADMIN
            ? {}
            : viewer.role === UserRole.TEACHER
              ? { role: UserRole.STUDENT, classEnrollments: { some: { class: { teacherId: viewer.id } } } }
              : { id: viewer.id }),
        },
        select: { id: true },
      });
      if (!visibleProfile) return new NextResponse("Media file not found.", { status: 404 });
    }
    const filePath = getLocalMediaFilePath(requestedStorageKey);
    const fileStat = await stat(filePath);
    const extension = filePath.split(".").pop()?.toLowerCase();
    const imageType = getAllowedLocalImageTypes().find((type) => type.extension === extension);

    if (!imageType) {
      return new NextResponse("Unsupported media type.", { status: 415 });
    }

    const fileBytes = await readFile(filePath);

    return new NextResponse(fileBytes, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(fileStat.size),
        "Content-Type": imageType.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof LocalMediaValidationError) {
      return new NextResponse(error.message, { status: 400 });
    }

    return new NextResponse("Media file not found.", { status: 404 });
  }
}
