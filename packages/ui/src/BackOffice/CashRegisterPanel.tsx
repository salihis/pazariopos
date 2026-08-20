// packages/ui/src/BackOffice/CashRegisterPanel.tsx
// ─────────────────────────────────────────────────────────────
// Kasa Yönetimi — cash register list, manual movement entry (para
// giriş/çıkış), movement history, and day-end cash count (gün sonu
// kasa sayımı). Wraps useFinanceStore (registers) + cashRegistersApi
// directly for movement/count history, which the store doesn't cache
// (same pattern as PosScreen's direct accountBalanceService call).
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { useFinanceStore, cashRegistersApi, type CashMovement, type CashCount } from '@pazariopos/core'
import { money, parseMoneyInput, formatDate } from '../lib/format'

export function CashRegisterPanel() {
  const cashRegisters = useFinanceStore(s => s.cashRegisters)
  const recordCashMovement = useFinanceStore(s => s.recordCashMovement)
  const recordCashCount = useFinanceStore(s => s.recordCashCount)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [counts, setCounts] = useState<CashCount[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const [movementType, setMovementType] = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementDescription, setMovementDescription] = useState('')
  const [movementMessage, setMovementMessage] = useState<string | null>(null)

  const [countedAmount, setCountedAmount] = useState('')
  const [countNotes, setCountNotes] = useState('')
  const [countMessage, setCountMessage] = useState<string | null>(null)

  const selectedRegister = cashRegisters.find(r => r.id === selectedId) ?? null

  const loadHistory = useCallback(async (registerId: string) => {
    setIsLoadingHistory(true)
    try {
      const [m, c] = await Promise.all([
        cashRegistersApi.listMovements(registerId),
        cashRegistersApi.listCounts(registerId),
      ])
      setMovements(m)
      setCounts(c)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    void loadHistory(selectedId)
  }, [selectedId, loadHistory])

  // Auto-select the first register once the list loads.
  useEffect(() => {
    if (!selectedId && cashRegisters.length > 0) {
      setSelectedId(cashRegisters[0]!.id)
    }
  }, [cashRegisters, selectedId])

  const handleRecordMovement = useCallback(async () => {
    setMovementMessage(null)
    if (!selectedId) return

    const amount = parseMoneyInput(movementAmount)
    if (amount === null) {
      setMovementMessage('Geçerli bir tutar girin.')
      return
    }

    try {
      await recordCashMovement(selectedId, movementType, amount, movementDescription || undefined)
      setMovementAmount('')
      setMovementDescription('')
      setMovementMessage('Hareket kaydedildi.')
      await loadHistory(selectedId)
    } catch (err) {
      setMovementMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [selectedId, movementType, movementAmount, movementDescription, recordCashMovement, loadHistory])

  const handleRecordCount = useCallback(async () => {
    setCountMessage(null)
    if (!selectedId) return

    const counted = parseMoneyInput(countedAmount)
    if (counted === null) {
      setCountMessage('Geçerli bir sayım tutarı girin.')
      return
    }

    try {
      const { difference } = await recordCashCount(selectedId, counted, countNotes || undefined)
      setCountedAmount('')
      setCountNotes('')
      const diffText =
        difference === 0
          ? 'Fark yok — kasa tutuyor.'
          : difference > 0
            ? `Fazla: +${money(difference)}`
            : `Eksik: ${money(difference)}`
      setCountMessage(`Sayım kaydedildi. ${diffText}`)
      await loadHistory(selectedId)
    } catch (err) {
      setCountMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [selectedId, countedAmount, countNotes, recordCashCount, loadHistory])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
      {/* ── Register list ── */}
      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Kasalar</h3>
        {cashRegisters.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Henüz kasa yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {cashRegisters.map(register => (
              <li key={register.id}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    register.id === selectedId
                      ? 'bg-[var(--color-petrol)] text-white'
                      : 'border border-[var(--color-paper-line)] bg-white hover:border-[var(--color-petrol)]'
                  }`}
                  onClick={() => setSelectedId(register.id)}
                >
                  <div className="font-medium">{register.name}</div>
                  <div className="tabular-money text-xs opacity-80">{money(register.balance)} ₺</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Selected register detail ── */}
      {selectedRegister ? (
        <div className="space-y-5">
          <div className="register-display flex items-center justify-between rounded-lg px-4 py-3">
            <span className="text-sm font-medium tracking-wide opacity-80">{selectedRegister.name} BAKİYE</span>
            <span className="text-2xl font-semibold">{money(selectedRegister.balance)}</span>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Manual movement form */}
            <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Manuel Hareket</h3>
              <div className="flex gap-2">
                <button
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    movementType === 'in'
                      ? 'bg-[var(--color-olive)] text-white'
                      : 'border border-[var(--color-paper-line)] bg-white'
                  }`}
                  onClick={() => setMovementType('in')}
                >
                  Para Girişi
                </button>
                <button
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                    movementType === 'out'
                      ? 'bg-[var(--color-copper)] text-white'
                      : 'border border-[var(--color-paper-line)] bg-white'
                  }`}
                  onClick={() => setMovementType('out')}
                >
                  Para Çıkışı
                </button>
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Tutar (ör. 100.00)"
                value={movementAmount}
                onChange={e => setMovementAmount(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
              />
              <input
                type="text"
                placeholder="Açıklama (opsiyonel)"
                value={movementDescription}
                onChange={e => setMovementDescription(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
              />
              <button
                className="mt-3 w-full rounded-lg bg-[var(--color-saffron)] py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white"
                onClick={handleRecordMovement}
              >
                Kaydet
              </button>
              {movementMessage && <div className="mt-2 text-xs">{movementMessage}</div>}
            </div>

            {/* Day-end count form */}
            <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Gün Sonu Kasa Sayımı</h3>
              <p className="mb-2 text-xs text-[var(--color-ink-soft)]">
                Sistemdeki bakiye: <strong className="tabular-money">{money(selectedRegister.balance)}</strong>
              </p>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Sayılan tutar (ör. 1250.00)"
                value={countedAmount}
                onChange={e => setCountedAmount(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
              />
              <input
                type="text"
                placeholder="Not (opsiyonel)"
                value={countNotes}
                onChange={e => setCountNotes(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
              />
              <button
                className="mt-3 w-full rounded-lg border border-[var(--color-petrol)] py-2.5 text-sm font-semibold text-[var(--color-petrol)] transition hover:bg-[var(--color-petrol)] hover:text-white"
                onClick={handleRecordCount}
              >
                Sayımı Kaydet
              </button>
              {countMessage && <div className="mt-2 text-xs">{countMessage}</div>}
            </div>
          </div>

          {/* History */}
          <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-soft)]">Hareket Geçmişi</h3>
            {isLoadingHistory ? (
              <p className="text-sm text-[var(--color-ink-soft)]">Yükleniyor…</p>
            ) : movements.length === 0 ? (
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
                  {movements.map(m => (
                    <tr key={m.id} className="border-b border-[var(--color-paper-line)]/60">
                      <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{formatDate(m.createdAt)}</td>
                      <td className="py-1.5">{m.description || (m.referenceSaleId ? 'Satış tahsilatı' : '—')}</td>
                      <td
                        className={`tabular-money py-1.5 text-right ${
                          m.type === 'in' ? 'text-[var(--color-olive)]' : 'text-[var(--color-copper)]'
                        }`}
                      >
                        {m.type === 'in' ? '+' : '−'}
                        {money(m.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}

            {counts.length > 0 && (
              <>
                <h4 className="mb-2 mt-5 text-xs font-semibold text-[var(--color-ink-soft)]">Sayım Geçmişi</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                      <th className="pb-2 pt-1 text-left font-medium">Tarih</th>
                      <th className="pb-2 pt-1 text-right font-medium">Beklenen</th>
                      <th className="pb-2 pt-1 text-right font-medium">Sayılan</th>
                      <th className="pb-2 pt-1 text-right font-medium">Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map(c => (
                      <tr key={c.id} className="border-b border-[var(--color-paper-line)]/60">
                        <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{formatDate(c.createdAt)}</td>
                        <td className="tabular-money py-1.5 text-right">{money(c.expectedAmount)}</td>
                        <td className="tabular-money py-1.5 text-right">{money(c.countedAmount)}</td>
                        <td
                          className={`tabular-money py-1.5 text-right ${
                            c.difference === 0
                              ? ''
                              : c.difference > 0
                                ? 'text-[var(--color-olive)]'
                                : 'text-[var(--color-copper)]'
                          }`}
                        >
                          {c.difference > 0 ? '+' : ''}
                          {money(c.difference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-8 text-center text-sm text-[var(--color-ink-soft)]">
          Sol taraftan bir kasa seçin.
        </div>
      )}
    </div>
  )
}
