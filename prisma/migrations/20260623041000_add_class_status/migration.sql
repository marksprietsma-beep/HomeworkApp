-- Add conservative class lifecycle status for admin class management.
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Class" ADD COLUMN "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE';
