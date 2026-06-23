-- Add an optional deterministic payload hash so repeated saves of the same
-- feedback import for an assignment can be treated idempotently.
ALTER TABLE "FeedbackImport" ADD COLUMN "importPayloadHash" TEXT;

CREATE UNIQUE INDEX "FeedbackImport_assignmentId_importPayloadHash_key" ON "FeedbackImport"("assignmentId", "importPayloadHash");
