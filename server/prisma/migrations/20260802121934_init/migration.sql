-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('piece', 'box', 'kg', 'lt');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('completed', 'returned', 'partial_return', 'voided');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('synced', 'pending', 'conflict', 'error');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('customer', 'supplier', 'employee', 'other');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('invoice', 'payment', 'return', 'transfer', 'interest', 'fx_diff');

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

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'accountant', 'cashier', 'warehouse', 'viewer');

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
    "type" "AccountType" NOT NULL DEFAULT 'customer',
    "tax_number" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "iban_list" TEXT[],
    "credit_limit" INTEGER NOT NULL DEFAULT 0,
    "payment_term_days" INTEGER NOT NULL DEFAULT 0,
    "discount_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "account_transaction_matches" (
    "id" TEXT NOT NULL,
    "payment_transaction_id" TEXT NOT NULL,
    "invoice_transaction_id" TEXT NOT NULL,
    "matched_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transaction_matches_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'cashier',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_warehouse_id_idx" ON "products"("warehouse_id");

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

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "accounts"("type");

-- CreateIndex
CREATE INDEX "account_transactions_account_id_idx" ON "account_transactions"("account_id");

-- CreateIndex
CREATE INDEX "account_transactions_due_date_idx" ON "account_transactions"("due_date");

-- CreateIndex
CREATE INDEX "account_transaction_matches_payment_transaction_id_idx" ON "account_transaction_matches"("payment_transaction_id");

-- CreateIndex
CREATE INDEX "account_transaction_matches_invoice_transaction_id_idx" ON "account_transaction_matches"("invoice_transaction_id");

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

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transaction_matches" ADD CONSTRAINT "account_transaction_matches_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "account_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transaction_matches" ADD CONSTRAINT "account_transaction_matches_invoice_transaction_id_fkey" FOREIGN KEY ("invoice_transaction_id") REFERENCES "account_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
