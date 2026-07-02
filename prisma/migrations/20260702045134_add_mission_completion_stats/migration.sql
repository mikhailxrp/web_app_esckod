-- CreateTable
CREATE TABLE "MissionCompletionStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "skipped" BOOLEAN NOT NULL,
    "failedAttempts" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionCompletionStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionCompletionStats_userId_idx" ON "MissionCompletionStats"("userId");

-- CreateIndex
CREATE INDEX "MissionCompletionStats_slotId_idx" ON "MissionCompletionStats"("slotId");

-- AddForeignKey
ALTER TABLE "MissionCompletionStats" ADD CONSTRAINT "MissionCompletionStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
