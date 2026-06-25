CREATE TYPE "HomeworkQuestionResponseMode" AS ENUM ('TEXT', 'PSEUDOCODE');

ALTER TABLE "HomeworkQuestion"
  ADD COLUMN "responseMode" "HomeworkQuestionResponseMode" NOT NULL DEFAULT 'TEXT';
