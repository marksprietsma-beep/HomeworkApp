ALTER TABLE "ParticipantFeedback" ADD COLUMN "overallFeedbackI18n" JSONB;
ALTER TABLE "ParticipantFeedback" ADD COLUMN "strengthsI18n" JSONB;
ALTER TABLE "ParticipantFeedback" ADD COLUMN "targetsI18n" JSONB;

ALTER TABLE "QuestionFeedback" ADD COLUMN "feedbackI18n" JSONB;
ALTER TABLE "QuestionFeedback" ADD COLUMN "strengthsI18n" JSONB;
ALTER TABLE "QuestionFeedback" ADD COLUMN "targetsI18n" JSONB;

ALTER TABLE "FeedbackFollowUpAction" ADD COLUMN "promptI18n" JSONB;
