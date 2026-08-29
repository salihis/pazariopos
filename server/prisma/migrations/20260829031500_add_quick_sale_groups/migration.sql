-- CreateTable
CREATE TABLE "quick_sale_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_sale_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quick_sale_groups_name_key" ON "quick_sale_groups"("name");

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "quick_sale_group_id" TEXT;

-- CreateIndex
CREATE INDEX "products_quick_sale_group_id_idx" ON "products"("quick_sale_group_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_quick_sale_group_id_fkey" FOREIGN KEY ("quick_sale_group_id") REFERENCES "quick_sale_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
