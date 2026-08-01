-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('completed', 'returned', 'partial_return', 'voided');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('synced', 'pending', 'conflict', 'error');

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discount_total" INTEGER NOT NULL,
    "tax_total" INTEGER NOT NULL,
    "grand_total" INTEGER NOT NULL,
    "change_given" INTEGER NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'completed',
    "device_id" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'synced',
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_lines" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_local_id_key" ON "sales"("local_id");

-- CreateIndex
CREATE INDEX "sales_branch_id_idx" ON "sales"("branch_id");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "sale_lines_sale_id_idx" ON "sale_lines"("sale_id");

-- CreateIndex
CREATE INDEX "sale_lines_product_id_idx" ON "sale_lines"("product_id");

-- CreateIndex
CREATE INDEX "sale_payments_sale_id_idx" ON "sale_payments"("sale_id");

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
