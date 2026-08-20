// packages/ui/src/BackOffice/FinancePanel.tsx
// ─────────────────────────────────────────────────────────────
// Finans Yönetimi — four sub-tabs: Banka Hesapları, Çek/Senet,
// Kategoriler, Raporlar. Bank accounts + categories go through
// useFinanceStore; cheques and reports have no store (no caching
// need) so they call chequesApi/reportsApi directly, same pattern as
// AccountsPanel's risk-accounts call.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import {
  useFinanceStore, bankAccountsApi, chequesApi, reportsApi, categoriesApi,
  type BankTransaction, type Cheque, type ChequeStatus, type ChequeType,
  type CashFlowReport, type IncomeExpenseReport, type ProfitLossReport, type CategoryType,
} from '@pazariopos/core'
import { money, parseMoneyInput, formatDate } from '../lib/format'

type SubTab = 'bank' | 'cheques' | 'categories' | 'reports'

const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  in_wallet: 'Cüzdanda', at_bank: 'Bankada', collected: 'Tahsil Edildi',
  returned: 'Karşılıksız', protested: 'Protesto',
}
const CHEQUE_TYPE_LABELS: Record<ChequeType, string> = {
  customer_cheque: 'Müşteri Çeki', own_cheque: 'Kendi Çekimiz',
}

export function FinancePanel() {
  const [tab, setTab] = useState<SubTab>('bank')

  const loadAll = useFinanceStore(s => s.loadAll)
  useEffect(() => { void loadAll() }, [loadAll])

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([
          ['bank', 'Banka Hesapları'],
          ['cheques', 'Çek/Senet'],
          ['categories', 'Kategoriler'],
          ['reports', 'Raporlar'],
        ] as [SubTab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === key ? 'bg-[var(--color-petrol)] text-white' : 'border border-[var(--color-paper-line)] bg-white'
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bank' && <BankAccountsTab />}
      {tab === 'cheques' && <ChequesTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  )
}

// ── Banka Hesapları ──────────────────────────────────────────

function BankAccountsTab() {
  const bankAccounts = useFinanceStore(s => s.bankAccounts)
  const recordBankTransaction = useFinanceStore(s => s.recordBankTransaction)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIban, setNewIban] = useState('')
  const [newBankName, setNewBankName] = useState('')

  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [txAmount, setTxAmount] = useState('')
  const [txDescription, setTxDescription] = useState('')
  const [txMessage, setTxMessage] = useState<string | null>(null)

  const selected = bankAccounts.find(a => a.id === selectedId) ?? null

  const loadTransactions = useCallback(async (id: string) => {
    setTransactions(await bankAccountsApi.listTransactions(id))
  }, [])

  useEffect(() => {
    if (selectedId) void loadTransactions(selectedId)
  }, [selectedId, loadTransactions])

  useEffect(() => {
    if (!selectedId && bankAccounts.length > 0) setSelectedId(bankAccounts[0]!.id)
  }, [bankAccounts, selectedId])

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    await bankAccountsApi.createBankAccount({ name: newName, iban: newIban || undefined, bankName: newBankName || undefined })
    setNewName(''); setNewIban(''); setNewBankName(''); setShowCreate(false)
    // Refresh the shared list via the store.
    await useFinanceStore.getState().loadAll()
  }, [newName, newIban, newBankName])

  const handleRecordTx = useCallback(async () => {
    setTxMessage(null)
    if (!selectedId) return
    const amount = parseMoneyInput(txAmount)
    if (amount === null) { setTxMessage('Geçerli bir tutar girin.'); return }
    try {
      await recordBankTransaction(selectedId, txType, amount, txDescription || undefined)
      setTxAmount(''); setTxDescription(''); setTxMessage('Hareket kaydedildi.')
      await loadTransactions(selectedId)
    } catch (err) {
      setTxMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [selectedId, txType, txAmount, txDescription, recordBankTransaction, loadTransactions])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-ink-soft)]">Banka Hesapları</h3>
          <button
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 py-1 text-xs font-medium hover:border-[var(--color-petrol)]"
            onClick={() => setShowCreate(v => !v)}
          >
            {showCreate ? 'Vazgeç' : '+ Yeni'}
          </button>
        </div>
        {showCreate && (
          <div className="mb-3 space-y-2 rounded-lg border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-3">
            <input type="text" placeholder="Hesap adı *" value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
            <input type="text" placeholder="Banka adı" value={newBankName} onChange={e => setNewBankName(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
            <input type="text" placeholder="IBAN" value={newIban} onChange={e => setNewIban(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
            <button className="w-full rounded-lg bg-[var(--color-saffron)] py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={handleCreate}>
              Oluştur
            </button>
          </div>
        )}
        {bankAccounts.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Henüz banka hesabı yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {bankAccounts.map(acc => (
              <li key={acc.id}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    acc.id === selectedId ? 'bg-[var(--color-petrol)] text-white' : 'border border-[var(--color-paper-line)] bg-white hover:border-[var(--color-petrol)]'
                  }`}
                  onClick={() => setSelectedId(acc.id)}
                >
                  <div className="font-medium">{acc.name}</div>
                  <div className="tabular-money text-xs opacity-80">{money(acc.balance)} ₺</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <div className="space-y-5">
          <div className="register-display flex items-center justify-between rounded-lg px-4 py-3">
            <span className="text-sm font-medium tracking-wide opacity-80">{selected.name} BAKİYE</span>
            <span className="text-2xl font-semibold">{money(selected.balance)}</span>
          </div>

          <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Hareket Ekle</h3>
            <div className="flex gap-2">
              <button
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${txType === 'deposit' ? 'bg-[var(--color-olive)] text-white' : 'border border-[var(--color-paper-line)] bg-white'}`}
                onClick={() => setTxType('deposit')}
              >
                Para Yatırma
              </button>
              <button
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${txType === 'withdrawal' ? 'bg-[var(--color-copper)] text-white' : 'border border-[var(--color-paper-line)] bg-white'}`}
                onClick={() => setTxType('withdrawal')}
              >
                Para Çekme
              </button>
            </div>
            <input type="text" inputMode="decimal" placeholder="Tutar" value={txAmount} onChange={e => setTxAmount(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
            <input type="text" placeholder="Açıklama (opsiyonel)" value={txDescription} onChange={e => setTxDescription(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
            <button className="mt-3 w-full rounded-lg bg-[var(--color-saffron)] py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={handleRecordTx}>
              Kaydet
            </button>
            {txMessage && <div className="mt-2 text-xs">{txMessage}</div>}
          </div>

          <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Hareket Geçmişi</h3>
            {transactions.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-soft)]">Henüz hareket yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                    <th className="pb-2 pt-1 text-left font-medium">Tarih</th>
                    <th className="pb-2 pt-1 text-left font-medium">Açıklama</th>
                    <th className="pb-2 pt-1 text-right font-medium">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-[var(--color-paper-line)]/60">
                      <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{formatDate(tx.createdAt)}</td>
                      <td className="py-1.5">{tx.description || '—'}</td>
                      <td className={`tabular-money py-1.5 text-right ${tx.type === 'deposit' ? 'text-[var(--color-olive)]' : 'text-[var(--color-copper)]'}`}>
                        {tx.type === 'deposit' ? '+' : '−'}{money(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-8 text-center text-sm text-[var(--color-ink-soft)]">
          Sol taraftan bir banka hesabı seçin.
        </div>
      )}
    </div>
  )
}

// ── Çek/Senet ────────────────────────────────────────────────

function ChequesTab() {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [statusFilter, setStatusFilter] = useState<ChequeStatus | 'all'>('all')
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    type: 'customer_cheque' as ChequeType,
    amount: '', chequeNumber: '', drawerName: '', bankName: '', dueDate: '', notes: '',
  })

  const load = useCallback(async () => {
    if (showUpcoming) {
      setCheques(await chequesApi.getUpcoming(30))
    } else {
      setCheques(await chequesApi.listCheques(statusFilter === 'all' ? undefined : { status: statusFilter }))
    }
  }, [statusFilter, showUpcoming])

  useEffect(() => { void load() }, [load])

  const handleCreate = useCallback(async () => {
    setMessage(null)
    const amount = parseMoneyInput(form.amount)
    if (amount === null) { setMessage('Geçerli bir tutar girin.'); return }
    if (!form.drawerName.trim()) { setMessage('Keşideci adı zorunlu.'); return }
    if (!form.dueDate) { setMessage('Vade tarihi zorunlu.'); return }

    try {
      await chequesApi.createCheque({
        type: form.type, amount,
        chequeNumber: form.chequeNumber || undefined,
        drawerName: form.drawerName,
        bankName: form.bankName || undefined,
        dueDate: new Date(form.dueDate).toISOString(),
        notes: form.notes || undefined,
      })
      setForm({ type: 'customer_cheque', amount: '', chequeNumber: '', drawerName: '', bankName: '', dueDate: '', notes: '' })
      setShowCreate(false)
      await load()
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [form, load])

  const handleStatusChange = useCallback(async (cheque: Cheque, status: ChequeStatus) => {
    await chequesApi.updateStatus(cheque.id, status)
    await load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', ...Object.keys(CHEQUE_STATUS_LABELS)] as (ChequeStatus | 'all')[]).map(s => (
            <button
              key={s}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                statusFilter === s && !showUpcoming ? 'bg-[var(--color-petrol)] text-white' : 'border border-[var(--color-paper-line)] bg-white'
              }`}
              onClick={() => { setStatusFilter(s); setShowUpcoming(false) }}
            >
              {s === 'all' ? 'Tümü' : CHEQUE_STATUS_LABELS[s]}
            </button>
          ))}
          <button
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              showUpcoming ? 'bg-[var(--color-saffron-dark)] text-white' : 'border border-[var(--color-saffron-dark)]/50 bg-white text-[var(--color-saffron-dark)]'
            }`}
            onClick={() => setShowUpcoming(v => !v)}
          >
            📅 Vade Takvimi (30 gün)
          </button>
        </div>
        <button
          className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-1.5 text-xs font-medium hover:border-[var(--color-petrol)]"
          onClick={() => setShowCreate(v => !v)}
        >
          {showCreate ? 'Vazgeç' : '+ Yeni Çek/Senet'}
        </button>
      </div>

      {showCreate && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-3 md:grid-cols-3">
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ChequeType })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]">
            {(Object.keys(CHEQUE_TYPE_LABELS) as ChequeType[]).map(t => <option key={t} value={t}>{CHEQUE_TYPE_LABELS[t]}</option>)}
          </select>
          <input type="text" inputMode="decimal" placeholder="Tutar *" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <input type="text" placeholder="Keşideci adı *" value={form.drawerName} onChange={e => setForm({ ...form, drawerName: e.target.value })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <input type="text" placeholder="Banka" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <input type="text" placeholder="Çek/Senet No" value={form.chequeNumber} onChange={e => setForm({ ...form, chequeNumber: e.target.value })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <button className="rounded-lg bg-[var(--color-saffron)] py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-saffron-dark)] hover:text-white md:col-span-3" onClick={handleCreate}>
            Kaydet
          </button>
          {message && <div className="text-xs text-[var(--color-copper)] md:col-span-3">{message}</div>}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        {cheques.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                <th className="pb-2 pt-1 text-left font-medium">Vade</th>
                <th className="pb-2 pt-1 text-left font-medium">Keşideci</th>
                <th className="pb-2 pt-1 text-left font-medium">Tür</th>
                <th className="pb-2 pt-1 text-right font-medium">Tutar</th>
                <th className="pb-2 pt-1 text-left font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map(c => (
                <tr key={c.id} className="border-b border-[var(--color-paper-line)]/60">
                  <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{formatDate(c.dueDate)}</td>
                  <td className="py-1.5">{c.drawerName}</td>
                  <td className="py-1.5 text-xs">{CHEQUE_TYPE_LABELS[c.type]}</td>
                  <td className="tabular-money py-1.5 text-right">{money(c.amount)}</td>
                  <td className="py-1.5">
                    <select
                      value={c.status}
                      onChange={e => void handleStatusChange(c, e.target.value as ChequeStatus)}
                      className="rounded-lg border border-[var(--color-paper-line)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--color-saffron)]"
                    >
                      {(Object.keys(CHEQUE_STATUS_LABELS) as ChequeStatus[]).map(s => (
                        <option key={s} value={s}>{CHEQUE_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Kategoriler ──────────────────────────────────────────────

function CategoriesTab() {
  const categories = useFinanceStore(s => s.categories)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CategoryType>('expense')

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    await categoriesApi.createCategory({ name: newName, type: newType })
    setNewName('')
    await useFinanceStore.getState().loadAll()
  }, [newName, newType])

  const income = categories.filter(c => c.type === 'income')
  const expense = categories.filter(c => c.type === 'expense')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <select value={newType} onChange={e => setNewType(e.target.value as CategoryType)}
          className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]">
          <option value="income">Gelir</option>
          <option value="expense">Gider</option>
        </select>
        <input type="text" placeholder="Kategori adı" value={newName} onChange={e => setNewName(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
        <button className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={handleCreate}>
          Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-olive)]">Gelir Kategorileri</h3>
          {income.length === 0 ? <p className="text-sm text-[var(--color-ink-soft)]">Henüz yok.</p> : (
            <ul className="space-y-1 text-sm">{income.map(c => <li key={c.id}>{c.name}</li>)}</ul>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-copper)]">Gider Kategorileri</h3>
          {expense.length === 0 ? <p className="text-sm text-[var(--color-ink-soft)]">Henüz yok.</p> : (
            <ul className="space-y-1 text-sm">{expense.map(c => <li key={c.id}>{c.name}</li>)}</ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Raporlar ─────────────────────────────────────────────────

function defaultFromDate(): string {
  const d = new Date()
  d.setDate(1) // start of this month
  return d.toISOString().slice(0, 10)
}
function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function ReportsTab() {
  const [from, setFrom] = useState(defaultFromDate())
  const [to, setTo] = useState(defaultToDate())
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null)
  const [incomeExpense, setIncomeExpense] = useState<IncomeExpenseReport | null>(null)
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const fromIso = new Date(from).toISOString()
      const toIso = new Date(to).toISOString()
      const [cf, ie, pl] = await Promise.all([
        reportsApi.getCashFlow(fromIso, toIso),
        reportsApi.getIncomeExpense(fromIso, toIso),
        reportsApi.getProfitLoss(fromIso, toIso),
      ])
      setCashFlow(cf); setIncomeExpense(ie); setProfitLoss(pl)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [from, to])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <div>
          <label className="text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="report-from">Başlangıç</label>
          <input id="report-from" type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="report-to">Bitiş</label>
          <input id="report-to" type="date" value={to} onChange={e => setTo(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
        </div>
        <button className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={handleRun} disabled={isLoading}>
          {isLoading ? 'Hesaplanıyor…' : 'Raporu Çalıştır'}
        </button>
      </div>

      {error && <div className="text-sm text-[var(--color-copper)]">Hata: {error}</div>}

      {cashFlow && (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Nakit Akışı</h3>
          <ReportRow label="Kasa Girişi" value={cashFlow.cashIn} positive />
          <ReportRow label="Kasa Çıkışı" value={cashFlow.cashOut} />
          <ReportRow label="Banka Yatırma" value={cashFlow.bankDeposits} positive />
          <ReportRow label="Banka Çekme" value={cashFlow.bankWithdrawals} />
          <ReportRow label="Net Nakit Akışı" value={cashFlow.totalNetFlow} bold />
        </div>
      )}

      {incomeExpense && (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Gelir/Gider</h3>
          <ReportRow label="Satış Geliri" value={incomeExpense.salesRevenue} positive />
          <ReportRow label="Diğer Gelir" value={incomeExpense.otherIncome} positive />
          <ReportRow label="Toplam Gider" value={incomeExpense.totalExpense} />
          {incomeExpense.byCategory.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {incomeExpense.byCategory.map(row => (
                  <tr key={row.categoryId} className="border-b border-[var(--color-paper-line)]/60">
                    <td className="py-1 text-xs text-[var(--color-ink-soft)]">{row.categoryName}</td>
                    <td className={`tabular-money py-1 text-right ${row.type === 'income' ? 'text-[var(--color-olive)]' : 'text-[var(--color-copper)]'}`}>
                      {money(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {profitLoss && (
        <div className="register-display flex items-center justify-between rounded-lg px-4 py-3">
          <span className="text-sm font-medium tracking-wide opacity-80">NET KÂR/ZARAR</span>
          <span className="text-2xl font-semibold">{money(profitLoss.netProfit)}</span>
        </div>
      )}
    </div>
  )
}

function ReportRow({ label, value, positive, bold }: { label: string; value: number; positive?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      <span className={`tabular-money ${positive ? 'text-[var(--color-olive)]' : ''}`}>{money(value)}</span>
    </div>
  )
}
