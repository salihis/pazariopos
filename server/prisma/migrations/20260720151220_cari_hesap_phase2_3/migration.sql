-- CreateTable
CREATE TABLE "account_transaction_matches" (
    "id" TEXT NOT NULL,
    "payment_transaction_id" TEXT NOT NULL,
    "invoice_transaction_id" TEXT NOT NULL,
    "matched_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transaction_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_transaction_matches_payment_transaction_id_idx" ON "account_transaction_matches"("payment_transaction_id");

-- CreateIndex
CREATE INDEX "account_transaction_matches_invoice_transaction_id_idx" ON "account_transaction_matches"("invoice_transaction_id");

-- AddForeignKey
ALTER TABLE "account_transaction_matches" ADD CONSTRAINT "account_transaction_matches_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "account_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transaction_matches" ADD CONSTRAINT "account_transaction_matches_invoice_transaction_id_fkey" FOREIGN KEY ("invoice_transaction_id") REFERENCES "account_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
