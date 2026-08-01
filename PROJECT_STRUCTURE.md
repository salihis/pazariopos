# Project Structure Quick Reference

```
pos-erp/
│
├── 📖 DOCUMENTATION (START HERE)
│   ├── ARCHITECTURE.md           ← Design decisions, rules, tech stack
│   ├── CODING_GUIDELINES.md      ← How to enforce architecture in code
│   ├── README.md                 ← Setup, quick start, troubleshooting
│   └── PROJECT_STRUCTURE.md      ← You are here
│
├── 📦 CONFIGURATION (Monorepo setup)
│   ├── package.json              ← Root workspace config + scripts
│   ├── pnpm-workspace.yaml       ← Workspace folder definitions
│   ├── turbo.json                ← Turborepo pipeline
│   ├── tsconfig.base.json        ← Root TypeScript config
│   └── .gitignore
│
├── packages/
│   │
│   ├── core/                     ← [PLATFORM-AGNOSTIC BUSINESS LOGIC]
│   │   ├── src/
│   │   │   ├── index.ts          ← Public barrel export
│   │   │   │
│   │   │   ├── types/
│   │   │   │   └── domain.ts     ← Sale, Product, CartLine, etc.
│   │   │   │
│   │   │   ├── platform/
│   │   │   │   └── PlatformDetectionService.ts  ← Runtime web/desktop check
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── IPrinterService.ts
│   │   │   │   │   ├── IBarcodeService.ts
│   │   │   │   │   ├── INetworkMonitor.ts
│   │   │   │   │   └── ILocalSaleQueue.ts
│   │   │   │   │
│   │   │   │   ├── web/          ← Browser implementations
│   │   │   │   │   ├── BrowserPrinterService.ts
│   │   │   │   │   ├── InMemorySaleQueue.ts
│   │   │   │   │   └── receiptTemplate.ts
│   │   │   │   │
│   │   │   │   ├── desktop/      ← Tauri/Rust implementations
│   │   │   │   │   ├── TauriPrinterService.ts
│   │   │   │   │   └── TauriLocalSaleQueue.ts
│   │   │   │   │
│   │   │   │   ├── *Factory.ts   ← Factories pick right impl
│   │   │   │   ├── NetworkMonitor.ts
│   │   │   │   ├── BarcodeService.ts
│   │   │   │   └── AccountBalanceService.ts
│   │   │   │
│   │   │   ├── api/
│   │   │   │   └── salesApi.ts   ← REST client (Fetch wrapper)
│   │   │   │
│   │   │   └── store/
│   │   │       └── useSaleStore.ts  ← Zustand: offline/online + sync
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/                       ← [SHARED REACT COMPONENTS]
│   │   ├── src/
│   │   │   ├── index.ts          ← Barrel: exports PosScreen
│   │   │   └── PosScreen.tsx     ← Demo: barcode + cart + checkout + print
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── types/                    ← [RESERVED for future shared types]
│       └── (currently empty, types in packages/core/src/types/)
│
├── apps/
│   │
│   ├── web/                      ← [BROWSER APP (Vite SPA)]
│   │   ├── index.html
│   │   ├── src/
│   │   │   └── main.tsx          ← React entry (mounts PosScreen)
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── desktop/                  ← [TAURI DESKTOP APP]
│       ├── index.html
│       ├── src/
│       │   └── main.tsx          ← React entry (IDENTICAL to web)
│       ├── vite.config.ts        ← Fixed port :1420 (matches tauri.conf.json)
│       │
│       ├── src-tauri/            ← Rust backend (core of desktop magic)
│       │   ├── src/
│       │   │   ├── main.rs       ← Entry: SQLite setup, command registry
│       │   │   │
│       │   │   ├── commands/     ← #[tauri::command] IPC handlers
│       │   │   │   ├── mod.rs
│       │   │   │   ├── printer.rs    ← print_receipt, test_print
│       │   │   │   ├── barcode.rs    ← simulate_barcode_scan, list_ports
│       │   │   │   └── sales.rs      ← save_sale_offline, sync operations
│       │   │   │
│       │   │   ├── db/           ← SQLite pool + schema
│       │   │   │   ├── mod.rs
│       │   │   │   ├── pool.rs       ← SqlitePool init, migrations
│       │   │   │   └── sync_queue.rs ← Offline sale queue table
│       │   │   │
│       │   │   ├── hardware/     ← Physical I/O
│       │   │   │   ├── mod.rs
│       │   │   │   ├── escpos.rs     ← ESC/POS builder (thermal printer)
│       │   │   │   ├── serial.rs     ← Serial port detection & writing
│       │   │   │   └── barcode.rs    ← Barcode listener (emits event)
│       │   │   │
│       │   │   └── error.rs      ← AppError, AppResult types
│       │   │
│       │   ├── Cargo.toml        ← Rust dependencies
│       │   └── tauri.conf.json   ← Tauri config (window, build, bundle)
│       │
│       ├── tsconfig.json
│       ├── package.json
│       └── README.md (if exists)
│
├── server/                       ← [FASTIFY v5 API]
│   ├── src/
│   │   ├── main.ts               ← Entry: app.listen()
│   │   └── routes/
│   │       ├── health.ts         ← GET/HEAD /api/health (ping endpoint)
│   │       ├── sales.ts          ← POST /api/sales, /api/sales/sync
│   │       └── accounts.ts       ← GET /api/accounts/:id/balance
│   │
│   ├── Dockerfile (if needed)
│   ├── prisma/                   ← Database schema (future)
│   │   └── schema.prisma
│   │
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md (if exists)
│
├── docker/                       ← [DEVELOPMENT INFRASTRUCTURE]
│   ├── docker-compose.yml        ← PostgreSQL + Redis (dev)
│   └── nginx.conf (if needed)    ← Reverse proxy (production)
│
└── .github/
    └── workflows/
        ├── ci.yml                ← Tests + type check on PR
        └── release.yml           ← Build desktop installers + publish
```

---

## 🔑 Key File Locations

| What | Where | Note |
|-----|-------|------|
| Platform decision | `packages/core/src/platform/PlatformDetectionService.ts` | Singleton that routes everything |
| Printer interface | `packages/core/src/services/interfaces/IPrinterService.ts` | Contract all impls follow |
| Browser printer | `packages/core/src/services/web/BrowserPrinterService.ts` | Uses `window.open` + CSS print |
| Desktop printer | `packages/core/src/services/desktop/TauriPrinterService.ts` | Calls Rust `print_receipt` |
| Printer factory | `packages/core/src/services/printerServiceFactory.ts` | Picks right impl based on platform |
| Rust printer impl | `apps/desktop/src-tauri/src/commands/printer.rs` | ESC/POS byte building + serial I/O |
| Barcode service | `packages/core/src/services/BarcodeService.ts` | Listens for scans (Tauri event or keydown) |
| Barcode event | `apps/desktop/src-tauri/src/hardware/barcode.rs` | Emits `barcode-scanned` event |
| Offline store | `packages/core/src/store/useSaleStore.ts` | Online→API, Offline→queue, sync on reconnect |
| Offline queue (desktop) | `packages/core/src/services/desktop/TauriLocalSaleQueue.ts` | SQLite persistence |
| Offline queue (web) | `packages/core/src/services/web/InMemorySaleQueue.ts` | In-memory, doesn't survive reload |
| Account balance | `packages/core/src/services/AccountBalanceService.ts` | **Throws** OfflineBalanceError if offline |
| Network monitor | `packages/core/src/services/NetworkMonitor.ts` | Pings `/api/health` every 10s |
| Demo UI | `packages/ui/src/PosScreen.tsx` | Barcode + cart + checkout + print screen |
| Web entry | `apps/web/src/main.tsx` | React root (browser SPA) |
| Desktop entry | `apps/desktop/src/main.tsx` | React root (Tauri WebView) — identical to web |
| Tauri setup | `apps/desktop/src-tauri/src/main.rs` | SQLite init, command registration, barcode listener |
| API health check | `server/src/routes/health.ts` | Target of NetworkMonitor pings |

---

## 🚀 First Commands After Setup

```bash
# 1. Install everything
pnpm install

# 2. Start backend + databases
pnpm docker:up
pnpm dev:server

# 3. In another terminal: start frontend
pnpm dev:web              # Browser: http://localhost:5173
# OR
pnpm dev:desktop          # Desktop app (Tauri dev mode)

# 4. Test the flow
# - Scan a barcode (keyboard or HID scanner)
# - Add to cart
# - Checkout → should create a sale (online if network OK)
# - Print receipt (browser print or thermal printer)
```

---

## 📋 What Each Layer Does

| Layer | Technology | Responsibility |
|-------|------------|-----------------|
| **User Layer** | Browser / Tauri WebView | Renders UI, captures input |
| **Frontend (shared)** | React 19 + TypeScript | PosScreen, state management (Zustand) |
| **Platform Bridge** | Factory pattern + PlatformDetectionService | Routes calls to right implementation |
| **Services (web)** | BrowserPrinterService, InMemorySaleQueue | REST API calls, browser APIs |
| **Services (desktop)** | TauriPrinterService, TauriLocalSaleQueue | Tauri invoke() to Rust, SQLite access |
| **IPC Bridge** | Tauri v2 (invoke + emit) | TypeScript ↔ Rust message passing |
| **Rust Backend** | Tokio + sqlx | Serial port, ESC/POS, SQLite, barcode listener |
| **Server API** | Fastify v5 | REST endpoints (sales, accounts, health) |
| **Database** | PostgreSQL (prod) / SQLite (desktop local) | Persistent data |

---

## 🔗 Dependency Flow

```
Browser/Tauri WebView
    ↓
React Component (PosScreen)
    ↓
Zustand Store (useSaleStore)
    ↓
Factories (getPrinterService, getBarcodeService, etc.)
    ├→ Web mode: REST API calls → Fastify server → PostgreSQL
    └→ Desktop mode: Tauri invoke() → Rust commands → SQLite / Serial port
```

---

## 📐 Architecture Enforcement Files

These files ensure the architecture stays intact:

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | **Read first** — all decisions documented |
| `CODING_GUIDELINES.md` | How to enforce decisions in code |
| `README.md` | Setup, quick start, troubleshooting |
| `PROJECT_STRUCTURE.md` | This file — file locations |
| File headers | Every `.ts`/`.tsx`/`.rs` file links to `ARCHITECTURE.md §` |
| Commit messages | Reference `[§N <Name>]` in commits |

---

## ✅ Checklist for New Features

Before writing code for a new feature (e.g., "Add Inventory Tracking"):

1. ✅ Find the relevant section in `ARCHITECTURE.md`
2. ✅ Check `CODING_GUIDELINES.md` for the pattern
3. ✅ Create interface(s) in `packages/core/src/services/interfaces/`
4. ✅ Implement for web in `packages/core/src/services/web/`
5. ✅ Implement for desktop in `packages/core/src/services/desktop/` or `apps/desktop/src-tauri/src/`
6. ✅ Create factory in `packages/core/src/services/*Factory.ts`
7. ✅ Add Zustand store (if stateful) in `packages/core/src/store/`
8. ✅ Update UI in `packages/ui/src/`
9. ✅ Add tests in `*.test.ts`
10. ✅ Commit with `[§N <Name>]` reference

---

**This structure keeps everything organized and traceable back to architectural decisions.**
