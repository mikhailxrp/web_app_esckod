-- CreateTable
CREATE TABLE "GameCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalScore" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "GameCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameCompletion_userId_idx" ON "GameCompletion"("userId");

-- CreateIndex
CREATE INDEX "GameCompletion_completedAt_idx" ON "GameCompletion"("completedAt");

-- AddForeignKey
ALTER TABLE "GameCompletion" ADD CONSTRAINT "GameCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
