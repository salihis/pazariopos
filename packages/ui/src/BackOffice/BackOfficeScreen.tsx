// packages/ui/src/BackOffice/BackOfficeScreen.tsx
// ─────────────────────────────────────────────────────────────
// Top-level shell for the back-office area: tab navigation between
// Kasa (cash registers), Cari (accounts receivable/payable), and
// Finans (bank accounts, cheques, categories, reports).
//
// Mounted by PosScreen once the logged-in user's role permits it
// (admin/accountant — see PosScreen's nav gating, which mirrors the
// server's RBAC on these routes: server/src/routes/{cashRegisters,
// accounts,bankAccounts,cheques,categories,reports}.ts).
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode } from 'react'
import { useFinanceStore, useAccountStore, useAuthStore } from '@pazariopos/core'
import { CashRegisterPanel } from './CashRegisterPanel'
import { AccountsPanel } from './AccountsPanel'
import { FinancePanel } from './FinancePanel'
import { ProductsPanel } from './ProductsPanel'
import { PurchaseInvoicePanel } from './PurchaseInvoicePanel'
import { SalesInvoicesPanel } from './SalesInvoicesPanel'
import { UsersPanel } from './UsersPanel'
import { StockCountScreen } from './StockCountScreen'

type Tab = 'cash' | 'accounts' | 'finance' | 'products' | 'stockCount' | 'purchases' | 'sales' | 'users'

export interface BackOfficeScreenProps {
  /** Jump straight to a tab on mount — used by PosScreen's "Ürün Ekle"
   * shortcut (a scanned barcode with no matching product) so the
   * cashier lands directly on the add-product form instead of the
   * default Kasa tab. */
  initialTab?: Tab
  /** Passed straight through to ProductsPanel — see its own prop for
   * details. Only meaningful when initialTab is 'products'. */
  productInitialCreateValues?: { barcode?: string; name?: string }
}

export function BackOfficeScreen({ initialTab, productInitialCreateValues }: BackOfficeScreenProps = {}) {
  const currentUser = useAuthStore(s => s.currentUser)
  const isAdmin = currentUser?.role === 'admin'
  // 'warehouse' (Depo) only has server-side RBAC for products/stock
  // endpoints (see server/src/plugins/authPlugin.ts's requireRole calls
  // on routes/{cashRegisters,accounts,bankAccounts,cheques,purchases,
  // sales}.ts) — hide the finance/accounting tabs for that role so they
  // never land on a screen that just 403s on every action.
  const isWarehouseOnly = currentUser?.role === 'warehouse'
  const canSeeFinanceTabs = !isWarehouseOnly

  const [tab, setTab] = useState<Tab>(initialTab ?? (isWarehouseOnly ? 'stockCount' : 'cash'))

  // Both panels' data lives in stores that don't auto-load on mount
  // (unlike useInventoryStore, which PosScreen already drives) — kick
  // them off once here so switching tabs feels instant. Skipped for
  // warehouse-only users, who can't reach those tabs anyway.
  const loadFinance = useFinanceStore(s => s.loadAll)
  const loadAccounts = useAccountStore(s => s.loadAccounts)
  useEffect(() => {
    if (!canSeeFinanceTabs) return
    void loadFinance()
    void loadAccounts()
  }, [loadFinance, loadAccounts, canSeeFinanceTabs])

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {canSeeFinanceTabs && <TabButton active={tab === 'cash'} onClick={() => setTab('cash')}>💰 Kasa</TabButton>}
        {canSeeFinanceTabs && <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}>📒 Cari Hesap</TabButton>}
        {canSeeFinanceTabs && <TabButton active={tab === 'finance'} onClick={() => setTab('finance')}>🏦 Finans</TabButton>}
        <TabButton active={tab === 'products'} onClick={() => setTab('products')}>📦 Ürünler</TabButton>
        <TabButton active={tab === 'stockCount'} onClick={() => setTab('stockCount')}>📋 Stok Sayım</TabButton>
        {canSeeFinanceTabs && <TabButton active={tab === 'purchases'} onClick={() => setTab('purchases')}>🧾 Alış Faturası</TabButton>}
        {canSeeFinanceTabs && <TabButton active={tab === 'sales'} onClick={() => setTab('sales')}>🧾 Satış Faturaları</TabButton>}
        {/* Server-side RBAC already restricts every /api/users endpoint to
            admin (see users.ts) — hiding the tab for non-admins is purely
            a UX nicety on top of that, not the actual security boundary. */}
        {isAdmin && <TabButton active={tab === 'users'} onClick={() => setTab('users')}>👤 Kullanıcılar</TabButton>}
      </div>

      {tab === 'cash' && canSeeFinanceTabs && <CashRegisterPanel />}
      {tab === 'accounts' && canSeeFinanceTabs && <AccountsPanel />}
      {tab === 'finance' && canSeeFinanceTabs && <FinancePanel />}
      {tab === 'products' && <ProductsPanel initialCreateValues={productInitialCreateValues} />}
      {tab === 'stockCount' && <StockCountScreen />}
      {tab === 'purchases' && canSeeFinanceTabs && <PurchaseInvoicePanel />}
      {tab === 'sales' && canSeeFinanceTabs && <SalesInvoicesPanel />}
      {tab === 'users' && isAdmin && <UsersPanel />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-[var(--color-petrol)] text-white shadow-sm'
          : 'border border-[var(--color-paper-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-petrol)]'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
