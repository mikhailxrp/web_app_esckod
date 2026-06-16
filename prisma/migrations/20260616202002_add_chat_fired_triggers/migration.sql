-- AlterTable
ALTER TABLE "ChatState" ADD COLUMN     "firedTriggers" TEXT[] DEFAULT ARRAY[]::TEXT[];
