// packages/ui/src/BackOffice/ProductsPanel.tsx
// ─────────────────────────────────────────────────────────────
// Ürün Yönetimi — full product catalog management: create, edit,
// deactivate/reactivate (soft-delete — see products.ts route comment
// on why there's no hard DELETE), and product categories (hierarchical:
// Ana Kategori / Alt Kategori via Category.parentId, already supported
// end-to-end by the backend — this panel is the first UI to use it).
//
// Form layout follows the user-provided mockup (URUNEKLEME.jpg):
// Barkod+üret / Ürün Adı / Birim+Ürün Kodu / Alış-Satış Fiyatı (KDV
// dahil toggle each) / KDV Oranı+Kritik Stok / Ana-Alt Kategori /
// Mevcut-Eklenen Stok / Ana Depo / İptal-Kaydet.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  productsApi, categoriesApi,
  type Product, type Category, type CreateProductInput, type UpdateProductInput,
} from '@pazariopos/core'
import { money } from '../lib/format'

const UNIT_LABELS: Record<Product['unit'], string> = {
  piece: 'Adet', box: 'Kutu', kg: 'Kg', lt: 'Lt',
}

const TAX_RATE_OPTIONS = [0.01, 0.10, 0.20]

/**
 * Generates a random, spec-valid EAN-13 barcode for products that don't
 * have a real manufacturer barcode. Prefixed 200-299 is the GS1-reserved
 * range for internal/in-store use — never collides with a real retail
 * product's barcode, which is the whole point of "Yeni Barkod Oluştur".
 */
function generateEan13(): string {
  const prefix = '20' + String(Math.floor(Math.random() * 10))
  const body = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  const digits = (prefix + body).split('').map(Number)
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const checkDigit = (10 - (sum % 10)) % 10
  return digits.join('') + String(checkDigit)
}

type FormState = {
  barcode: string
  name: string
  unit: Product['unit']
  sku: string
  costPriceInput: string
  costPriceTaxInclusive: boolean
  priceInput: string
  priceTaxInclusive: boolean
  taxRate: number
  lowStockThreshold: number
  mainCategoryId: string | null
  subCategoryId: string | null
  addedStock: number
  warehouseId: string
}

function emptyFormState(): FormState {
  return {
    barcode: '', name: '', unit: 'piece', sku: '',
    costPriceInput: '', costPriceTaxInclusive: true,
    priceInput: '', priceTaxInclusive: true,
    taxRate: 0.18, lowStockThreshold: 0,
    mainCategoryId: null, subCategoryId: null,
    addedStock: 0, warehouseId: 'default',
  }
}

/** Converts a decimal-string TL input into kuruş, applying the KDV-dahil toggle. */
function toGrossKurus(input: string, taxInclusive: boolean, taxRate: number): number | null {
  const tl = Number(input.replace(',', '.'))
  if (!Number.isFinite(tl) || tl < 0) return null
  const kurus = Math.round(tl * 100)
  return taxInclusive ? kurus : Math.round(kurus * (1 + taxRate))
}

export function ProductsPanel() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(emptyFormState())
  const [message, setMessage] = useState<string | null>(null)

  const [newMainCategoryName, setNewMainCategoryName] = useState('')
  const [newSubCategoryName, setNewSubCategoryName] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [p, c] = await Promise.all([
        productsApi.listProducts(showInactive),
        categoriesApi.listCategories('product'),
      ])
      setProducts(p)
      setCategories(c)
    } finally {
      setIsLoading(false)
    }
  }, [showInactive])

  useEffect(() => { void load() }, [load])

  const mainCategories = useMemo(() => categories.filter(c => !c.parentId), [categories])
  const subCategoriesOf = useCallback(
    (mainId: string | null) => categories.filter(c => c.parentId === mainId),
    [categories],
  )
  const categoryPath = useCallback((id: string | null) => {
    if (!id) return '—'
    const cat = categories.find(c => c.id === id)
    if (!cat) return '—'
    if (!cat.parentId) return cat.name
    const parent = categories.find(c => c.id === cat.parentId)
    return parent ? `${parent.name} / ${cat.name}` : cat.name
  }, [categories])

  const startEdit = useCallback((p: Product) => {
    const cat = categories.find(c => c.id === p.categoryId)
    const mainCategoryId = cat ? (cat.parentId ?? cat.id) : null
    const subCategoryId = cat?.parentId ? cat.id : null

    setEditingProduct(p)
    setForm({
      barcode: p.barcode[0] ?? '',
      name: p.name,
      unit: p.unit,
      sku: p.sku,
      costPriceInput: p.costPrice != null ? money(p.costPrice) : '',
      costPriceTaxInclusive: true,
      priceInput: money(p.price),
      priceTaxInclusive: true,
      taxRate: p.taxRate,
      lowStockThreshold: p.lowStockThreshold,
      mainCategoryId, subCategoryId,
      addedStock: 0,
      warehouseId: p.warehouseId,
    })
    setShowForm(true)
    setMessage(null)
  }, [categories])

  const startCreate = useCallback(() => {
    setEditingProduct(null)
    setForm(emptyFormState())
    setShowForm(true)
    setMessage(null)
  }, [])

  const handleGenerateBarcode = useCallback(() => {
    setForm(f => ({ ...f, barcode: generateEan13() }))
  }, [])

  const handleCreateMainCategory = useCallback(async () => {
    if (!newMainCategoryName.trim()) return
    const cat = await categoriesApi.createCategory({ name: newMainCategoryName, type: 'product' })
    setNewMainCategoryName('')
    await load()
    setForm(f => ({ ...f, mainCategoryId: cat.id, subCategoryId: null }))
  }, [newMainCategoryName, load])

  const handleCreateSubCategory = useCallback(async () => {
    if (!newSubCategoryName.trim() || !form.mainCategoryId) return
    const cat = await categoriesApi.createCategory({ name: newSubCategoryName, type: 'product', parentId: form.mainCategoryId })
    setNewSubCategoryName('')
    await load()
    setForm(f => ({ ...f, subCategoryId: cat.id }))
  }, [newSubCategoryName, form.mainCategoryId, load])

  const handleSave = useCallback(async () => {
    setMessage(null)
    if (!form.name.trim()) { setMessage('Ürün adı zorunlu.'); return }
    if (!editingProduct && !form.sku.trim()) { setMessage('Ürün kodu zorunlu.'); return }

    const price = toGrossKurus(form.priceInput, form.priceTaxInclusive, form.taxRate)
    if (price === null) { setMessage('Geçerli bir satış fiyatı girin.'); return }
    const costPrice = form.costPriceInput.trim()
      ? toGrossKurus(form.costPriceInput, form.costPriceTaxInclusive, form.taxRate)
      : null
    if (form.costPriceInput.trim() && costPrice === null) { setMessage('Geçerli bir alış fiyatı girin.'); return }

    const categoryId = form.subCategoryId ?? form.mainCategoryId

    try {
      if (editingProduct) {
        const input: UpdateProductInput = {
          name: form.name,
          barcode: form.barcode ? [form.barcode] : [],
          price, costPrice, taxRate: form.taxRate,
          lowStockThreshold: form.lowStockThreshold, unit: form.unit,
          categoryId, warehouseId: form.warehouseId,
        }
        await productsApi.updateProduct(editingProduct.id, input)
        if (form.addedStock > 0) {
          await productsApi.adjustStock(editingProduct.id, form.addedStock, 'Manuel stok girişi (Ürün Düzenleme)')
        }
      } else {
        const input: CreateProductInput = {
          sku: form.sku, name: form.name,
          barcode: form.barcode ? [form.barcode] : [],
          price, costPrice, taxRate: form.taxRate,
          stock: form.addedStock, lowStockThreshold: form.lowStockThreshold,
          unit: form.unit, categoryId, warehouseId: form.warehouseId,
        }
        await productsApi.createProduct(input)
      }
      setShowForm(false)
      setEditingProduct(null)
      await load()
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [form, editingProduct, load])

  const handleToggleActive = useCallback(async (p: Product) => {
    if (p.isActive) {
      await productsApi.deactivateProduct(p.id)
    } else {
      await productsApi.activateProduct(p.id)
    }
    await load()
  }, [load])

  const filtered = products.filter(p =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()),
  )

  const inputClass = 'w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]'
  const labelClass = 'mb-1 block text-xs font-medium text-[var(--color-ink-soft)]'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <input
          type="text"
          placeholder="Ara (ad veya ürün kodu)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
        />
        <button
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            showInactive ? 'bg-[var(--color-copper)] text-white' : 'border border-[var(--color-paper-line)] bg-white'
          }`}
          onClick={() => setShowInactive(v => !v)}
        >
          {showInactive ? 'Pasifler dahil' : 'Sadece aktifler'}
        </button>
        <button
          className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white"
          onClick={startCreate}
        >
          + Yeni Ürün
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-ink-soft)]">
            {editingProduct ? `Ürünü Düzenle — ${editingProduct.name}` : 'Yeni Ürün Ekle'}
          </h3>

          {/* Barkod + Yeni Barkod Oluştur */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <label className={labelClass} htmlFor="pf-barcode">Barkod</label>
              <input id="pf-barcode" type="text" value={form.barcode}
                onChange={e => setForm({ ...form, barcode: e.target.value })}
                className={inputClass} />
            </div>
            <button
              className="self-end rounded-lg bg-[var(--color-petrol)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              onClick={handleGenerateBarcode}
              type="button"
            >
              Yeni Barkod Oluştur
            </button>
          </div>

          {/* Ürün Adı */}
          <div className="mb-3">
            <label className={labelClass} htmlFor="pf-name">Ürün Adı</label>
            <input id="pf-name" type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputClass} />
          </div>

          {/* Birim | Ürün Kodu */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pf-unit">Birim</label>
              <select id="pf-unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as Product['unit'] })} className={inputClass}>
                {(Object.keys(UNIT_LABELS) as Product['unit'][]).map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="pf-sku">Ürün Kodu {editingProduct && '(değiştirilemez)'}</label>
              <input id="pf-sku" type="text" value={form.sku} disabled={!!editingProduct}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                className={`${inputClass} disabled:opacity-50`} />
            </div>
          </div>

          {/* Alış Fiyatı + KDV Dahil | Satış Fiyatı + KDV Dahil */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pf-cost">Alış Fiyatı</label>
              <div className="flex gap-2">
                <input id="pf-cost" type="text" inputMode="decimal" placeholder="ör. 15.00" value={form.costPriceInput}
                  onChange={e => setForm({ ...form, costPriceInput: e.target.value })}
                  className={inputClass} />
                <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 text-xs text-[var(--color-ink-soft)]">
                  <input type="checkbox" checked={form.costPriceTaxInclusive}
                    onChange={e => setForm({ ...form, costPriceTaxInclusive: e.target.checked })} />
                  KDV Dahil
                </label>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="pf-price">Satış Fiyatı</label>
              <div className="flex gap-2">
                <input id="pf-price" type="text" inputMode="decimal" placeholder="ör. 24.90" value={form.priceInput}
                  onChange={e => setForm({ ...form, priceInput: e.target.value })}
                  className={inputClass} />
                <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 text-xs text-[var(--color-ink-soft)]">
                  <input type="checkbox" checked={form.priceTaxInclusive}
                    onChange={e => setForm({ ...form, priceTaxInclusive: e.target.checked })} />
                  KDV Dahil
                </label>
              </div>
            </div>
          </div>

          {/* KDV Oranı | Kritik Stok */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pf-tax">KDV Oranı</label>
              <select id="pf-tax" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })} className={inputClass}>
                {TAX_RATE_OPTIONS.map(r => <option key={r} value={r}>%{Math.round(r * 100)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="pf-critical">Kritik Stok</label>
              <input id="pf-critical" type="number" value={form.lowStockThreshold}
                onChange={e => setForm({ ...form, lowStockThreshold: Number(e.target.value || 0) })}
                className={inputClass} />
            </div>
          </div>

          {/* Ana Kategori | Alt Kategori */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pf-main-cat">Ana Kategori</label>
              <select id="pf-main-cat" value={form.mainCategoryId ?? ''}
                onChange={e => setForm({ ...form, mainCategoryId: e.target.value || null, subCategoryId: null })}
                className={inputClass}>
                <option value="">Kategori yok</option>
                {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="mt-1.5 flex gap-1.5">
                <input type="text" placeholder="+ yeni ana kategori" value={newMainCategoryName}
                  onChange={e => setNewMainCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleCreateMainCategory() }}
                  className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 py-1 text-xs outline-none focus:border-[var(--color-saffron)]" />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="pf-sub-cat">Alt Kategori</label>
              <select id="pf-sub-cat" value={form.subCategoryId ?? ''}
                disabled={!form.mainCategoryId}
                onChange={e => setForm({ ...form, subCategoryId: e.target.value || null })}
                className={`${inputClass} disabled:opacity-50`}>
                <option value="">Alt kategori yok</option>
                {subCategoriesOf(form.mainCategoryId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {form.mainCategoryId && (
                <div className="mt-1.5 flex gap-1.5">
                  <input type="text" placeholder="+ yeni alt kategori" value={newSubCategoryName}
                    onChange={e => setNewSubCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleCreateSubCategory() }}
                    className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 py-1 text-xs outline-none focus:border-[var(--color-saffron)]" />
                </div>
              )}
            </div>
          </div>

          {/* Mevcut Stok | Eklenen Stok */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pf-current-stock">Mevcut Stok</label>
              <input id="pf-current-stock" type="text" disabled
                value={editingProduct ? editingProduct.stock : 0}
                className={`${inputClass} disabled:opacity-60`} />
            </div>
            <div>
              <label className={labelClass} htmlFor="pf-added-stock">
                {editingProduct ? 'Eklenen Stok (bu kayıtla stoğa eklenir)' : 'Başlangıç Stoğu'}
              </label>
              <input id="pf-added-stock" type="number" value={form.addedStock}
                onChange={e => setForm({ ...form, addedStock: Number(e.target.value || 0) })}
                className={inputClass} />
            </div>
          </div>

          {/* Ana Depo */}
          <div className="mb-4">
            <label className={labelClass} htmlFor="pf-warehouse">Ana Depo</label>
            <input id="pf-warehouse" type="text" value={form.warehouseId}
              onChange={e => setForm({ ...form, warehouseId: e.target.value })}
              className={inputClass} />
          </div>

          {message && <div className="mb-3 text-xs text-[var(--color-copper)]">{message}</div>}

          <div className="flex gap-2">
            <button className="rounded-lg border border-[var(--color-paper-line)] bg-white px-6 py-2 text-sm font-medium" onClick={() => setShowForm(false)}>
              İptal
            </button>
            <button className="flex-1 rounded-lg bg-[var(--color-saffron)] py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={handleSave}>
              Kaydet
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Ürün bulunamadı.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                <th className="pb-2 pt-1 text-left font-medium">Ürün Kodu</th>
                <th className="pb-2 pt-1 text-left font-medium">Ad</th>
                <th className="pb-2 pt-1 text-left font-medium">Kategori</th>
                <th className="pb-2 pt-1 text-right font-medium">Alış</th>
                <th className="pb-2 pt-1 text-right font-medium">Satış</th>
                <th className="pb-2 pt-1 text-right font-medium">Stok</th>
                <th className="pb-2 pt-1 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={`border-b border-[var(--color-paper-line)]/60 ${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{p.sku}</td>
                  <td className="py-1.5">{p.name}{!p.isActive && <span className="ml-1.5 text-xs text-[var(--color-copper)]">(pasif)</span>}</td>
                  <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{categoryPath(p.categoryId)}</td>
                  <td className="tabular-money py-1.5 text-right text-xs text-[var(--color-ink-soft)]">{p.costPrice != null ? money(p.costPrice) : '—'}</td>
                  <td className="tabular-money py-1.5 text-right">{money(p.price)}</td>
                  <td className={`tabular-money py-1.5 text-right ${p.stock <= p.lowStockThreshold ? 'text-[var(--color-copper)]' : ''}`}>{p.stock}</td>
                  <td className="py-1.5 text-right">
                    <button className="mr-2 text-xs font-medium text-[var(--color-petrol)] hover:underline" onClick={() => startEdit(p)}>
                      Düzenle
                    </button>
                    <button className="text-xs font-medium text-[var(--color-copper)] hover:underline" onClick={() => void handleToggleActive(p)}>
                      {p.isActive ? 'Pasife Al' : 'Aktifleştir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
