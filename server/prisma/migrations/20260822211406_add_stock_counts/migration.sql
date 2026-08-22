-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('draft', 'completed');

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL DEFAULT 'default',
    "status" "StockCountStatus" NOT NULL DEFAULT 'draft',
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_items" (
    "id" TEXT NOT NULL,
    "stock_count_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_sku" TEXT NOT NULL,
    "previous_stock" INTEGER NOT NULL,
    "counted_stock" INTEGER NOT NULL,
    "counted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_counts_user_id_status_idx" ON "stock_counts"("user_id", "status");

-- CreateIndex
CREATE INDEX "stock_count_items_stock_count_id_idx" ON "stock_count_items"("stock_count_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_items_stock_count_id_product_id_key" ON "stock_count_items"("stock_count_id", "product_id");

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
