/*
  Warnings:

  - You are about to drop the column `mergedFromId` on the `Tab` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "kdsStation" TEXT;

-- AlterTable
ALTER TABLE "Tab" DROP COLUMN "mergedFromId";

-- CreateTable
CREATE TABLE "KdsStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KdsStation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KdsStation_name_key" ON "KdsStation"("name");
