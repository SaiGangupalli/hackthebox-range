-- CreateTable
CREATE TABLE "hhb"."hhb_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hhb_setting_pkey" PRIMARY KEY ("key")
);
