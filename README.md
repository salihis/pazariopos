# POS ERP — Hybrid Web + Desktop System

**Point of Sale | Inventory | Accounts Receivable/Payable | Finance**

Single React codebase runs on:
- 🌐 **Web**: Browser (Chrome, Firefox, Safari)
- 🖥️ **Desktop**: Windows, macOS, Linux (via Tauri v2)

---

## 📋 Before You Start

**READ THIS FIRST:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)

All architectural decisions are documented there. When in doubt:
1. Check `ARCHITECTURE.md` (Sections 1–12)
2. It explains the "why" behind every choice
3. It defines non-negotiable rules (e.g., account balance reads must fail offline)

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0
- **Rust** ≥ 1.75 (for desktop builds only)

### Setup

```bash
# Install dependencies across the monorepo
pnpm install

# Start dev servers (all at once)
pnpm dev

# Or start individually:
pnpm dev:web       # http://localhost:5173
pnpm dev:desktop   # Tauri dev mode
pnpm dev:server    # Fastify on :3000
```

### First Screen

Both web and desktop render the same **PosScreen** component:
- Scan barcodes (HID keyboard on web; Tauri event on desktop)
- Add items to cart
- Submit sale (online → REST API; offline → SQLite queue)
- Print receipt (browser print on web; ESC/POS on desktop)

See: [`packages/ui/src/PosScreen.tsx`](./packages/ui/src/PosScreen.tsx)

---

## 🏗️ Architecture Highlights

### Platform Detection (Runtime)
```typescript
import { platform } from '@pos-erp/core'

if (platform.isDesktop()) {
  // Use Tauri/Rust commands
} else {
  // Use REST API
}
```
No compile-time branching — same binary works everywhere.

### Services (Factory Pattern)
Never import concrete classes directly:
```typescript
// ❌ WRONG
import { TauriPrinterService } from '@pos-erp/core'

// ✅ RIGHT
import { getPrinterService } from '@pos-erp/core'
const printer = getPrinterService()
```

### Offline/Online Rules (in `useSaleStore`)

| Data | Online | Offline |
|------|--------|---------|
| Sales | Direct POST to API | Queue in `sync_queue` |
| Inventory Read | API | Cached local copy |
| Account Balance | Query server | **❌ Error (OfflineBalanceError)** |

### Barcode Event Name (must match across platforms)
```rust
// Rust: apps/desktop/src-tauri/src/hardware/barcode.rs
pub const BARCODE_EVENT: &str = "barcode-scanned"
```
```typescript
// TypeScript: packages/core/src/services/BarcodeService.ts
const TAURI_BARCODE_EVENT = 'barcode-scanned'  // same string
```

---

## 📁 Folder Structure

```
pos-erp/
├── ARCHITECTURE.md              ← Read this first
├── README.md                    ← You are here
├── package.json                 ← Root (Turborepo)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
│
├── packages/
│   ├── core/                    ← Shared business logic (platform-agnostic)
│   │   ├── services/interfaces/ ← Contracts (IPrinterService, IBarcodeService...)
│   │   ├── services/web/        ← Browser implementations
│   │   ├── services/desktop/    ← Tauri implementations
│   │   ├── store/               ← Zustand (useSaleStore with offline support)
│   │   ├── types/               ← Domain types
│   │   ├── platform/            ← Platform detection
│   │   └── api/                 ← REST client (Fetch wrapper)
│   │
│   ├── ui/                      ← Shared React components
│   │   └── PosScreen.tsx        ← Main demo screen
│   │
│   └── types/                   ← Shared TypeScript interfaces
│
├── apps/
│   ├── web/                     ← React SPA (Vite)
│   │   ├── index.html
│   │   ├── src/main.tsx         ← Entry point
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── desktop/                 ← Tauri app (React + Rust)
│       ├── src/main.tsx         ← React entry (identical to web)
│       ├── src-tauri/           ← Rust backend
│       │   ├── src/
│       │   │   ├── main.rs      ← Tauri setup, command registration
│       │   │   ├── commands/    ← IPC handlers (printer, barcode, sales)
│       │   │   ├── db/          ← SQLite pool, sync_queue schema
│       │   │   ├── hardware/    ← ESC/POS, serial port, HID
│       │   │   └── error.rs
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       ├── vite.config.ts
│       └── package.json
│
├── server/                      ← Fastify v5 + Prisma
│   ├── src/
│   │   ├── main.ts              ← Entry point
│   │   └── routes/
│   │       ├── health.ts        ← /api/health (ping endpoint)
│       ├── sales.ts             ← /api/sales, /api/sales/sync
│       └── accounts.ts          ← /api/accounts/:id/balance
│   ├── package.json
│   └── tsconfig.json
│
└── docker/
    └── docker-compose.yml       ← PostgreSQL + Redis (dev)
```

---

## 🚀 Development Workflow

### 1. Start Services
```bash
pnpm docker:up        # PostgreSQL + Redis (one-time setup)
pnpm dev:server       # Fastify on localhost:3000
```

### 2. Start Frontend
```bash
# For web SPA:
pnpm dev:web          # React on localhost:5173

# For desktop app:
pnpm dev:desktop      # Tauri + React (dev mode with hot reload)
```

### 3. Test the Flow

1. **Scan a barcode** → Product added to cart
   - Web: Type barcode + Enter (HID mode)
   - Desktop: Click "Simulate Barcode" or plug in a USB scanner
2. **Checkout** → Creates a sale
   - Online: Goes to API immediately
   - Offline: Queued locally (visible in UI as "X pending sync")
3. **Print receipt**
   - Web: Opens browser print dialog
   - Desktop: Sends ESC/POS bytes to thermal printer
4. **Check account balance**
   - Online: Shows balance from server
   - Offline: Throws `OfflineBalanceError` (intentional!)

---

## 🧪 Testing

```bash
# Unit tests (services, store, etc.)
pnpm test

# Type checking across monorepo
pnpm typecheck

# Linting
pnpm lint

# E2E (web only, via Playwright)
pnpm test:e2e
```

---

## 🔧 Key Commands

| Command | What It Does |
|---------|------------|
| `pnpm dev` | Starts web + server in parallel (run `pnpm dev:desktop` separately — it opens a native window and needs its own terminal) |
| `pnpm build` | Builds all packages (TypeScript check + output) |
| `pnpm build:desktop` | Builds desktop `.exe` / `.dmg` / `.deb` |
| `pnpm lint` | Runs ESLint across all packages |
| `pnpm typecheck` | TypeScript --noEmit across monorepo |
| `pnpm db:migrate` | Runs Prisma migrations (server only) |
| `pnpm docker:up` | Starts dev databases (PostgreSQL + Redis) |
| `pnpm docker:down` | Stops dev databases |
| `pnpm clean` | Nukes node_modules + dist across all packages |

---

## 📚 Architecture Decisions

Every non-trivial decision is in [`ARCHITECTURE.md`](./ARCHITECTURE.md). Examples:

- **§1: Why Tauri v2 over Electron?** → Bundle size, native security, single codebase
- **§3: Platform detection strategy** → Runtime `window.__TAURI__` check, no compile-time branching
- **§4: Sync engine** → `sync_queue` table with `device_id + updated_at` conflict resolution
- **§7: Offline rules** → Sales work offline; account balances do NOT (throws error)
- **§9: Hardware integrations** → ESC/POS printer, barkod scanner, serial port handling

When in doubt about a code decision, grep the architecture doc for context.

---

## 🐛 Common Issues

### "BarcodeService won't initialize"
→ Check that `BARCODE_EVENT` constant matches in `hardware/barcode.rs` and `BarcodeService.ts`

### "Account balance check always fails offline"
→ **Intentional by design.** See `§7 OFFLINE MODE` in `ARCHITECTURE.md`. Catch `OfflineBalanceError` in your UI.

### "Printer won't print on desktop"
→ Check that the printer is listed by `list_printers()`. On Windows, COM ports may need administrative access.

### "Sync queue isn't clearing"
→ Verify the server is running (`pnpm dev:server`). Check `lastSyncError` in the store.

---

## 📖 Next Steps

1. **Read** [`ARCHITECTURE.md`](./ARCHITECTURE.md) in full (sections 1–12)
2. **Run** `pnpm install && pnpm dev`
3. **Open** http://localhost:5173 (web) or launch the desktop app
4. **Scan** a demo barcode, checkout, print
5. **Code** — all service factories and interfaces are in `packages/core/`; UI is in `packages/ui/`

---

## 📝 License

Internal project — POS ERP Team
