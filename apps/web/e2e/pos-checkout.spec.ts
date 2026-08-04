// apps/web/e2e/pos-checkout.spec.ts
// ─────────────────────────────────────────────────────────────
// Smoke test for the critical path: login -> quick-add a product ->
// pay cash. The backend is fully mocked via page.route() so this runs
// without a live server/DB (see playwright.config.ts comment).
//
// Also asserts the tax-inclusive -> net price split documented in
// PosScreen.tsx's productToCartLine() comment: a 32.00 TL gross price
// at 10% VAT must split into 29.09 net + 2.91 tax, not 32.00 + 3.20.
// ─────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test'

const PRODUCT = {
  id: 'prod-1',
  sku: 'SKU-1',
  name: 'Zeytinyağı 1L',
  barcode: ['8690000000017'],
  price: 3200,       // 32.00 TL, KDV dahil (gross)
  taxRate: 0.10,      // 10% VAT
  stock: 25,
  lowStockThreshold: 5,
  unit: 'piece',
  categoryId: 'cat-1',
  isActive: true, costPrice: null,
  warehouseId: 'wh-1',
}

const USER = { id: 'user-1', name: 'Test Kasiyer', username: 'kasiyer1', role: 'cashier' }

async function mockBackend(page: import('@playwright/test').Page) {
  await page.route('**/api/health', route => route.fulfill({ status: 200, body: '' }))

  await page.route('**/api/auth/login', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'fake-jwt-token', user: USER }),
    }),
  )

  await page.route('**/api/products', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([PRODUCT]),
    }),
  )

  await page.route('**/api/accounts?type=customer', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )

  await page.route('**/api/sales', route =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'sale-1', localId: crypto.randomUUID(), branchId: 'b1', registerId: 'r1',
        cashierId: USER.id, lines: [], payments: [{ method: 'cash', amount: 3200 }],
        subtotal: 2909, discountTotal: 0, taxTotal: 291, grandTotal: 3200, changeGiven: 0,
        status: 'completed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        syncStatus: 'synced', syncedAt: new Date().toISOString(),
      }),
    }),
  )
}

test.describe('POS checkout — cash sale smoke test', () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page)
    await page.goto('/')
  })

  test('logs in, quick-adds a product, and completes a cash sale', async ({ page }) => {
    await page.getByLabel('Kullanıcı Adı').fill(USER.username)
    await page.getByLabel('Şifre').fill('kasiyer123')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()

    // Header greets the logged-in cashier by name.
    await expect(page.getByText(USER.name)).toBeVisible()

    // Product catalog loaded and quick-add works.
    const productCard = page.getByRole('button', { name: new RegExp(PRODUCT.name) })
    await expect(productCard).toBeVisible()
    await productCard.click()

    // Cart shows the product (scoped to the cart table cell — the product
    // name also appears in the quick-add card and the "Eklendi: …" scan
    // feedback, so a bare getByText() is ambiguous/strict-mode-violating).
    await expect(page.getByRole('cell', { name: PRODUCT.name })).toBeVisible()
    // register-display total reflects the tax-inclusive (gross) price
    // (scoped to .register-display — '32.00' also appears on the product
    // card and in the cart table cell, same ambiguity as PRODUCT.name above).
    await expect(page.locator('.register-display').getByText('32.00', { exact: false })).toBeVisible()

    const [saleRequest] = await Promise.all([
      page.waitForRequest('**/api/sales'),
      page.getByRole('button', { name: 'Ödeme Al (Nakit)' }).click(),
    ])

    const body = saleRequest.postDataJSON()
    expect(body.payments).toEqual([{ method: 'cash', amount: 3200 }])
    // Net price = round(3200 / 1.10) = 2909, tax = 3200 - 2909 = 291 —
    // NOT 3200 + 320 (the bug this comment/test guards against).
    expect(body.lines[0].unitPrice).toBe(2909)
    expect(body.lines[0].taxAmount).toBe(291)
    expect(body.lines[0].total).toBe(3200)
  })

  test('shows an inline error on invalid credentials instead of navigating away', async ({ page }) => {
    await page.unroute('**/api/auth/login')
    await page.route('**/api/auth/login', route =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized', message: 'Invalid credentials' }),
      }),
    )

    await page.getByLabel('Kullanıcı Adı').fill('kasiyer1')
    await page.getByLabel('Şifre').fill('wrong-password')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()

    await expect(page.getByText('Kullanıcı adı veya şifre hatalı.')).toBeVisible()
    // Still on the login form — not silently "logged in" with no user.
    await expect(page.getByLabel('Kullanıcı Adı')).toBeVisible()
  })

  test('the veresiye (account) checkout button stays disabled until a customer is selected', async ({ page }) => {
    await page.getByLabel('Kullanıcı Adı').fill(USER.username)
    await page.getByLabel('Şifre').fill('kasiyer123')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()

    await page.getByRole('button', { name: new RegExp(PRODUCT.name) }).click()

    await expect(page.getByRole('button', { name: 'Veresiye (Cari Hesaba Ekle)' })).toBeDisabled()
  })
})
