-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('piece', 'box', 'kg', 'lt');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT[],
    "price" INTEGER NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "unit" "ProductUnit" NOT NULL DEFAULT 'piece',
    "category_id" TEXT NOT NULL DEFAULT '',
    "warehouse_id" TEXT NOT NULL DEFAULT 'default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_warehouse_id_idx" ON "products"("warehouse_id");
