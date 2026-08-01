# Getting Started — Architecture-Guided Development

Welcome! This project uses a **hybrid Web + Desktop architecture** (Tauri v2 + React + Fastify). All code decisions flow from [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 📚 Read First (In This Order)

1. **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** (22 KB)
   - Tech stack & why each choice
   - Platform detection & service factories
   - Offline/online rules (critical for sales flow)
   - Sync engine & conflict resolution
   - Development timeline

2. **[`CODING_GUIDELINES.md`](./CODING_GUIDELINES.md)** (13 KB)
   - File header convention (every file links to `ARCHITECTURE.md §`)
   - Platform branching rules (no `window.__TAURI__` in UI code)
   - Interface-first design
   - Offline/online patterns (sales vs account balance)
   - Zustand store pattern

3. **[`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)** (12 KB)
   - File locations quick reference
   - Which files do what
   - Dependency flow diagram
   - Checklist for new features

4. **[`README.md`](./README.md)** (8.4 KB)
   - Quick start commands
   - First screen walkthrough
   - Troubleshooting

---

## ⚡ TL;DR — Get Running in 5 Minutes

### 1. Install

```bash
# Prerequisites: Node ≥20, pnpm ≥9
pnpm install
```

### 2. Start Backend

```bash
# Terminal 1: Databases
pnpm docker:up

# Terminal 2: Fastify server
pnpm dev:server
```

You should see:
```
[server] listening on http://localhost:3000
```

### 3. Start Frontend

**Option A: Browser (Web)**
```bash
pnpm dev:web
# Opens http://localhost:5173
```

**Option B: Desktop**
```bash
pnpm dev:desktop
# Tauri dev mode (hot reload enabled)
```

### 4. Test

- Scan a barcode (or click "Quick Add" button)
- Add items to cart
- Click "Checkout (Cash)"
- Print receipt (browser print or thermal printer)

---

## 🏗️ Architecture at a Glance

### Single Codebase, Two Platforms

```
┌─────────────────────────────────────────┐
│  React 19 (packages/ui/PosScreen.tsx)  │ ← Same code for both!
└──────────┬──────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
 WEB         DESKTOP
 ├─ Browser   ├─ Tauri v2
 ├─ Vite      ├─ React
 ├─ REST API  ├─ Rust backend
 └─ Fetch     ├─ SQLite
              └─ Serial port
```

### Key Concepts

| Concept | Enforced By | What It Means |
|---------|------------|---------------|
| **Platform Detection** | `PlatformDetectionService` | Runtime check: `window.__TAURI__` → "desktop", else "web" |
| **Factory Pattern** | `getPrinterService()`, `getBarcodeService()`, etc. | UI never imports concrete classes; factory picks the right one |
| **Offline/Online** | `useSaleStore` + `NetworkMonitor` | Sales queue locally if offline, auto-sync on reconnect |
| **Account Balance** | `AccountBalanceService` | **Throws** `OfflineBalanceError` if offline (never caches) |
| **Barcode Events** | `BARCODE_EVENT = 'barcode-scanned'` | Must match in Rust + TypeScript |

---

## 📁 Where to Write Code

### Want to add a printer feature?

1. **Interface:** `packages/core/src/services/interfaces/IPrinterService.ts`
2. **Web impl:** `packages/core/src/services/web/BrowserPrinterService.ts`
3. **Desktop impl:** `packages/core/src/services/desktop/TauriPrinterService.ts`
4. **Rust impl:** `apps/desktop/src-tauri/src/commands/printer.rs`
5. **Factory:** `packages/core/src/services/printerServiceFactory.ts`
6. **UI:** `packages/ui/src/PosScreen.tsx`

### Want to add offline support for a new data type?

1. **Add to store:** `packages/core/src/store/useSaleStore.ts` (or create a new store)
2. **Create queue interface:** `packages/core/src/services/interfaces/ILocalSaleQueue.ts`
3. **Web queue:** `packages/core/src/services/web/InMemorySaleQueue.ts`
4. **Desktop queue:** `packages/core/src/services/desktop/TauriLocalSaleQueue.ts` + Rust SQL
5. **Sync logic:** Update `useSaleStore.syncPendingSales()` or create sync endpoint

---

## 🔑 Critical Rules

### ❌ Never Do This

```typescript
// WRONG: Importing concrete class in UI
import { TauriPrinterService } from '@pos-erp/core/services/desktop'

// WRONG: Checking platform in UI code
if (window.__TAURI__) { ... }

// WRONG: Caching account balance offline
const balance = cachedBalance ?? await fetchBalance()

// WRONG: Ignoring offline errors
try {
  await checkAccountBalance()
} catch (err) {
  // Silently continue — NOT ALLOWED
}
```

### ✅ Always Do This

```typescript
// RIGHT: Use the factory
import { getPrinterService } from '@pos-erp/core'
const printer = getPrinterService()

// RIGHT: Platform detection inside factory only
export function getPrinterService() {
  if (platform.isDesktop()) {
    return new TauriPrinterService()
  }
  return new BrowserPrinterService()
}

// RIGHT: Throw when offline
if (!networkMonitor.isOnline()) {
  throw new OfflineBalanceError(accountId)
}

// RIGHT: Catch and show error
try {
  const balance = await checkAccountBalance(id)
} catch (err) {
  if (err instanceof OfflineBalanceError) {
    showWarning('Please go online')
  } else {
    throw err  // Re-throw unexpected errors
  }
}
```

---

## 🚀 Development Workflow

### Starting a New Feature

1. **Check `ARCHITECTURE.md`** — Is there already a section on this?
2. **Check `CODING_GUIDELINES.md`** — What pattern applies?
3. **Create interface** in `packages/core/src/services/interfaces/`
4. **Implement for web** + **desktop** (separate classes)
5. **Create factory** to pick the right one
6. **Update store** (Zustand) if stateful
7. **Test both platforms** (`pnpm dev:web` and `pnpm dev:desktop`)
8. **Commit** with `[§N <Name>]` reference to ARCHITECTURE.md section

### File Header Convention

Every `.ts`, `.tsx`, `.rs` file starts with:

```typescript
// packages/core/src/services/web/BrowserPrinterService.ts
// ─────────────────────────────────────────────────────────────
// Handles printing on web platform using browser print dialog.
//
// Architecture rule: §8 Hardware Integration
// Implementation: Browser only (no ESC/POS)
//
// Consumed by: getPrinterService() factory
// ─────────────────────────────────────────────────────────────
```

This ties every line of code back to an architectural decision.

---

## 🧪 Running Tests

```bash
# Unit tests (services, store, helpers)
pnpm test

# TypeScript checking (strict mode enforced)
pnpm typecheck

# Linting (ESLint)
pnpm lint

# E2E tests (web only, Playwright)
pnpm test:e2e
```

---

## 📊 Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Core layer** | ✅ Complete | Platform detection, factories, store |
| **Web app** | ✅ Skeleton | Entry point ready, missing: Vite plugins, CSS |
| **Desktop app** | ✅ Complete | Tauri v2, Rust backend, all commands registered |
| **Server** | 🟡 Partial | Fastify setup + health endpoint; routes skeleton |
| **UI (PosScreen)** | ✅ Demo | Barcode + cart + checkout + print working |
| **Sync engine** | ✅ Design | `useSaleStore` flow complete; DB schema ready |
| **E2E tests** | ⏳ To do | Playwright setup ready, specs pending |
| **Docker setup** | ✅ Ready | postgres + redis in docker-compose |

---

## 🆘 Troubleshooting

### "Failed to resolve module '@pos-erp/core'"
→ Run `pnpm install` in monorepo root, then `pnpm build` to link packages

### "BarcodeService throws 'BARCODE_EVENT is undefined'"
→ Check that `BARCODE_EVENT` matches in `hardware/barcode.rs` and `BarcodeService.ts` (both should be `'barcode-scanned'`)

### "Offline queue isn't syncing"
→ Check that server is running (`pnpm dev:server`), and `NetworkMonitor.isOnline()` returns true

### "Account balance check throws OfflineBalanceError"
→ **This is intentional!** Go online or handle the error in UI

### "Printer won't print on desktop"
→ Run `list_printers()` to verify your printer is recognized; check `POS_BARCODE_PORT` env var for serial port config

---

## 📖 Next Steps

1. ✅ Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) (all 12 sections)
2. ✅ Read [`CODING_GUIDELINES.md`](./CODING_GUIDELINES.md) (understand the patterns)
3. ✅ Run `pnpm dev` (starts web + server), then `pnpm dev:desktop` in a separate terminal (opens the native window)
4. ✅ Test the demo (scan barcode → checkout → print)
5. ✅ Look at [`packages/ui/src/PosScreen.tsx`](./packages/ui/src/PosScreen.tsx) — see how it wires everything
6. ✅ Pick a module to extend (Inventory? Finance?) and follow the checklist

---

## 🤝 Contributing

Before opening a PR:
- [ ] Read `ARCHITECTURE.md` section relevant to your change
- [ ] Follow `CODING_GUIDELINES.md` patterns
- [ ] Add file header comment linking to `§`
- [ ] Commit message includes `[§N <Name>]` reference
- [ ] Pass: `pnpm typecheck && pnpm lint && pnpm test`
- [ ] Test on both web (`pnpm dev:web`) and desktop (`pnpm dev:desktop`)

---

**Good luck! Architecture-driven development makes everything coherent and traceable. 🚀**
