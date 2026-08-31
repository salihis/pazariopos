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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  productsApi, categoriesApi, quickSaleGroupsApi,
  type Product, type Category, type QuickSaleGroup, type CreateProductInput, type UpdateProductInput,
} from '@pazariopos/core'
import { money } from '../lib/format'
import { CameraScanner } from '../components/CameraScanner'

const EXCEL_HEADERS = [
  'Ürün Kodu', 'Barkod', 'Ürün Adı', 'Ana Kategori', 'Alt Kategori', 'Birim',
  'Alış Fiyatı', 'Satış Fiyatı', 'KDV Oranı (%)', 'Kritik Stok', 'Mevcut Stok', 'Durum',
] as const

type ExcelRow = Record<(typeof EXCEL_HEADERS)[number], unknown>

type ImportOutcome = { created: number; updated: number; errors: string[] }

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
  quickSaleGroupId: string | null
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
    quickSaleGroupId: null,
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

export interface ProductsPanelProps {
  /**
   * Pre-fills and auto-opens the create form on mount — used by the Stok
   * Sayım screen's "Ürün Ekle" redirect when a scanned barcode or typed
   * name doesn't match any existing product. Ignored once the user has
   * interacted with the form (only applied on mount, not on every
   * re-render, so it doesn't fight the user's own edits).
   */
  initialCreateValues?: { barcode?: string; name?: string }
  /**
   * Fired after a NEW product is successfully saved (not on edits).
   * The Stok Sayım screen uses this to return to the count and resume
   * right where the user left off, with the just-created product ready
   * to be counted.
   */
  onProductCreated?: (product: Product) => void
}

export function ProductsPanel({ initialCreateValues, onProductCreated }: ProductsPanelProps = {}) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [quickSaleGroups, setQuickSaleGroups] = useState<QuickSaleGroup[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [listCameraOpen, setListCameraOpen] = useState(false)
  const handleListCameraDetected = useCallback((value: string) => {
    setListCameraOpen(false)
    setSearch(value)
  }, [])

  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<FormState>(emptyFormState())
  const [cameraOpen, setCameraOpen] = useState(false)
  const handleCameraDetected = useCallback((value: string) => {
    setCameraOpen(false)
    setForm(f => ({ ...f, barcode: value }))
  }, [])
  const [message, setMessage] = useState<string | null>(null)

  const [newMainCategoryName, setNewMainCategoryName] = useState('')
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [newQuickSaleGroupName, setNewQuickSaleGroupName] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [p, c, g] = await Promise.all([
        productsApi.listProducts(showInactive),
        categoriesApi.listCategories('product'),
        quickSaleGroupsApi.listQuickSaleGroups(),
      ])
      setProducts(p)
      setCategories(c)
      setQuickSaleGroups(g)
    } finally {
      setIsLoading(false)
    }
  }, [showInactive])

  useEffect(() => { void load() }, [load])

  // Apply initialCreateValues exactly once on mount (see ProductsPanelProps
  // comment) — deliberately an empty dependency array so it doesn't
  // re-trigger and stomp on the user's own edits as they fill out the form.
  useEffect(() => {
    if (!initialCreateValues) return
    setEditingProduct(null)
    setForm(f => ({
      ...f,
      barcode: initialCreateValues.barcode ?? f.barcode,
      name: initialCreateValues.name ?? f.name,
    }))
    setShowForm(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // ── Excel dışa aktarma ──
  // Round-trips with the import format below: exported columns match
  // EXCEL_HEADERS exactly, so "export, edit in Excel, re-import" is a
  // supported workflow, not just one-way reporting.
  const handleExport = useCallback(() => {
    const rows: ExcelRow[] = products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId)
      const mainCategory = cat ? categories.find(c => c.id === (cat.parentId ?? cat.id)) : null
      const subCategory = cat?.parentId ? cat : null
      return {
        'Ürün Kodu': p.sku,
        'Barkod': p.barcode.join(', '),
        'Ürün Adı': p.name,
        'Ana Kategori': mainCategory?.name ?? '',
        'Alt Kategori': subCategory?.name ?? '',
        'Birim': UNIT_LABELS[p.unit],
        'Alış Fiyatı': p.costPrice != null ? Number(money(p.costPrice)) : '',
        'Satış Fiyatı': Number(money(p.price)),
        'KDV Oranı (%)': Math.round(p.taxRate * 100),
        'Kritik Stok': p.lowStockThreshold,
        'Mevcut Stok': p.stock,
        'Durum': p.isActive ? 'Aktif' : 'Pasif',
      }
    })
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...EXCEL_HEADERS] })
    sheet['!cols'] = EXCEL_HEADERS.map(h => ({ wch: Math.max(12, h.length + 2) }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Ürünler')
    const dateStamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `urunler-${dateStamp}.xlsx`)
  }, [products, categories])

  // ── Excel içe aktarma ──
  // Matches existing products by "Ürün Kodu" (sku): a match updates
  // that product, no match creates a new one. Category names are
  // resolved against existing categories (case-insensitive) and
  // auto-created if not found — same quick-add UX as the category
  // fields in the form above, so importing a spreadsheet with new
  // category names "just works" without a separate setup step.
  const findOrCreateCategoryId = useCallback(async (
    mainName: string, subName: string, categoryCache: Category[],
  ): Promise<{ categoryId: string | null; categoryCache: Category[] }> => {
    let cache = categoryCache
    if (!mainName.trim()) return { categoryId: null, categoryCache: cache }

    let main = cache.find(c => !c.parentId && c.name.toLowerCase() === mainName.trim().toLowerCase())
    if (!main) {
      main = await categoriesApi.createCategory({ name: mainName.trim(), type: 'product' })
      cache = [...cache, main]
    }
    if (!subName.trim()) return { categoryId: main.id, categoryCache: cache }

    let sub = cache.find(c => c.parentId === main!.id && c.name.toLowerCase() === subName.trim().toLowerCase())
    if (!sub) {
      sub = await categoriesApi.createCategory({ name: subName.trim(), type: 'product', parentId: main.id })
      cache = [...cache, sub]
    }
    return { categoryId: sub.id, categoryCache: cache }
  }, [])

  const handleImportFile = useCallback(async (file: File) => {
    setIsImporting(true)
    setImportOutcome(null)
    const outcome: ImportOutcome = { created: 0, updated: 0, errors: [] }

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]!]
      const rows = XLSX.utils.sheet_to_json<ExcelRow>(firstSheet!, { defval: '' })

      let categoryCache = categories
      let productCache = products

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!
        const rowLabel = `Satır ${i + 2}` // +2: header row + 1-indexing

        const sku = String(row['Ürün Kodu'] ?? '').trim()
        const name = String(row['Ürün Adı'] ?? '').trim()
        const priceValue = Number(row['Satış Fiyatı'])

        if (!name) { outcome.errors.push(`${rowLabel}: Ürün adı boş, atlandı.`); continue }
        if (!Number.isFinite(priceValue) || priceValue < 0) {
          outcome.errors.push(`${rowLabel}: Geçersiz satış fiyatı, atlandı.`)
          continue
        }

        const barcode = String(row['Barkod'] ?? '').split(',').map(s => s.trim()).filter(Boolean)
        const unitLabel = String(row['Birim'] ?? '').trim()
        const unit = (Object.keys(UNIT_LABELS) as Product['unit'][]).find(
          u => UNIT_LABELS[u].toLowerCase() === unitLabel.toLowerCase(),
        ) ?? 'piece'
        const costPriceValue = Number(row['Alış Fiyatı'])
        const costPrice = Number.isFinite(costPriceValue) && String(row['Alış Fiyatı']).trim() !== ''
          ? Math.round(costPriceValue * 100) : null
        const taxRateValue = Number(row['KDV Oranı (%)'])
        const taxRate = Number.isFinite(taxRateValue) ? taxRateValue / 100 : 0.20
        const lowStockThreshold = Number(row['Kritik Stok']) || 0
        const stock = Number(row['Mevcut Stok']) || 0
        const statusValue = String(row['Durum'] ?? '').trim().toLowerCase()

        try {
          const { categoryId, categoryCache: nextCache } = await findOrCreateCategoryId(
            String(row['Ana Kategori'] ?? ''), String(row['Alt Kategori'] ?? ''), categoryCache,
          )
          categoryCache = nextCache

          const existing = sku ? productCache.find(p => p.sku === sku) : undefined

          if (existing) {
            const input: UpdateProductInput = {
              name, barcode, price: Math.round(priceValue * 100), costPrice, taxRate,
              lowStockThreshold, unit, categoryId, warehouseId: existing.warehouseId,
            }
            const updated = await productsApi.updateProduct(existing.id, input)
            if (statusValue === 'pasif' && updated.isActive) await productsApi.deactivateProduct(updated.id)
            else if (statusValue === 'aktif' && !updated.isActive) await productsApi.activateProduct(updated.id)
            productCache = productCache.map(p => (p.id === existing.id ? updated : p))
            outcome.updated++
          } else {
            if (!sku) { outcome.errors.push(`${rowLabel}: Yeni ürün için "Ürün Kodu" zorunlu, atlandı.`); continue }
            const input: CreateProductInput = {
              sku, name, barcode, price: Math.round(priceValue * 100), costPrice, taxRate,
              stock, lowStockThreshold, unit, categoryId,
            }
            const created = await productsApi.createProduct(input)
            productCache = [...productCache, created]
            outcome.created++
          }
        } catch (err) {
          outcome.errors.push(`${rowLabel} (${sku || name}): ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      setImportOutcome(outcome)
      await load()
    } catch (err) {
      setImportOutcome({ created: 0, updated: 0, errors: [`Dosya okunamadı: ${err instanceof Error ? err.message : String(err)}`] })
    } finally {
      setIsImporting(false)
    }
  }, [categories, products, findOrCreateCategoryId, load])

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
      quickSaleGroupId: p.quickSaleGroupId,
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

  const [quickSaleGroupError, setQuickSaleGroupError] = useState<string | null>(null)
  const handleCreateQuickSaleGroup = useCallback(async () => {
    if (!newQuickSaleGroupName.trim()) return
    setQuickSaleGroupError(null)
    try {
      const group = await quickSaleGroupsApi.createQuickSaleGroup({ name: newQuickSaleGroupName.trim() })
      setNewQuickSaleGroupName('')
      await load()
      setForm(f => ({ ...f, quickSaleGroupId: group.id }))
    } catch (err) {
      setQuickSaleGroupError(err instanceof Error ? err.message : 'Grup eklenemedi.')
    }
  }, [newQuickSaleGroupName, load])

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
          categoryId, quickSaleGroupId: form.quickSaleGroupId, warehouseId: form.warehouseId,
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
          unit: form.unit, categoryId, quickSaleGroupId: form.quickSaleGroupId, warehouseId: form.warehouseId,
        }
        const created = await productsApi.createProduct(input)
        onProductCreated?.(created)
      }
      setShowForm(false)
      setEditingProduct(null)
      await load()
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [form, editingProduct, load, onProductCreated])

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
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.some(b => b.toLowerCase().includes(search.toLowerCase())),
  )

  const inputClass = 'w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]'
  const labelClass = 'mb-1 block text-xs font-medium text-[var(--color-ink-soft)]'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <input
          type="text"
          placeholder="Ara (ad, ürün kodu veya barkod)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
        />
        <button
          className="rounded-lg border border-[var(--color-saffron)] bg-[var(--color-saffron)]/10 px-3 py-2 text-sm font-medium text-[var(--color-petrol)] transition hover:bg-[var(--color-saffron)]/20"
          onClick={() => setListCameraOpen(true)}
          type="button"
        >
          📷 Kamerayla Tara
        </button>
        {listCameraOpen && (
          <CameraScanner
            title="Kamerayla Ürün Ara"
            onDetected={handleListCameraDetected}
            onClose={() => setListCameraOpen(false)}
          />
        )}
        <button
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            showInactive ? 'bg-[var(--color-copper)] text-white' : 'border border-[var(--color-paper-line)] bg-white'
          }`}
          onClick={() => setShowInactive(v => !v)}
        >
          {showInactive ? 'Pasifler dahil' : 'Sadece aktifler'}
        </button>
        <button
          className="rounded-lg border border-[var(--color-olive)] px-3 py-2 text-sm font-medium text-[var(--color-olive)] transition hover:bg-[var(--color-olive)] hover:text-white"
          onClick={handleExport}
          type="button"
        >
          📤 Excel'e Aktar
        </button>
        <button
          className="rounded-lg border border-[var(--color-petrol)] px-3 py-2 text-sm font-medium text-[var(--color-petrol)] transition hover:bg-[var(--color-petrol)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          type="button"
        >
          {isImporting ? 'İçe aktarılıyor…' : '📥 Excel\'den İçe Aktar'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = '' // allow re-selecting the same file next time
          }}
        />
        <button
          className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white"
          onClick={startCreate}
        >
          + Yeni Ürün
        </button>
      </div>

      {importOutcome && (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4 text-sm">
          <div className="font-medium">
            İçe aktarma tamamlandı: <span className="text-[var(--color-olive)]">{importOutcome.created} yeni</span>,{' '}
            <span className="text-[var(--color-petrol)]">{importOutcome.updated} güncellendi</span>
            {importOutcome.errors.length > 0 && (
              <span className="text-[var(--color-copper)]">, {importOutcome.errors.length} hata</span>
            )}
          </div>
          {importOutcome.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-[var(--color-copper)]">
              {importOutcome.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
          <button className="mt-2 text-xs text-[var(--color-ink-soft)] hover:underline" onClick={() => setImportOutcome(null)}>
            Kapat
          </button>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-ink-soft)]">
            {editingProduct ? `Ürünü Düzenle — ${editingProduct.name}` : 'Yeni Ürün Ekle'}
          </h3>

          {/* Barkod + Kamerayla Tara + Yeni Barkod Oluştur */}
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
            <div>
              <label className={labelClass} htmlFor="pf-barcode">Barkod</label>
              <input id="pf-barcode" type="text" value={form.barcode}
                onChange={e => setForm({ ...form, barcode: e.target.value })}
                className={inputClass} />
            </div>
            <button
              className="self-end rounded-lg border border-[var(--color-saffron)] bg-[var(--color-saffron)]/10 px-4 py-2 text-sm font-medium text-[var(--color-petrol)] transition hover:bg-[var(--color-saffron)]/20"
              onClick={() => setCameraOpen(true)}
              type="button"
            >
              📷 Kamerayla Tara
            </button>
            <button
              className="self-end rounded-lg bg-[var(--color-petrol)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              onClick={handleGenerateBarcode}
              type="button"
            >
              Yeni Barkod Oluştur
            </button>
          </div>

          {cameraOpen && (
            <CameraScanner
              title="Kamerayla Barkod Tara"
              onDetected={handleCameraDetected}
              onClose={() => setCameraOpen(false)}
            />
          )}

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

          {/* Hızlı Ürün Grubu — kategoriden bağımsız, sadece Hızlı Satış
              ekranındaki "Hızlı Ürünler" kutucuk grid'inde bu ürünün
              görünüp görünmeyeceğini ve hangi sekmede çıkacağını belirler. */}
          <div className="mb-3">
            <label className={labelClass} htmlFor="pf-quick-group">
              Hızlı Ürün Grubu <span className="font-normal text-[var(--color-ink-soft)]">(Hızlı Satış ekranında gösterilecekse seçin)</span>
            </label>
            <select id="pf-quick-group" value={form.quickSaleGroupId ?? ''}
              onChange={e => setForm({ ...form, quickSaleGroupId: e.target.value || null })}
              className={inputClass}>
              <option value="">Hızlı Satış'ta gösterme</option>
              {quickSaleGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <div className="mt-1.5 flex gap-1.5">
              <input type="text" placeholder="+ yeni hızlı ürün grubu" value={newQuickSaleGroupName}
                onChange={e => setNewQuickSaleGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleCreateQuickSaleGroup() }}
                className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 py-1 text-xs outline-none focus:border-[var(--color-saffron)]" />
              <button type="button" onClick={() => void handleCreateQuickSaleGroup()}
                className="rounded-lg border border-[var(--color-saffron)] bg-[var(--color-saffron)]/10 px-3 py-1 text-xs font-medium text-[var(--color-petrol)] transition hover:bg-[var(--color-saffron)]/20">
                Ekle
              </button>
            </div>
            {quickSaleGroupError && (
              <div className="mt-1.5 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-2.5 py-1.5 text-xs text-[var(--color-copper)]">
                {quickSaleGroupError}
              </div>
            )}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                <th className="pb-2 pt-1 text-left font-medium">Ürün Kodu</th>
                <th className="pb-2 pt-1 text-left font-medium">Ad</th>
                <th className="pb-2 pt-1 text-left font-medium">Kategori</th>
                <th className="pb-2 pt-1 text-left font-medium">Hızlı Ürün Grubu</th>
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
                  <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">
                    {p.quickSaleGroupId ? (quickSaleGroups.find(g => g.id === p.quickSaleGroupId)?.name ?? '—') : '—'}
                  </td>
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
          </div>
        )}
      </div>
    </div>
  )
}
