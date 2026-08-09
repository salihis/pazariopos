// packages/ui/src/BackOffice/PurchaseInvoicePanel.tsx
// ─────────────────────────────────────────────────────────────
// Alış Faturası Oluştur — purchase invoice creation, matching the
// user-provided mockup (ALISFATOLUS.jpg), scoped to the core flow:
// barkod ara/tara, ürün seç, miktar+birim fiyat+iskonto+KDV, canlı
// toplamlar, Nakit/Kredi Kartı/Çek/Açık Hesap ödeme. Excel import,
// çoklu iskonto katmanı, and multi-branch price sync from the mockup
// are out of scope for this MVP (agreed with the user).
//
// Each line's discountAmount/taxAmount are line TOTALS (not
// per-unit) — see schema.prisma's PurchaseLine comment for why this
// differs from SaleLine's per-unit convention.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  productsApi, accountsApi, purchasesApi,
  type Product, type Account, type PaymentMethod,
} from '@pazariopos/core'
import { money } from '../lib/format'

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Nakit', card: 'Kredi Kartı', cheque: 'Çek/Senet', account: 'Açık Hesap (Vadeli)', transfer: 'Havale/EFT',
}
const PAYABLE_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'cheque', 'account']

const TAX_RATE_OPTIONS = [0.01, 0.10, 0.20]

function generateInvoiceNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const rand = Math.floor(Math.random() * 900000 + 100000)
  return `ALF-${y}-${rand}`
}

type LineForm = {
  key: string
  barcode: string
  productId: string | null
  productName: string
  salePrice: number | null // reference display only
  currentStock: number | null
  quantity: string
  unitCostInput: string
  taxInclusive: boolean
  discountPercent: string
  taxRate: number
  notFoundName: string // shown when barcode doesn't match any product — quick-create flow
}

function emptyLine(): LineForm {
  return {
    key: crypto.randomUUID(),
    barcode: '', productId: null, productName: '', salePrice: null, currentStock: null,
    quantity: '1', unitCostInput: '', taxInclusive: true, discountPercent: '0', taxRate: 0.20,
    notFoundName: '',
  }
}

/** Per-line computed amounts, all in kuruş. Discount is applied on the gross (KDV dahil) line total. */
function computeLine(line: LineForm) {
  const qty = Number(line.quantity.replace(',', '.')) || 0
  const unitTl = Number(line.unitCostInput.replace(',', '.')) || 0
  const unitKurus = Math.round(unitTl * 100)
  const grossPerUnit = line.taxInclusive ? unitKurus : Math.round(unitKurus * (1 + line.taxRate))

  const grossTotal = Math.round(grossPerUnit * qty)
  const discountPct = Math.min(100, Math.max(0, Number(line.discountPercent.replace(',', '.')) || 0))
  const discountAmount = Math.round(grossTotal * (discountPct / 100))
  const grossAfterDiscount = grossTotal - discountAmount
  const netAfterDiscount = Math.round(grossAfterDiscount / (1 + line.taxRate))
  const taxAmount = grossAfterDiscount - netAfterDiscount

  return { qty, grossPerUnit, grossTotal, discountAmount, grossAfterDiscount, netAfterDiscount, taxAmount }
}

export function PurchaseInvoicePanel() {
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber())
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  const [lines, setLines] = useState<LineForm[]>([emptyLine()])
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [p, s] = await Promise.all([
        productsApi.listProducts(false),
        accountsApi.listAccounts('supplier'),
      ])
      setProducts(p)
      setSuppliers(s)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const updateLine = useCallback((key: string, patch: Partial<LineForm>) => {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  }, [])

  const handleBarcodeLookup = useCallback((key: string, barcode: string) => {
    if (!barcode.trim()) return
    const match = products.find(p => p.barcode.includes(barcode.trim()) || p.sku === barcode.trim())
    if (match) {
      updateLine(key, {
        barcode, productId: match.id, productName: match.name,
        salePrice: match.price, currentStock: match.stock,
        unitCostInput: match.costPrice != null ? money(match.costPrice) : '',
        taxRate: match.taxRate, notFoundName: '',
      })
    } else {
      updateLine(key, { barcode, productId: null, productName: '', salePrice: null, currentStock: null })
    }
  }, [products, updateLine])

  const handleQuickCreateProduct = useCallback(async (key: string) => {
    const line = lines.find(l => l.key === key)
    if (!line || !line.notFoundName.trim() || !line.barcode.trim()) return
    const sku = `SKU-${Date.now().toString(36).toUpperCase()}`
    const created = await productsApi.createProduct({
      sku, name: line.notFoundName, barcode: [line.barcode],
      price: 0, taxRate: line.taxRate, stock: 0, lowStockThreshold: 0, unit: 'piece',
    })
    setProducts(ps => [...ps, created])
    updateLine(key, { productId: created.id, productName: created.name, salePrice: created.price, currentStock: created.stock, notFoundName: '' })
  }, [lines, updateLine])

  const addLine = useCallback(() => setLines(ls => [...ls, emptyLine()]), [])
  const removeLine = useCallback((key: string) => setLines(ls => (ls.length > 1 ? ls.filter(l => l.key !== key) : ls)), [])

  const totals = useMemo(() => {
    const computed = lines.filter(l => l.productId).map(computeLine)
    return {
      productCount: computed.length,
      totalQuantity: computed.reduce((s, c) => s + c.qty, 0),
      grossTotal: computed.reduce((s, c) => s + c.grossTotal, 0),
      discountTotal: computed.reduce((s, c) => s + c.discountAmount, 0),
      subtotal: computed.reduce((s, c) => s + c.netAfterDiscount, 0),
      taxTotal: computed.reduce((s, c) => s + c.taxAmount, 0),
      grandTotal: computed.reduce((s, c) => s + c.grossAfterDiscount, 0),
    }
  }, [lines])

  const handleSave = useCallback(async () => {
    setMessage(null)
    const validLines = lines.filter(l => l.productId)
    if (validLines.length === 0) {
      setMessage('En az bir ürün eklemelisiniz.')
      return
    }
    if (paymentMethod === 'account' && !supplierId) {
      setMessage('Açık Hesap ödemesi için bir firma (tedarikçi) seçmelisiniz.')
      return
    }

    setIsSaving(true)
    try {
      const purchase = await purchasesApi.createPurchase({
        invoiceNumber,
        supplierId,
        invoiceDate: new Date(invoiceDate).toISOString(),
        lines: validLines.map(l => {
          const c = computeLine(l)
          return {
            productId: l.productId!,
            productName: l.productName,
            quantity: c.qty,
            unitCost: c.grossPerUnit,
            discountAmount: c.discountAmount,
            taxAmount: c.taxAmount,
            total: c.grossAfterDiscount,
          }
        }),
        payments: [{ method: paymentMethod, amount: totals.grandTotal }],
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
      })
      setSavedInvoiceNumber(purchase.invoiceNumber ?? purchase.id)
      setInvoiceNumber(generateInvoiceNumber())
      setInvoiceDate(new Date().toISOString().slice(0, 10))
      setSupplierId(null)
      setLines([emptyLine()])
      await load()
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSaving(false)
    }
  }, [lines, paymentMethod, supplierId, invoiceNumber, invoiceDate, totals, load])

  const inputClass = 'w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-saffron)]'
  const labelClass = 'mb-1 block text-xs font-medium text-[var(--color-ink-soft)]'

  if (isLoading) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Yükleniyor…</p>
  }

  return (
    <div className="space-y-4">
      <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-petrol)]">Alış Faturası Oluştur</h2>

      {savedInvoiceNumber && (
        <div className="rounded-lg border border-[var(--color-olive)]/30 bg-[var(--color-olive)]/10 px-3 py-2 text-sm text-[var(--color-olive)]">
          ✓ Fatura kaydedildi ({savedInvoiceNumber}). Stok artırıldı{paymentMethod === 'account' ? ', tedarikçi cari hesabına işlendi.' : '.'}
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4 md:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="pi-number">Fatura No *</label>
          <div className="flex gap-1.5">
            <input id="pi-number" type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputClass} />
            <button type="button" className="shrink-0 rounded-lg border border-[var(--color-paper-line)] bg-white px-2 text-xs" onClick={() => setInvoiceNumber(generateInvoiceNumber())}>
              Rastgele Üret
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="pi-date">Fatura Tarihi *</label>
          <input id="pi-date" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="pi-supplier">Firma</label>
          <select id="pi-supplier" value={supplierId ?? ''} onChange={e => setSupplierId(e.target.value || null)} className={inputClass}>
            <option value="">Firmasız</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="pi-payment">Ödeme Tipi</label>
          <select id="pi-payment" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className={inputClass}>
            {PAYABLE_PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
      </div>

      {/* Line items */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
              <th className="pb-2 pt-1 text-left font-medium">Sıra</th>
              <th className="pb-2 pt-1 text-left font-medium">Barkod *</th>
              <th className="pb-2 pt-1 text-left font-medium">Ürün</th>
              <th className="pb-2 pt-1 text-right font-medium">Satış Fiy.</th>
              <th className="pb-2 pt-1 text-right font-medium">Stok</th>
              <th className="pb-2 pt-1 text-right font-medium">Miktar *</th>
              <th className="pb-2 pt-1 text-right font-medium">Birim Fiy.</th>
              <th className="pb-2 pt-1 text-center font-medium">KDV Dahil</th>
              <th className="pb-2 pt-1 text-right font-medium">İsk. %</th>
              <th className="pb-2 pt-1 text-right font-medium">KDV %</th>
              <th className="pb-2 pt-1 text-right font-medium">Tutar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const c = computeLine(line)
              const priceChanged = line.productId != null &&
                (() => {
                  const p = products.find(pp => pp.id === line.productId)
                  return p?.costPrice != null && p.costPrice !== c.grossPerUnit
                })()
              return (
                <tr key={line.key} className="border-b border-[var(--color-paper-line)]/60 align-top">
                  <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{idx + 1}</td>
                  <td className="w-40 py-1.5">
                    <input type="text" placeholder="Ürün barkodu [Enter]" value={line.barcode}
                      onChange={e => updateLine(line.key, { barcode: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleBarcodeLookup(line.key, line.barcode) }}
                      onBlur={() => handleBarcodeLookup(line.key, line.barcode)}
                      className={inputClass} />
                    {!line.productId && line.barcode.trim() && (
                      <div className="mt-1 flex gap-1">
                        <input type="text" placeholder="Yeni ürün adı" value={line.notFoundName}
                          onChange={e => updateLine(line.key, { notFoundName: e.target.value })}
                          className="w-full rounded border border-[var(--color-copper)]/40 bg-white px-1.5 py-1 text-xs outline-none" />
                        <button type="button" className="shrink-0 rounded bg-[var(--color-copper)] px-2 text-xs text-white" onClick={() => void handleQuickCreateProduct(line.key)}>
                          Oluştur
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-1.5">
                    {line.productName || <span className="text-xs text-[var(--color-ink-soft)]">—</span>}
                  </td>
                  <td className="tabular-money py-1.5 text-right text-xs text-[var(--color-ink-soft)]">
                    {line.salePrice != null ? money(line.salePrice) : '—'}
                  </td>
                  <td className="tabular-money py-1.5 text-right text-xs text-[var(--color-ink-soft)]">
                    {line.currentStock ?? '—'}
                  </td>
                  <td className="w-20 py-1.5">
                    <input type="text" inputMode="decimal" value={line.quantity}
                      onChange={e => updateLine(line.key, { quantity: e.target.value })}
                      className={`${inputClass} text-right`} />
                  </td>
                  <td className="w-24 py-1.5">
                    <input type="text" inputMode="decimal" placeholder="0.00" value={line.unitCostInput}
                      onChange={e => updateLine(line.key, { unitCostInput: e.target.value })}
                      className={`${inputClass} text-right`} />
                    {priceChanged && <div className="mt-0.5 text-[10px] text-[var(--color-copper)]">⚠ alış fiyatı değişti</div>}
                  </td>
                  <td className="py-1.5 text-center">
                    <input type="checkbox" checked={line.taxInclusive} onChange={e => updateLine(line.key, { taxInclusive: e.target.checked })} />
                  </td>
                  <td className="w-16 py-1.5">
                    <input type="text" inputMode="decimal" value={line.discountPercent}
                      onChange={e => updateLine(line.key, { discountPercent: e.target.value })}
                      className={`${inputClass} text-right`} />
                  </td>
                  <td className="w-20 py-1.5">
                    <select value={line.taxRate} onChange={e => updateLine(line.key, { taxRate: Number(e.target.value) })} className={inputClass}>
                      {TAX_RATE_OPTIONS.map(r => <option key={r} value={r}>%{Math.round(r * 100)}</option>)}
                    </select>
                  </td>
                  <td className="tabular-money py-1.5 text-right font-medium">{money(c.grossAfterDiscount)}</td>
                  <td className="py-1.5 text-right">
                    <button type="button" className="text-xs text-[var(--color-copper)] hover:underline" onClick={() => removeLine(line.key)}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button type="button" className="mt-3 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-1.5 text-xs font-medium hover:border-[var(--color-petrol)]" onClick={addLine}>
          + Yeni ürün alanı ekle
        </button>
      </div>

      {/* Totals + save */}
      <div className="flex flex-col items-end gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Toplam Ürün</span><span>{totals.productCount}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Toplam Miktar</span><span>{totals.totalQuantity}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Brüt Toplam</span><span className="tabular-money">{money(totals.grossTotal)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">İskonto tutarı</span><span className="tabular-money">− {money(totals.discountTotal)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Ara toplam</span><span className="tabular-money">{money(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">KDV tutarı</span><span className="tabular-money">+ {money(totals.taxTotal)}</span></div>
          <div className="register-display mt-2 flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-xs font-medium tracking-wide opacity-80">GENEL TOPLAM</span>
            <span className="tabular-money text-lg font-semibold">{money(totals.grandTotal)}</span>
          </div>
        </div>

        {message && <div className="text-xs text-[var(--color-copper)]">{message}</div>}

        <button
          className="w-full max-w-xs rounded-lg bg-[var(--color-saffron)] py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}
