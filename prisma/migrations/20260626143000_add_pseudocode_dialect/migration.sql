CREATE TYPE "PseudocodeDialect" AS ENUM ('CAMBRIDGE_9618_2026');

ALTER TABLE "HomeworkQuestion"
  ADD COLUMN "pseudocodeDialect" "PseudocodeDialect";
