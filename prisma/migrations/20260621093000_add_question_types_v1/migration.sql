-- Add question type v1 metadata for assignment creation.
CREATE TYPE "HomeworkQuestionType" AS ENUM ('OPEN_TEXT', 'LONG_TEXT', 'MULTIPLE_CHOICE');

ALTER TABLE "HomeworkQuestion"
  ADD COLUMN "options" JSONB,
  ADD COLUMN "imagePath" TEXT,
  ADD COLUMN "imageCaption" TEXT,
  ADD COLUMN "imageAltText" TEXT;

ALTER TABLE "HomeworkQuestion"
  ALTER COLUMN "questionType" DROP DEFAULT;

ALTER TABLE "HomeworkQuestion"
  ALTER COLUMN "questionType" TYPE "HomeworkQuestionType"
  USING (
    CASE
      WHEN upper("questionType") = 'LONG_TEXT' THEN 'LONG_TEXT'
      WHEN upper("questionType") = 'MULTIPLE_CHOICE' THEN 'MULTIPLE_CHOICE'
      ELSE 'OPEN_TEXT'
    END
  )::"HomeworkQuestionType";

ALTER TABLE "HomeworkQuestion"
  ALTER COLUMN "questionType" SET DEFAULT 'OPEN_TEXT';
