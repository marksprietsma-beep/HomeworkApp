-- Existing users retain the initials avatar until they choose an image.
ALTER TABLE "User" ADD COLUMN "profileImagePath" TEXT;
