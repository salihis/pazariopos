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
// inside @pos-erp/core's factories.
//
// UI text is in Turkish (user-facing labels only — code, comments,
// and identifiers stay in English per CODING_GUIDELINES.md).
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'

import {
  useSaleStore,
  useInventoryStore,
  getBarcodeService,
  getPrinterService,
  OfflineBalanceError,
  type Product,
  type CartLine,
} from '@pos-erp/core'

function productToCartLine(product: Product, quantity = 1): CartLine {
  const discountAmount = 0
  const taxAmount = Math.round(product.price * product.taxRate)
  return {
    product,
    quantity,
    unitPrice: product.price,
    discountAmount,
    taxAmount,
    total: (product.price - discountAmount + taxAmount) * quantity,
  }
}

function money(cents: number): string {
  return (cents / 100).toFixed(2)
}

// ── Component ────────────────────────────────────────────────

export function PosScreen() {
  const cart            = useSaleStore(s => s.cart)
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

  const [scanFeedback, setScanFeedback] = useState<string | null>(null)
  const [lastReceiptStatus, setLastReceiptStatus] = useState<string | null>(null)
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null)

  // ── Init store lifecycle (network monitor + queue seed) ────
  useEffect(() => {
    const teardown = useSaleStore.getState().init()
    return teardown
  }, [])

  // ── Load the product catalog once on mount (Inventory MVP) ─
  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

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

  // ── Manual add (keyboard-less demo / touch screen) ──────
  const handleQuickAdd = useCallback((product: Product) => {
    addLine(productToCartLine(product))
    setScanFeedback(`Eklendi: ${product.name}`)
  }, [addLine])

  // ── Checkout ─────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return

    const outcome = await submitSale([
      { method: 'cash', amount: grandTotal },
    ])

    const printer = getPrinterService()
    const printResult = await printer.printReceipt(outcome.sale)
    const receiptStatus = printResult.success ? 'yazdırıldı' : (printResult.errorMessage ?? 'yazdırma hatası')

    setLastReceiptStatus(
      outcome.mode === 'online'
        ? `Satış çevrimiçi tamamlandı. Fiş: ${receiptStatus}`
        : `Çevrimdışı — satış yerel olarak kuyruğa alındı (bağlantı gelince senkronize edilecek). Fiş: ${receiptStatus}`,
    )
  }, [cart, grandTotal, submitSale])

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

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>POS — Hızlı Satış</h1>
        <NetworkBadge status={networkStatus} pendingCount={pendingCount} isSyncing={isSyncing} />
      </header>

      {lastSyncError && (
        <div style={styles.warningBanner}>Son senkronizasyon hatası: {lastSyncError}</div>
      )}

      <div style={styles.layout}>
        {/* ── Left: scan / quick add ── */}
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Tara veya Hızlı Ekle</h2>
          <p style={styles.hint}>
            Okuyucu HID modunda barkodu ve Enter tuşunu otomatik yazar.
            Masaüstünde, fiziksel / seri taramalar Tauri olayları üzerinden gelir.
          </p>

          <div style={styles.quickAddGrid}>
            {isCatalogLoading && products.length === 0 && (
              <div style={styles.hint}>Katalog yükleniyor…</div>
            )}
            {catalogError && (
              <div style={styles.warningBanner}>Katalog yüklenemedi: {catalogError}</div>
            )}
            {!isCatalogLoading && !catalogError && products.length === 0 && (
              <div style={styles.hint}>Henüz ürün yok. Veritabanını seed edin (bkz. prisma/seed.ts).</div>
            )}
            {products.map(product => {
              const isLowStock = product.stock <= product.lowStockThreshold
              return (
                <button key={product.id} style={styles.quickAddButton} onClick={() => handleQuickAdd(product)}>
                  <div style={{ fontWeight: 600 }}>{product.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{product.barcode[0] ?? product.sku}</div>
                  <div style={{ fontSize: 13 }}>{money(product.price)}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: isLowStock ? '#b91c1c' : '#6b7280' }}>
                    {isLowStock ? `⚠ Düşük stok: ${product.stock}` : `Stok: ${product.stock}`}
                  </div>
                </button>
              )
            })}
          </div>

          {scanFeedback && <div style={styles.scanFeedback}>{scanFeedback}</div>}

          <div style={{ marginTop: 24 }}>
            <button style={styles.secondaryButton} onClick={handleCheckBalance}>
              Cari Bakiye Sorgula (demo-customer-1)
            </button>
            {balanceMessage && <div style={styles.balanceMessage}>{balanceMessage}</div>}
          </div>
        </section>

        {/* ── Right: cart ── */}
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Sepet</h2>

          {cart.length === 0 ? (
            <p style={styles.hint}>Sepet boş — başlamak için bir ürün tarayın.</p>
          ) : (
            <table style={styles.cartTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Ürün</th>
                  <th style={styles.thRight}>Adet</th>
                  <th style={styles.thRight}>Toplam</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map(line => (
                  <tr key={line.product.id}>
                    <td style={styles.td}>{line.product.name}</td>
                    <td style={styles.tdRight}>{line.quantity}</td>
                    <td style={styles.tdRight}>{money(line.total)}</td>
                    <td style={styles.tdRight}>
                      <button style={styles.removeButton} onClick={() => removeLine(line.product.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={styles.totalRow}>
            <span>Toplam</span>
            <span>{money(grandTotal)}</span>
          </div>

          <button
            style={{ ...styles.primaryButton, opacity: cart.length === 0 ? 0.5 : 1 }}
            disabled={cart.length === 0}
            onClick={handleCheckout}
          >
            Ödeme Al (Nakit)
          </button>

          {lastReceiptStatus && <div style={styles.receiptStatus}>{lastReceiptStatus}</div>}
        </section>
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
  const color = status === 'online' ? '#1a7f37' : status === 'degraded' ? '#9a6700' : '#b91c1c'
  const label = status === 'online' ? 'ÇEVRİMİÇİ' : status === 'degraded' ? 'SINIRLI' : 'ÇEVRİMDIŞI'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ ...styles.badge, background: color }}>{label}</span>
      {pendingCount > 0 && (
        <span style={styles.pendingBadge}>
          {isSyncing ? 'Senkronize ediliyor…' : `${pendingCount} bekleyen senkronizasyon`}
        </span>
      )}
    </div>
  )
}

// ── Inline styles (kept dependency-free for the hello-world demo;
//    swap for Tailwind classes once frontend-design system is wired in) ──

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  badge: { color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, letterSpacing: 0.5 },
  pendingBadge: { fontSize: 12, color: '#9a6700', background: '#fff8e6', padding: '4px 10px', borderRadius: 999, border: '1px solid #f0d38a' },
  warningBanner: { background: '#fff1f0', border: '1px solid #ffccc7', color: '#b91c1c', padding: '8px 12px', borderRadius: 6, marginBottom: 16, fontSize: 13 },
  layout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  panel: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 },
  panelTitle: { fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 10 },
  hint: { fontSize: 12, color: '#6b7280', lineHeight: 1.5 },
  quickAddGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 },
  quickAddButton: { textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafafa', cursor: 'pointer' },
  scanFeedback: { marginTop: 12, fontSize: 13, color: '#1a7f37' },
  secondaryButton: { padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 },
  balanceMessage: { marginTop: 8, fontSize: 13 },
  cartTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '6px 4px', fontSize: 12, color: '#6b7280' },
  thRight: { textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '6px 4px', fontSize: 12, color: '#6b7280' },
  td: { padding: '6px 4px', borderBottom: '1px solid #f3f4f6' },
  tdRight: { padding: '6px 4px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' },
  removeButton: { border: 'none', background: 'transparent', cursor: 'pointer', color: '#b91c1c' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, marginTop: 16, paddingTop: 12, borderTop: '2px solid #111827' },
  primaryButton: { marginTop: 16, width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  receiptStatus: { marginTop: 12, fontSize: 12, color: '#374151', background: '#f9fafb', padding: 8, borderRadius: 6 },
}
