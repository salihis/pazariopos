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

type Tab = 'cash' | 'accounts' | 'finance' | 'products' | 'purchases' | 'sales' | 'users'

export function BackOfficeScreen() {
  const [tab, setTab] = useState<Tab>('cash')
  const currentUser = useAuthStore(s => s.currentUser)
  const isAdmin = currentUser?.role === 'admin'

  // Both panels' data lives in stores that don't auto-load on mount
  // (unlike useInventoryStore, which PosScreen already drives) — kick
  // them off once here so switching tabs feels instant.
  const loadFinance = useFinanceStore(s => s.loadAll)
  const loadAccounts = useAccountStore(s => s.loadAccounts)
  useEffect(() => {
    void loadFinance()
    void loadAccounts()
  }, [loadFinance, loadAccounts])

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <TabButton active={tab === 'cash'} onClick={() => setTab('cash')}>💰 Kasa</TabButton>
        <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')}>📒 Cari Hesap</TabButton>
        <TabButton active={tab === 'finance'} onClick={() => setTab('finance')}>🏦 Finans</TabButton>
        <TabButton active={tab === 'products'} onClick={() => setTab('products')}>📦 Ürünler</TabButton>
        <TabButton active={tab === 'purchases'} onClick={() => setTab('purchases')}>🧾 Alış Faturası</TabButton>
        <TabButton active={tab === 'sales'} onClick={() => setTab('sales')}>🧾 Satış Faturaları</TabButton>
        {/* Server-side RBAC already restricts every /api/users endpoint to
            admin (see users.ts) — hiding the tab for non-admins is purely
            a UX nicety on top of that, not the actual security boundary. */}
        {isAdmin && <TabButton active={tab === 'users'} onClick={() => setTab('users')}>👤 Kullanıcılar</TabButton>}
      </div>

      {tab === 'cash' && <CashRegisterPanel />}
      {tab === 'accounts' && <AccountsPanel />}
      {tab === 'finance' && <FinancePanel />}
      {tab === 'products' && <ProductsPanel />}
      {tab === 'purchases' && <PurchaseInvoicePanel />}
      {tab === 'sales' && <SalesInvoicesPanel />}
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
