// packages/core/src/types/domain.ts
// ─────────────────────────────────────────────────────────────
// Shared domain types — consumed by all packages in the monorepo
// ─────────────────────────────────────────────────────────────

// ── Product & Cart ────────────────────────────────────────────

export interface Product {
  id: string
  sku: string
  name: string
  barcode: string[]
  price: number        // stored in smallest currency unit (kuruş / cent)
  costPrice: number | null   // Alış fiyatı (KDV dahil, kuruş) — null for products created before this field existed
  taxRate: number      // e.g. 0.18 for 18% VAT
  stock: number
  lowStockThreshold: number   // stock at/below this triggers a low-stock warning
  unit: 'piece' | 'box' | 'kg' | 'lt'
  categoryId: string | null
  warehouseId: string
  isActive: boolean
}

export interface CartLine {
  product: Product
  quantity: number
  unitPrice: number    // price at time of sale (price may change later)
  discountAmount: number
  taxAmount: number
  total: number        // (unitPrice - discountAmount + taxAmount) * quantity
}

// ── Sale ─────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'cheque' | 'account'

export interface PaymentLine {
  method: PaymentMethod
  amount: number
  reference?: string   // card auth code, cheque no, etc.
}

export type SaleStatus = 'completed' | 'returned' | 'partial_return' | 'voided'
export type SyncStatus  = 'synced' | 'pending' | 'conflict' | 'error'

export interface Sale {
  id: string
  localId: string      // UUID generated on the device before server assigns an id
  branchId: string
  registerId: string
  cashierId: string
  customerId?: string

  lines: CartLine[]
  payments: PaymentLine[]

  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number
  changeGiven: number

  status: SaleStatus

  // Audit
  createdAt: string    // ISO-8601
  updatedAt: string

  // Sync (desktop only — ignored on server)
  deviceId?: string
  syncStatus?: SyncStatus
  syncedAt?: string | null
}

// ── Alış Faturası / Purchase Invoice ────────────────────────────
// Mirror of Sale, in the opposite direction: increases stock, and an
// 'account' payment posts to the SUPPLIER's ledger (decreases their
// Account.balance — see server's TransactionType.purchase comment).
// No offline-queue fields (localId/deviceId/syncStatus): purchases
// are created online-only at a desk, unlike POS sales.

export interface PurchaseLine {
  productId: string
  productName: string   // denormalized snapshot at time of purchase
  quantity: number
  unitCost: number       // per-unit, KDV dahil (tax-inclusive)
  discountAmount: number // TOTAL for this line (not per-unit)
  taxAmount: number      // TOTAL tax for this line (not per-unit)
  total: number
}

export interface Purchase {
  id: string
  invoiceNumber: string | null
  supplierId: string | null   // null = "Firmasız"
  warehouseId: string
  userId: string

  lines: PurchaseLine[]
  payments: PaymentLine[]

  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number

  invoiceDate: string   // ISO-8601
  createdAt: string
  updatedAt: string
}

// ── Report ───────────────────────────────────────────────────

export interface ReportData {
  title: string
  generatedAt: string
  period: { from: string; to: string }
  rows: Record<string, unknown>[]
  summary?: Record<string, number>
}

// ── Cari Hesap / Accounts Receivable-Payable ──────────────────
// Phase 1-3 scope only (card + ledger + aging/risk). Phase 4-5
// (PDF statements, FX, bulk SMS/email) are out of scope — see
// CHECKLIST.md for the phase breakdown and rationale.

export type AccountType = 'customer' | 'supplier' | 'employee' | 'other'

export interface Account {
  id: string
  name: string
  type: AccountType

  taxNumber?: string
  address?: string
  phone?: string
  email?: string
  ibanList: string[]

  creditLimit: number       // 0 = no limit enforced
  paymentTermDays: number   // used to compute invoice due dates
  discountRate: number      // 0..1

  balance: number           // running net balance, minor currency units;
                             // positive = they owe us, negative = we owe them

  createdAt: string
  updatedAt: string
}

export type AccountTransactionType =
  | 'invoice'   // sale posted to account ("veresiye") — increases balance
  | 'payment'   // balance paid down — decreases balance (see schema.prisma's
                // TransactionType.payment comment on the current customer-only sign bug)
  | 'return'    // sale return credited to account — decreases balance
  | 'purchase'  // supplier invoice posted to account ("açık hesap alış") —
                // DECREASES balance (mirror of 'invoice', opposite direction)
  | 'transfer'  // manual balance transfer between accounts
  | 'interest'  // late-payment interest (Phase 3)
  | 'fx_diff'   // period-end FX difference (Phase 5 — not implemented)

export interface AccountTransaction {
  id: string
  accountId: string
  type: AccountTransactionType
  amount: number        // positive = debit (increases balance), negative = credit
  openAmount: number     // remaining unmatched amount (Phase 2 open-item matching)
  referenceSaleId?: string
  referencePurchaseId?: string
  description: string
  dueDate?: string | null
  createdAt: string
}

export interface AgingBuckets {
  current: number
  days0to30: number
  days31to60: number
  days61to90: number
  days90plus: number
}

export interface AgingReport {
  accountId: string
  asOf: string
  totalOpen: number
  buckets: AgingBuckets
}

// ── Gelir/Gider & Finans (Income/Expense & Finance) ───────────
// Phase 1-3 scope only (categories, cash register, bank account,
// cheques, reports). Phase 4-5 (budget/dashboard, CSV/OFX bank
// statement import) are out of scope — see CHECKLIST.md.

export type CategoryType = 'income' | 'expense' | 'product'

export interface Category {
  id: string
  name: string
  type: CategoryType
  parentId?: string | null
  createdAt: string
  updatedAt: string
}

export interface CashRegister {
  id: string
  name: string
  balance: number
  createdAt: string
  updatedAt: string
}

export type MovementType = 'in' | 'out'

export interface CashMovement {
  id: string
  cashRegisterId: string
  type: MovementType
  amount: number
  categoryId?: string | null
  referenceSaleId?: string | null
  referencePurchaseId?: string | null
  description: string
  createdAt: string
}

export interface CashCount {
  id: string
  cashRegisterId: string
  expectedAmount: number
  countedAmount: number
  difference: number
  notes: string
  createdAt: string
}

export interface BankAccount {
  id: string
  name: string
  iban?: string | null
  bankName?: string | null
  balance: number
  createdAt: string
  updatedAt: string
}

export type BankTransactionType = 'deposit' | 'withdrawal'

export interface BankTransaction {
  id: string
  bankAccountId: string
  type: BankTransactionType
  amount: number
  categoryId?: string | null
  description: string
  createdAt: string
}

// ── Çek/Senet (Cheques/Promissory Notes) — Phase 2 ──

export type ChequeType = 'customer_cheque' | 'own_cheque'
export type ChequeStatus = 'in_wallet' | 'at_bank' | 'collected' | 'returned' | 'protested'

export interface Cheque {
  id: string
  type: ChequeType
  status: ChequeStatus
  amount: number
  chequeNumber?: string | null
  drawerName: string
  bankName?: string | null
  dueDate: string
  accountId?: string | null
  referenceSaleId?: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

// ── Raporlar (Reports) — Phase 3 ──

export interface CashFlowReport {
  from: string
  to: string
  cashIn: number
  cashOut: number
  netCashFlow: number
  bankDeposits: number
  bankWithdrawals: number
  netBankFlow: number
  totalNetFlow: number
}

export interface IncomeExpenseCategoryBreakdown {
  categoryId: string
  categoryName: string
  type: CategoryType
  total: number
}

export interface IncomeExpenseReport {
  from: string
  to: string
  salesRevenue: number
  otherIncome: number
  totalIncome: number
  totalExpense: number
  byCategory: IncomeExpenseCategoryBreakdown[]
}

export interface ProfitLossReport {
  from: string
  to: string
  salesRevenue: number
  cashExpense: number
  bankExpense: number
  totalExpense: number
  netProfit: number
}

// ── Stok Sayım (Physical Inventory Count) ──────────────────────
// See server/prisma/schema.prisma's StockCount/StockCountItem comment
// for the draft → completed lifecycle and the "overwrite, not add" semantics.

export type StockCountStatus = 'draft' | 'completed'

export interface StockCountItem {
  id: string
  productId: string
  productName: string   // denormalized snapshot at time of counting
  productSku: string
  previousStock: number // Product.stock at the moment this item was (re-)counted
  countedStock: number
  countedAt: string      // ISO-8601
}

export interface StockCount {
  id: string
  warehouseId: string
  status: StockCountStatus
  userId: string
  items: StockCountItem[]
  startedAt: string
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

// ── Auth / Kullanıcı Yönetimi ──────────────────────────────────

export type UserRole = 'admin' | 'accountant' | 'cashier' | 'warehouse' | 'viewer'

export interface User {
  id: string
  username: string
  name: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
}

// ── Sync Queue ───────────────────────────────────────────────

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE'

export interface SyncQueueItem {
  id: string
  tableName: string
  operation: SyncOperation
  recordId: string
  payload: string      // JSON.stringify(record)
  createdAt: string
  retryCount: number
  lastError?: string
}

// ── Network ──────────────────────────────────────────────────

export type NetworkStatus = 'online' | 'offline' | 'degraded'
