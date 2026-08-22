// packages/core/src/index.ts
// ─────────────────────────────────────────────────────────────
// Public API of @pazariopos/core. UI apps (web + desktop) should only
// import from this barrel — never reach into services/web/* or
// services/desktop/* directly. This keeps the platform switch
// (factory pattern) as the single source of truth.
// ─────────────────────────────────────────────────────────────

// Types
export * from './types/domain'

// Platform detection
export { platform } from './platform/PlatformDetectionService'
export type { PlatformType } from './platform/PlatformDetectionService'

// Interfaces (for typing custom mocks in tests)
export type { IPrinterService, PrinterConfig, PrintResult, PaperWidth } from './services/interfaces/IPrinterService'
export { DEFAULT_PRINTER_CONFIG } from './services/interfaces/IPrinterService'
export type { IBarcodeService, BarcodeEvent, BarcodeHandler, BarcodeFormat } from './services/interfaces/IBarcodeService'
export type { INetworkMonitor, NetworkStatusHandler } from './services/interfaces/INetworkMonitor'
export type { ILocalSaleQueue } from './services/interfaces/ILocalSaleQueue'

// Factories — the only way UI code should obtain a service instance
export { getPrinterService } from './services/printerServiceFactory'
export { getBarcodeService } from './services/barcodeServiceFactory'
export { getNetworkMonitor } from './services/NetworkMonitor'
export { getLocalSaleQueue } from './services/localSaleQueueFactory'

// Account balance (offline-forbidden by design)
export { accountBalanceService, OfflineBalanceError } from './services/AccountBalanceService'
export type { AccountBalance } from './services/AccountBalanceService'

// Inventory (offline-tolerant — safe to serve cached data)
export { inventoryService } from './services/InventoryService'

// API client (used directly by the store; exposed for advanced use / testing)
export {
  salesApi, purchasesApi, accountsApi, productsApi, categoriesApi, cashRegistersApi, bankAccountsApi, chequesApi, reportsApi,
  authApi, usersApi, stockCountsApi,
  ApiError, setApiBaseUrl, setAuthToken,
} from './api/salesApi'
export type { CreateAccountInput, CreateCategoryInput, CreateChequeInput, CreateUserInput, UpdateUserInput, CreateProductInput, UpdateProductInput, CreatePurchaseInput } from './api/salesApi'

// Stores
export { useSaleStore } from './store/useSaleStore'
export type { SaleStoreState, SaleSubmitOutcome } from './store/useSaleStore'
export { useInventoryStore } from './store/useInventoryStore'
export type { InventoryStoreState } from './store/useInventoryStore'
export { useAccountStore } from './store/useAccountStore'
export type { AccountStoreState } from './store/useAccountStore'
export { useFinanceStore } from './store/useFinanceStore'
export type { FinanceStoreState } from './store/useFinanceStore'
export { useAuthStore } from './store/useAuthStore'
export type { AuthStoreState } from './store/useAuthStore'
export { useStockCountStore } from './store/useStockCountStore'
export type { StockCountStoreState } from './store/useStockCountStore'
