// packages/ui/src/PosScreen.tsx
// ─────────────────────────────────────────────────────────────
// "Hello World" POS screen.
// Wires together every piece built for this deliverable:
//   • BarcodeService   (hybrid: Tauri event / HID keyboard-wedge)
//   • PrinterService   (Tauri ESC/POS / browser print window)
//   • useSaleStore     (offline-queue-or-online submit branch)
//   • AccountBalanceService (throws when offline — demoed via a button)
//
// This component is platform-agnostic: apps/web and apps/desktop
// both mount it verbatim. All platform branching already happened
// inside @pazariopos/core's factories.
//
// UI text is in Turkish (user-facing labels only — code, comments,
// and identifiers stay in English per CODING_GUIDELINES.md).
//
// Styling: Tailwind v4 + the PazarioPOS design tokens defined in
// styles.css ("Pazario" ← Turkish "pazar"/bazaar — warm paper-ledger
// surface, petrol + saffron market-awning accents, and a signature
// mechanical-register digit display for the cart total).
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from 'react'

import {
  useSaleStore,
  useInventoryStore,
  useAccountStore,
  useAuthStore,
  getBarcodeService,
  getPrinterService,
  OfflineBalanceError,
  quickSaleGroupsApi,
  MISC_SALE_PRODUCT_ID,
  type Product,
  type CartLine,
  type QuickSaleGroup,
} from '@pazariopos/core'
import { money, parseMoneyInput } from './lib/format'
import { BackOfficeScreen } from './BackOffice/BackOfficeScreen'
import { CameraScanner } from './components/CameraScanner'

// `priceTier`: 1 = product.price ("Fiyat 1"), 2 = product.price2 ("Fiyat 2").
// Falls back to Fiyat 1 whenever a product has no Fiyat 2 set (most
// products — Fiyat 2 is optional, e.g. for wholesale/bayi customers).
function productToCartLine(product: Product, quantity = 1, priceTier: 1 | 2 = 1): CartLine {
  const discountAmount = 0

  // product.price is the tax-INCLUSIVE (KDV dahil) shelf/barcode price —
  // this is what's actually charged, and what's shown on the Quick-Add
  // card. The net (KDV hariç) price and the tax amount must be derived
  // by DIVIDING the gross price, not by adding tax on top of it.
  //
  // Example (KDV %10, gross 32.00 TL):
  //   netUnitPrice = 32.00 / 1.10 = 29.09
  //   taxAmount    = 32.00 - 29.09 = 2.91
  //   netUnitPrice + taxAmount = 32.00  ✓ (matches the shelf price exactly)
  const grossUnitPrice = (priceTier === 2 ? product.price2 : null) ?? product.price
  const netUnitPrice = Math.round(grossUnitPrice / (1 + product.taxRate))
  const taxAmount = grossUnitPrice - netUnitPrice

  return {
    product,
    quantity,
    unitPrice: netUnitPrice,   // net (KDV hariç) — CartLine.unitPrice is always tax-exclusive
    discountAmount,
    taxAmount,                 // per-unit tax (KDV) amount
    total: (netUnitPrice - discountAmount + taxAmount) * quantity,
  }
}

// ── Component ────────────────────────────────────────────────

export function PosScreen() {
  const cart            = useSaleStore(s => s.cart)
  const customerId      = useSaleStore(s => s.customerId)
  const setCustomer     = useSaleStore(s => s.setCustomer)
  const slots            = useSaleStore(s => s.slots)
  const activeSlotIndex  = useSaleStore(s => s.activeSlotIndex)
  const setActiveSlot    = useSaleStore(s => s.setActiveSlot)
  const networkStatus   = useSaleStore(s => s.networkStatus)
  const pendingCount     = useSaleStore(s => s.pendingCount)
  const isSyncing        = useSaleStore(s => s.isSyncing)
  const lastSyncError    = useSaleStore(s => s.lastSyncError)
  const addLine          = useSaleStore(s => s.addLine)
  const removeLine       = useSaleStore(s => s.removeLine)
  const submitSale       = useSaleStore(s => s.submitSale)
  const checkAccountBalance = useSaleStore(s => s.checkAccountBalance)

  const products          = useInventoryStore(s => s.products)
  const isCatalogLoading  = useInventoryStore(s => s.isLoading)
  const catalogError      = useInventoryStore(s => s.error)
  const loadProducts      = useInventoryStore(s => s.loadProducts)
  const findByBarcode     = useInventoryStore(s => s.findByBarcode)

  const customerAccounts = useAccountStore(s => s.accounts)
  const loadAccounts     = useAccountStore(s => s.loadAccounts)
  const recordPayment    = useAccountStore(s => s.recordPayment)

  const currentUser      = useAuthStore(s => s.currentUser)

  // ── Fiyat 1 / Fiyat 2 selector — which of the product's two selling
  //    prices to charge (e.g. Fiyat 2 for a wholesale/bayi customer).
  //    Applies to every item added from this point on (scan, quick-add
  //    tile, or search) until changed back. Products with no Fiyat 2
  //    set fall back to Fiyat 1 regardless of this setting — see
  //    productToCartLine. ──
  const [priceTier, setPriceTier] = useState<1 | 2>(1)
  const isAuthenticating = useAuthStore(s => s.isAuthenticating)
  const authError        = useAuthStore(s => s.error)
  const login            = useAuthStore(s => s.login)
  const logout           = useAuthStore(s => s.logout)

  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [lastReceiptStatus, setLastReceiptStatus] = useState<string | null>(null)
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null)
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  // Back-office is only meaningful once logged in — gated to
  // admin/accountant in the header button below, mirroring the
  // server's RBAC on the routes those screens call.
  const [view, setView] = useState<'pos' | 'backoffice'>('pos')
  // "Ürün bulunamadı" — what PosScreen hands off to BackOfficeScreen's
  // Ürünler tab when the cashier picks "Ürün Ekle" for a scanned/typed
  // value that matched no product (see resolveScannedValue below).
  const [productCreateHandoff, setProductCreateHandoff] = useState<{ barcode?: string; name?: string } | null>(null)

  // ── Restore a previously-saved session, if any (Auth Phase 1) ──
  useEffect(() => {
    void useAuthStore.getState().init()
  }, [])

  // ── Init store lifecycle (network monitor + queue seed) ────
  useEffect(() => {
    const teardown = useSaleStore.getState().init()
    return teardown
  }, [])

  // ── Load the product catalog once logged in (Inventory MVP) ─
  // Gated on currentUser: GET /api/products now requires auth (RBAC
  // Phase 2), so calling this before login would just be a wasted 401.
  useEffect(() => {
    if (!currentUser) return
    void loadProducts()
  }, [loadProducts, currentUser])

  // ── Load customer accounts once logged in (Cari Hesap Phase 1) ─
  useEffect(() => {
    if (!currentUser) return
    void loadAccounts('customer')
  }, [loadAccounts, currentUser])

  // ── Totals ───────────────────────────────────────────────
  const grandTotal = cart.reduce((sum, l) => sum + l.total, 0)
  const selectedCustomerAccount = customerAccounts.find(a => a.id === customerId) ?? null

  // ── Product search (barcode/manual + name autocomplete) ───
  const trimmedSearchQuery = searchQuery.trim()
  const searchSuggestions =
    trimmedSearchQuery.length >= 3
      ? products
          .filter(p => p.name.toLocaleLowerCase('tr').includes(trimmedSearchQuery.toLocaleLowerCase('tr')))
          .slice(0, 8)
      : []

  // ── Manual add (keyboard-less demo / touch screen) ──────
  // ── Select a product from the name-search dropdown ──────
  const handleSelectSearchResult = useCallback((product: Product) => {
    addLine(productToCartLine(product, 1, priceTier))
    setScanFeedback(`Eklendi: ${product.name}`)
    setSearchQuery('')
    setShowSuggestions(false)
    searchInputRef.current?.focus()
  }, [addLine, priceTier])

  // ── Shared "resolve a raw scanned/typed value to a product" step.
  //    Used by the manual search box (Enter key), the global HID/Tauri
  //    listener above, AND the camera scanner below — all three paths
  //    funnel through the same exact-barcode-then-name-fallback logic
  //    so behaviour never diverges between input methods. ──
  const [notFoundQuery, setNotFoundQuery] = useState<string | null>(null)
  const resolveScannedValue = useCallback((query: string, suggestions: Product[]) => {
    const product = findByBarcode(query)
    if (product) {
      addLine(productToCartLine(product, 1, priceTier))
      setScanFeedback(`Eklendi: ${product.name}`)
      setNotFoundQuery(null)
      setSearchQuery('')
      setShowSuggestions(false)
      searchInputRef.current?.focus()
      return
    }

    if (suggestions.length === 1) {
      const [onlyMatch] = suggestions
      if (onlyMatch) {
        handleSelectSearchResult(onlyMatch)
        setNotFoundQuery(null)
      }
      return
    }

    setScanFeedback(null)
    setNotFoundQuery(query)
  }, [findByBarcode, addLine, priceTier, handleSelectSearchResult])

  // ── Barcode scanning (physical HID scanner / Tauri hardware event).
  //    Placed after resolveScannedValue's definition — it's a plain
  //    `const` (not hoisted), so referencing it any earlier would be a
  //    temporal-dead-zone error. ──
  useEffect(() => {
    const barcodeService = getBarcodeService()

    const unsubscribe = barcodeService.onScan(event => {
      resolveScannedValue(event.value, [])
    })

    return () => {
      unsubscribe()
    }
  }, [resolveScannedValue])

  // ── Manual barcode entry / Enter-to-add from the search box.
  //    Tries an exact barcode match first (so a barcode scanner
  //    that types into this field + Enter works identically to
  //    the global HID/Tauri scan listener above); falls back to
  //    accepting a single remaining name-search match. ──
  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim()
    if (!query) return
    resolveScannedValue(query, searchSuggestions)
  }, [searchQuery, searchSuggestions, resolveScannedValue])

  // ── Camera scan (phones without a hardware scanner, or a PC webcam).
  //    A decoded value never has a "3+ character name" fallback set to
  //    match against, so it only ever resolves via exact barcode match. ──
  const [cameraOpen, setCameraOpen] = useState(false)
  const handleCameraDetected = useCallback((value: string) => {
    setCameraOpen(false)
    resolveScannedValue(value, [])
  }, [resolveScannedValue])

  // ── "Ürün bulunamadı" → two ways forward (bp/Yayla Soft-style):
  //    catalog it properly, or sell it as a one-off "Muhtelif Satış"
  //    line that never touches inventory. ──
  const looksLikeBarcode = notFoundQuery !== null && /^\d{6,}$/.test(notFoundQuery)
  const handleGoToAddProduct = useCallback(() => {
    if (notFoundQuery === null) return
    setProductCreateHandoff(looksLikeBarcode ? { barcode: notFoundQuery } : { name: notFoundQuery })
    setNotFoundQuery(null)
    setSearchQuery('')
    setView('backoffice')
  }, [notFoundQuery, looksLikeBarcode])

  const [miscSaleForm, setMiscSaleForm] = useState<{ name: string; priceInput: string } | null>(null)
  const handleOpenMiscSale = useCallback(() => {
    if (notFoundQuery === null) return
    setMiscSaleForm({ name: looksLikeBarcode ? '' : notFoundQuery, priceInput: '' })
  }, [notFoundQuery, looksLikeBarcode])

  const handleConfirmMiscSale = useCallback(() => {
    if (!miscSaleForm) return
    const name = miscSaleForm.name.trim()
    const price = parseMoneyInput(miscSaleForm.priceInput)
    if (!name || price === null || price <= 0) return

    // Sold as its own catalog-free line — see MISC_SALE_PRODUCT_ID's
    // comment (packages/core/src/constants.ts) for why this is safe to
    // check out: the server special-cases this id to skip the
    // stock-decrement it otherwise performs for every sale line.
    const miscProduct: Product = {
      id: MISC_SALE_PRODUCT_ID,
      sku: 'MUHTELIF',
      name,
      barcode: [],
      price,
      price2: null,
      brand: null,
      costPrice: null,
      taxRate: 0.18,
      stock: 0,
      lowStockThreshold: 0,
      unit: 'piece',
      categoryId: null,
      quickSaleGroupId: null,
      warehouseId: 'default',
      isActive: true,
    }
    addLine(productToCartLine(miscProduct))
    setScanFeedback(`Eklendi: ${name}`)
    setMiscSaleForm(null)
    setNotFoundQuery(null)
    setSearchQuery('')
    searchInputRef.current?.focus()
  }, [miscSaleForm, addLine])

  // ── "Hızlı Ürünler" group tabs — with ~1000 SKUs in the catalog, only
  //    products explicitly tagged with a Hızlı Ürün Grubu (an admin
  //    opt-in, set on the Ürünler page — independent of Category/Ana
  //    Kategori, which is the accounting-oriented tree) show up here at
  //    all. An untagged product simply never appears in this section,
  //    by design — that's the whole point of the field: curate the
  //    high-sellers instead of dumping the entire catalog on the
  //    cashier. ──
  const [quickSaleGroups, setQuickSaleGroups] = useState<QuickSaleGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    quickSaleGroupsApi.listQuickSaleGroups()
      .then(groups => { if (!cancelled) setQuickSaleGroups(groups) })
      .catch(() => { /* Group tabs are a nice-to-have — silently skip if this fails. */ })
    return () => { cancelled = true }
  }, [])

  const taggedForQuickSale = products.filter(p => p.quickSaleGroupId !== null)
  const groupsInUse = quickSaleGroups.filter(g => taggedForQuickSale.some(p => p.quickSaleGroupId === g.id))

  const quickAddProducts = selectedGroupId === null
    ? taggedForQuickSale
    : taggedForQuickSale.filter(p => p.quickSaleGroupId === selectedGroupId)

  // ── Record a payment against the selected customer's account
  //    (Cari Hesap Phase 2 — pays down open invoices, oldest first) ──
  const handleRecordPayment = useCallback(async () => {
    setPaymentMessage(null)
    if (!customerId) return

    const amountKurus = parseMoneyInput(paymentAmountInput)
    if (amountKurus === null) {
      setPaymentMessage('Geçerli bir tutar girin.')
      return
    }

    try {
      await recordPayment(customerId, amountKurus)
      setPaymentAmountInput('')
      setPaymentMessage('Ödeme kaydedildi.')
    } catch (err) {
      setPaymentMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [customerId, paymentAmountInput, recordPayment])

  // ── Checkout ─────────────────────────────────────────────
  const handleCheckout = useCallback(async (method: 'cash' | 'card' | 'account') => {
    if (cart.length === 0) return
    if (method === 'account' && !customerId) return

    try {
      const outcome = await submitSale([
        { method, amount: grandTotal },
      ])

      const printer = getPrinterService()
      const printResult = await printer.printReceipt(outcome.sale)
      const receiptStatus = printResult.success ? 'yazdırıldı' : (printResult.errorMessage ?? 'yazdırma hatası')

      const methodLabel = method === 'account' ? 'veresiye (cari hesaba)' : method === 'card' ? 'kredi kartı' : 'nakit'
      setLastReceiptStatus(
        outcome.mode === 'online'
          ? `Satış çevrimiçi tamamlandı (${methodLabel}). Fiş: ${receiptStatus}`
          : `Çevrimdışı — satış yerel olarak kuyruğa alındı (bağlantı gelince senkronize edilecek). Fiş: ${receiptStatus}`,
      )
    } catch (err) {
      setLastReceiptStatus(`Hata: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [cart, customerId, grandTotal, submitSale])

  // ── Account balance demo (must throw offline) ───────────
  const handleCheckBalance = useCallback(async () => {
    setBalanceMessage(null)
    try {
      const balance = await checkAccountBalance('demo-customer-1')
      setBalanceMessage(`Bakiye: ${money(balance)}`)
    } catch (err) {
      if (err instanceof OfflineBalanceError) {
        setBalanceMessage(`⛔ ${err.message}`)
      } else {
        setBalanceMessage(`Hata: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }, [checkAccountBalance])

  // ── Login (Auth Phase 1) ─────────────────────────────────
  const handleLogin = useCallback(async () => {
    if (!loginUsername || !loginPassword) return
    try {
      await login(loginUsername, loginPassword)
      setLoginPassword('')
    } catch {
      // authError is already set by the store; nothing else to do here.
    }
  }, [login, loginUsername, loginPassword])

  // ── Not logged in → show the login form instead of the POS UI ──
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-[var(--color-paper)] px-4 pt-16 font-[var(--font-sans)] text-[var(--color-ink)] sm:items-center sm:pt-0">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--color-paper-line)] bg-white/60 p-6 shadow-sm sm:p-8">
          <h1 className="mb-1 font-[var(--font-display)] text-3xl font-semibold text-[var(--color-petrol)]">
            PazarioPOS
          </h1>
          <p className="mb-6 text-sm text-[var(--color-ink-soft)]">Devam etmek için giriş yapın</p>

          <label className="text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="login-username">
            Kullanıcı Adı
          </label>
          <input
            id="login-username"
            type="text"
            value={loginUsername}
            onChange={e => setLoginUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="mt-1 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)] focus:ring-2 focus:ring-[var(--color-saffron)]/30"
            autoFocus
          />

          <label className="mt-3 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="login-password">
            Şifre
          </label>
          <input
            id="login-password"
            type="password"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="mt-1 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)] focus:ring-2 focus:ring-[var(--color-saffron)]/30"
          />

          <button
            className="mt-5 w-full rounded-lg bg-[var(--color-petrol)] py-2.5 text-sm font-semibold text-[var(--color-paper)] transition hover:bg-[var(--color-petrol-light)] disabled:opacity-60"
            disabled={isAuthenticating}
            onClick={handleLogin}
          >
            {isAuthenticating ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>

          {authError && (
            <div className="mt-4 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-3 py-2 text-sm text-[var(--color-copper)]">
              {authError}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-paper)] font-[var(--font-sans)] text-[var(--color-ink)]">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-petrol)] px-3 py-3 text-[var(--color-paper)] shadow-sm sm:px-6 sm:py-4">
        <h1 className="font-[var(--font-display)] text-lg font-semibold tracking-tight sm:text-2xl">
          PazarioPOS <span className="hidden text-[var(--color-saffron-light)] sm:inline">— Hızlı Satış</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="hidden text-sm text-[var(--color-paper)]/80 md:inline">
            {currentUser.name} <span className="text-[var(--color-saffron-light)]">({currentUser.role})</span>
          </span>
          {(currentUser.role === 'admin' || currentUser.role === 'accountant' || currentUser.role === 'warehouse') && (
            <button
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                view === 'backoffice'
                  ? 'border-[var(--color-saffron)] bg-[var(--color-saffron)] text-[var(--color-ink)]'
                  : 'border-[var(--color-paper)]/30 text-[var(--color-paper)] hover:bg-white/10'
              }`}
              onClick={() => setView(v => {
                if (v === 'backoffice') setProductCreateHandoff(null)
                return v === 'pos' ? 'backoffice' : 'pos'
              })}
            >
              {view === 'backoffice' ? '← Kasaya Dön' : 'Yönetim Paneli'}
            </button>
          )}
          <button
            className="rounded-full border border-[var(--color-paper)]/30 px-3 py-1 text-xs font-medium text-[var(--color-paper)] transition hover:bg-white/10"
            onClick={logout}
          >
            Çıkış
          </button>
          <NetworkBadge status={networkStatus} pendingCount={pendingCount} isSyncing={isSyncing} />
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-3 sm:p-6">
        {view === 'backoffice' ? (
          <BackOfficeScreen
            initialTab={productCreateHandoff ? 'products' : undefined}
            productInitialCreateValues={productCreateHandoff ?? undefined}
          />
        ) : (
          <>
        {lastSyncError && (
          <div className="mb-4 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-3 py-2 text-sm text-[var(--color-copper)]">
            Son senkronizasyon hatası: {lastSyncError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          {/* ── Left: scan bar, quick-add tiles, cart ── */}
          <div className="space-y-4">
            {/* ── Scan bar — the single most-used control, so it gets
                 the full width and the top-left position, mirroring
                 every reference POS layout's barcode field. ── */}
            <section className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
              <div className="flex gap-2">
                {/* ── Fiyat 1 / Fiyat 2 selector — mirrors the reference
                     POS layouts' price-tier dropdown at the top-left of
                     the scan bar. Affects every item added from this
                     point forward (see productToCartLine's priceTier
                     param); products with no Fiyat 2 set always charge
                     Fiyat 1 regardless of this setting. ── */}
                <select
                  value={priceTier}
                  onChange={e => setPriceTier(Number(e.target.value) === 2 ? 2 : 1)}
                  title="Bu ürün için hangi fiyat uygulanacak"
                  className={`shrink-0 rounded-xl border px-2.5 py-3.5 text-sm font-medium outline-none ${
                    priceTier === 2
                      ? 'border-[var(--color-copper)] bg-[var(--color-copper)]/10 text-[var(--color-copper)]'
                      : 'border-[var(--color-paper-line)] bg-white text-[var(--color-ink)]'
                  }`}
                >
                  <option value={1}>Fiyat 1</option>
                  <option value={2}>Fiyat 2</option>
                </select>

                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[var(--color-ink-soft)]">
                    ⌕
                  </span>
                  <input
                    id="pos-search"
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    autoFocus
                    autoComplete="off"
                    placeholder="Barkod okutun veya ürün adı yazın…"
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(true)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSearchSubmit()
                      } else if (e.key === 'Escape') {
                        setSearchQuery('')
                        setShowSuggestions(false)
                      }
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      // Delay so a click on a suggestion below still registers before we hide the list.
                      window.setTimeout(() => setShowSuggestions(false), 150)
                    }}
                    className="w-full rounded-xl border border-[var(--color-paper-line)] bg-white py-3.5 pl-10 pr-3 text-base outline-none focus:border-[var(--color-saffron)] focus:ring-2 focus:ring-[var(--color-saffron)]/30"
                  />

                  {showSuggestions && searchSuggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--color-paper-line)] bg-white shadow-lg">
                      {searchSuggestions.map(product => (
                        <li key={product.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-[var(--color-paper-dim)]"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleSelectSearchResult(product)}
                          >
                            <span>
                              <span className="font-medium text-[var(--color-ink)]">{product.name}</span>
                              <span className="ml-2 text-xs text-[var(--color-ink-soft)]">
                                {product.barcode[0] ?? product.sku}
                              </span>
                            </span>
                            <span className="tabular-money text-[var(--color-petrol)]">
                              {money((priceTier === 2 ? product.price2 : null) ?? product.price)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {showSuggestions && trimmedSearchQuery.length >= 3 && searchSuggestions.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-soft)] shadow-lg">
                      Eşleşen ürün yok.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  title="Kamerayla Tara"
                  className="flex aspect-square shrink-0 items-center justify-center rounded-xl border border-[var(--color-saffron)] bg-[var(--color-saffron)]/10 px-4 text-xl text-[var(--color-petrol)] transition hover:bg-[var(--color-saffron)]/20"
                >
                  📷
                </button>
              </div>

              {cameraOpen && (
                <CameraScanner
                  onDetected={handleCameraDetected}
                  onClose={() => setCameraOpen(false)}
                />
              )}

              {isCatalogLoading && products.length === 0 && (
                <div className="mt-2 text-xs text-[var(--color-ink-soft)]">Katalog yükleniyor…</div>
              )}
              {catalogError && (
                <div className="mt-2 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-3 py-2 text-sm text-[var(--color-copper)]">
                  Katalog yüklenemedi: {catalogError}
                </div>
              )}
              {!isCatalogLoading && !catalogError && products.length === 0 && (
                <div className="mt-2 text-xs text-[var(--color-ink-soft)]">
                  Henüz ürün yok. Veritabanını seed edin (bkz. prisma/seed.ts).
                </div>
              )}
              {scanFeedback && (
                <div className="mt-2 text-sm font-medium text-[var(--color-olive)]">{scanFeedback}</div>
              )}

              {/* ── "Ürün bulunamadı" — offer both ways forward instead
                   of just a dead-end message (bp/Yayla Soft-style: a
                   real product goes through Ürün Ekle, a one-off item
                   goes through Muhtelif Satış without ever touching
                   the catalog). ── */}
              {notFoundQuery !== null && !miscSaleForm && (
                <div className="mt-2 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 p-3">
                  <div className="mb-2 text-sm font-medium text-[var(--color-copper)]">
                    Bulunamadı: {notFoundQuery}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleGoToAddProduct}
                      className="rounded-lg border border-[var(--color-petrol)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-petrol)] transition hover:bg-[var(--color-petrol)]/10"
                    >
                      + Ürün Ekle
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenMiscSale}
                      className="rounded-lg border border-[var(--color-saffron)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-saffron)]/10"
                    >
                      Muhtelif Satış
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotFoundQuery(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-ink-soft)] transition hover:bg-black/5"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}

              {/* ── Muhtelif Satış mini-form — sells the scanned/typed
                   value as a one-off line (name + manual price), never
                   creating a catalog row. See MISC_SALE_PRODUCT_ID. ── */}
              {miscSaleForm && (
                <div className="mt-2 rounded-lg border border-[var(--color-saffron)]/40 bg-[var(--color-saffron)]/10 p-3">
                  <div className="mb-2 text-xs font-medium text-[var(--color-ink-soft)]">
                    Muhtelif Satış — kataloğa eklenmez, sadece bu satışa özel
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Ürün adı"
                      value={miscSaleForm.name}
                      onChange={e => setMiscSaleForm(f => f && { ...f, name: e.target.value })}
                      className="min-w-[10rem] flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-saffron)]"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Fiyat (ör. 25.00)"
                      value={miscSaleForm.priceInput}
                      onChange={e => setMiscSaleForm(f => f && { ...f, priceInput: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleConfirmMiscSale() }}
                      className="w-32 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-saffron)]"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmMiscSale}
                      disabled={!miscSaleForm.name.trim() || parseMoneyInput(miscSaleForm.priceInput) === null}
                      className="rounded-lg bg-[var(--color-olive)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sepete Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => setMiscSaleForm(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-ink-soft)] transition hover:bg-black/5"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── Quick-add tiles — tap a frequently-sold item instead of
                 scanning it. Reuses the same add-to-cart path as a
                 search-result click, so quantities merge identically.
                 Group tabs (from the "Ana Kategori" set up on the
                 Ürünler page) filter which products show here. ── */}
            {taggedForQuickSale.length > 0 && (
              <section className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
                <h2 className="mb-3 font-[var(--font-display)] text-sm font-semibold text-[var(--color-petrol)]">
                  Hızlı Ürünler
                </h2>

                {groupsInUse.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupId(null)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        selectedGroupId === null
                          ? 'border-[var(--color-petrol)] bg-[var(--color-petrol)] text-white'
                          : 'border-[var(--color-paper-line)] bg-white text-[var(--color-ink-soft)] hover:border-[var(--color-petrol)]'
                      }`}
                    >
                      Tümü
                    </button>
                    {groupsInUse.map(group => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selectedGroupId === group.id
                            ? 'border-[var(--color-petrol)] bg-[var(--color-petrol)] text-white'
                            : 'border-[var(--color-paper-line)] bg-white text-[var(--color-ink-soft)] hover:border-[var(--color-petrol)]'
                        }`}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                )}

                {quickAddProducts.length === 0 ? (
                  <p className="text-xs text-[var(--color-ink-soft)]">Bu grupta ürün yok.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {quickAddProducts.map((product, i) => {
                      const tileTone = [
                        'border-[var(--color-saffron)]/40 bg-[var(--color-saffron)]/10 hover:bg-[var(--color-saffron)]/20',
                        'border-[var(--color-petrol)]/25 bg-[var(--color-petrol)]/8 hover:bg-[var(--color-petrol)]/15',
                        'border-[var(--color-olive)]/25 bg-[var(--color-olive)]/8 hover:bg-[var(--color-olive)]/15',
                        'border-[var(--color-copper)]/25 bg-[var(--color-copper)]/8 hover:bg-[var(--color-copper)]/15',
                      ][i % 4]
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectSearchResult(product)}
                          className={`rounded-xl border p-3 text-left text-sm transition ${tileTone}`}
                        >
                          <div className="line-clamp-2 font-medium text-[var(--color-ink)]">{product.name}</div>
                          <div className="tabular-money mt-1 text-xs text-[var(--color-ink-soft)]">
                            {money((priceTier === 2 ? product.price2 : null) ?? product.price)}
                            {priceTier === 2 && product.price2 != null && (
                              <span className="ml-1 text-[10px] text-[var(--color-copper)]">F2</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── Cart ── */}
            <section className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
              <h2 className="mb-3 font-[var(--font-display)] text-lg font-semibold text-[var(--color-petrol)]">
                Sepet
              </h2>

              {/* ── Multi-customer tabs — up to SALE_SLOT_COUNT concurrent
                   draft sales, so Müşteri 2 doesn't have to wait for
                   Müşteri 1 to finish before the cashier can start
                   ringing them up. Switching tabs swaps the whole cart
                   +selected customer via useSaleStore's slots — nothing
                   is lost, each tab keeps its own state until checked
                   out. ── */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {slots.map((slot, i) => {
                  const slotTotal = slot.cart.reduce((sum, l) => sum + l.total, 0)
                  const isActive = i === activeSlotIndex
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveSlot(i)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? 'border-[var(--color-petrol)] bg-[var(--color-petrol)] text-white'
                          : slot.cart.length > 0
                            ? 'border-[var(--color-saffron)] bg-[var(--color-saffron)]/10 text-[var(--color-petrol)]'
                            : 'border-[var(--color-paper-line)] bg-white text-[var(--color-ink-soft)] hover:border-[var(--color-petrol)]'
                      }`}
                    >
                      Müşteri {i + 1} ({money(slotTotal)})
                    </button>
                  )
                })}
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-soft)]">Sepet boş — başlamak için bir ürün tarayın.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="receipt-rule text-xs text-[var(--color-ink-soft)]">
                      <th className="pb-2 pt-1 text-left font-medium">Ürün</th>
                      <th className="pb-2 pt-1 text-right font-medium">Adet</th>
                      <th className="pb-2 pt-1 text-right font-medium">Toplam</th>
                      <th className="pb-2 pt-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(line => (
                      <tr key={line.product.id} className="border-b border-[var(--color-paper-line)]/60">
                        <td className="py-2.5">{line.product.name}</td>
                        <td className="tabular-money py-2.5 text-right">{line.quantity}</td>
                        <td className="tabular-money py-2.5 text-right">{money(line.total)}</td>
                        <td className="py-2.5 text-right">
                          <button
                            className="text-[var(--color-copper)] transition hover:text-[var(--color-copper-light)]"
                            onClick={() => removeLine(line.product.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          {/* ── Right: total + customer + payment ── */}
          <div className="space-y-4">
            {/* ── Signature element: mechanical register digit display —
                 enlarged and given its own panel so the running total is
                 always visible without scrolling, matching how every
                 reference POS keeps "Toplam Tutar" pinned and huge. ── */}
            <section className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
              <div className="register-display flex flex-col items-center rounded-lg px-4 py-4 text-center">
                <span className="text-xs font-medium tracking-wide opacity-80">TOPLAM</span>
                <span className="text-4xl font-semibold">{money(grandTotal)}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
              <label className="text-xs font-medium text-[var(--color-ink-soft)]" htmlFor="customer-select">
                Cari Hesap (veresiye için seçin)
              </label>
              <select
                id="customer-select"
                value={customerId ?? ''}
                onChange={e => setCustomer(e.target.value || null)}
                className="mt-1 w-full rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)] focus:ring-2 focus:ring-[var(--color-saffron)]/30"
              >
                <option value="">— Seçilmedi (sadece nakit) —</option>
                {customerAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} (Bakiye: {money(account.balance)})
                  </option>
                ))}
              </select>

              {selectedCustomerAccount && (
                <div className="mt-3 rounded-lg border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-3">
                  <div className="mb-2 text-xs text-[var(--color-ink-soft)]">
                    {selectedCustomerAccount.name} güncel bakiye:{' '}
                    <strong className="tabular-money text-[var(--color-ink)]">
                      {money(selectedCustomerAccount.balance)}
                    </strong>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ödeme tutarı (ör. 50.00)"
                      value={paymentAmountInput}
                      onChange={e => setPaymentAmountInput(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-saffron)]"
                    />
                    <button
                      className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm transition hover:border-[var(--color-petrol)]"
                      onClick={handleRecordPayment}
                    >
                      Ödeme Al
                    </button>
                  </div>
                  {paymentMessage && <div className="mt-2 text-xs">{paymentMessage}</div>}
                </div>
              )}
            </section>

            {/* ── Payment — big color-coded blocks (cash=olive, card=petrol,
                 open-tab=copper) instead of thin bordered buttons, so a
                 cashier can hit the right one at a glance, the way every
                 reference POS's chunky colored buttons work. ── */}
            <section className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-4">
              <button
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-olive)] py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cart.length === 0}
                onClick={() => handleCheckout('cash')}
              >
                💵 Nakit
              </button>

              <button
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-petrol)] py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cart.length === 0}
                onClick={() => handleCheckout('card')}
              >
                💳 Kredi Kartı
              </button>

              <button
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-copper)] py-4 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cart.length === 0 || !customerId}
                onClick={() => handleCheckout('account')}
              >
                📒 Veresiye
              </button>

              {lastReceiptStatus && (
                <div className="mt-1 rounded-lg bg-[var(--color-paper-dim)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
                  {lastReceiptStatus}
                </div>
              )}
            </section>

            {/* ── Demo/dev tools — tucked away so they don't compete with
                 the cashier's actual workflow above. ── */}
            <details className="rounded-2xl border border-[var(--color-paper-line)] bg-white/30 p-4 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-[var(--color-ink-soft)]">
                Geliştirici Araçları
              </summary>
              <button
                className="mt-3 rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm transition hover:border-[var(--color-petrol)]"
                onClick={handleCheckBalance}
              >
                Cari Bakiye Sorgula (demo-customer-1)
              </button>
              {balanceMessage && <div className="mt-2 text-sm">{balanceMessage}</div>}
            </details>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Network status badge ─────────────────────────────────────

function NetworkBadge({
  status, pendingCount, isSyncing,
}: {
  status: 'online' | 'offline' | 'degraded'
  pendingCount: number
  isSyncing: boolean
}) {
  const badgeClass =
    status === 'online'
      ? 'bg-[var(--color-olive)]'
      : status === 'degraded'
        ? 'bg-[var(--color-saffron-dark)]'
        : 'bg-[var(--color-copper)]'

  const label = status === 'online' ? 'ÇEVRİMİÇİ' : status === 'degraded' ? 'SINIRLI' : 'ÇEVRİMDIŞI'

  return (
    <div className="flex items-center gap-3">
      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-white ${badgeClass}`}>
        {label}
      </span>
      {pendingCount > 0 && (
        <span className="rounded-full border border-[var(--color-saffron)]/40 bg-[var(--color-saffron-light)]/20 px-3 py-1 text-[11px] font-medium text-[var(--color-saffron-dark)]">
          {isSyncing ? 'Senkronize ediliyor…' : `${pendingCount} bekleyen senkronizasyon`}
        </span>
      )}
    </div>
  )
}
