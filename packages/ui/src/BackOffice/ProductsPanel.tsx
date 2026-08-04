// packages/ui/src/BackOffice/ProductsPanel.tsx
// ─────────────────────────────────────────────────────────────
// Ürün Yönetimi — full product catalog management: create, edit,
// deactivate/reactivate (soft-delete — see products.ts route comment
// on why there's no hard DELETE), and product categories (a
// Category row with type='product', same table Finans's
// Gelir/Gider categories use, just a different `type`).
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import {
  productsApi, categoriesApi,
  type Product, type Category, type CreateProductInput, type UpdateProductInput,
} from '@pazariopos/core'
import { money } from '../lib/format'

const UNIT_LABELS: Record<Product['unit'], string> = {
  piece: 'Adet', box: 'Kutu', kg: 'Kg', lt: 'Lt',
}

function emptyForm(): CreateProductInput & { id?: string } {
  return {
    sku: '', name: '', barcode: [], price: 0, taxRate: 0.18,
    stock: 0, lowStockThreshold: 0, unit: 'piece', categoryId: null, warehouseId: 'default',
  }
}

export function ProductsPanel() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateProductInput & { id?: string }>(emptyForm())
  const [priceInput, setPriceInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const [newCategoryName, setNewCategoryName] = useState('')

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

  const startEdit = useCallback((p: Product) => {
    setEditingId(p.id)
    setForm({
      sku: p.sku, name: p.name, barcode: p.barcode, price: p.price, taxRate: p.taxRate,
      lowStockThreshold: p.lowStockThreshold, unit: p.unit, categoryId: p.categoryId, warehouseId: p.warehouseId,
    })
    setPriceInput(money(p.price))
    setShowForm(true)
    setMessage(null)
  }, [])

  const startCreate = useCallback(() => {
    setEditingId(null)
    setForm(emptyForm())
    setPriceInput('')
    setShowForm(true)
    setMessage(null)
  }, [])

  const handleSave = useCallback(async () => {
    setMessage(null)
    if (!form.name.trim()) { setMessage('Ürün adı zorunlu.'); return }
    if (!editingId && !form.sku.trim()) { setMessage('SKU zorunlu.'); return }

    const priceKurus = Math.round(Number(priceInput.replace(',', '.') || 0) * 100)
    if (!Number.isFinite(priceKurus) || priceKurus < 0) { setMessage('Geçerli bir fiyat girin.'); return }

    try {
      if (editingId) {
        const input: UpdateProductInput = {
          name: form.name, barcode: form.barcode ?? [], price: priceKurus, taxRate: form.taxRate,
          lowStockThreshold: form.lowStockThreshold ?? 0, unit: form.unit ?? 'piece',
          categoryId: form.categoryId, warehouseId: form.warehouseId ?? 'default',
        }
        await productsApi.updateProduct(editingId, input)
      } else {
        await productsApi.createProduct({ ...form, price: priceKurus })
      }
      setShowForm(false)
      setEditingId(null)
      await load()
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [form, priceInput, editingId, load])

  const handleToggleActive = useCallback(async (p: Product) => {
    if (p.isActive) {
      await productsApi.deactivateProduct(p.id)
    } else {
      await productsApi.activateProduct(p.id)
    }
    await load()
  }, [load])

  const handleCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim()) return
    await categoriesApi.createCategory({ name: newCategoryName, type: 'product' })
    setNewCategoryName('')
    await load()
  }, [newCategoryName, load])

  const filtered = products.filter(p =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()),
  )

  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <input
          type="text"
          placeholder="Ara (ad veya SKU)"
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

      {/* Category quick-add */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <span className="text-xs font-medium text-[var(--color-ink-soft)]">Ürün Kategorileri:</span>
        {categories.map(c => (
          <span key={c.id} className="rounded-full border border-[var(--color-paper-line)] bg-white px-2.5 py-1 text-xs">{c.name}</span>
        ))}
        <input
          type="text"
          placeholder="+ yeni kategori"
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleCreateCategory() }}
          className="w-36 rounded-lg border border-[var(--color-paper-line)] bg-white px-2.5 py-1 text-xs outline-none focus:border-[var(--color-saffron)]"
        />
      </div>

      {showForm && (
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-4 md:grid-cols-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink-soft)] md:col-span-3">
            {editingId ? 'Ürünü Düzenle' : 'Yeni Ürün'}
          </h3>
          <input type="text" placeholder="SKU *" value={form.sku} disabled={!!editingId}
            onChange={e => setForm({ ...form, sku: e.target.value })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)] disabled:opacity-50" />
          <input type="text" placeholder="Ürün adı *" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <input type="text" placeholder="Barkod (virgülle ayır)" value={(form.barcode ?? []).join(', ')}
            onChange={e => setForm({ ...form, barcode: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <input type="text" inputMode="decimal" placeholder="Fiyat (KDV dahil) *" value={priceInput}
            onChange={e => setPriceInput(e.target.value)}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          <select value={form.taxRate} onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]">
            <option value={0.01}>%1 KDV</option>
            <option value={0.10}>%10 KDV</option>
            <option value={0.20}>%20 KDV</option>
          </select>
          <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as Product['unit'] })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]">
            {(Object.keys(UNIT_LABELS) as Product['unit'][]).map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
          <select value={form.categoryId ?? ''} onChange={e => setForm({ ...form, categoryId: e.target.value || null })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]">
            <option value="">Kategori yok</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" placeholder="Düşük stok eşiği" value={form.lowStockThreshold ?? 0}
            onChange={e => setForm({ ...form, lowStockThreshold: Number(e.target.value || 0) })}
            className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          {!editingId && (
            <input type="number" placeholder="Başlangıç stoğu" value={form.stock ?? 0}
              onChange={e => setForm({ ...form, stock: Number(e.target.value || 0) })}
              className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]" />
          )}
          <div className="flex gap-2 md:col-span-3">
            <button className="flex-1 rounded-lg bg-[var(--color-saffron)] py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white" onClick={handleSave}>
              Kaydet
            </button>
            <button className="rounded-lg border border-[var(--color-paper-line)] bg-white px-4 py-2 text-sm font-medium" onClick={() => setShowForm(false)}>
              Vazgeç
            </button>
          </div>
          {message && <div className="text-xs text-[var(--color-copper)] md:col-span-3">{message}</div>}
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
                <th className="pb-2 pt-1 text-left font-medium">SKU</th>
                <th className="pb-2 pt-1 text-left font-medium">Ad</th>
                <th className="pb-2 pt-1 text-left font-medium">Kategori</th>
                <th className="pb-2 pt-1 text-right font-medium">Fiyat</th>
                <th className="pb-2 pt-1 text-right font-medium">Stok</th>
                <th className="pb-2 pt-1 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={`border-b border-[var(--color-paper-line)]/60 ${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{p.sku}</td>
                  <td className="py-1.5">{p.name}{!p.isActive && <span className="ml-1.5 text-xs text-[var(--color-copper)]">(pasif)</span>}</td>
                  <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{categoryName(p.categoryId)}</td>
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
