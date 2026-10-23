-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "hhb_user" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hhb_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hhb_solve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hhb_solve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hhb_user_handle_key" ON "hhb_user"("handle");

-- CreateIndex
CREATE INDEX "hhb_solve_userId_idx" ON "hhb_solve"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hhb_solve_userId_challengeId_key" ON "hhb_solve"("userId", "challengeId");

-- AddForeignKey
ALTER TABLE "hhb_solve" ADD CONSTRAINT "hhb_solve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hhb_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

