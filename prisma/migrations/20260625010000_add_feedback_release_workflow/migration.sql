CREATE TYPE "FeedbackReleaseState" AS ENUM ('DRAFT', 'RELEASED');

ALTER TABLE "FeedbackImport"
  ADD COLUMN "importedById" INTEGER,
  ADD COLUMN "classId" INTEGER,
  ADD COLUMN "operationSummary" JSONB;

ALTER TABLE "ParticipantFeedback"
  ADD COLUMN "releaseState" "FeedbackReleaseState" NOT NULL DEFAULT 'RELEASED',
  ADD COLUMN "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "importedById" INTEGER,
  ADD COLUMN "importAction" TEXT NOT NULL DEFAULT 'created',
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "releasedById" INTEGER;

-- Historical feedback was already student-visible before MAR-215, so keep it RELEASED.
UPDATE "ParticipantFeedback" SET "releaseState" = 'RELEASED' WHERE "releaseState" IS NULL;

CREATE INDEX "ParticipantFeedback_releaseState_idx" ON "ParticipantFeedback"("releaseState");
CREATE UNIQUE INDEX "ParticipantFeedback_assignmentId_studentId_submissionId_key" ON "ParticipantFeedback"("assignmentId", "studentId", "submissionId");
