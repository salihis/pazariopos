-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('customer', 'supplier', 'employee', 'other');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('invoice', 'payment', 'return', 'transfer', 'interest', 'fx_diff');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "address" TEXT,
ADD COLUMN     "credit_limit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discount_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "iban_list" TEXT[],
ADD COLUMN     "payment_term_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "tax_number" TEXT,
ADD COLUMN     "type" "AccountType" NOT NULL DEFAULT 'customer';

-- CreateTable
CREATE TABLE "account_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "open_amount" INTEGER NOT NULL DEFAULT 0,
    "reference_sale_id" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_transactions_account_id_idx" ON "account_transactions"("account_id");

-- CreateIndex
CREATE INDEX "account_transactions_due_date_idx" ON "account_transactions"("due_date");

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "accounts"("type");

-- AddForeignKey
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
