-- CreateTable
CREATE TABLE "hhb"."hhb_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hhb_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hhb"."hhb_hint_unlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "hint" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hhb_hint_unlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hhb"."hhb_vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hhb_vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hhb"."hhb_team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hhb_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hhb"."hhb_team_member" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hhb_team_member_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "hhb_progress_userId_kind_key_key" ON "hhb"."hhb_progress"("userId", "kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "hhb_hint_unlock_userId_challengeId_hint_key" ON "hhb"."hhb_hint_unlock"("userId", "challengeId", "hint");

-- CreateIndex
CREATE INDEX "hhb_vote_challengeId_idx" ON "hhb"."hhb_vote"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "hhb_vote_userId_challengeId_key" ON "hhb"."hhb_vote"("userId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "hhb_team_name_key" ON "hhb"."hhb_team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "hhb_team_code_key" ON "hhb"."hhb_team"("code");

-- CreateIndex
CREATE INDEX "hhb_team_member_teamId_idx" ON "hhb"."hhb_team_member"("teamId");

-- AddForeignKey
ALTER TABLE "hhb"."hhb_progress" ADD CONSTRAINT "hhb_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hhb"."hhb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hhb"."hhb_hint_unlock" ADD CONSTRAINT "hhb_hint_unlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hhb"."hhb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hhb"."hhb_vote" ADD CONSTRAINT "hhb_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hhb"."hhb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hhb"."hhb_team_member" ADD CONSTRAINT "hhb_team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hhb"."hhb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hhb"."hhb_team_member" ADD CONSTRAINT "hhb_team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "hhb"."hhb_team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
