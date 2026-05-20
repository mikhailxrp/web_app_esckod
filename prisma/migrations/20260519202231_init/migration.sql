-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('SUCCESS', 'ERROR', 'INFO');

-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('DETECTIVE', 'MARINA');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('ALWAYS', 'CHOICE', 'TRIGGER');

-- CreateEnum
CREATE TYPE "MissionType" AS ENUM ('CRACK', 'DECIPHER', 'RDP');

-- CreateEnum
CREATE TYPE "CipherType" AS ENUM ('PLAYFAIR', 'VIGENERE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
    "consentPolicy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessKeyId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "maxActivations" INTEGER NOT NULL DEFAULT 5,
    "currentActivations" INTEGER NOT NULL DEFAULT 0,
    "blockedAt" TIMESTAMP(3),
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marinaTriggered" BOOLEAN NOT NULL DEFAULT false,
    "finalReportDone" BOOLEAN NOT NULL DEFAULT false,
    "finalScore" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LogType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatScript" (
    "id" TEXT NOT NULL,
    "chatType" "ChatType" NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audioUrl" TEXT,
    "hasChoices" BOOLEAN NOT NULL DEFAULT false,
    "choices" JSONB,
    "isStart" BOOLEAN NOT NULL DEFAULT false,
    "isEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTransition" (
    "id" TEXT NOT NULL,
    "fromMessageId" TEXT NOT NULL,
    "toMessageId" TEXT NOT NULL,
    "conditionType" "ConditionType" NOT NULL,
    "conditionValue" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentDetectiveMessageId" TEXT,
    "currentMarinaMessageId" TEXT,
    "playerChoices" JSONB NOT NULL DEFAULT '{}',
    "finalChoice" TEXT,
    "detectiveFinished" BOOLEAN NOT NULL DEFAULT false,
    "marinaFinished" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionSlot" (
    "id" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "missionType" "MissionType" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT NOT NULL,
    "targetWord" TEXT,
    "targetUrl" TEXT,
    "targetEmail" TEXT,
    "resultPassword" TEXT,
    "crackMaxAttempts" INTEGER DEFAULT 6,
    "cipherType" "CipherType",
    "encryptedWord" TEXT,
    "cipherKey" TEXT,
    "folderPassword" TEXT,
    "folderPath" TEXT,
    "unlocksRdpFolder" TEXT,
    "unlocksRdpSlotKey" TEXT,
    "correctIp" TEXT,
    "rdpScenario" INTEGER,
    "logSubjectName" TEXT,
    "nextRdpSlotKey" TEXT,
    "timerSeconds" INTEGER,
    "rdpPuzzleGridSize" INTEGER,
    "hintText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrackSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "targetWord" TEXT NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "wordList" JSONB NOT NULL,
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "attempts" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RdpFile" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "folder" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RdpFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalReportQuestion" (
    "id" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOption" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalReportQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalReportContent" (
    "id" TEXT NOT NULL,
    "finalChoiceValue" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalReportContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectiveHint" (
    "id" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectiveHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHintProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenHintIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserHintProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "defaultMarketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "supportEmail" TEXT NOT NULL DEFAULT 'support@example.com',
    "privacyPolicyUrl" TEXT NOT NULL DEFAULT 'https://example.com/privacy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "adminId" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_accessKeyId_idx" ON "User"("accessKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessKey_key_key" ON "AccessKey"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GameProgress_userId_key" ON "GameProgress"("userId");

-- CreateIndex
CREATE INDEX "OperationLog_userId_idx" ON "OperationLog"("userId");

-- CreateIndex
CREATE INDEX "OperationLog_createdAt_idx" ON "OperationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatScript_code_key" ON "ChatScript"("code");

-- CreateIndex
CREATE INDEX "ChatScript_chatType_idx" ON "ChatScript"("chatType");

-- CreateIndex
CREATE INDEX "ChatScript_code_idx" ON "ChatScript"("code");

-- CreateIndex
CREATE INDEX "ChatTransition_fromMessageId_idx" ON "ChatTransition"("fromMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatState_userId_key" ON "ChatState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionSlot_slotKey_key" ON "MissionSlot"("slotKey");

-- CreateIndex
CREATE INDEX "MissionSlot_missionType_idx" ON "MissionSlot"("missionType");

-- CreateIndex
CREATE INDEX "MissionSlot_isActive_idx" ON "MissionSlot"("isActive");

-- CreateIndex
CREATE INDEX "MissionProgress_userId_idx" ON "MissionProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgress_userId_slotId_key" ON "MissionProgress"("userId", "slotId");

-- CreateIndex
CREATE INDEX "CrackSession_userId_idx" ON "CrackSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CrackSession_userId_slotId_key" ON "CrackSession"("userId", "slotId");

-- CreateIndex
CREATE INDEX "RdpFile_slotId_idx" ON "RdpFile"("slotId");

-- CreateIndex
CREATE INDEX "FinalReportQuestion_orderIndex_idx" ON "FinalReportQuestion"("orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FinalReportContent_finalChoiceValue_key" ON "FinalReportContent"("finalChoiceValue");

-- CreateIndex
CREATE UNIQUE INDEX "DetectiveHint_orderIndex_key" ON "DetectiveHint"("orderIndex");

-- CreateIndex
CREATE INDEX "DetectiveHint_orderIndex_idx" ON "DetectiveHint"("orderIndex");

-- CreateIndex
CREATE INDEX "DetectiveHint_isActive_idx" ON "DetectiveHint"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserHintProgress_userId_key" ON "UserHintProgress"("userId");

-- CreateIndex
CREATE INDEX "UserHintProgress_userId_idx" ON "UserHintProgress"("userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_type_idx" ON "AdminAuditLog"("type");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_userId_idx" ON "AdminAuditLog"("userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessKeyId_fkey" FOREIGN KEY ("accessKeyId") REFERENCES "AccessKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameProgress" ADD CONSTRAINT "GameProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTransition" ADD CONSTRAINT "ChatTransition_fromMessageId_fkey" FOREIGN KEY ("fromMessageId") REFERENCES "ChatScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTransition" ADD CONSTRAINT "ChatTransition_toMessageId_fkey" FOREIGN KEY ("toMessageId") REFERENCES "ChatScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatState" ADD CONSTRAINT "ChatState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatState" ADD CONSTRAINT "ChatState_currentDetectiveMessageId_fkey" FOREIGN KEY ("currentDetectiveMessageId") REFERENCES "ChatScript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatState" ADD CONSTRAINT "ChatState_currentMarinaMessageId_fkey" FOREIGN KEY ("currentMarinaMessageId") REFERENCES "ChatScript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "MissionSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrackSession" ADD CONSTRAINT "CrackSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrackSession" ADD CONSTRAINT "CrackSession_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "MissionSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RdpFile" ADD CONSTRAINT "RdpFile_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "MissionSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHintProgress" ADD CONSTRAINT "UserHintProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
