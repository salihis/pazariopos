/*
  Warnings:

  - You are about to drop the column `showCustomerName` on the `receipt_settings` table. All the data in the column will be lost.
  - You are about to drop the column `showCustomerPhone` on the `receipt_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "receipt_settings" DROP COLUMN "showCustomerName",
DROP COLUMN "showCustomerPhone";
