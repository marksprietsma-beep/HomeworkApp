CREATE TABLE "CurriculumHomeworkLibraryItem" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "yearGroup" TEXT,
    "unitTopic" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignmentJson" JSONB NOT NULL,
    "sourceAssignmentId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumHomeworkLibraryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CurriculumHomeworkLibraryItem_createdById_idx" ON "CurriculumHomeworkLibraryItem"("createdById");
CREATE INDEX "CurriculumHomeworkLibraryItem_sourceAssignmentId_idx" ON "CurriculumHomeworkLibraryItem"("sourceAssignmentId");

ALTER TABLE "CurriculumHomeworkLibraryItem" ADD CONSTRAINT "CurriculumHomeworkLibraryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
