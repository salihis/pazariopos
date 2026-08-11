// packages/ui/src/BackOffice/AccountsPanel.tsx
// ─────────────────────────────────────────────────────────────
// Cari Hesap Yönetimi — account list (filterable by type), account
// creation, ledger detail (transactions + payment recording), and a
// risk-accounts view (over credit limit). Wraps useAccountStore.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import {
  useAccountStore, accountsApi,
  type Account, type AccountType, type CreateAccountInput,
} from '@pazariopos/core'
import { money, parseMoneyInput, formatDate } from '../lib/format'

const TYPE_LABELS: Record<AccountType, string> = {
  customer: 'Müşteri',
  supplier: 'Tedarikçi',
  employee: 'Çalışan',
  other: 'Diğer',
}

const TX_TYPE_LABELS: Record<string, string> = {
  invoice: 'Veresiye Satış',
  payment: 'Ödeme',
  return: 'İade',
  purchase: 'Alış Faturası',
  transfer: 'Transfer',
  interest: 'Gecikme Faizi',
  fx_diff: 'Kur Farkı',
}

function emptyNewAccount(): CreateAccountInput {
  return {
    name: '', type: 'customer', ibanList: [],
    creditLimit: 0, paymentTermDays: 0, discountRate: 0,
  }
}

export function AccountsPanel() {
  const accounts = useAccountStore(s => s.accounts)
  const loadAccounts = useAccountStore(s => s.loadAccounts)
  const createAccount = useAccountStore(s => s.createAccount)
  const selectedAccount = useAccountStore(s => s.selectedAccount)
  const transactions = useAccountStore(s => s.transactions)
  const isLoadingTransactions = useAccountStore(s => s.isLoadingTransactions)
  const selectAccount = useAccountStore(s => s.selectAccount)
  const recordPayment = useAccountStore(s => s.recordPayment)

  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all')
  const [showRiskOnly, setShowRiskOnly] = useState(false)
  const [riskAccounts, setRiskAccounts] = useState<Account[] | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAccount, setNewAccount] = useState<CreateAccountInput>(emptyNewAccount())
  const [createMessage, setCreateMessage] = useState<string | null>(null)

  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadAccounts(typeFilter === 'all' ? undefined : typeFilter)
  }, [loadAccounts, typeFilter])

  const loadRiskAccounts = useCallback(async () => {
    const result = await accountsApi.getRiskAccounts()
    setRiskAccounts(result)
  }, [])

  useEffect(() => {
    if (showRiskOnly) void loadRiskAccounts()
  }, [showRiskOnly, loadRiskAccounts])

  const handleCreate = useCallback(async () => {
    setCreateMessage(null)
    if (!newAccount.name.trim()) {
      setCreateMessage('Hesap adı zorunlu.')
      return
    }
    try {
      await createAccount(newAccount)
      setNewAccount(emptyNewAccount())
      setShowCreateForm(false)
      setCreateMessage(null)
    } catch (err) {
      setCreateMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [newAccount, createAccount])

  const handleRecordPayment = useCallback(async () => {
    setPaymentMessage(null)
    if (!selectedAccount) return

    const amount = parseMoneyInput(paymentAmount)
    if (amount === null) {
      setPaymentMessage('Geçerli bir tutar girin.')
      return
    }

    try {
      await recordPayment(selectedAccount.id, amount)
      setPaymentAmount('')
      setPaymentMessage('Ödeme kaydedildi.')
    } catch (err) {
      setPaymentMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [selectedAccount, paymentAmount, recordPayment])

  const listToShow = showRiskOnly ? (riskAccounts ?? []) : accounts

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
      {/* ── Account list ── */}
      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-ink-soft)]">Cari Hesaplar</h3>
          <button
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 py-1 text-xs font-medium transition hover:border-[var(--color-petrol)]"
            onClick={() => setShowCreateForm(v => !v)}
          >
            {showCreateForm ? 'Vazgeç' : '+ Yeni Hesap'}
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-4 space-y-2 rounded-lg border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-3">
            <input
              type="text"
              placeholder="Hesap adı *"
              value={newAccount.name}
              onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
            />
            <select
              value={newAccount.type}
              onChange={e => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}
              className="w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
            >
              {(Object.keys(TYPE_LABELS) as AccountType[]).map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Telefon"
              value={newAccount.phone ?? ''}
              onChange={e => setNewAccount({ ...newAccount, phone: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Kredi limiti (₺)"
                value={newAccount.creditLimit ? newAccount.creditLimit / 100 : ''}
                onChange={e => setNewAccount({ ...newAccount, creditLimit: Math.round(Number(e.target.value || 0) * 100) })}
                className="w-1/2 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
              />
              <input
                type="number"
                placeholder="Vade (gün)"
                value={newAccount.paymentTermDays || ''}
                onChange={e => setNewAccount({ ...newAccount, paymentTermDays: Number(e.target.value || 0) })}
                className="w-1/2 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
              />
            </div>
            <button
              className="w-full rounded-lg bg-[var(--color-saffron)] py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white"
              onClick={handleCreate}
            >
              Hesabı Oluştur
            </button>
            {createMessage && <div className="text-xs text-[var(--color-copper)]">{createMessage}</div>}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {(['all', ...Object.keys(TYPE_LABELS)] as (AccountType | 'all')[]).map(t => (
            <button
              key={t}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                typeFilter === t && !showRiskOnly
                  ? 'bg-[var(--color-petrol)] text-white'
                  : 'border border-[var(--color-paper-line)] bg-white'
              }`}
              onClick={() => { setTypeFilter(t); setShowRiskOnly(false) }}
            >
              {t === 'all' ? 'Tümü' : TYPE_LABELS[t]}
            </button>
          ))}
          <button
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              showRiskOnly
                ? 'bg-[var(--color-copper)] text-white'
                : 'border border-[var(--color-copper)]/50 bg-white text-[var(--color-copper)]'
            }`}
            onClick={() => setShowRiskOnly(v => !v)}
          >
            ⚠ Riskli Hesaplar
          </button>
        </div>

        {listToShow.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">
            {showRiskOnly ? 'Kredi limitini aşan hesap yok.' : 'Hesap bulunamadı.'}
          </p>
        ) : (
          <ul className="max-h-[520px] space-y-1.5 overflow-y-auto">
            {listToShow.map(account => (
              <li key={account.id}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    account.id === selectedAccount?.id
                      ? 'bg-[var(--color-petrol)] text-white'
                      : 'border border-[var(--color-paper-line)] bg-white hover:border-[var(--color-petrol)]'
                  }`}
                  onClick={() => void selectAccount(account.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{account.name}</span>
                    <span className="tabular-money text-xs">{money(account.balance)}</span>
                  </div>
                  <div className="text-[11px] opacity-70">{TYPE_LABELS[account.type]}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Selected account detail ── */}
      {selectedAccount ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-petrol)]">
                  {selectedAccount.name}
                </h2>
                <div className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  {TYPE_LABELS[selectedAccount.type]}
                  {selectedAccount.phone ? ` · ${selectedAccount.phone}` : ''}
                  {selectedAccount.paymentTermDays > 0 ? ` · ${selectedAccount.paymentTermDays} gün vade` : ''}
                </div>
              </div>
              <div className="register-display rounded-lg px-4 py-2 text-right">
                <div className="text-[11px] tracking-wide opacity-80">BAKİYE</div>
                <div className="tabular-money text-xl font-semibold">{money(selectedAccount.balance)}</div>
              </div>
            </div>

            {selectedAccount.creditLimit > 0 && selectedAccount.type !== 'supplier' && (
              <div className="mt-2 text-xs text-[var(--color-ink-soft)]">
                Kredi limiti: <span className="tabular-money">{money(selectedAccount.creditLimit)}</span>
                {selectedAccount.balance > selectedAccount.creditLimit && (
                  <span className="ml-2 rounded-full bg-[var(--color-copper-light)]/25 px-2 py-0.5 font-medium text-[var(--color-copper)]">
                    ⚠ Limit aşıldı
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder={selectedAccount.type === 'supplier' ? 'Ödenecek tutar (ör. 100.00)' : 'Ödeme tutarı (ör. 100.00)'}
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
              />
              <button
                className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white"
                onClick={handleRecordPayment}
              >
                {selectedAccount.type === 'supplier' ? 'Ödeme Yap' : 'Ödeme Al'}
              </button>
            </div>
            {paymentMessage && <div className="mt-2 text-xs">{paymentMessage}</div>}
          </div>

          <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Hesap Hareketleri</h3>
            {isLoadingTransactions ? (
              <p className="text-sm text-[var(--color-ink-soft)]">Yükleniyor…</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">Henüz hareket yok.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                    <th className="pb-2 pt-1 text-left font-medium">Tarih</th>
                    <th className="pb-2 pt-1 text-left font-medium">Tür</th>
                    <th className="pb-2 pt-1 text-left font-medium">Açıklama</th>
                    <th className="pb-2 pt-1 text-right font-medium">Tutar</th>
                    <th className="pb-2 pt-1 text-right font-medium">Vade</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-[var(--color-paper-line)]/60">
                      <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{formatDate(tx.createdAt)}</td>
                      <td className="py-1.5 text-xs">{TX_TYPE_LABELS[tx.type] ?? tx.type}</td>
                      <td className="py-1.5">{tx.description || '—'}</td>
                      <td
                        className={`tabular-money py-1.5 text-right ${
                          tx.amount >= 0 ? 'text-[var(--color-copper)]' : 'text-[var(--color-olive)]'
                        }`}
                      >
                        {tx.amount >= 0 ? '+' : ''}
                        {money(tx.amount)}
                      </td>
                      <td className="py-1.5 text-right text-xs text-[var(--color-ink-soft)]">{formatDate(tx.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-8 text-center text-sm text-[var(--color-ink-soft)]">
          Sol taraftan bir cari hesap seçin.
        </div>
      )}
    </div>
  )
}
