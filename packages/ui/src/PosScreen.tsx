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

import { useEffect, useState, useCallback } from 'react'

import {
  useSaleStore,
  useInventoryStore,
  useAccountStore,
  useAuthStore,
  getBarcodeService,
  getPrinterService,
  OfflineBalanceError,
  type Product,
  type CartLine,
} from '@pazariopos/core'
import { money, parseMoneyInput } from './lib/format'
import { BackOfficeScreen } from './BackOffice/BackOfficeScreen'

function productToCartLine(product: Product, quantity = 1): CartLine {
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
  const grossUnitPrice = product.price
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
  const isAuthenticating = useAuthStore(s => s.isAuthenticating)
  const authError        = useAuthStore(s => s.error)
  const login            = useAuthStore(s => s.login)
  const logout           = useAuthStore(s => s.logout)

  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
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

  // ── Barcode scanning ─────────────────────────────────────
  useEffect(() => {
    const barcodeService = getBarcodeService()

    const unsubscribe = barcodeService.onScan(event => {
      const product = findByBarcode(event.value)

      if (!product) {
        setScanFeedback(`Bilinmeyen barkod: ${event.value}`)
        return
      }

      addLine(productToCartLine(product))
      setScanFeedback(`Eklendi: ${product.name}`)
    })

    return () => {
      unsubscribe()
    }
  }, [addLine, findByBarcode])

  // ── Totals ───────────────────────────────────────────────
  const grandTotal = cart.reduce((sum, l) => sum + l.total, 0)
  const selectedCustomerAccount = customerAccounts.find(a => a.id === customerId) ?? null

  // ── Manual add (keyboard-less demo / touch screen) ──────
  const handleQuickAdd = useCallback((product: Product) => {
    addLine(productToCartLine(product))
    setScanFeedback(`Eklendi: ${product.name}`)
  }, [addLine])

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
          {(currentUser.role === 'admin' || currentUser.role === 'accountant') && (
            <button
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                view === 'backoffice'
                  ? 'border-[var(--color-saffron)] bg-[var(--color-saffron)] text-[var(--color-ink)]'
                  : 'border-[var(--color-paper)]/30 text-[var(--color-paper)] hover:bg-white/10'
              }`}
              onClick={() => setView(v => (v === 'pos' ? 'backoffice' : 'pos'))}
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
          <BackOfficeScreen />
        ) : (
          <>
        {lastSyncError && (
          <div className="mb-4 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-3 py-2 text-sm text-[var(--color-copper)]">
            Son senkronizasyon hatası: {lastSyncError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Left: scan / quick add ── */}
          <section className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-5">
            <h2 className="mb-1 font-[var(--font-display)] text-lg font-semibold text-[var(--color-petrol)]">
              Tara veya Hızlı Ekle
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-[var(--color-ink-soft)]">
              Okuyucu HID modunda barkodu ve Enter tuşunu otomatik yazar.
              Masaüstünde, fiziksel / seri taramalar Tauri olayları üzerinden gelir.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {isCatalogLoading && products.length === 0 && (
                <div className="col-span-2 text-xs text-[var(--color-ink-soft)]">Katalog yükleniyor…</div>
              )}
              {catalogError && (
                <div className="col-span-2 rounded-lg border border-[var(--color-copper)]/30 bg-[var(--color-copper-light)]/15 px-3 py-2 text-sm text-[var(--color-copper)]">
                  Katalog yüklenemedi: {catalogError}
                </div>
              )}
              {!isCatalogLoading && !catalogError && products.length === 0 && (
                <div className="col-span-2 text-xs text-[var(--color-ink-soft)]">
                  Henüz ürün yok. Veritabanını seed edin (bkz. prisma/seed.ts).
                </div>
              )}
              {products.map(product => {
                const isLowStock = product.stock <= product.lowStockThreshold
                return (
                  <button
                    key={product.id}
                    className="price-tag rounded-xl border border-[var(--color-paper-line)] bg-[var(--color-paper-dim)] p-3 pl-5 text-left transition hover:border-[var(--color-saffron)] hover:shadow-md"
                    onClick={() => handleQuickAdd(product)}
                  >
                    <div className="font-medium text-[var(--color-ink)]">{product.name}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">{product.barcode[0] ?? product.sku}</div>
                    <div className="tabular-money mt-1 text-sm font-semibold text-[var(--color-petrol)]">
                      {money(product.price)}
                    </div>
                    <div
                      className={
                        isLowStock
                          ? 'mt-1 inline-block rounded-full bg-[var(--color-copper-light)]/25 px-2 py-0.5 text-[11px] font-medium text-[var(--color-copper)]'
                          : 'mt-1 text-[11px] text-[var(--color-ink-soft)]'
                      }
                    >
                      {isLowStock ? `⚠ Düşük stok: ${product.stock}` : `Stok: ${product.stock}`}
                    </div>
                  </button>
                )
              })}
            </div>

            {scanFeedback && (
              <div className="mt-3 text-sm font-medium text-[var(--color-olive)]">{scanFeedback}</div>
            )}

            <div className="mt-6 border-t border-[var(--color-paper-line)] pt-4">
              <button
                className="rounded-lg border border-[var(--color-paper-line)] bg-white px-3 py-2 text-sm transition hover:border-[var(--color-petrol)]"
                onClick={handleCheckBalance}
              >
                Cari Bakiye Sorgula (demo-customer-1)
              </button>
              {balanceMessage && <div className="mt-2 text-sm">{balanceMessage}</div>}
            </div>
          </section>

          {/* ── Right: cart ── */}
          <section className="rounded-2xl border border-[var(--color-paper-line)] bg-white/50 p-5">
            <h2 className="mb-3 font-[var(--font-display)] text-lg font-semibold text-[var(--color-petrol)]">
              Sepet
            </h2>

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
                      <td className="py-1.5">{line.product.name}</td>
                      <td className="tabular-money py-1.5 text-right">{line.quantity}</td>
                      <td className="tabular-money py-1.5 text-right">{money(line.total)}</td>
                      <td className="py-1.5 text-right">
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

            {/* ── Signature element: mechanical register digit display ── */}
            <div className="register-display mt-4 flex items-center justify-between rounded-lg px-4 py-3">
              <span className="text-sm font-medium tracking-wide opacity-80">TOPLAM</span>
              <span className="text-2xl font-semibold">{money(grandTotal)}</span>
            </div>

            <div className="mt-4">
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
            </div>

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

            <button
              className="mt-4 w-full rounded-lg bg-[var(--color-saffron)] py-3 text-sm font-semibold text-[var(--color-ink)] shadow-sm transition hover:bg-[var(--color-saffron-dark)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cart.length === 0}
              onClick={() => handleCheckout('cash')}
            >
              Ödeme Al (Nakit)
            </button>

            <button
              className="mt-2 w-full rounded-lg border border-[var(--color-petrol)] py-2.5 text-sm font-medium text-[var(--color-petrol)] transition hover:bg-[var(--color-petrol)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cart.length === 0}
              onClick={() => handleCheckout('card')}
            >
              Ödeme Al (Kredi Kartı)
            </button>

            <button
              className="mt-2 w-full rounded-lg border border-[var(--color-copper)] py-2.5 text-sm font-medium text-[var(--color-copper)] transition hover:bg-[var(--color-copper)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cart.length === 0 || !customerId}
              onClick={() => handleCheckout('account')}
            >
              Veresiye (Cari Hesaba Ekle)
            </button>

            {lastReceiptStatus && (
              <div className="mt-3 rounded-lg bg-[var(--color-paper-dim)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
                {lastReceiptStatus}
              </div>
            )}
          </section>
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
