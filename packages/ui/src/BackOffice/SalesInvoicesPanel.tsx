// packages/ui/src/BackOffice/SalesInvoicesPanel.tsx
// ─────────────────────────────────────────────────────────────
// Satış Fatura Listesi — browses past sales (GET /api/sales), with
// date-range and customer filters, and an expandable receipt-style
// detail view per row (line items + payments). Read-only: creating a
// sale happens in the POS screen, not here.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { salesApi, accountsApi, type Sale, type Account } from '@pazariopos/core'
import { money, formatDate } from '../lib/format'

const STATUS_LABELS: Record<string, string> = {
  completed: 'Tamamlandı', voided: 'İptal Edildi', refunded: 'İade Edildi',
}
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit', card: 'Kredi Kartı', cheque: 'Çek/Senet', account: 'Veresiye', transfer: 'Havale/EFT',
}

function defaultFromDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SalesInvoicesPanel() {
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState(defaultFromDate())
  const [to, setTo] = useState(defaultToDate())
  const [customerId, setCustomerId] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const fromIso = new Date(from).toISOString()
      // Include the entire "to" day, not just its midnight.
      const toIso = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
      const [salesResult, customersResult] = await Promise.all([
        salesApi.listSales({ from: fromIso, to: toIso, customerId: customerId || undefined }),
        customers.length === 0 ? accountsApi.listAccounts('customer') : Promise.resolve(customers),
      ])
      setSales(salesResult)
      if (customers.length === 0) setCustomers(customersResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `customers` intentionally excluded (only used to skip a redundant refetch)
  }, [from, to, customerId])

  useEffect(() => { void load() }, [load])

  const customerName = useCallback(
    (id?: string) => (id ? customers.find(c => c.id === id)?.name ?? id : 'Perakende Müşteri'),
    [customers],
  )

  const totals = useMemo(() => ({
    count: sales.length,
    grandTotal: sales.reduce((s, sale) => s + sale.grandTotal, 0),
  }), [sales])

  const inputClass = 'rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]'

  return (
    <div className="space-y-4">
      <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-petrol)]">Satış Fatura Listesi</h2>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="si-from">Başlangıç</label>
          <input id="si-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="si-to">Bitiş</label>
          <input id="si-to" type="date" value={to} onChange={e => setTo(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="si-customer">Müşteri</label>
          <select id="si-customer" value={customerId} onChange={e => setCustomerId(e.target.value)} className={inputClass}>
            <option value="">Tümü</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="button" className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={load}>
          Yenile
        </button>
        <div className="ml-auto text-right text-sm text-[var(--color-ink-soft)]">
          <div>{totals.count} fatura</div>
          <div className="tabular-money font-semibold text-[var(--color-ink)]">{money(totals.grandTotal)}</div>
        </div>
      </div>

      {error && <div className="text-sm text-[var(--color-copper)]">Hata: {error}</div>}

      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Yükleniyor…</p>
        ) : sales.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Seçili aralıkta satış bulunamadı.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                <th className="pb-2 pt-1 text-left font-medium">Tarih</th>
                <th className="pb-2 pt-1 text-left font-medium">Müşteri</th>
                <th className="pb-2 pt-1 text-left font-medium">Ödeme</th>
                <th className="pb-2 pt-1 text-left font-medium">Durum</th>
                <th className="pb-2 pt-1 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => (
                <Fragment key={sale.id}>
                  <tr
                    className="cursor-pointer border-b border-[var(--color-paper-line)]/60 hover:bg-white"
                    onClick={() => setExpandedId(id => (id === sale.id ? null : sale.id))}
                  >
                    <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{formatDate(sale.createdAt)}</td>
                    <td className="py-1.5">{customerName(sale.customerId)}</td>
                    <td className="py-1.5 text-xs">{sale.payments.map(p => PAYMENT_METHOD_LABELS[p.method] ?? p.method).join(', ')}</td>
                    <td className="py-1.5 text-xs">{STATUS_LABELS[sale.status] ?? sale.status}</td>
                    <td className="tabular-money py-1.5 text-right font-medium">{money(sale.grandTotal)}</td>
                  </tr>
                  {expandedId === sale.id && (
                    <tr className="border-b border-[var(--color-paper-line)]/60 bg-[var(--color-paper-dim)]">
                      <td colSpan={5} className="p-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[var(--color-ink-soft)]">
                              <th className="pb-1 text-left font-medium">Ürün</th>
                              <th className="pb-1 text-right font-medium">Miktar</th>
                              <th className="pb-1 text-right font-medium">Birim Fiyat</th>
                              <th className="pb-1 text-right font-medium">Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.lines.map((line, i) => (
                              <tr key={i}>
                                <td className="py-0.5">{line.product.name}</td>
                                <td className="py-0.5 text-right">{line.quantity}</td>
                                <td className="tabular-money py-0.5 text-right">{money(line.unitPrice)}</td>
                                <td className="tabular-money py-0.5 text-right">{money(line.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 flex justify-between text-xs text-[var(--color-ink-soft)]">
                          <span>Ara Toplam: <span className="tabular-money">{money(sale.subtotal)}</span></span>
                          <span>KDV: <span className="tabular-money">{money(sale.taxTotal)}</span></span>
                          <span>İskonto: <span className="tabular-money">{money(sale.discountTotal)}</span></span>
                          <span className="font-semibold text-[var(--color-ink)]">Genel Toplam: <span className="tabular-money">{money(sale.grandTotal)}</span></span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
