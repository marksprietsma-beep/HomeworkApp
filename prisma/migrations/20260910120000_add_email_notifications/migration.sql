-- Add a database-backed, idempotent email notification outbox and non-secret settings.
CREATE TYPE "EmailNotificationType" AS ENUM ('HOMEWORK_PUBLISHED', 'FEEDBACK_RELEASED');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

ALTER TABLE "HomeworkAssignment" ADD COLUMN "publicationVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "EmailNotificationSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "homeworkEnabled" BOOLEAN NOT NULL DEFAULT true,
  "feedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
  "homeworkSubjectTemplate" TEXT NOT NULL,
  "homeworkBodyTemplate" TEXT NOT NULL,
  "feedbackSubjectTemplate" TEXT NOT NULL,
  "feedbackBodyTemplate" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailNotificationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailNotification" (
  "id" SERIAL NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "type" "EmailNotificationType" NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "recipientUserId" INTEGER,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "assignmentId" INTEGER,
  "participantFeedbackId" INTEGER,
  "templateData" JSONB NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "attemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailNotification_idempotencyKey_key" ON "EmailNotification"("idempotencyKey");
CREATE INDEX "EmailNotification_status_nextAttemptAt_idx" ON "EmailNotification"("status", "nextAttemptAt");
CREATE INDEX "EmailNotification_createdAt_idx" ON "EmailNotification"("createdAt");
CREATE INDEX "EmailNotification_recipientUserId_idx" ON "EmailNotification"("recipientUserId");
CREATE INDEX "EmailNotification_assignmentId_idx" ON "EmailNotification"("assignmentId");
CREATE INDEX "EmailNotification_participantFeedbackId_idx" ON "EmailNotification"("participantFeedbackId");
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_participantFeedbackId_fkey" FOREIGN KEY ("participantFeedbackId") REFERENCES "ParticipantFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
