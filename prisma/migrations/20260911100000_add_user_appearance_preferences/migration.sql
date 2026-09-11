-- Existing accounts inherit the device theme and standard text size. Defaults
-- also make preferences available without a manual data backfill.
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
CREATE TYPE "TextSizePreference" AS ENUM ('STANDARD', 'LARGE');

ALTER TABLE "User"
ADD COLUMN "themePreference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN "textSizePreference" "TextSizePreference" NOT NULL DEFAULT 'STANDARD';
