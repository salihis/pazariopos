// packages/ui/src/BackOffice/StockCountScreen.tsx
// ─────────────────────────────────────────────────────────────
// Stok Sayım (physical inventory count).
//
// Flow:
//   1. On mount, resumes the caller's open draft from the server (or
//      starts a new one) — useStockCountStore.loadOrStartDraft(). This
//      is what makes the count survive a page reload or continuing
//      from a different device (see useStockCountStore.ts comment).
//   2. Barkod okuyucu veya ürün adı ile arama — same search pattern as
//      PosScreen (exact barcode match first, then a name-search
//      dropdown for 3+ characters).
//   3. Found → the product is staged in a "Sayılan Miktar" entry card;
//      confirming records it against the draft (server-persisted).
//   4. NOT found → redirects into ProductsPanel's create form (prefilled
//      with whatever was scanned/typed). After the product is saved,
//      the screen returns here with that product already staged for
//      quantity entry — "kaldığım yerden devam" per the redirect.
//   5. "Sayımı Aktar" — writes every counted item onto Product.stock
//      and closes the count (routes/stockCounts.ts POST /:id/complete).
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useInventoryStore, useStockCountStore,
  type Product,
} from '@pazariopos/core'
import { formatDate } from '../lib/format'
import { ProductsPanel } from './ProductsPanel'

export function StockCountScreen() {
  const products         = useInventoryStore(s => s.products)
  const findByBarcode    = useInventoryStore(s => s.findByBarcode)
  const loadProducts     = useInventoryStore(s => s.loadProducts)

  const current           = useStockCountStore(s => s.current)
  const isLoading         = useStockCountStore(s => s.isLoading)
  const isSaving          = useStockCountStore(s => s.isSaving)
  const isCompleting      = useStockCountStore(s => s.isCompleting)
  const storeError        = useStockCountStore(s => s.error)
  const loadOrStartDraft  = useStockCountStore(s => s.loadOrStartDraft)
  const countProduct      = useStockCountStore(s => s.countProduct)
  const removeItem        = useStockCountStore(s => s.removeItem)
  const completeCount     = useStockCountStore(s => s.completeCount)
  const clearCurrent      = useStockCountStore(s => s.clearCurrent)

  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // The product currently staged for "Sayılan Miktar" entry.
  const [activeProduct, setActiveProduct] = useState<Product | null>(null)
  const [qtyInput, setQtyInput] = useState('')
  const qtyInputRef = useRef<HTMLInputElement>(null)

  // Set when a scan/search finds no match — redirects into the product
  // create form. Holds whatever was typed so the form can pre-fill it.
  const [creatingProduct, setCreatingProduct] = useState<{ barcode?: string; name?: string } | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [completedSummary, setCompletedSummary] = useState<{ itemCount: number } | null>(null)

  useEffect(() => { void loadOrStartDraft() }, [loadOrStartDraft])

  // Focus the quantity field as soon as a product is staged.
  useEffect(() => {
    if (activeProduct) qtyInputRef.current?.focus()
  }, [activeProduct])

  const trimmedSearchQuery = searchQuery.trim()
  const searchSuggestions =
    trimmedSearchQuery.length >= 3
      ? products
          .filter(p => p.name.toLocaleLowerCase('tr').includes(trimmedSearchQuery.toLocaleLowerCase('tr')))
          .slice(0, 8)
      : []

  const stageProduct = useCallback((product: Product) => {
    // If this product was already counted in this session, prefill with
    // that value so re-scanning it to correct a typo doesn't reset to 0.
    const existing = current?.items.find(i => i.productId === product.id)
    setActiveProduct(product)
    setQtyInput(existing ? String(existing.countedStock) : '')
    setSearchQuery('')
    setShowSuggestions(false)
    setFeedback(null)
  }, [current])

  const handleSelectSearchResult = useCallback((product: Product) => {
    stageProduct(product)
  }, [stageProduct])

  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim()
    if (!query) return

    const product = findByBarcode(query)
    if (product) {
      stageProduct(product)
      return
    }

    if (searchSuggestions.length === 1) {
      const [onlyMatch] = searchSuggestions
      if (onlyMatch) { stageProduct(onlyMatch); return }
    }

    if (searchSuggestions.length > 1) {
      // Ambiguous name match — keep the dropdown open instead of guessing.
      setShowSuggestions(true)
      return
    }

    // Nothing matched at all → redirect to "Ürün Ekle", pre-filled with
    // whatever was scanned/typed. A pure-digit query is almost certainly
    // a barcode; anything else is treated as a name.
    const looksLikeBarcode = /^\d{6,}$/.test(query)
    setCreatingProduct(looksLikeBarcode ? { barcode: query } : { name: query })
    setSearchQuery('')
    setShowSuggestions(false)
  }, [searchQuery, findByBarcode, searchSuggestions, stageProduct])

  const handleConfirmQuantity = useCallback(async () => {
    if (!activeProduct) return
    const qty = Number(qtyInput)
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      setFeedback('Geçerli bir miktar girin (0 veya üzeri tam sayı).')
      return
    }
    await countProduct(activeProduct.id, qty)
    setFeedback(`Sayıldı: ${activeProduct.name} → ${qty}`)
    setActiveProduct(null)
    setQtyInput('')
    searchInputRef.current?.focus()
  }, [activeProduct, qtyInput, countProduct])

  const handleCancelQuantity = useCallback(() => {
    setActiveProduct(null)
    setQtyInput('')
    searchInputRef.current?.focus()
  }, [])

  // ── Redirect-and-return: a new product was just created ──
  const handleProductCreated = useCallback(async (product: Product) => {
    // The global catalog cache (useInventoryStore) doesn't know about
    // this product yet — refresh it so barcode/name lookups (including
    // stageProduct's "already counted?" check) see it immediately.
    await loadProducts()
    setCreatingProduct(null)
    stageProduct(product)
  }, [loadProducts, stageProduct])

  const handleCancelCreate = useCallback(() => {
    setCreatingProduct(null)
    searchInputRef.current?.focus()
  }, [])

  const handleRemoveItem = useCallback(async (productId: string) => {
    await removeItem(productId)
  }, [removeItem])

  const handleComplete = useCallback(async () => {
    if (!current || current.items.length === 0) return
    const confirmed = window.confirm(
      `${current.items.length} ürünün sayılan miktarı stoğa aktarılacak. Bu işlem geri alınamaz. Devam edilsin mi?`,
    )
    if (!confirmed) return

    const completed = await completeCount()
    setCompletedSummary({ itemCount: completed.items.length })
    await loadProducts() // refresh catalog so PosScreen/ProductsPanel show the new stock levels
  }, [current, completeCount, loadProducts])

  const handleStartNewCount = useCallback(async () => {
    setCompletedSummary(null)
    clearCurrent()
    await loadOrStartDraft()
  }, [clearCurrent, loadOrStartDraft])

  const inputClass = 'w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]'

  // ── Redirected to "Ürün Ekle" ──
  if (creatingProduct) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--color-saffron)]/40 bg-[var(--color-saffron-light)]/15 px-4 py-3">
          <p className="text-sm text-[var(--color-ink)]">
            <span className="font-semibold">Ürün bulunamadı</span> — yeni ürünü ekleyin, kaydedince sayıma kaldığınız yerden devam edersiniz.
          </p>
          <button
            className="shrink-0 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-1.5 text-xs font-medium"
            onClick={handleCancelCreate}
          >
            ← Sayıma Dön
          </button>
        </div>
        <ProductsPanel initialCreateValues={creatingProduct} onProductCreated={product => void handleProductCreated(product)} />
      </div>
    )
  }

  if (isLoading) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Sayım yükleniyor…</p>
  }

  // ── Just completed ──
  if (completedSummary) {
    return (
      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-6 text-center">
        <p className="mb-2 text-lg font-semibold text-[var(--color-ink)]">✅ Sayım aktarıldı</p>
        <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
          {completedSummary.itemCount} ürünün stoğu, sayılan miktarlarla güncellendi.
        </p>
        <button
          className="rounded-lg bg-[var(--color-saffron)] px-6 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white"
          onClick={() => void handleStartNewCount()}
        >
          Yeni Sayım Başlat
        </button>
      </div>
    )
  }

  const items = current?.items ?? []

  return (
    <div className="space-y-4">
      {storeError && (
        <div className="rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-3 py-2 text-sm text-[var(--color-copper)]">
          {storeError}
        </div>
      )}

      {/* ── Arama / barkod okutma ── */}
      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="stockcount-search">
          Barkod veya Ürün Adı
        </label>
        <div className="relative">
          <input
            id="stockcount-search"
            ref={searchInputRef}
            type="text"
            autoFocus
            value={searchQuery}
            placeholder="Barkod okutun veya ürün adı yazın (en az 3 harf)…"
            onChange={e => {
              setSearchQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { handleSearchSubmit() }
              else if (e.key === 'Escape') { setSearchQuery(''); setShowSuggestions(false) }
            }}
            disabled={!!activeProduct}
            className={`${inputClass} disabled:opacity-50`}
          />
          {showSuggestions && trimmedSearchQuery.length >= 3 && searchSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[var(--color-paper-line)] bg-white shadow-md">
              {searchSuggestions.map(product => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-saffron-light)]/20"
                  onClick={() => handleSelectSearchResult(product)}
                >
                  <span>{product.name}</span>
                  <span className="text-xs text-[var(--color-ink-soft)]">Stok: {product.stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">
          Okuyucu HID modunda barkodu ve Enter tuşunu otomatik yazar. Bulunamayan ürünler için Ürün Ekle ekranına yönlendirilirsiniz.
        </p>
        {feedback && <p className="mt-2 text-xs font-medium text-[var(--color-olive)]">{feedback}</p>}
      </div>

      {/* ── Sayılan miktar giriş kartı ── */}
      {activeProduct && (
        <div className="rounded-2xl border border-[var(--color-saffron)] bg-[var(--color-saffron-light)]/15 p-4">
          <p className="mb-0.5 text-sm font-semibold text-[var(--color-ink)]">{activeProduct.name}</p>
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            {activeProduct.sku} · Sistemde kayıtlı stok: {activeProduct.stock}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="stockcount-qty">
                Sayılan Miktar
              </label>
              <input
                id="stockcount-qty"
                ref={qtyInputRef}
                type="number"
                min={0}
                step={1}
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleConfirmQuantity() }}
                className={inputClass}
              />
            </div>
            <button
              className="rounded-lg border border-[var(--color-paper-line)] bg-white px-4 py-2 text-sm font-medium"
              onClick={handleCancelQuantity}
            >
              İptal
            </button>
            <button
              className="rounded-lg bg-[var(--color-saffron)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-saffron-dark)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleConfirmQuantity()}
              disabled={isSaving}
            >
              {isSaving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* ── Sayılan ürünler listesi ── */}
      <div className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            Sayılan Ürünler {items.length > 0 && <span className="text-[var(--color-ink-soft)]">({items.length})</span>}
          </p>
          {current?.startedAt && (
            <p className="text-xs text-[var(--color-ink-soft)]">Başlangıç: {formatDate(current.startedAt)}</p>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Henüz sayılan ürün yok. Yukarıdan barkod okutun veya ürün adı yazın.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                  <th className="pb-2 pt-1 text-left font-medium">Ürün Kodu</th>
                  <th className="pb-2 pt-1 text-left font-medium">Ad</th>
                  <th className="pb-2 pt-1 text-right font-medium">Önceki Stok</th>
                  <th className="pb-2 pt-1 text-right font-medium">Sayılan</th>
                  <th className="pb-2 pt-1 text-right font-medium">Fark</th>
                  <th className="pb-2 pt-1 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const diff = item.countedStock - item.previousStock
                  return (
                    <tr key={item.id} className="border-b border-[var(--color-paper-line)]/60">
                      <td className="py-1.5 text-xs text-[var(--color-ink-soft)]">{item.productSku}</td>
                      <td className="py-1.5">{item.productName}</td>
                      <td className="py-1.5 text-right text-[var(--color-ink-soft)]">{item.previousStock}</td>
                      <td className="py-1.5 text-right font-medium">{item.countedStock}</td>
                      <td className={`py-1.5 text-right ${diff === 0 ? 'text-[var(--color-ink-soft)]' : diff > 0 ? 'text-[var(--color-olive)]' : 'text-[var(--color-copper)]'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          className="text-xs font-medium text-[var(--color-copper)] hover:underline"
                          onClick={() => void handleRemoveItem(item.productId)}
                        >
                          Kaldır
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            className="rounded-lg bg-[var(--color-petrol)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleComplete()}
            disabled={items.length === 0 || isCompleting}
          >
            {isCompleting ? 'Aktarılıyor…' : 'Sayımı Aktar'}
          </button>
        </div>
      </div>
    </div>
  )
}
