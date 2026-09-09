-- Add the generic structured-response mode and nullable JSON documents without
-- rewriting existing questions or text answers.
ALTER TYPE "HomeworkQuestionResponseMode" ADD VALUE 'STRUCTURED';

ALTER TABLE "HomeworkQuestion" ADD COLUMN "responseSchema" JSONB;
ALTER TABLE "SubmissionAnswer" ADD COLUMN "answerData" JSONB;
