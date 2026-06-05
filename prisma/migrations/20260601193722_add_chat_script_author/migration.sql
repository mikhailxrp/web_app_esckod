-- CreateEnum
CREATE TYPE "ChatAuthor" AS ENUM ('DETECTIVE', 'PLAYER', 'MARINA', 'ANONYMOUS');

-- AlterTable
ALTER TABLE "ChatScript" ADD COLUMN     "author" "ChatAuthor" NOT NULL DEFAULT 'DETECTIVE';
