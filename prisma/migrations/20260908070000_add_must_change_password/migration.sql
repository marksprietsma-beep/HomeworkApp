-- Existing users keep normal access; only explicitly issued temporary credentials are flagged.
ALTER TABLE "User"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
