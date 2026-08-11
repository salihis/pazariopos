// packages/core/src/api/salesApi.ts
// ─────────────────────────────────────────────────────────────
// Thin fetch wrapper around the Fastify REST endpoints.
// Kept dependency-free (no axios) to minimize bundle size on the
// web target; swap for axios here if interceptors are needed later.
// ─────────────────────────────────────────────────────────────

import type {
  Sale, Product, Account, AccountTransaction, AgingReport,
  Category, CashRegister, CashMovement, CashCount, BankAccount, BankTransaction, Cheque,
  CashFlowReport, IncomeExpenseReport, ProfitLossReport, User, Purchase, PaymentLine,
} from '../types/domain'

// packages/core must stay platform-agnostic (see CODING_GUIDELINES.md §2) —
// it cannot assume a Vite bundler is present (the desktop Rust side has no
// bundler at all). App entry points (apps/web/src/main.tsx,
// apps/desktop/src/main.tsx) call `setApiBaseUrl()` during startup using
// their own `import.meta.env.VITE_API_BASE_URL`, where Vite's types are
// already configured. This module only owns a sane default + the setter.
let apiBase = 'http://localhost:3000'

/** Called once at app startup by apps/web or apps/desktop. */
export function setApiBaseUrl(url: string): void {
  apiBase = url
}

// JWT set by useAuthStore after a successful login; attached to every
// request below. Kept in memory only — persisting it (or not) across
// app restarts is a client concern (useAuthStore decides that).
let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }

  // 204 No Content etc.
  if (res.status === 204) return undefined as T

  return (await res.json()) as T
}

export const salesApi = {
  /** Persists a completed sale on the server. Used in the ONLINE branch of useSaleStore. */
  createSale(sale: Sale): Promise<Sale> {
    return request<Sale>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(sale),
    })
  },

  /** Used by the sync engine to push a queued offline sale once connectivity returns. */
  syncSale(sale: Sale): Promise<Sale> {
    return request<Sale>('/api/sales/sync', {
      method: 'POST',
      body: JSON.stringify(sale),
    })
  },

  /** Lists past sales for the back-office "Satış Fatura Listesi" screen. */
  listSales(filters: { from?: string; to?: string; customerId?: string; cashierId?: string } = {}): Promise<Sale[]> {
    const params = new URLSearchParams()
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.customerId) params.set('customerId', filters.customerId)
    if (filters.cashierId) params.set('cashierId', filters.cashierId)
    const query = params.toString()
    return request<Sale[]>(`/api/sales${query ? `?${query}` : ''}`)
  },
  getSale(id: string): Promise<Sale> {
    return request<Sale>(`/api/sales/${id}`)
  },
}

export type CreateAccountInput = Omit<Account, 'id' | 'balance' | 'createdAt' | 'updatedAt'>

export const accountsApi = {
  /**
   * Fetches the live balance for a customer/supplier account.
   * Per architecture rule: account balances are NEVER served from a
   * local cache — a stale balance could authorize a sale beyond the
   * real credit limit. Callers must catch the offline rejection.
   */
  getBalance(accountId: string): Promise<{ accountId: string; balance: number; asOf: string }> {
    return request(`/api/accounts/${accountId}/balance`)
  },

  /** Lists all accounts, optionally filtered by type (Cari Hesap Phase 1). */
  listAccounts(type?: Account['type']): Promise<Account[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : ''
    return request<Account[]>(`/api/accounts${query}`)
  },

  /** Creates a new customer/supplier/employee card. */
  createAccount(input: CreateAccountInput): Promise<Account> {
    return request<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  /** Fetches full card detail for one account. */
  getAccount(accountId: string): Promise<Account> {
    return request<Account>(`/api/accounts/${accountId}`)
  },

  /** Fetches the transaction ledger (hareket geçmişi) for one account. */
  getTransactions(accountId: string): Promise<AccountTransaction[]> {
    return request<AccountTransaction[]>(`/api/accounts/${accountId}/transactions`)
  },

  /**
   * Records a payment against an account (Cari Hesap Phase 2).
   * If `matches` is omitted, the server auto-matches oldest-open-invoice-first.
   */
  recordPayment(
    accountId: string,
    input: { amount: number; description?: string; matches?: Array<{ invoiceTransactionId: string; amount: number }> },
  ): Promise<{ transactionId: string; matchedAmount: number; unmatchedAmount: number; account: Account }> {
    return request(`/api/accounts/${accountId}/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  /** Vade bazlı açık bakiye dağılımı (Cari Hesap Phase 3). */
  getAging(accountId: string): Promise<AgingReport> {
    return request<AgingReport>(`/api/accounts/${accountId}/aging`)
  },

  /** Accounts currently over their credit limit (Cari Hesap Phase 3). */
  getRiskAccounts(): Promise<Account[]> {
    return request<Account[]>('/api/accounts/risk')
  },

  /** Applies late-payment interest on an account's overdue open invoices. */
  applyInterest(accountId: string, rate: number): Promise<{ accountId: string; interestAmount: number; account: Account }> {
    return request(`/api/accounts/${accountId}/interest`, {
      method: 'POST',
      body: JSON.stringify({ rate }),
    })
  },
}

export type CreateProductInput = {
  sku: string
  name: string
  barcode?: string[]
  price: number
  costPrice?: number | null
  taxRate: number
  stock?: number
  lowStockThreshold?: number
  unit?: Product['unit']
  categoryId?: string | null
  warehouseId?: string
}

export type UpdateProductInput = {
  name: string
  barcode: string[]
  price: number
  costPrice?: number | null
  taxRate: number
  lowStockThreshold: number
  unit: Product['unit']
  categoryId?: string | null
  warehouseId: string
}

export const productsApi = {
  /**
   * Fetches the product catalog. Unlike accountsApi, this is safe to
   * call opportunistically — InventoryService caches the result in
   * memory so barcode lookups keep working offline (architecture rule:
   * inventory reads may serve stale data, unlike account balances).
   * Defaults to active products only (POS quick-add catalog);
   * back-office product management passes includeInactive=true.
   */
  listProducts(includeInactive = false): Promise<Product[]> {
    const query = includeInactive ? '?includeInactive=true' : ''
    return request<Product[]>(`/api/products${query}`)
  },
  createProduct(input: CreateProductInput): Promise<Product> {
    return request<Product>('/api/products', { method: 'POST', body: JSON.stringify(input) })
  },
  updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    return request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },
  deactivateProduct(id: string): Promise<Product> {
    return request<Product>(`/api/products/${id}/deactivate`, { method: 'PATCH' })
  },
  activateProduct(id: string): Promise<Product> {
    return request<Product>(`/api/products/${id}/activate`, { method: 'PATCH' })
  },
  adjustStock(id: string, delta: number, reason: string): Promise<Product> {
    return request<Product>(`/api/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta, reason }) })
  },
}

export type CreateCategoryInput = { name: string; type: Category['type']; parentId?: string }

export const categoriesApi = {
  listCategories(type?: Category['type']): Promise<Category[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : ''
    return request<Category[]>(`/api/categories${query}`)
  },
  createCategory(input: CreateCategoryInput): Promise<Category> {
    return request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(input) })
  },
}

export const cashRegistersApi = {
  listCashRegisters(): Promise<CashRegister[]> {
    return request<CashRegister[]>('/api/cash-registers')
  },
  createCashRegister(name: string): Promise<CashRegister> {
    return request<CashRegister>('/api/cash-registers', { method: 'POST', body: JSON.stringify({ name }) })
  },
  getCashRegister(id: string): Promise<CashRegister> {
    return request<CashRegister>(`/api/cash-registers/${id}`)
  },
  /** Manual kasa hareketi. POS cash sales post their own movement automatically (routes/sales.ts). */
  recordMovement(
    id: string,
    input: { type: CashMovement['type']; amount: number; categoryId?: string; description?: string },
  ): Promise<{ movement: CashMovement; register: CashRegister }> {
    return request(`/api/cash-registers/${id}/movements`, { method: 'POST', body: JSON.stringify(input) })
  },
  listMovements(id: string): Promise<CashMovement[]> {
    return request<CashMovement[]>(`/api/cash-registers/${id}/movements`)
  },
  /** Gün sonu kasa sayımı — compares countedAmount against the current system balance. */
  recordCount(id: string, countedAmount: number, notes?: string): Promise<CashCount> {
    return request<CashCount>(`/api/cash-registers/${id}/count`, {
      method: 'POST',
      body: JSON.stringify({ countedAmount, notes }),
    })
  },
  listCounts(id: string): Promise<CashCount[]> {
    return request<CashCount[]>(`/api/cash-registers/${id}/counts`)
  },
}

export const bankAccountsApi = {
  listBankAccounts(): Promise<BankAccount[]> {
    return request<BankAccount[]>('/api/bank-accounts')
  },
  createBankAccount(input: { name: string; iban?: string; bankName?: string }): Promise<BankAccount> {
    return request<BankAccount>('/api/bank-accounts', { method: 'POST', body: JSON.stringify(input) })
  },
  getBankAccount(id: string): Promise<BankAccount> {
    return request<BankAccount>(`/api/bank-accounts/${id}`)
  },
  recordTransaction(
    id: string,
    input: { type: BankTransaction['type']; amount: number; categoryId?: string; description?: string },
  ): Promise<{ transaction: BankTransaction; account: BankAccount }> {
    return request(`/api/bank-accounts/${id}/transactions`, { method: 'POST', body: JSON.stringify(input) })
  },
  listTransactions(id: string): Promise<BankTransaction[]> {
    return request<BankTransaction[]>(`/api/bank-accounts/${id}/transactions`)
  },
}

export type CreateChequeInput = {
  type: Cheque['type']
  amount: number
  chequeNumber?: string
  drawerName: string
  bankName?: string
  dueDate: string
  accountId?: string
  notes?: string
}

export const chequesApi = {
  listCheques(filter?: { status?: Cheque['status']; type?: Cheque['type'] }): Promise<Cheque[]> {
    const params = new URLSearchParams()
    if (filter?.status) params.set('status', filter.status)
    if (filter?.type) params.set('type', filter.type)
    const query = params.toString() ? `?${params.toString()}` : ''
    return request<Cheque[]>(`/api/cheques${query}`)
  },
  createCheque(input: CreateChequeInput): Promise<Cheque> {
    return request<Cheque>('/api/cheques', { method: 'POST', body: JSON.stringify(input) })
  },
  getCheque(id: string): Promise<Cheque> {
    return request<Cheque>(`/api/cheques/${id}`)
  },
  /** Vade takvimi — cheques due within `days` (default 30). */
  getUpcoming(days = 30): Promise<Cheque[]> {
    return request<Cheque[]>(`/api/cheques/upcoming?days=${days}`)
  },
  updateStatus(id: string, status: Cheque['status']): Promise<Cheque> {
    return request<Cheque>(`/api/cheques/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
  },
}

export type CreatePurchaseInput = {
  invoiceNumber?: string
  supplierId?: string | null
  warehouseId?: string
  invoiceDate: string
  lines: Array<{
    productId: string
    productName: string
    quantity: number
    unitCost: number
    discountAmount: number
    taxAmount: number
    total: number
  }>
  payments: PaymentLine[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number
}

export const purchasesApi = {
  listPurchases(supplierId?: string): Promise<Purchase[]> {
    const query = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : ''
    return request<Purchase[]>(`/api/purchases${query}`)
  },
  getPurchase(id: string): Promise<Purchase> {
    return request<Purchase>(`/api/purchases/${id}`)
  },
  createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
    return request<Purchase>('/api/purchases', { method: 'POST', body: JSON.stringify(input) })
  },
}

export const reportsApi = {
  getCashFlow(from: string, to: string): Promise<CashFlowReport> {
    return request<CashFlowReport>(`/api/reports/cash-flow?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  },
  getIncomeExpense(from: string, to: string): Promise<IncomeExpenseReport> {
    return request<IncomeExpenseReport>(`/api/reports/income-expense?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  },
  getProfitLoss(from: string, to: string): Promise<ProfitLossReport> {
    return request<ProfitLossReport>(`/api/reports/profit-loss?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  },
}

export const authApi = {
  login(username: string, password: string): Promise<{ token: string; user: User }> {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  },
  /** Verifies the currently-set auth token is still valid and returns the user. */
  me(): Promise<User> {
    return request<User>('/api/auth/me')
  },
}

export type CreateUserInput = { username: string; password: string; name: string; role: User['role'] }

export const usersApi = {
  /** Admin only. */
  listUsers(): Promise<User[]> {
    return request<User[]>('/api/users')
  },
  /** Admin only. */
  createUser(input: CreateUserInput): Promise<User> {
    return request<User>('/api/users', { method: 'POST', body: JSON.stringify(input) })
  },
  changeOwnPassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request('/api/users/me/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  },
}
