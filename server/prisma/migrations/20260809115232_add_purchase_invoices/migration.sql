-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'purchase';

-- AlterTable
ALTER TABLE "account_transactions" ADD COLUMN     "reference_purchase_id" TEXT;

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "reference_purchase_id" TEXT;

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT,
    "supplier_id" TEXT,
    "warehouse_id" TEXT NOT NULL DEFAULT 'default',
    "user_id" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount_total" INTEGER NOT NULL,
    "tax_total" INTEGER NOT NULL,
    "grand_total" INTEGER NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lines" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_payments" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchases_supplier_id_idx" ON "purchases"("supplier_id");

-- CreateIndex
CREATE INDEX "purchases_created_at_idx" ON "purchases"("created_at");

-- CreateIndex
CREATE INDEX "purchase_lines_purchase_id_idx" ON "purchase_lines"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_lines_product_id_idx" ON "purchase_lines"("product_id");

-- CreateIndex
CREATE INDEX "purchase_payments_purchase_id_idx" ON "purchase_payments"("purchase_id");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
