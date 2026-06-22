-- Add a simple teacher-entered subject label for classes.
ALTER TABLE "Class" ADD COLUMN "subject" TEXT NOT NULL DEFAULT 'General';
