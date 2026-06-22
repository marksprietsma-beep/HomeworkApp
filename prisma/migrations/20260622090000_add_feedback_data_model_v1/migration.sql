-- CreateEnum
CREATE TYPE "FeedbackFollowUpActionType" AS ENUM ('ACKNOWLEDGEMENT', 'SHORT_REFLECTION', 'ANSWER_FOLLOW_UP_QUESTION');

-- CreateEnum
CREATE TYPE "FeedbackFollowUpActionStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "FeedbackImport" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "feedbackFormat" TEXT NOT NULL DEFAULT 'homework-feedback',
    "feedbackVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceExportFormat" TEXT,
    "sourceExportVersion" INTEGER,
    "sourceExportGeneratedAt" TIMESTAMP(3),
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantFeedback" (
    "id" SERIAL NOT NULL,
    "feedbackImportId" INTEGER NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "studentId" INTEGER,
    "submissionId" INTEGER,
    "sourceParticipantId" INTEGER,
    "sourceParticipantName" TEXT,
    "sourceParticipantEmail" TEXT,
    "sourceSubmissionId" INTEGER,
    "sourceSubmissionStatus" TEXT,
    "overallFeedback" TEXT NOT NULL,
    "strengths" TEXT[],
    "targets" TEXT[],
    "teacherNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionFeedback" (
    "id" SERIAL NOT NULL,
    "participantFeedbackId" INTEGER NOT NULL,
    "questionId" INTEGER,
    "sourceQuestionId" INTEGER,
    "questionOrder" INTEGER,
    "feedback" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teacherNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackFollowUpAction" (
    "id" SERIAL NOT NULL,
    "participantFeedbackId" INTEGER NOT NULL,
    "questionFeedbackId" INTEGER,
    "sourceActionId" TEXT NOT NULL,
    "type" "FeedbackFollowUpActionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "FeedbackFollowUpActionStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackFollowUpAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackImport_assignmentId_idx" ON "FeedbackImport"("assignmentId");

-- CreateIndex
CREATE INDEX "ParticipantFeedback_feedbackImportId_idx" ON "ParticipantFeedback"("feedbackImportId");

-- CreateIndex
CREATE INDEX "ParticipantFeedback_assignmentId_idx" ON "ParticipantFeedback"("assignmentId");

-- CreateIndex
CREATE INDEX "ParticipantFeedback_studentId_idx" ON "ParticipantFeedback"("studentId");

-- CreateIndex
CREATE INDEX "ParticipantFeedback_submissionId_idx" ON "ParticipantFeedback"("submissionId");

-- CreateIndex
CREATE INDEX "QuestionFeedback_participantFeedbackId_idx" ON "QuestionFeedback"("participantFeedbackId");

-- CreateIndex
CREATE INDEX "QuestionFeedback_questionId_idx" ON "QuestionFeedback"("questionId");

-- CreateIndex
CREATE INDEX "FeedbackFollowUpAction_participantFeedbackId_idx" ON "FeedbackFollowUpAction"("participantFeedbackId");

-- CreateIndex
CREATE INDEX "FeedbackFollowUpAction_questionFeedbackId_idx" ON "FeedbackFollowUpAction"("questionFeedbackId");

-- CreateIndex
CREATE INDEX "FeedbackFollowUpAction_status_idx" ON "FeedbackFollowUpAction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackFollowUpAction_participantFeedbackId_sourceActionId_key" ON "FeedbackFollowUpAction"("participantFeedbackId", "sourceActionId");

-- AddForeignKey
ALTER TABLE "FeedbackImport" ADD CONSTRAINT "FeedbackImport_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantFeedback" ADD CONSTRAINT "ParticipantFeedback_feedbackImportId_fkey" FOREIGN KEY ("feedbackImportId") REFERENCES "FeedbackImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantFeedback" ADD CONSTRAINT "ParticipantFeedback_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantFeedback" ADD CONSTRAINT "ParticipantFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantFeedback" ADD CONSTRAINT "ParticipantFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFeedback" ADD CONSTRAINT "QuestionFeedback_participantFeedbackId_fkey" FOREIGN KEY ("participantFeedbackId") REFERENCES "ParticipantFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFeedback" ADD CONSTRAINT "QuestionFeedback_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "HomeworkQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackFollowUpAction" ADD CONSTRAINT "FeedbackFollowUpAction_participantFeedbackId_fkey" FOREIGN KEY ("participantFeedbackId") REFERENCES "ParticipantFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackFollowUpAction" ADD CONSTRAINT "FeedbackFollowUpAction_questionFeedbackId_fkey" FOREIGN KEY ("questionFeedbackId") REFERENCES "QuestionFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
