-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "kdsStation" TEXT,
ADD COLUMN     "kdsStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "servedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "originalPaymentId" TEXT,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PAYMENT';

-- AlterTable
ALTER TABLE "Tab" ADD COLUMN     "guestCount" INTEGER,
ADD COLUMN     "mergedFromId" TEXT;

-- CreateTable
CREATE TABLE "DayClose" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "staffId" TEXT NOT NULL,
    "openingCash" DECIMAL(10,2) NOT NULL,
    "closingCash" DECIMAL(10,2) NOT NULL,
    "expectedCash" DECIMAL(10,2) NOT NULL,
    "variance" DECIMAL(10,2) NOT NULL,
    "totalSales" DECIMAL(10,2) NOT NULL,
    "totalRefunds" DECIMAL(10,2) NOT NULL,
    "totalTips" DECIMAL(10,2) NOT NULL,
    "totalVoids" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "coverCount" INTEGER NOT NULL DEFAULT 0,
    "lostItems" JSONB,
    "reportData" JSONB NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayClose_date_key" ON "DayClose"("date");

-- CreateIndex
CREATE INDEX "DayClose_date_idx" ON "DayClose"("date");

-- CreateIndex
CREATE INDEX "OrderItem_kdsStatus_createdAt_idx" ON "OrderItem"("kdsStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_type_idx" ON "Payment"("type");

-- AddForeignKey
ALTER TABLE "DayClose" ADD CONSTRAINT "DayClose_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
