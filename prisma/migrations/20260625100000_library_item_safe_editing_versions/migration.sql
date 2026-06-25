ALTER TABLE "HomeworkAssignment" ADD COLUMN "sourceLibraryVersion" INTEGER;

ALTER TABLE "CurriculumHomeworkLibraryItem" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "updatedById" INTEGER;

CREATE TABLE "CurriculumHomeworkLibraryItemVersion" (
    "id" SERIAL NOT NULL,
    "libraryItemId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "editedById" INTEGER,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CurriculumHomeworkLibraryItemVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurriculumHomeworkLibraryItemVersion_libraryItemId_version_key" ON "CurriculumHomeworkLibraryItemVersion"("libraryItemId", "version");
CREATE INDEX "CurriculumHomeworkLibraryItemVersion_editedById_idx" ON "CurriculumHomeworkLibraryItemVersion"("editedById");
CREATE INDEX "CurriculumHomeworkLibraryItemVersion_editedAt_idx" ON "CurriculumHomeworkLibraryItemVersion"("editedAt");
CREATE INDEX "HomeworkAssignment_sourceLibraryItemId_sourceLibraryVersion_idx" ON "HomeworkAssignment"("sourceLibraryItemId", "sourceLibraryVersion");
CREATE INDEX "CurriculumHomeworkLibraryItem_archivedAt_idx" ON "CurriculumHomeworkLibraryItem"("archivedAt");

ALTER TABLE "CurriculumHomeworkLibraryItemVersion" ADD CONSTRAINT "CurriculumHomeworkLibraryItemVersion_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "CurriculumHomeworkLibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurriculumHomeworkLibraryItemVersion" ADD CONSTRAINT "CurriculumHomeworkLibraryItemVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
