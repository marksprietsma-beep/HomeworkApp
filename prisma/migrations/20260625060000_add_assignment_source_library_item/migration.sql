-- Add traceability from class assignment copies back to their reusable curriculum library source.
ALTER TABLE "HomeworkAssignment" ADD COLUMN "sourceLibraryItemId" INTEGER;

ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_sourceLibraryItemId_fkey" FOREIGN KEY ("sourceLibraryItemId") REFERENCES "CurriculumHomeworkLibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "HomeworkAssignment_sourceLibraryItemId_idx" ON "HomeworkAssignment"("sourceLibraryItemId");
