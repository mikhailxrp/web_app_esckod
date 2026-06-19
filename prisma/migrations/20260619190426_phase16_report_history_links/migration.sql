-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "finalReportQuestionId" TEXT;

-- CreateTable
CREATE TABLE "FinalReportLinkBlock" (
    "id" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalReportLinkBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinalReportLinkBlock_blockIndex_key" ON "FinalReportLinkBlock"("blockIndex");

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_finalReportQuestionId_fkey" FOREIGN KEY ("finalReportQuestionId") REFERENCES "FinalReportQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
