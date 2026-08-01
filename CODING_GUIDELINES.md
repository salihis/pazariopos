# Coding Guidelines — Architecture Enforcement

This document enforces the decisions in [`ARCHITECTURE.md`](./ARCHITECTURE.md) at the code level.

**Read this before writing a single line.**

---

## 1. File Header Rule

Every TypeScript, Rust, and Python file must start with a comment block:

```typescript
// packages/core/src/services/web/BrowserPrinterService.ts
// ─────────────────────────────────────────────────────────────
// [1-2 line description of what this file does]
//
// Architecture rule(s) it enforces: §[N] [RULE NAME]
// Example: §3 Platform Detection, §8 Hardware Abstraction
//
// Dependencies it bridges:
//   • imports from: [what this imports]
//   • exported to: [what depends on this]
// ─────────────────────────────────────────────────────────────
```

**Why?** Every file becomes self-documenting. A developer reading the code immediately knows which architectural decision led to this file's existence.

---

## 2. Platform Branching Rule

### ❌ WRONG — Direct platform check in UI code
```typescript
// apps/web/src/MyComponent.tsx
import { TauriPrinterService } from '@pos-erp/core/services/desktop'

if (window.__TAURI__) {
  const printer = new TauriPrinterService()
}
```

### ✅ RIGHT — Use the factory
```typescript
// apps/web/src/MyComponent.tsx
import { getPrinterService } from '@pos-erp/core'

const printer = getPrinterService()  // Platform detection is inside the factory
```

**Rule:** All platform branching happens in ONE place:
- `PlatformDetectionService.ts` (determines `type`)
- Factory functions (`getPrinterService()`, `getBarcodeService()`, etc.)

**No other file may import `window.__TAURI__` or branch on `platform.isDesktop()`.**

---

## 3. Interface-First Design

### ❌ WRONG — Implementation leaks into UI
```typescript
// UI code importing concrete class
import { TauriPrinterService } from '@pos-erp/core/services/desktop'
import { BrowserPrinterService } from '@pos-erp/core/services/web'

const printer = isBrowser ? new BrowserPrinterService() : new TauriPrinterService()
```

### ✅ RIGHT — Import interface + factory
```typescript
// UI code
import { getPrinterService } from '@pos-erp/core'
import type { IPrinterService } from '@pos-erp/core'

const printer: IPrinterService = getPrinterService()
```

**Rule:** Every service must have:
1. An **interface** in `services/interfaces/I*.ts` (the contract)
2. A **web implementation** in `services/web/` (for browser)
3. A **desktop implementation** in `services/desktop/` (for Tauri)
4. A **factory** in `services/*Factory.ts` (picks the right one)

UI code only knows about the interface and the factory.

---

## 4. Offline/Online Architecture (Critical)

See `ARCHITECTURE.md §7 OFFLINE MODE` before writing any data-fetching code.

### Sales (CAN be offline)

```typescript
// ✅ CORRECT — useSaleStore.submitSale()
async submitSale(payments: PaymentLine[]): Promise<SaleSubmitOutcome> {
  const { cart, networkStatus } = get()

  // If ONLINE: try API first
  if (networkStatus === 'online') {
    try {
      const persisted = await salesApi.createSale(draft)
      return { mode: 'online', sale: persisted }
    } catch (err) {
      // Fall back to queue if mid-request failure
      return enqueueOffline(draft)
    }
  }

  // If OFFLINE: queue immediately
  return enqueueOffline(draft)
}
```

### Account Balance (CANNOT be offline)

```typescript
// ✅ CORRECT — Must throw when offline, never silent cache
async checkAccountBalance(accountId: string): Promise<number> {
  const monitor = getNetworkMonitor()

  if (!monitor.isOnline()) {
    throw new OfflineBalanceError(accountId)
  }

  return accountsApi.getBalance(accountId).then(r => r.balance)
}
```

**Rule:**
- **Sales/Inventory:** Safe to serve from local cache when offline
- **Account Balances:** MUST throw `OfflineBalanceError` — never silent fallback
- **Any new query:** Ask first: "Can this data safely go stale?" If not, require online

---

## 5. Zustand Store Convention

All Zustand stores in `packages/core/src/store/` must:

### Store Shape
```typescript
export interface YourStoreState {
  // ── Data ──
  items: Item[]
  selectedId: string | null

  // ── Lifecycle / sync state ──
  isSyncing: boolean
  lastSyncError: string | null

  // ── Actions ──
  addItem(item: Item): void
  removeItem(id: string): void
  syncPending(): Promise<void>

  // ── Lifecycle ──
  init(): () => void  // Returns teardown function
}

export const useYourStore = create<YourStoreState>()(
  subscribeWithSelector((set, get) => ({
    // ... implementation
  }))
)
```

### Initialization (in React)
```typescript
useEffect(() => {
  const teardown = useYourStore.getState().init()
  return teardown  // Always clean up
}, [])
```

**Rule:** Every store must have an `init()` method that:
1. Seeds the store from persistent state (if any)
2. Subscribes to network/system changes
3. Returns an unsubscribe function for cleanup

---

## 6. Barcode Event Naming (Web + Desktop Sync)

### In Rust (apps/desktop/src-tauri/src/hardware/barcode.rs)
```rust
pub const BARCODE_EVENT: &str = "barcode-scanned"

// When a barcode is scanned:
app_handle.emit(BARCODE_EVENT, BarcodePayload { ... })
```

### In TypeScript (packages/core/src/services/BarcodeService.ts)
```typescript
const TAURI_BARCODE_EVENT = 'barcode-scanned'  // SAME STRING

listen<BarcodePayload>(TAURI_BARCODE_EVENT, event => {
  // Handle scan
})
```

**Rule:** These strings MUST match exactly. If you change one, change both. Consider adding a shared constant to `packages/core/types/` if the pain gets real.

---

## 7. Error Handling Pattern

### Offline-Specific Errors
```typescript
// Thrown by services when offline access is forbidden
export class OfflineBalanceError extends Error {
  constructor(accountId: string) {
    super(`Cannot fetch balance for account "${accountId}" while offline.`)
    this.name = 'OfflineBalanceError'
  }
}

// UI code catches it deliberately
try {
  const balance = await checkAccountBalance('customer-123')
} catch (err) {
  if (err instanceof OfflineBalanceError) {
    // Show "please go online" message
    showWarning(err.message)
  } else {
    // Re-throw unexpected errors
    throw err
  }
}
```

### API Errors
```typescript
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// Caller can check status code
try {
  await salesApi.createSale(sale)
} catch (err) {
  if (err instanceof ApiError && err.status === 409) {
    // Handle conflict (e.g., duplicate sale)
  }
}
```

---

## 8. TypeScript Strictness

Every file compiles with `typescript: strict: true`:

```typescript
// ❌ WRONG
const value = someOptionalField.prop  // error: may be undefined

// ✅ RIGHT
const value = someOptionalField?.prop ?? defaultValue
```

Use utility types from `packages/core/src/types/domain.ts`:
```typescript
import type { Sale, CartLine, NetworkStatus } from '@pos-erp/core'
```

Never use `any`. If you must type-erase, use `unknown` and guard it:
```typescript
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'id' in data) {
    console.log(data.id)  // now TS knows `id` exists
  }
}
```

---

## 9. Rust Conventions (apps/desktop/src-tauri/src/)

### Command DTOs (Rust ↔ TypeScript)

Every `#[tauri::command]` must:
1. Define input/output DTOs in Rust with `#[derive(Deserialize, Serialize)]`
2. Mirror the shapes in TypeScript (in comments or types in `TauriPrinterService.ts`)
3. Use `#[serde(rename = "camelCase")]` for Tauri's JSON bridge

```rust
// Rust command
#[tauri::command]
pub async fn print_receipt(
    sale: SaleDto,              // ← Input DTO
    printer_name: Option<String>,
) -> AppResult<PrintResultDto> {  // ← Output DTO
    // ...
}

// TypeScript invocation
const result = await invoke<PrintResultDto>('print_receipt', {
  sale,
  printerName: config.printerName,  // Note: TS uses camelCase
})
```

### Error Handling

```rust
pub enum AppError {
  SerialPort(String),
  Database(String),
}

impl From<serialport::Error> for AppError {
  fn from(e: serialport::Error) -> Self {
    AppError::SerialPort(e.to_string())
  }
}

pub type AppResult<T> = Result<T, AppError>;
```

---

## 10. Testing Convention

### File Naming
- Source: `src/services/BarcodeService.ts`
- Test: `src/services/BarcodeService.test.ts`

### Mocking (Dependency Injection for Tests)

```typescript
// ✅ Testable — accepts dependencies
function createSaleStore(
  networkMonitor?: INetworkMonitor,
  salesApi?: typeof salesApi,
) {
  return create<SaleStoreState>()(set => ({
    // ... use provided deps or defaults
  }))
}

// In tests:
const mockNetworkMonitor: INetworkMonitor = {
  status: 'online',
  isOnline: () => true,
  onStatusChange: handler => {
    handler('online')
    return () => {}
  },
  start: () => {},
  stop: () => {},
}

test('sale submits online', async () => {
  const store = createSaleStore(mockNetworkMonitor)
  // ...
})
```

---

## 11. Commit Message Convention

Reference `ARCHITECTURE.md §` in commit messages:

```
feat(core): factory pattern for printer service [§8 Hardware Abstraction]

- Adds IPrinterService interface
- Implements BrowserPrinterService and TauriPrinterService
- getPrinterService() factory routes to correct impl

Relates to: ARCHITECTURE.md §8
```

---

## 12. Folder Naming & Module Exports

### Explicit Re-exports (Barrel Pattern)

```typescript
// packages/core/src/services/interfaces/index.ts
export type { IPrinterService } from './IPrinterService'
export type { IBarcodeService } from './IBarcodeService'
```

UI code:
```typescript
import type { IPrinterService, IBarcodeService } from '@pos-erp/core/services/interfaces'
// or just
import type { IPrinterService } from '@pos-erp/core'  // via barrel in packages/core/src/index.ts
```

---

## 13. Documentation Comments

Every public export needs a JSDoc:

```typescript
/**
 * Determines the runtime platform (desktop vs web).
 * Called once on app start; result is cached in the singleton.
 *
 * Returns 'desktop' if `window.__TAURI_INTERNALS__` is truthy,
 * 'mobile-web' if user agent matches mobile patterns,
 * otherwise 'web'.
 *
 * @example
 * if (platform.isDesktop()) {
 *   const printer = getTauriPrinterService()
 * }
 */
export class PlatformDetectionService { ... }
```

---

## 14. Folder/File Naming

| Category | Naming | Example |
|----------|--------|---------|
| Interfaces | `I<Name>Service.ts` | `IPrinterService.ts` |
| Implementations | `<Name>Service.ts` | `BrowserPrinterService.ts` |
| Factories | `<name>Factory.ts` | `printerServiceFactory.ts` |
| Stores | `use<Name>Store.ts` | `useSaleStore.ts` |
| Types | `domain.ts` or `<feature>.ts` | `domain.ts`, `sync.ts` |
| Tests | `<source>.test.ts` | `BarcodeService.test.ts` |

---

## 15. What NOT to Do

### ❌ Anti-Patterns

| Anti-Pattern | Why | What to Do |
|--------------|-----|-----------|
| Import concrete class in UI | Breaks factory pattern | Use `getXxxService()` factory |
| Catch `OfflineBalanceError` silently | Allows stale data | Re-throw or show warning |
| Change event name without syncing Rust ↔ TS | Desktop breaks | Update both files + add comment |
| Use `any` type | Defeats TypeScript safety | Use `unknown` + guards or type properly |
| Skip `init()` in stores | Memory leaks, monitors don't start | Always call in `useEffect` |
| Commit without `ARCHITECTURE.md` section ref | Hard to trace decisions | Add `[§N <Name>]` to messages |
| Cache account balances locally | Authorizes sales over credit limit | Throw error, never cache |
| Hardcode branch/register/cashier IDs | Not portable | Wire from session/auth context |

---

## Quick Checklist Before Committing

- [ ] Read `ARCHITECTURE.md §` for the feature I'm building
- [ ] File has a header comment linking to the relevant `§`
- [ ] No `window.__TAURI__` checks outside factories/platform detection
- [ ] All imports use public factories, not concrete classes
- [ ] Account balance logic throws when offline (never caches)
- [ ] TypeScript passes `pnpm typecheck` with strict mode
- [ ] Barcode events use the constant `BARCODE_EVENT = 'barcode-scanned'` (both platforms)
- [ ] Rust DTOs match TypeScript invocation shapes (camelCase)
- [ ] All public types/functions have JSDoc
- [ ] Commit message has `[§N <Name>]` reference
- [ ] Tests run: `pnpm test`

---

**Enforcing these rules keeps the codebase coherent and ties every line back to an architectural decision.**
