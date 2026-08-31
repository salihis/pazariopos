// packages/core/src/constants.ts
// ─────────────────────────────────────────────────────────────
// Shared across client and server — see PosScreen's "Muhtelif Satış"
// flow (an ad-hoc sale line for an item that isn't in the catalog,
// e.g. because a scanned barcode wasn't found and the cashier doesn't
// want to stop to create a product record for a one-off item).
//
// This sentinel `id` is NOT a real row in the `products` table. The
// server's sale-checkout route (server/src/routes/sales.ts) special-
// cases it to skip the stock decrement it otherwise performs for
// every line — a "Muhtelif Satış" line is deliberately not
// inventory-tracked, so there is nothing to decrement.
// ─────────────────────────────────────────────────────────────

export const MISC_SALE_PRODUCT_ID = 'muhtelif-satis'
