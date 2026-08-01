# 🖥️ Web + Masaüstü Hibrit Mimari Tasarım
## POS / Stok / Cari / Finans Sistemi

### ⚡ HIZLI REFERANS — Bu Tasarım Tüm Kodlamayı Yönetir

**Teknoloji Stack:**
- **Frontend:** React 19 + TypeScript 5 + Vite + Zustand v5
- **Desktop Wrapper:** Tauri v2 (Rust backend)
- **Web Backend:** Fastify v5 + Prisma ORM
- **Desktop DB:** SQLite (SQLCipher şifreli)
- **Server DB:** PostgreSQL
- **Monorepo:** pnpm workspaces + Turborepo

**Kritik Mimarı Kuralları:**

| Kural | Uygulanma Alanı | Açıklama |
|-------|-----------------|----------|
| **Platform Detection** | `packages/core` | Runtime'da `window.__TAURI__` ile web/desktop ayırt edilir |
| **Factory Pattern** | Tüm servisler | `getPrinterService()`, `getBarcodeService()` vb. — hiçbir zaman doğrudan import etmeyin |
| **Offline/Online Branch** | `useSaleStore` | ONLINE → REST API, OFFLINE → `sync_queue` |
| **Account Balance** | Tüm platformlar | **HIÇBIR ZAMAN** offline cache — `OfflineBalanceError` fırlatır |
| **Sync Rules** | Desktop SQLite | `updated_at + device_id` karşılaştırması, sunucu master karar verir |
| **Barcode Event** | `BARCODE_EVENT = 'barcode-scanned'` | Rust ve TypeScript tarafında eşleşmeli |

**Dosya Yapısı Hızlı Bakış:**
```
pos-erp/
├── ARCHITECTURE.md          ← Burası — tüm kurallar burada
├── packages/core/           ← Tüm platform-bağımsız iş mantığı
│   ├── services/interfaces/ ← Contract'lar (IPrinterService, IBarcodeService...)
│   ├── services/web/        ← Browser uygulamaları (BrowserPrinterService...)
│   ├── services/desktop/    ← Tauri/Rust çağrıları (TauriPrinterService...)
│   └── store/useSaleStore   ← Offline/Online ve sync motoru
├── apps/web/                ← React SPA (Vite)
├── apps/desktop/            ← Tauri + React (aynı kod, farklı entry point)
│   └── src-tauri/           ← Rust katmanı (donanım, SQLite)
├── packages/ui/             ← Paylaşılan UI (PosScreen.tsx)
└── server/                  ← Fastify API
```

---

## 1. TEMEL MİMARİ KARAR: TAURI v2

**Seçim: React (Web) + Tauri v2 (Desktop Wrapper)**

Neden bu kombinasyon:

| Kriter | Electron | Tauri v2 | PWA | Karar |
|---|---|---|---|---|
| Bundle boyutu | ~150MB | ~8MB | 0MB | Tauri ✅ |
| RAM kullanımı | ~300MB | ~50MB | ~80MB | Tauri ✅ |
| Donanım erişimi (yazıcı, barkod) | ✅ | ✅ | ❌ | Tauri ✅ |
| Offline tam destek | ✅ | ✅ | Kısıtlı | Tauri ✅ |
| Güncelleme mekanizması | ✅ | ✅ | ✅ | Eşit |
| Web'de de çalışma | ❌ | ✅ | ✅ | Tauri ✅ |
| Rust backend güvenliği | ❌ | ✅ | - | Tauri ✅ |

**Sonuç:** Tek kod tabanı → Web'de browser'dan, masaüstünde `.exe/.dmg/.deb` olarak çalışır.

---

## 2. MİMARİ GENEL GÖRÜNÜM

```
┌─────────────────────────────────────────────────────────────┐
│                     KULLANICI KATMANI                       │
├─────────────────────┬───────────────────────────────────────┤
│   WEB TARAYICI      │        MASAÜSTÜ (Tauri v2)            │
│   Chrome/Firefox    │        Windows / macOS / Linux        │
│   (herhangi cihaz)  │        .exe / .dmg / .deb             │
└──────────┬──────────┴──────────────┬────────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND: React 19 + TypeScript                 │
│   Vite • TanStack Router • TanStack Query • Zustand         │
│   Shadcn/UI • Recharts • React Hook Form + Zod              │
│   (Aynı kod — platform farkını runtime'da algılar)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
┌─────────────────────┐    ┌────────────────────────────────┐
│   WEB MODU          │    │   DESKTOP MODU                 │
│                     │    │                                │
│  REST API çağrıları │    │  Tauri IPC komutları           │
│  → Merkezi Sunucu   │    │  → Rust Backend (local)        │
│                     │    │  → SQLite (local DB)           │
│  Auth: JWT/Session  │    │  + Sync Engine (sunucuya)      │
└─────────────────────┘    └────────────────────────────────┘
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND KATMANI                           │
│                                                             │
│   Node.js + Fastify (REST API)                              │
│   PostgreSQL (Ana Veritabanı — Sunucu)                      │
│   SQLite (Desktop yerel DB — Tauri içinde)                  │
│   Redis (Session, Cache, Queue)                             │
│   BullMQ (Async job queue)                                  │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│               ALTYAPI / ENTEGRASYON                         │
│   e-Fatura GİB  •  Banka API  •  SMS  •  E-posta           │
│   Termal Yazıcı (Desktop)  •  Barkod  •  OKC POS           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. PLATFORM ALGILAMA STRATEJİSİ

Frontend, çalıştığı ortamı runtime'da anlar ve davranışını buna göre değiştirir:

```typescript
// src/lib/platform.ts

export const platform = {
  isDesktop: () => typeof window.__TAURI__ !== 'undefined',
  isWeb: () => typeof window.__TAURI__ === 'undefined',
  isMobile: () => /Android|iPhone/i.test(navigator.userAgent),
}

// Servis katmanı — platform'a göre doğru implementasyonu seçer
export function createApiService() {
  if (platform.isDesktop()) {
    return new TauriLocalService()   // Rust IPC üzerinden SQLite
  }
  return new HttpApiService()         // REST API üzerinden PostgreSQL
}

// Donanım servisi — sadece desktop'ta gerçek, web'de mock
export function createHardwareService() {
  if (platform.isDesktop()) {
    return new TauriHardwareService() // Termal yazıcı, barkod okuyucu
  }
  return new WebHardwareStub()        // Browser print API, kamera barkod
}
```

---

## 4. VERİ AKIŞI & SENKRONIZASYON

### 4a. Desktop → Sunucu Senkronizasyon Mimarisi

```
DESKTOP (SQLite)                    SUNUCU (PostgreSQL)
─────────────────                   ──────────────────

Her kayıt değiştiğinde:             Sync Engine alır:
┌──────────────────┐                ┌──────────────────────┐
│ sync_queue       │  ──────────►  │ Conflict Detection   │
│ ─────────────    │                │ (timestamp + device) │
│ id              │                │                      │
│ table_name      │                │ Son kazanan: sunucu  │
│ record_id       │                │ veya manuel çözüm    │
│ operation       │                └──────────────────────┘
│ payload (JSON)  │
│ synced_at       │
│ retry_count     │
└──────────────────┘

Senkronizasyon stratejisi:
• Bağlantı varken: anlık (WebSocket)
• Bağlantı yokken: kuyruğa ekle, tekrar dene
• Çakışma: updated_at + device_id ile son kayıt kazanır
• Kritik veriler (stok, bakiye): sunucu master kabul edilir
```

### 4b. Senkronizasyon Tabloları

```sql
-- Her tabloya eklenmesi gereken senkronizasyon alanları
ALTER TABLE sales ADD COLUMN (
  device_id       TEXT NOT NULL DEFAULT 'server',
  sync_status     TEXT DEFAULT 'synced',  -- synced | pending | conflict
  local_id        TEXT,          -- offline oluşturulan kayıtlar için
  server_id       UUID,          -- sunucudaki gerçek ID
  synced_at       TIMESTAMPTZ
);

-- Senkronizasyon kuyruğu (her cihazda lokal)
CREATE TABLE sync_queue (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name      TEXT NOT NULL,
  operation       TEXT NOT NULL,  -- INSERT | UPDATE | DELETE
  record_id       TEXT NOT NULL,
  payload         TEXT NOT NULL,  -- JSON
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  retry_count     INTEGER DEFAULT 0,
  last_error      TEXT
);
```

---

## 5. PROJE KLASÖR YAPISI

```
pos-erp/
├── apps/
│   ├── web/                        # Sadece web deployment
│   │   └── vite.config.ts
│   └── desktop/                    # Tauri masaüstü uygulaması
│       ├── src-tauri/
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── commands/       # Tauri IPC komutları
│       │   │   │   ├── sales.rs
│       │   │   │   ├── stock.rs
│       │   │   │   ├── finance.rs
│       │   │   │   └── hardware.rs
│       │   │   ├── db/             # SQLite işlemleri (sqlx)
│       │   │   └── sync/           # Senkronizasyon motoru
│       │   ├── tauri.conf.json
│       │   └── Cargo.toml
│       └── vite.config.ts
│
├── packages/
│   ├── ui/                         # Ortak UI bileşenleri (Shadcn tabanlı)
│   │   ├── components/
│   │   │   ├── pos/                # POS ekranı bileşenleri
│   │   │   ├── stock/              # Stok bileşenleri
│   │   │   ├── finance/            # Finans bileşenleri
│   │   │   └── shared/             # Ortak (tablo, form, modal vb.)
│   │   └── package.json
│   │
│   ├── core/                       # İş mantığı (platform bağımsız)
│   │   ├── services/
│   │   │   ├── interfaces/         # IStockService, ISaleService...
│   │   │   ├── web/                # HTTP implementasyonları
│   │   │   └── desktop/            # Tauri IPC implementasyonları
│   │   ├── stores/                 # Zustand store'lar
│   │   ├── hooks/                  # React hook'lar
│   │   └── utils/                  # Hesaplama, format, validasyon
│   │
│   └── types/                      # Ortak TypeScript tipleri
│       ├── models.ts               # Product, Sale, Customer...
│       ├── api.ts                  # API request/response tipleri
│       └── events.ts               # Sync olayları
│
├── server/                         # Backend (Node.js + Fastify)
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   └── jobs/                   # BullMQ worker'lar
│   ├── migrations/                 # Veritabanı migration'ları
│   └── package.json
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx.conf
│
└── package.json                    # Turborepo root
```

---

## 6. DONANIM ENTEGRASYONU — WEB vs DESKTOP

### Termal Yazıcı

```typescript
// packages/core/services/interfaces/IPrinterService.ts
interface IPrinterService {
  printReceipt(sale: Sale): Promise<void>
  printReport(data: ReportData): Promise<void>
  testPrint(): Promise<boolean>
}

// packages/core/services/desktop/TauriPrinterService.ts
// Rust üzerinden ESC/POS komutları gönderir
class TauriPrinterService implements IPrinterService {
  async printReceipt(sale: Sale) {
    await invoke('print_receipt', {
      saleData: sale,
      printerName: await this.getDefaultPrinter()
    })
  }
}

// packages/core/services/web/BrowserPrinterService.ts
// CSS print stylesheet ile tarayıcı print dialog'u
class BrowserPrinterService implements IPrinterService {
  async printReceipt(sale: Sale) {
    const receiptHtml = renderToString(<Receipt sale={sale} />)
    const printWindow = window.open('', '_blank')
    printWindow.document.write(receiptHtml)
    printWindow.print()
  }
}
```

### Barkod Okuyucu

```typescript
// Desktop: Tauri global keyboard listener (HID/COM)
// Web: Keyboard event listener (barkod okuyucu HID modunda)
// Web (kamera): @zxing/library ile kamera üzerinden okuma

class BarcodeService {
  private buffer = ''
  private timer: NodeJS.Timeout

  startListening(onScan: (barcode: string) => void) {
    if (platform.isDesktop()) {
      // Tauri: serial port veya HID event
      listen('barcode-scanned', (event) => onScan(event.payload))
    } else {
      // Web: barkod okuyucu klavye gibi davranır
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.buffer.length > 3) {
          onScan(this.buffer)
          this.buffer = ''
        } else {
          this.buffer += e.key
          clearTimeout(this.timer)
          this.timer = setTimeout(() => this.buffer = '', 100)
        }
      })
    }
  }
}
```

---

## 7. OFFLİNE MODU — DESKTOP İÇİN TAM DESTEK

```
Ağ durumu tespiti ve fallback mekanizması:

┌─────────────────────────────────────────┐
│  NetworkMonitor                         │
│  ─────────────                         │
│  • ping her 10 saniyede bir             │
│  • WebSocket bağlantı durumu           │
│  • Status: online | offline | degraded  │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
    ONLINE            OFFLİNE
       │                │
       ▼                ▼
  Direkt API       SQLite local
  çağrıları        işlemler
       │                │
       │          sync_queue'ya ekle
       │                │
       └───────┬────────┘
               │
          Bağlantı gelince
          otomatik sync
```

Kritik kurallar:
- Satış: her zaman çalışır (offline da)
- Stok: offline okur, sync gelince günceller
- Cari bakiye: online gerektirir (tutarsızlık riski)
- Raporlar: lokal veriden üretilir, online'da sunucu verisinden

---

## 8. GÜVENLİK — PLATFORM FARKLILIKLARI

### Web Güvenliği
```
• JWT token: HttpOnly cookie (XSS koruması)
• CSRF token: her form için
• Rate limiting: IP bazlı (Nginx + backend)
• CSP headers: inline script yasak
• HTTPS zorunlu
```

### Desktop Güvenliği
```
• Tauri v2 Capabilities sistemi:
  - Her Rust komutu için ayrı izin tanımı
  - Frontend sadece izin verilen komutları çağırabilir
• Veritabanı şifreleme: SQLCipher (SQLite şifreli)
• Keychain: işletim sistemi güvenli depolama (token, şifre)
• Auto-lock: X dakika hareketsizlikte ekran kilidi
• Güncelleme imzası: Tauri updater + private key ile imzalı
```

---

## 9. DEPLOYMENT MİMARİSİ

### Web Deployment
```
Kullanıcı Tarayıcısı
       │
       ▼
  Cloudflare CDN (static assets)
       │
       ▼
  Nginx (reverse proxy, SSL, gzip)
       │
  ┌────┴────┐
  │ Fastify │  (Node.js cluster, PM2)
  │ API     │
  └────┬────┘
       │
  ┌────┴────┐    ┌──────────┐
  │Postgres │    │  Redis   │
  │ (primary│    │ (cache + │
  │+replica)│    │  queue)  │
  └─────────┘    └──────────┘
```

### Desktop Deployment
```
GitHub Releases (veya özel update server)
       │
  Tauri Updater (otomatik güncelleme kontrolü)
       │
  ┌────────────────────────────────┐
  │  Kullanıcının Bilgisayarı      │
  │  ├── Tauri App (.exe)          │
  │  ├── Embedded React UI         │
  │  ├── Rust Backend (local)      │
  │  ├── SQLite DB (şifreli)       │
  │  └── Sync Engine               │
  └────────────────────────────────┘
         │  (internet varsa)
         ▼
    Merkezi Sunucu (web ile aynı)
```

### CI/CD Pipeline
```yaml
# .github/workflows/release.yml

on:
  push:
    tags: ['v*']

jobs:
  build-web:
    - Build React (Vite)
    - Upload to CDN / Nginx

  build-desktop:
    - Windows: tauri build → .msi + .exe installer
    - macOS: tauri build → .dmg (universal binary)
    - Linux: tauri build → .deb + .AppImage
    - Sign with certificates
    - Upload to GitHub Releases
    - Update update-server manifest

  deploy-server:
    - Docker build
    - Push to registry
    - Deploy (blue-green)
    - Run migrations
    - Health check
```

---

## 10. GELİŞTİRME ORTAMI KURULUM PROMPT'U

```
Aşağıdaki yapıyı sıfırdan kur:

PAKETLER:
• Turborepo (monorepo yönetimi)
• React 19 + TypeScript + Vite
• Tauri v2 (Rust 1.75+)
• TanStack Router v1 (file-based routing)
• TanStack Query v5 (server state)
• Zustand v5 (client state)
• Shadcn/UI + Tailwind CSS v4
• React Hook Form + Zod
• Recharts (grafik)
• date-fns (tarih)
• Fastify v5 (backend)
• Prisma ORM (PostgreSQL)
• sqlx (Rust SQLite)
• BullMQ (queue)
• Vitest (test)
• Playwright (e2e)

YAPILACAKLAR:
1. pnpm workspace + Turborepo yapısını kur
2. packages/ui, packages/core, packages/types oluştur
3. apps/web ve apps/desktop'u Tauri v2 şablonuyla kur
4. server/ dizinini Fastify + Prisma ile kur
5. Platform algılama servisini implement et
6. IPC köprüsünü kur (Tauri komutlar ↔ TypeScript)
7. Dev script'lerini tanımla:
   - pnpm dev:web → sadece web
   - pnpm dev:desktop → Tauri + web birlikte
   - pnpm dev:server → backend
   - pnpm dev → hepsi paralel
8. Docker Compose (dev): postgres + redis
9. İlk migration: temel tablolar
10. Smoke test: web'de satış yap, desktop'ta gör

Tüm dosyaları yaz ve kurulum tamamlandığında çalışacak bir "hello world" POS ekranı oluştur.
```

---

## 11. PLATFORM FARK MATRİSİ — MODÜL BAZLI

| Modül | Web | Desktop | Fark |
|-------|-----|---------|------|
| POS Satış | ✅ | ✅ | Desktop: termal yazıcı, çekmece |
| Stok Takibi | ✅ | ✅ | Eşit |
| Cari Hesap | ✅ | ✅ | Eşit |
| Finans | ✅ | ✅ | Eşit |
| Barkod Okuma | Kamera veya HID | HID + COM port | Desktop daha güvenilir |
| Termal Fiş | Browser print | ESC/POS direkt | Desktop daha hızlı |
| Offline Mod | ❌ (kısıtlı) | ✅ (tam) | Desktop kazanır |
| Çok Kullanıcı | ✅ (doğal) | Sync gerekir | Web kazanır |
| Mobil Erişim | ✅ | ❌ | Web kazanır |
| Güncelleme | Anlık | Tauri updater | Web daha kolay |
| Kurulum | 0 | ~8MB installer | Web kazanır |
| Donanım Entegrasyon | Sınırlı | Tam | Desktop kazanır |

---

## 12. ÖNERİLEN GELİŞTİRME SIRASI

```
Hafta 1-2:   Monorepo kurulum + DB şeması + Auth
Hafta 3-4:   POS modülü (web) → çalışan satış akışı
Hafta 5:     Tauri entegrasyonu → aynı POS desktop'ta
Hafta 6:     Termal yazıcı + barkod donanım katmanı
Hafta 7-8:   Stok takibi (web + desktop eşit)
Hafta 9-10:  Cari hesap
Hafta 11-12: Finans modülü
Hafta 13-14: Senkronizasyon motoru (offline→online)
Hafta 15:    Raporlama ve dashboard
Hafta 16:    CI/CD, installer build, update server
```
