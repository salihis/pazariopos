// packages/core/src/services/InventoryService.test.ts
// ─────────────────────────────────────────────────────────────
// Covers ARCHITECTURE.md §7's rule for Inventory: "safe to serve from
// local cache when offline". Each test re-imports the module fresh
// (vi.resetModules) because `inventoryService` is a module-level
// singleton — without this, cache state would leak between tests.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Product } from '../types/domain'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  sku: 'SKU-1',
  name: 'Test Product',
  barcode: ['1234567890123'],
  price: 1000,
  taxRate: 0.18,
  stock: 10,
  lowStockThreshold: 2,
  unit: 'piece',
  categoryId: 'cat-1',
  quickSaleGroupId: null,
  price2: null,
  brand: null,
  isActive: true, costPrice: null,
  warehouseId: 'wh-1',
  ...overrides,
})

async function setup({ online, listProducts }: { online: boolean; listProducts: ReturnType<typeof vi.fn> }) {
  vi.resetModules()

  vi.doMock('./NetworkMonitor', () => ({
    getNetworkMonitor: () => ({ isOnline: () => online }),
  }))
  vi.doMock('../api/salesApi', () => ({
    productsApi: { listProducts },
  }))

  const mod = await import('./InventoryService')
  return mod.inventoryService
}

describe('InventoryService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the live catalog and caches it when online', async () => {
    const products = [product()]
    const listProducts = vi.fn(async () => products)
    const service = await setup({ online: true, listProducts })

    const result = await service.listProducts()

    expect(result).toEqual(products)
    expect(listProducts).toHaveBeenCalledTimes(1)
    expect(service.lastFetchedAt).not.toBeNull()
  })

  it('falls back to the cached catalog when a live fetch fails after a prior success', async () => {
    const cached = [product({ id: 'cached-1' })]
    const listProducts = vi.fn()
      .mockResolvedValueOnce(cached)
      .mockRejectedValueOnce(new Error('network down'))
    const service = await setup({ online: true, listProducts })

    await service.listProducts() // warms the cache
    const result = await service.listProducts() // fails, should fall back

    expect(result).toEqual(cached)
  })

  it('throws when online, the fetch fails, and there is no prior cache', async () => {
    const listProducts = vi.fn(async () => { throw new Error('network down') })
    const service = await setup({ online: true, listProducts })

    await expect(service.listProducts()).rejects.toThrow('network down')
  })

  it('serves the cached catalog while offline without calling the API', async () => {
    const cached = [product({ id: 'cached-2' })]
    const listProducts = vi.fn(async () => cached)

    // First go online to build a cache, then flip to offline via a fresh setup
    // sharing the same module instance is not possible across setup() calls
    // (each resets modules), so simulate the realistic flow within one module load:
    vi.resetModules()
    let online = true
    vi.doMock('./NetworkMonitor', () => ({
      getNetworkMonitor: () => ({ isOnline: () => online }),
    }))
    vi.doMock('../api/salesApi', () => ({
      productsApi: { listProducts },
    }))
    const { inventoryService } = await import('./InventoryService')

    await inventoryService.listProducts() // online, warms cache
    online = false
    listProducts.mockClear()

    const result = await inventoryService.listProducts()

    expect(result).toEqual(cached)
    expect(listProducts).not.toHaveBeenCalled()
  })

  it('throws a descriptive error when offline with no prior cache at all', async () => {
    const listProducts = vi.fn()
    const service = await setup({ online: false, listProducts })

    await expect(service.listProducts()).rejects.toThrow(/no prior cache/i)
    expect(listProducts).not.toHaveBeenCalled()
  })

  it('findByBarcode matches against any barcode in the product\'s barcode array', async () => {
    const products = [
      product({ id: 'a', barcode: ['111', '222'] }),
      product({ id: 'b', barcode: ['333'] }),
    ]
    const listProducts = vi.fn(async () => products)
    const service = await setup({ online: true, listProducts })
    await service.listProducts()

    expect(service.findByBarcode('222')?.id).toBe('a')
    expect(service.findByBarcode('333')?.id).toBe('b')
    expect(service.findByBarcode('does-not-exist')).toBeUndefined()
  })
})
