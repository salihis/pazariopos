-- CreateTable
CREATE TABLE "receipt_settings" (
    "id" TEXT NOT NULL,
    "shopName" TEXT NOT NULL DEFAULT '',
    "shopPhone" TEXT NOT NULL DEFAULT '',
    "showCustomerName" BOOLEAN NOT NULL DEFAULT true,
    "showCustomerPhone" BOOLEAN NOT NULL DEFAULT false,
    "showTaxBreakdown" BOOLEAN NOT NULL DEFAULT true,
    "showOrderNumber" BOOLEAN NOT NULL DEFAULT true,
    "footerMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_settings_pkey" PRIMARY KEY ("id")
);
