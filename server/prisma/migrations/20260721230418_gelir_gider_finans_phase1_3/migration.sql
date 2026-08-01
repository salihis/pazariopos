-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "BankTransactionType" AS ENUM ('deposit', 'withdrawal');

-- CreateEnum
CREATE TYPE "ChequeType" AS ENUM ('customer_cheque', 'own_cheque');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('in_wallet', 'at_bank', 'collected', 'returned', 'protested');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Ana Kasa',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "cash_register_id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "category_id" TEXT,
    "reference_sale_id" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_counts" (
    "id" TEXT NOT NULL,
    "cash_register_id" TEXT NOT NULL,
    "expected_amount" INTEGER NOT NULL,
    "counted_amount" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT,
    "bank_name" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "type" "BankTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "category_id" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques" (
    "id" TEXT NOT NULL,
    "type" "ChequeType" NOT NULL,
    "status" "ChequeStatus" NOT NULL DEFAULT 'in_wallet',
    "amount" INTEGER NOT NULL,
    "cheque_number" TEXT,
    "drawer_name" TEXT NOT NULL,
    "bank_name" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "account_id" TEXT,
    "reference_sale_id" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cheques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "cash_movements_cash_register_id_idx" ON "cash_movements"("cash_register_id");

-- CreateIndex
CREATE INDEX "cash_counts_cash_register_id_idx" ON "cash_counts"("cash_register_id");

-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_idx" ON "bank_transactions"("bank_account_id");

-- CreateIndex
CREATE INDEX "cheques_status_idx" ON "cheques"("status");

-- CreateIndex
CREATE INDEX "cheques_due_date_idx" ON "cheques"("due_date");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
