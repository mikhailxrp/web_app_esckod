-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "crackLaunchHint" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "decipherLaunchHint" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rdpLaunchHint" TEXT NOT NULL DEFAULT '';
