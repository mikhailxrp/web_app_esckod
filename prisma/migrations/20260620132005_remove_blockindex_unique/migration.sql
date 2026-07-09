-- DropIndex
DROP INDEX "FinalReportLinkBlock_blockIndex_key";

-- AlterTable
ALTER TABLE "FinalReportLinkBlock" ALTER COLUMN "blockIndex" SET DEFAULT 0;
