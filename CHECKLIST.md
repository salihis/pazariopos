# Proje Kurulumu Tamamlama Kontrol Listesi

## ✅ Yapılmış İşler

### 📖 Dokümantasyon Dosyaları (Proje Köküne Eklendi)
- [x] **ARCHITECTURE.md** — Tüm mimari kararlar, §1-§12, hızlı referans tablo
- [x] **CODING_GUIDELINES.md** — 15 temel kural (file headers, platform branching, vb.)
- [x] **README.md** — Setup, quick start, troubleshooting
- [x] **PROJECT_STRUCTURE.md** — Dosya konumları, bağımlılık akışı, checklist
- [x] **GETTING_STARTED.md** — 5 dakika içinde çalıştırmak için rehber
- [x] **CHECKLIST.md** — Bu dosya

### 🏗️ Monorepo Yapısı
- [x] pnpm workspace (pnpm-workspace.yaml)
- [x] Turborepo pipeline (turbo.json)
- [x] Root TypeScript config (tsconfig.base.json)
- [x] Root package.json (dev scripts: dev, dev:web, dev:desktop, vb.)

### 📦 packages/core — Platform-Bağımsız İş Mantığı
- [x] Tüm domain tipleri (domain.ts: Sale, Product, CartLine, vb.)
- [x] Platform detection servisi (runtime web/desktop algılama)
- [x] Printer servis (interface + 2 impl + factory)
- [x] Barcode servis (hybrid: Tauri event + keyboard)
- [x] Network monitor (online/offline detection + pinging)
- [x] Account balance servis (offline error fırlatma)
- [x] REST API client (Fetch wrapper)
- [x] Zustand store (useSaleStore — offline/online + sync logic)
- [x] Tüm factory fonksiyonları
- [x] Barrel export (index.ts)

### 🎨 packages/ui — React Bileşenleri
- [x] PosScreen.tsx (demo: barcode + cart + checkout + print)
- [x] Inline stiller (dependency-free)
- [x] Barcode tarama entegrasyonu
- [x] Yazıcı entegrasyonu
- [x] Offline state gösterimi

### 🌐 apps/web — Browser Uygulaması (Vite SPA)
- [x] package.json (React 19, Vite, Tauri API peer dep)
- [x] vite.config.ts
- [x] index.html
- [x] src/main.tsx (React entry point)
- [x] tsconfig.json

### 🖥️ apps/desktop — Tauri Desktop Uygulaması
- [x] package.json (@tauri-apps/cli + api)
- [x] vite.config.ts (fixed port :1420)
- [x] index.html
- [x] src/main.tsx (identical to web — single codebase!)
- [x] tsconfig.json

### 🦀 apps/desktop/src-tauri — Rust Backend
- [x] main.rs (Tauri setup, SQLite init, command registry)
- [x] commands/printer.rs (#[tauri::command] print_receipt, test_print, list_printers)
- [x] commands/barcode.rs (simulate_barcode_scan, list_barcode_ports)
- [x] commands/sales.rs (save_sale_offline, get_pending_sync_items, vb.)
- [x] db/pool.rs (SQLite pool init)
- [x] db/sync_queue.rs (offline queue schema + operations)
- [x] hardware/escpos.rs (ESC/POS byte builder — thermal printer)
- [x] hardware/serial.rs (serial port detection & writing)
- [x] hardware/barcode.rs (barcode listener, emits 'barcode-scanned' event)
- [x] error.rs (AppError, AppResult types)
- [x] Cargo.toml (serde, tokio, sqlx, tauri, serialport)
- [x] tauri.conf.json

### ⚡ server/ — Fastify v5 Backend
- [x] package.json (Fastify, @fastify/cors, Prisma)
- [x] src/main.ts (entry point)
- [x] src/routes/health.ts (GET/HEAD /api/health — NetworkMonitor ping)
- [x] src/routes/sales.ts (skeleton)
- [x] src/routes/accounts.ts (skeleton)
- [x] tsconfig.json

### 🐘 docker/ — Development Infrastructure
- [x] docker-compose.yml (PostgreSQL + Redis — ready but not yet written)

### ✅ Bütünlük Kontrolü
- [x] Tüm dosyalar özel referanslarla çalışıyor (platform detection, factories, vb.)
- [x] Barcode event adı (Rust + TypeScript) eşleşiyor
- [x] Printer IPC payload'ları (Rust DTO + TS invoke tip) eşleşiyor
- [x] Hello-world POS ekranı işlevsel (tarama + sepet + ödeme + baskı)
- [x] Offline/online branch logic tamamlanmış
- [x] Account balance offline-forbidden rule uygulanmış

---

## ⏳ Yapılacak İşler — GÜNCEL (25 Temmuz 2026 itibarıyla)

> Aşağıdaki blok, projenin en başında (henüz hiçbir modül yazılmadan) tahmini bir "hafta hafta"
> plan olarak yazılmıştı. O zamandan beri gerçek gelişim çok farklı bir sırada ilerledi —
> bu yüzden tamamen güncellendi. Detaylı faz bazlı dökümantasyon için bu dosyanın ilgili
> bölümlerine bakın (Ctrl+F ile modül adını arayın).

### ✅ Tamamlanan (Gerçek Durum)
- [x] Monorepo kurulumu, `pnpm install && pnpm docker:up && pnpm dev` — uçtan uca doğrulandı
- [x] Web + Desktop bağlantısı (Tauri penceresi gerçekten açılıyor, ONLINE badge doğrulandı)
- [x] Stok Modülü — `InventoryService` (interface değil, tek implementasyon — platform ayrımı
      gerekmiyor, bkz. mimari kararlar), atomik stok düşüşü, düşük stok uyarısı
- [x] Cari Hesap Modülü (Faz 1-3) — ledger, açık hesap eşleştirmesi (FIFO), yaşlandırma raporu,
      risk raporu
- [x] Finans Modülü (Faz 1-3) — kasa yönetimi (nakit satış otomatik işleniyor), banka hesabı,
      çek/senet, kâr/zarar tablosu
- [x] Auth/Login (Faz 1-3) — JWT, RBAC, kullanıcı yönetimi
- [x] Senkronizasyon motoru — `sync_queue`, `device_id + updated_at` conflict resolution,
      auto-sync (offline→online geçişte tetikleniyor) — **tamamlandı ve doğrulandı**

### ❌ Henüz Yapılmayan (Gerçek Eksikler)
- [ ] Web uygulaması styling'i — şu an inline stiller kullanılıyor (`packages/ui/src/PosScreen.tsx`
      içinde), Tailwind v4 kurulumu hiç yapılmadı. `ARCHITECTURE.md`'de Tailwind planlanmıştı
      ama gerçek geliştirmede önceliklendirilmedi.
- [ ] Desktop installer build (MSI, DMG, AppImage) — `cargo check` ile derleme doğrulandı,
      ama gerçek bir dağıtılabilir installer hiç üretilmedi (`pnpm tauri:build` denenmedi)
- [ ] Otomatik testler (unit/e2e) — hiç yazılmadı, tüm doğrulama bu oturumda manuel
      (PowerShell + Prisma Studio + tarayıcı testleri) yapıldı
- [ ] GitHub Actions CI/CD — hiç kurulmadı
- [ ] Production deployment (gerçek sunucu, domain, SSL, Nginx) — hiç yapılmadı, sadece local dev
- [ ] Dashboard / back-office ekranları — Kasa, Cari, Finans şu an sadece API üzerinden
      test edilebiliyor; `PosScreen`'e entegre parçalar (veresiye butonu, bakiye sorgulama)
      dışında ayrı yönetim ekranları yok
- [ ] Cari Hesap & Finans Faz 4-5 — PDF mutabakat mektubu, döviz/kur farkı, CSV/OFX ekstre
      import, toplu SMS/e-posta hatırlatma (kullanıcı kararıyla kapsam dışı bırakıldı — dış
      servis bağımlılığı gerektiriyor)
- [ ] Gerçek donanım testi — fiziksel yazıcı/barkod okuyucu ile hiç test edilmedi (kullanıcı
      kararıyla atlandı, kod mock modda doğrulandı)

---

## 🚀 Hemen Başlamak İçin

```bash
cd /home/claude/pos-erp

# 1. Oku
cat ARCHITECTURE.md          # Tüm kararlar burada
cat CODING_GUIDELINES.md    # Patterns ve kurallar
cat GETTING_STARTED.md      # 5 dakika rehberi

# 2. Kur
pnpm install

# 3. Çalıştır
pnpm docker:up              # PostgreSQL + Redis
pnpm dev:server             # Fastify on :3000
pnpm dev:web                # React on :5173
# VEYA
pnpm dev:desktop            # Tauri dev mode

# 4. Test
# Browser'da http://localhost:5173 aç
# - Barkod tara (keyboard)
# - Sepete ekle
# - Ödeme yap
# - Fiş yazdır
```

---

## 📋 Dosya Kontrol Listesi

Proje kök dizininde şu dosyalar olmalı:

```
pos-erp/
├── ✅ ARCHITECTURE.md           (22 KB) — Tüm kararlar
├── ✅ CODING_GUIDELINES.md      (13 KB) — Kod patterns
├── ✅ README.md                 (8.4 KB) — Quick start
├── ✅ PROJECT_STRUCTURE.md      (12 KB) — Dosya haritası
├── ✅ GETTING_STARTED.md        (8 KB) — 5 dakika rehberi
├── ✅ CHECKLIST.md              (Bu dosya)
├── ✅ package.json              — Monorepo root
├── ✅ pnpm-workspace.yaml       — Workspace tanımı
├── ✅ turbo.json                — Build pipeline
├── ✅ tsconfig.base.json        — TS config
├── ✅ packages/core/            — Core logic
├── ✅ packages/ui/              — Shared UI
├── ✅ apps/web/                 — Web SPA
├── ✅ apps/desktop/             — Tauri app + Rust
├── ✅ server/                   — Fastify API
└── ✅ docker/                   — Dev infrastructure
```

---

## 🔗 Dokümantasyon Oku Sırası

1. **GETTING_STARTED.md** ← Buradan başla
2. **ARCHITECTURE.md** ← Tüm kararlar
3. **CODING_GUIDELINES.md** ← Patterns
4. **PROJECT_STRUCTURE.md** ← Dosya haritası
5. **README.md** ← Setup & troubleshooting

---

## ✨ Başlıca Özellikler (Hazır)

- ✅ Platform detection (runtime web/desktop algılama)
- ✅ Factory pattern (service routing)
- ✅ Hello-world POS ekranı (tarama + sepet + ödeme + fiş)
- ✅ Offline/online branch (satış online/queue, bakiye offline hata)
- ✅ Barcode integration (Tauri event + keyboard wedge)
- ✅ Printer integration (ESC/POS + browser print)
- ✅ Zustand store (with sync logic)
- ✅ NetworkMonitor (online detection + pinging)
- ✅ Tauri v2 setup (Rust backend, SQLite, commands)
- ✅ Fastify API skeleton (routes ready)

---

**Şimdi başlamaya hazır! 🚀**

```bash
cd /home/claude/pos-erp
pnpm install
pnpm dev
```

Sonra http://localhost:5173 aç ve PosScreen'i test et.

---

## 🔍 DOĞRULAMA RAPORU (Gerçek Test Sonuçları — Bu Oturumda Çalıştırıldı)

Bu bölüm **iddia değil, gerçekten çalıştırılan komutların çıktısıdır.**

### ✅ Doğrulanan (pnpm install + typecheck gerçekten çalıştırıldı)

**Bu sandbox'ta (Claude tarafında):**
```bash
$ pnpm install                                    # ✅ Başarılı (354 paket)
$ pnpm turbo run typecheck
   @pos-erp/core:typecheck      ✅ PASS
   @pos-erp/ui:typecheck        ✅ PASS
   @pos-erp/web:typecheck       ✅ PASS
   @pos-erp/desktop:typecheck   ✅ PASS
   @pos-erp/server:typecheck    ❌ FAIL (Prisma engine indirilemedi — sandbox network kısıtlaması)
```

**Kullanıcının kendi Windows makinesinde (gerçek internet + Docker ile) — 15 Temmuz 2026:**
```powershell
> pnpm install                                     # ✅ Başarılı (300 paket, 53s)
> pnpm docker:up                                    # ✅ postgres + redis (healthy)
> pnpm db:migrate                                   # ✅ Migration uygulandı, Prisma Client üretildi
> pnpm --filter @pos-erp/server run db:seed         # ✅ demo-customer-1 seed edildi
> pnpm --filter @pos-erp/server exec tsc --noEmit   # ✅ Sessiz (hatasız)
> pnpm turbo run typecheck
   Tasks:    5 successful, 5 total                  # ✅ 5/5 PASS — TÜM MONOREPO TEMİZ
```

**Sonuç: Sandbox'ta bulunamayan tek sorun (Prisma engine) gerçek ortamda hiç sorun çıkarmadı. Tüm kod tabanı artık doğrulanmış durumda.**

---

## 🎉 UÇTAN UCA DOĞRULAMA — 16-17 Temmuz 2026 (Kullanıcının Windows Makinesi)

Bu, projenin gerçek anlamda **çalıştığının** ilk kanıtı. Süreçte gerçek makinede
çıkan ve düzeltilen hatalar dahil, tam kronoloji:

### Bulunan ve Düzeltilen Gerçek Hatalar (Rust/Tauri + Server katmanı)

| # | Hata | Kök Neden | Çözüm |
|---|------|-----------|-------|
| 1 | `can't find library pos_erp_desktop_lib` | `Cargo.toml`'da `[lib]` hedefi tanımlı ama `src/lib.rs` yoktu | Mantık `lib.rs`'e taşındı, `main.rs` ince wrapper yapıldı (Tauri v2 standart pattern) |
| 2 | `OUT_DIR env var is not set` | `build.rs` hiç yazılmamıştı | `tauri_build::build()` çağıran `build.rs` eklendi |
| 3 | `icon.ico not found` | `icons/` klasörü hiç oluşturulmamıştı | 5 formatlı placeholder ikon seti üretildi (32/128/256px PNG + .ico + .icns) |
| 4 | `unused variant` uyarıları | `Printer`/`Sync`/`NotFound` enum varyantları ileriye dönük tanımlanmış ama henüz kullanılmıyordu | `#[allow(dead_code)]` + gerekçe yorumu eklendi (silinmedi — yakında gerekecek) |
| 5 | `unable to determine transport target for "pino-pretty"` | `main.ts` bu paketi kullanıyordu ama `package.json`'a hiç eklenmemişti | `pino-pretty` devDependency olarak eklendi |
| 6 | `FST_ERR_DUPLICATED_ROUTE` | Fastify v5 her `GET` için otomatik `HEAD` üretiyor; ben elle de `HEAD` tanımlamıştım | Elle tanımlanan `HEAD` kaldırıldı |
| 7 | *(sessiz bug — hata vermeden önce yakalandı)* `NetworkMonitor` her zaman "online" görebilirdi | Vite dev server, eşleşmeyen `/api/*` isteklerini SPA fallback (`index.html`, 200 OK) ile yanıtlıyor | `apps/web` ve `apps/desktop` vite config'lerine `/api` proxy'si eklendi (`→ localhost:3000`) |

### ✅ Gerçekten Doğrulanan Uçtan Uca Akış

```
✅ pnpm install                                  (300 paket, temiz)
✅ pnpm docker:up                                 (postgres + redis healthy)
✅ pnpm db:migrate                                (migration + Prisma Client üretildi)
✅ pnpm --filter @pos-erp/server run db:seed      (demo-customer-1 oluşturuldu)
✅ pnpm turbo run typecheck                        (5/5 paket temiz)
✅ cargo check (apps/desktop/src-tauri)            (Finished, 0 warning)
✅ pnpm dev:server                                 (http://localhost:3000 ayakta)
✅ Invoke-RestMethod /api/health                   ({"status":"ok",...})
✅ Invoke-RestMethod /api/accounts/.../balance      ({"balance":15000,...})
✅ pnpm dev:web + tarayıcı testi:
   ✅ "ONLINE" badge görünüyor (proxy düzeltmesi doğrulandı)
   ✅ Barkod/Quick-Add → sepete ekleniyor
   ✅ Checkout (Cash) → "Sale completed online" + print dialog açılıyor
   ✅ Check Account Balance → "Balance: 150.00" doğru gösteriliyor
```

**Bu, POS modülünün üç kritik katmanının (HARDWARE INTEGRATION, OFFLINE MODE
altyapısı, DEV ENVIRONMENT SETUP) gerçek bir Windows makinesinde uçtan uca
çalıştığının ilk somut kanıtıdır.**

### ⏳ Henüz Doğrulanmayan (Bu Konuşmada)

| Test | Durum |
|------|-------|
| ~~Offline satış akışı (network kapatıp checkout)~~ | ✅ **Doğrulandı** — badge kırmızı OFFLINE'a döndü, "1 pending sync" göründü |
| ~~Auto-sync (network geri açılınca queue'nun boşalması)~~ | ✅ **Doğrulandı** — network geri gelince "1 pending sync" rozeti kayboldu, badge ONLINE'a döndü |
| ~~Desktop uygulamasının gerçekten açılması (`pnpm dev:desktop`)~~ | ✅ **Doğrulandı** — native Tauri penceresi açıldı, PosScreen içinde ONLINE, server logunda düzenli HEAD /api/health→200 pingleri görüldü |
| Gerçek termal yazıcı / barkod okuyucu ile donanım testi | ⏭️ **Kullanıcı kararıyla atlandı** (17 Temmuz 2026) — fiziksel donanım mevcut değil. Kod mock modda çalışıyor ve doğrulandı; gerçek donanım eline geçtiğinde `POS_BARCODE_PORT` env değişkenini gerçek COM portuna, `listPrinters()` sonucundaki bir yazıcı adını `PrinterConfig.printerName`'e ayarlayarak test edilebilir. |

### Bulunan ve Düzeltilen 8. Hata — `dev:desktop` Script'i

`tauri.conf.json`'daki `beforeDevCommand` zaten `apps/desktop`'un `dev` script'ini (Vite) doğru
şekilde tetikliyordu, ama **kök `package.json`'daki `dev:desktop` script'i** doğrudan o Vite
script'ini çalıştırıyordu — Tauri CLI'ı (`tauri dev`) hiç devreye sokmuyordu. Sonuç: native
pencere hiç açılmıyor, sadece boşta bir Vite dev server ayakta kalıyordu.

**Çözüm:** `dev:desktop` → `pnpm --filter @pos-erp/desktop run tauri:dev` olarak değiştirildi.
Ayrıca `pnpm dev` (paralel) artık sadece web+server'ı başlatıyor — desktop native pencere
açtığı için zaten ayrı bir terminal gerektiriyor, dokümantasyondaki yanlış iddia da düzeltildi.

### Bulunan (Kod Hatası Değil) — "DEGRADED" Durumu

Tauri penceresi ilk açıldığında `pnpm dev:server` terminali kapalıydı. `NetworkMonitor`'ün
`fetch()`'i Vite proxy üzerinden `:3000`'e ulaşamayınca, Vite bunu bağlantı hatası olarak değil
kendi 500 yanıtı olarak dönüyor — bu da `NetworkMonitor`'ün "OFFLINE" yerine "DEGRADED" görmesine
yol açıyor. Server tekrar başlatılınca 10 saniye içinde otomatik "ONLINE"'a döndü — **bu, mimarinin
doğru çalıştığının kanıtı**, düzeltilecek bir hata değildi.

---

## 📦 STOK TAKİBİ (INVENTORY) MODÜLÜ — MVP — 17 Temmuz 2026

Kullanıcı kararıyla kapsam: **Minimal MVP** (tek depo, basit stok seviyesi, satışta otomatik
düşüş, düşük stok uyarısı). Tam kapsam (çoklu depo, FIFO/lot takibi, ABC analizi) ileride ayrı
bir iterasyonda ele alınacak — bkz. `POS_ERP_Sistem_Prompt.md` §4.

### Eklenen Dosyalar

| Dosya | Amaç |
|---|---|
| `server/prisma/schema.prisma` | `Product` modeli eklendi (sku, barcode[], price, stock, lowStockThreshold) |
| `server/src/routes/products.ts` | `GET /api/products`, `POST /api/products`, `PATCH /api/products/:id/stock` |
| `server/src/schemas/product.ts` | Zod validasyonu |
| `server/src/mappers/productMapper.ts` | Prisma → domain tipi dönüşümü |
| `packages/core/src/services/InventoryService.ts` | Online'da canlı veri, offline'da son bilinen kopya (mimari §7 kuralı: stok verisi bayat sunulabilir) |
| `packages/core/src/store/useInventoryStore.ts` | Zustand store, katalog yükleme + barkod arama |

### Değiştirilen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `packages/core/src/types/domain.ts` | `Product`'a `lowStockThreshold` eklendi |
| `server/src/routes/sales.ts` | **Kritik:** Satış kaydı + stok düşüşü artık tek Prisma `$transaction` içinde atomik — biri başarısız olursa ikisi de geri alınır |
| `packages/ui/src/PosScreen.tsx` | Hardcoded `DEMO_CATALOG` kaldırıldı, gerçek `useInventoryStore`'a bağlandı; düşük stok rozeti eklendi |
| `server/prisma/seed.ts` | 3 ürün seed ediliyor (biri kasıtlı düşük stoklu — "Ceramic Mug" stock:3/threshold:5 — uyarıyı göstermek için) |

### Mimari Kararlar

- **Platform ayrımı yok:** `ARCHITECTURE.md`'nin platform matrisine göre Stok Takibi web/desktop'ta
  eşit — donanım gibi ayrı Web/Desktop implementasyonu + factory gerekmiyor. `AccountBalanceService`
  ile aynı kalıp izlendi (tek sınıf, offline'da farklı davranış).
- **Offline davranışı bakiyeden farklı:** `AccountBalanceService` offline'da hata fırlatırken,
  `InventoryService` offline'da **son bilinen kopyayı** döner (mimari §7: "Inventory: safe to
  serve from local cache when offline").
- **Atomiklik:** Satış + stok düşüşü aynı transaction'da — yarım kalmış bir satış/stok tutarsızlığı
  imkansız hale getirildi.

### ⚠️ Bu Sandbox'ta Doğrulanamayan (Yine Prisma Engine Kısıtlaması)

`pnpm --filter @pos-erp/server exec tsc --noEmit` çalıştırıldığında 5 hata veriyor — hepsi
`@prisma/client`'ın yeni `Product` modeli için henüz regenerate edilmemiş olmasından (bu
sandbox'ın network kısıtlaması). **core, ui, web, desktop paketleri 4/4 temiz.**

### ✅ Kullanıcının Makinesinde Doğrulandı — 17 Temmuz 2026

```powershell
✅ pnpm db:migrate                                  (20260717040857_add_product_inventory uygulandı)
✅ pnpm --filter @pos-erp/server run db:seed        (3 ürün + demo hesap seed edildi)
✅ pnpm turbo run typecheck                          (5/5 PASS — server dahil tüm monorepo temiz)
✅ Tarayıcıda Quick-Add kartları gerçek DB'den geliyor
✅ "Ceramic Mug" için "⚠ Low stock: 3" uyarısı doğru gösteriliyor
✅ Satış + atomik stok düşüşü doğrulandı: "Ceramic Mug" satışı sonrası Prisma Studio'da
   stock 3 → 2 olarak güncellendi — Sale + Product güncellemesi tek transaction'da çalıştı
```

**INVENTORY MVP — TAMAMLANDI VE UÇTAN UCA DOĞRULANDI.**

---

## 🏷️ MARKA DEĞİŞİKLİĞİ — "PazarioPOS" — 18 Temmuz 2026

Proje adı `pos-erp` → **`pazariopos`** olarak değiştirildi. Kapsam:

| Katman | Değişiklik |
|---|---|
| npm paket scope'u | `@pos-erp/*` → `@pazariopos/*` (core, ui, web, desktop, server — 5 paket) |
| Root `package.json` | `"name": "pazariopos"` |
| Rust crate | `pos-erp-desktop` → `pazariopos-desktop`, lib `pos_erp_desktop_lib` → `pazariopos_desktop_lib` |
| Tauri config | `productName`, `identifier` (`com.pazariopos.desktop`), pencere başlığı `"PazarioPOS"` |
| Desktop SQLite dosyası | `pos-erp.db` → `pazariopos.db` |
| Docker container adları | `pazariopos-postgres`, `pazariopos-redis` (sadece görüntü etiketi) |
| UI başlığı | "POS — Hızlı Satış" → "PazarioPOS — Hızlı Satış" |

### ⚠️ Bilinçli Olarak DEĞİŞTİRİLMEYEN

- **PostgreSQL veritabanı adı** (`pos_erp`) ve **Docker volume adları** (`pos_erp_postgres_data` vb.)
  — bunları değiştirmek, zaten doğrulanmış seed verisinin (3 ürün, demo hesap, test satışları)
  kaybolmasına yol açardı. `docker-compose.yml`'e bu kararın gerekçesini açıklayan bir yorum eklendi.

### Doğrulama

```
✅ pnpm turbo run typecheck (core, ui, web, desktop)  →  4/4 PASS
✅ pnpm --filter @pazariopos/server exec tsc --noEmit  →  sadece bilinen 5 Prisma
   regenerate hatası (yeni bir hata yok — rename'in kod tabanını bozmadığının kanıtı)
```

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm terminalleri durdur (web, desktop, server, studio)

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Paket adları değiştiği için node_modules'ü temizle ve yeniden kur
pnpm install

# 4. Eski Docker container'larını durdur (yeni isimlerle yeniden oluşturulacaklar,
#    AMA volume'lar aynı kaldığı için veriler korunacak)
docker compose -f docker/docker-compose.yml down
pnpm docker:up
docker ps
# Beklenen: pazariopos-postgres, pazariopos-redis (healthy)

# 5. Prisma Client'ı yeni paket adıyla tekrar üret
pnpm --filter @pazariopos/server exec prisma generate

# 6. Doğrula
pnpm turbo run typecheck
# Beklenen: 5/5 PASS

# 7. Rust tarafını da doğrula (identifier değişti, temiz derleme için target'ı silmek güvenli)
cd apps\desktop\src-tauri
cargo check
cd ..\..\..

# 8. Başlat ve test et
pnpm dev:server
pnpm dev:web
```

**Not:** Adım 4'te veritabanı verilerinin korunduğunu doğrulamak için Prisma Studio'da
(`pnpm db:studio`) `Product` tablosuna bakıp 3 ürünün hâlâ orada olduğunu kontrol edebilirsin.

### ✅ Kullanıcının Makinesinde Doğrulandı — 18 Temmuz 2026

```powershell
✅ pnpm install                                          (yeni paket adlarıyla temiz kuruldu)
✅ docker compose down + pnpm docker:up                  (pazariopos-postgres/redis healthy, veri korundu)
✅ pnpm --filter @pazariopos/server exec prisma generate (yeni paket adıyla Client üretildi)
✅ pnpm turbo run typecheck                               (5/5 PASS)
✅ cargo check → "Compiling pazariopos-desktop v0.1.0" → Finished, 0 hata/uyarı, 25.80s
```

**"PazarioPOS" REBRAND — TAMAMLANDI VE UÇTAN UCA DOĞRULANDI. Veri kaybı olmadı.**

---

## 💳 CARİ HESAP (ACCOUNTS RECEIVABLE/PAYABLE) — FAZ 1 — 19 Temmuz 2026

Kullanıcı kararıyla kapsam: **Tam kapsam istendi, sonra Faz 1-3'e daraltıldı** (Faz 4-5 —
PDF mutabakat mektubu, döviz, toplu SMS/e-posta — dış servis bağımlılığı gerektirdiği için
kapsam dışı bırakıldı).

### Faz Planı

| Faz | İçerik | Durum |
|---|---|---|
| **1 — Temel** | Cari kartı, hareket (ledger) modeli, 'account' ödemesinin satışta gerçekten çalışması | ✅ Bu oturumda yazıldı |
| **2 — Açık Hesap** | Ödeme kaydı, fatura-ödeme eşleştirmesi, ödeme planı | ⏳ Sırada |
| **3 — Yaşlandırma & Risk** | Vade bazlı dağılım, risk raporu, gecikme faizi | ⏳ Sırada |
| ~~4 — Ekstre & Mutabakat~~ | ~~PDF mutabakat mektubu~~ | ❌ Kapsam dışı (dış bağımlılık) |
| ~~5 — Döviz & Toplu İşlemler~~ | ~~FX, toplu SMS/e-posta~~ | ❌ Kapsam dışı (dış servis) |

### Faz 1'de Eklenen/Değiştirilen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `server/prisma/schema.prisma` | `Account` modeli genişletildi (type, taxNumber, address, phone, email, ibanList, creditLimit, paymentTermDays, discountRate); yeni `AccountTransaction` modeli (ledger) |
| `server/src/routes/sales.ts` | **Kritik:** `'account'` (veresiye) ödeme metodu artık satışla aynı transaction'da çalışıyor — `AccountTransaction` (invoice tipi) oluşturuluyor + `Account.balance` atomik güncelleniyor |
| `server/src/routes/accounts.ts` | `GET /api/accounts` (liste), `POST /api/accounts` (oluştur), `GET /api/accounts/:id` (detay), `GET /api/accounts/:id/transactions` (ledger) eklendi |
| `server/src/schemas/account.ts`, `server/src/mappers/accountMapper.ts` | Yeni dosyalar |
| `packages/core/src/types/domain.ts` | `Account`, `AccountTransaction`, `AccountType`, `AccountTransactionType` tipleri eklendi |
| `packages/core/src/store/useAccountStore.ts` | Yeni Zustand store (liste, oluştur, seç, ledger) |
| `packages/ui/src/PosScreen.tsx` | Müşteri seçici dropdown + **"Veresiye (Cari Hesaba Ekle)"** butonu eklendi — Faz 1'in uçtan uca test edilebilmesi için |
| `server/prisma/seed.ts` | `demo-customer-2` (Ayşe Yılmaz, düşük kredi limiti — Faz 3 risk testi için) eklendi, mevcut hesaplara `creditLimit`/`paymentTermDays` verildi |

### Mimari Kararlar

- **Atomiklik:** Satış + stok düşüşü + cari hesaba borç yazma artık **üçü birden tek transaction'da** — biri başarısız olursa hepsi geri alınır.
- **Idempotency korundu:** Aynı `localId` ile tekrar gelen bir satış (sync retry) cari hesaba **ikinci kez borç yazmıyor** (mevcut satış idempotency mantığıyla tutarlı).
- **Veri bütünlüğü:** `'account'` ödemesi olan ama `customerId` olmayan bir satış artık `MissingCustomerForAccountPaymentError` ile reddediliyor.
- **Kredi limiti zorlaması henüz yok:** Faz 1'de sadece takip ediliyor, aşımda satış engellenmiyor — bu bilinçli olarak Faz 3'e (Risk Raporu) bırakıldı.

### ⚠️ Bu Sandbox'ta Doğrulanamayan (Yine Prisma Engine Kısıtlaması)

`pnpm --filter @pazariopos/server exec tsc --noEmit` → 7 hata, hepsi `@prisma/client`'ın yeni
`Account`/`AccountTransaction` modelleri için henüz regenerate edilmemiş olmasından (bilinen
sandbox kısıtlaması). **core, ui, web, desktop paketleri 4/4 temiz.**

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm terminalleri durdur

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Yeni Account alanları + AccountTransaction tablosu için migration
pnpm db:migrate
# Migration adı sorarsa: "cari_hesap_phase1"

# 4. Seed'i tekrar çalıştır (demo-customer-2 eklenecek, mevcut hesaplar korunacak)
pnpm --filter @pazariopos/server run db:seed

# 5. Doğrula
pnpm turbo run typecheck
# Beklenen: 5/5 PASS

# 6. Başlat ve test et
pnpm dev:server
pnpm dev:web
```

**Tarayıcıda test edilecekler:**
1. "Cari Hesap (veresiye için seçin)" dropdown'ında "Demo Customer" ve "Ayşe Yılmaz" görünmeli
2. Bir ürün sepete ekle, dropdown'dan "Demo Customer" seç
3. **"Veresiye (Cari Hesaba Ekle)"** butonuna tıkla
4. Prisma Studio'da (`pnpm db:studio`) `Account` tablosunda "Demo Customer"ın `balance`
   değerinin arttığını, `AccountTransaction` tablosunda yeni bir `invoice` tipi kayıt
   olduğunu doğrula

---

## 💳 CARİ HESAP — FAZ 2 (AÇIK HESAP) + FAZ 3 (YAŞLANDIRMA & RİSK) — 20 Temmuz 2026

Faz 1'in hemen ardından, kullanıcı onayıyla Faz 2 ve Faz 3 art arda yazıldı.

### Faz 2 — Açık Hesap (Open-Item Matching)

| Dosya | Değişiklik |
|---|---|
| `server/prisma/schema.prisma` | Yeni `AccountTransactionMatch` tablosu — hangi ödemenin hangi faturayı ne kadar kapattığını kaydeder |
| `server/src/routes/accounts.ts` | `POST /api/accounts/:id/payments` — ödeme kaydı + **otomatik FIFO eşleştirme** (en eski açık faturadan başlayarak) veya çağıranın açıkça belirttiği faturalara manuel eşleştirme |
| `server/src/schemas/payment.ts` | Yeni dosya — zod validasyonu |
| `packages/core` | `accountsApi.recordPayment()`, `useAccountStore.recordPayment()` |
| `packages/ui/src/PosScreen.tsx` | Seçili müşteri için bakiye gösterimi + "Ödeme Al" formu eklendi |

**Nasıl çalışıyor:** Bir ödeme kaydedildiğinde, tutar açık faturalara (henüz kapanmamış `AccountTransaction.type='invoice'` kayıtlarına) en eskiden başlayarak otomatik dağıtılıyor. Her eşleştirme bir `AccountTransactionMatch` satırı olarak izleniyor — kısmi ödemeler ve birden fazla faturaya bölünen ödemeler doğru şekilde destekleniyor.

### Faz 3 — Yaşlandırma & Risk

| Endpoint | Amaç |
|---|---|
| `GET /api/accounts/:id/aging` | Açık bakiyeyi vade gününe göre dağıtır: `current`, `0-30`, `31-60`, `61-90`, `90+` gün |
| `GET /api/accounts/risk` | Kredi limitini aşan hesapları listeler |
| `POST /api/accounts/:id/interest` | Vadesi geçmiş açık tutara flat oranlı gecikme faizi uygular, yeni bir `interest` tipi hareket + bakiye güncellemesi (atomik) |

**Not:** Faiz hesaplaması basitleştirildi (bileşik/günlük faiz değil, tek seferlik flat oran) — bu, ilk sürüm için yeterli, ileride geliştirilebilir.

### Bu Oturumda Bulunan ve Düzeltilen Hatalar

1. **`accounts.ts`'deki `$transaction` callback'i** (`tx` parametresi) — `sales.ts`'de daha önce
   yaptığımız gibi açıkça `Prisma.TransactionClient` tipi verilmesi gerekiyordu, yoksa implicit-any hatası.
2. **`.filter()`/`.reduce()` inline callback'leri** — Prisma client bu sandbox'ta regenerate
   edilemediği için (`accounts.findMany()` sonucu `any[]` kalıyor), inline callback parametreleri
   tip çıkaramıyordu. Düz `for` döngülerine çevrildi — hem bu sandbox'ta hem gerçek ortamda
   sorunsuz çalışan, daha taşınabilir bir çözüm.

### Doğrulama

```
✅ pnpm turbo run typecheck (core, ui, web, desktop)  →  4/4 PASS
✅ pnpm --filter @pazariopos/server exec tsc --noEmit  →  sadece bilinen 7 Prisma
   regenerate hatası (yeni bir hata yok)
```

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm terminalleri durdur

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Yeni AccountTransactionMatch tablosu için migration
pnpm db:migrate
# Migration adı sorarsa: "cari_hesap_phase2_3"

# 4. Doğrula
pnpm turbo run typecheck
# Beklenen: 5/5 PASS

# 5. Başlat
pnpm dev:server
pnpm dev:web
```

**Faz 2 testi (PowerShell ile doğrudan):**
```powershell
# Önce Demo Customer'ın hesap ID'sini not al (demo-customer-1)
# Bir miktar ödeme kaydet (örn. 50.00 TL = 5000 kuruş)
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/accounts/demo-customer-1/payments" `
  -ContentType "application/json" -Body '{"amount": 5000, "description": "Test ödemesi"}'
```
Beklenen: `matchedAmount` ve `unmatchedAmount` alanları, güncellenmiş `account.balance` dönmeli.

**Faz 3 testi:**
```powershell
# Yaşlandırma raporu
Invoke-RestMethod "http://localhost:3000/api/accounts/demo-customer-1/aging"

# Risk raporu (limit aşanlar)
Invoke-RestMethod "http://localhost:3000/api/accounts/risk"
```

**CARİ HESAP FAZ 1-3 — KOD TAMAMLANDI, KULLANICI DOĞRULAMASI BEKLENİYOR.**

### ✅ Kullanıcının Makinesinde Doğrulandı — 20-21 Temmuz 2026

```powershell
✅ pnpm db:migrate (cari_hesap_phase2_3)          — AccountTransactionMatch tablosu oluşturuldu
✅ pnpm turbo run typecheck                        — 5/5 PASS
✅ Veresiye satış: balance 15000→34900 (ödeme -5000, satış +24900) — atomiklik doğrulandı
✅ Ödeme + FIFO otomatik eşleştirme:
   matchedAmount: 10000, unmatchedAmount: 0        — açık faturaya tam eşleşti
✅ Yaşlandırma raporu: totalOpen 24900 → 14900     — eşleştirme sonrası açık tutar doğru azaldı
```

**CARİ HESAP FAZ 1-3 — TAMAMLANDI VE UÇTAN UCA DOĞRULANDI.**

**Not (bilgi amaçlı, kod hatası değil):** PowerShell'in `Invoke-RestMethod`'u Türkçe karakterli
(`ı`, `ö` vb.) `-Body` metinlerinde `Content-Length` uyuşmazlığı hatası verebiliyor
(`FST_ERR_CTP_INVALID_CONTENT_LENGTH`). Bu, tarayıcıdaki gerçek web arayüzünü etkilemiyor —
sadece PowerShell'den doğrudan test ederken ASCII karakter kullanmak yeterli çözüm.

---

## 💰 GELİR/GİDER & FİNANS MODÜLÜ — FAZ 1-3 — 21 Temmuz 2026

Kullanıcı onayıyla, Cari Hesap'takiyle aynı disiplinle Faz 1-3 kapsamında (Faz 4-5 —
bütçe/dashboard, CSV/OFX ekstre import — kapsam dışı bırakıldı).

### Faz Planı

| Faz | İçerik | Durum |
|---|---|---|
| **1 — Temel** | Gelir/Gider kategori ağacı, Kasa (hareket + gün sonu sayımı), Banka hesabı (manuel hareket) | ✅ |
| **2 — Çek/Senet** | Çek/senet portföyü, durum akışı, vade takvimi | ✅ |
| **3 — Raporlar** | Nakit akış, gelir/gider karşılaştırma, kâr/zarar özeti | ✅ |
| ~~4 — Bütçe & Dashboard~~ | ~~Sapma analizi~~ | ❌ Kapsam dışı |
| ~~5 — Ekstre Import & Mutabakat~~ | ~~CSV/OFX~~ | ❌ Kapsam dışı |

### Eklenen Dosyalar (Özet)

| Dosya | İçerik |
|---|---|
| `server/prisma/schema.prisma` | `Category`, `CashRegister`, `CashMovement`, `CashCount`, `BankAccount`, `BankTransaction`, `Cheque` modelleri |
| `server/src/routes/categories.ts` | `GET/POST /api/categories` |
| `server/src/routes/cashRegisters.ts` | Kasa CRUD + hareket + gün sonu sayımı |
| `server/src/routes/bankAccounts.ts` | Banka hesabı CRUD + hareket |
| `server/src/routes/cheques.ts` | Çek/senet CRUD + durum geçişi (`in_wallet→at_bank→collected/returned/protested`) + vade takvimi |
| `server/src/routes/reports.ts` | `cash-flow`, `income-expense`, `profit-loss` (salt okunur agregasyon) |
| `server/src/routes/sales.ts` | **Kritik:** Nakit satışlar artık varsayılan kasaya (`default-cash-register`) otomatik işleniyor — satışla **atomik** |
| `packages/core` | `useFinanceStore`, `categoriesApi`, `cashRegistersApi`, `bankAccountsApi`, `chequesApi`, `reportsApi` |
| `server/prisma/seed.ts` | Varsayılan kasa (`Ana Kasa`), banka hesabı, 2 örnek kategori eklendi |

### Mimari Karar — Nakit Satış Otomatik Kasaya İşleniyor

Stok düşüşü ve veresiye borç yazma gibi, **nakit ödemeli her satış artık otomatik olarak
varsayılan kasaya bir "giriş" hareketi işliyor** — satışla aynı transaction'da, atomik.
Bu, mevcut "Ödeme Al (Nakit)" checkout akışını hiç değiştirmeden arkada çalışıyor — yani
**yeni bir arayüz eklemeden**, PosScreen'de yaptığın her nakit satış artık gerçekten kasaya
yansıyacak.

### Doğrulama

```
✅ pnpm turbo run typecheck (core, ui, web, desktop)  →  4/4 PASS
✅ pnpm --filter @pazariopos/server exec tsc --noEmit  →  sadece bilinen 14 Prisma
   regenerate hatası (yeni bir hata yok)
```

### Bu Oturumda Bulunan ve Düzeltilen Hata

`reports.ts`'deki `categories.map(c => [c.id, c])` — yine Prisma client regenerate
edilmediği için inline callback tip çıkaramıyordu. Düz `for` döngüsüne çevrildi
(`Cari Hesap`'ta da aynı deseni görmüştük).

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm terminalleri durdur

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Yeni tablolar için migration
pnpm db:migrate
# Migration adı sorarsa: "gelir_gider_finans_phase1_3"

# 4. Seed'i tekrar çalıştır (varsayılan kasa + banka hesabı + kategoriler eklenecek)
pnpm --filter @pazariopos/server run db:seed

# 5. Doğrula
pnpm turbo run typecheck
# Beklenen: 5/5 PASS

# 6. Başlat
pnpm dev:server
pnpm dev:web
```

**En kolay test — nakit satış yap, otomatik kasa girişini doğrula:**
```powershell
# Önce kasa bakiyesini kontrol et (0 olmalı, ilk kurulumda)
Invoke-RestMethod "http://localhost:3000/api/cash-registers/default-cash-register"

# Tarayıcıda bir ürün sepete ekle, "Ödeme Al (Nakit)" ile satış yap

# Kasa bakiyesini tekrar kontrol et — satış tutarı kadar artmış olmalı
Invoke-RestMethod "http://localhost:3000/api/cash-registers/default-cash-register"

# Hareket geçmişini gör
Invoke-RestMethod "http://localhost:3000/api/cash-registers/default-cash-register/movements"
```

**Çek/Senet testi:**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cheques" `
  -ContentType "application/json" `
  -Body '{"type": "customer_cheque", "amount": 50000, "drawerName": "Test Firma", "dueDate": "2026-08-15T00:00:00.000Z"}'

# Vade takvimi
Invoke-RestMethod "http://localhost:3000/api/cheques/upcoming?days=60"
```

**Raporlar testi:**
```powershell
Invoke-RestMethod "http://localhost:3000/api/reports/cash-flow?from=2026-01-01&to=2026-12-31"
Invoke-RestMethod "http://localhost:3000/api/reports/profit-loss?from=2026-01-01&to=2026-12-31"
```

**GELİR/GİDER & FİNANS FAZ 1-3 — KOD TAMAMLANDI, KULLANICI DOĞRULAMASI BEKLENİYOR.**

### ✅ Kullanıcının Makinesinde Doğrulandı — 23 Temmuz 2026

```powershell
✅ pnpm db:migrate + db:seed                — Category/CashRegister/CashMovement/CashCount/
                                               BankAccount/BankTransaction/Cheque tabloları oluştu
✅ pnpm turbo run typecheck                  — 5/5 PASS (server dahil, önceki 14 hata kayboldu)
✅ Nakit satış → otomatik kasa girişi:
   balance: 6400 = 3200 + 3200 (iki hareketin toplamı)
   Her hareket referenceSaleId ile gerçek bir satışa bağlı, doğru tutar + açıklama
```

**GELİR/GİDER & FİNANS FAZ 1-3 — TAMAMLANDI VE UÇTAN UCA DOĞRULANDI.**

**Not:** Seed script'teki `upsert`'in `update: {}` kullanması, `demo-customer-1`'in
`creditLimit`/`paymentTermDays` alanlarının sonradan eklenen değerlerle güncellenmemesine
yol açtı (var olan kayıt korunuyor, yeni alanlar sadece ilk oluşturmada uygulanıyor). Küçük
ve bloklayıcı olmayan bir tutarsızlık — ileride ele alınabilir.

---

## 🔐 AUTH / LOGIN — FAZ 1-3 — 25 Temmuz 2026

Kullanıcı onayıyla Faz 1-3 kapsamında.

### Faz Planı

| Faz | İçerik | Durum |
|---|---|---|
| **1 — Temel Kimlik Doğrulama** | `User` modeli, JWT tabanlı giriş, giriş ekranı, satışların gerçek kullanıcıya bağlanması | ✅ |
| **2 — Yetkilendirme (RBAC)** | Tüm endpoint'ler role göre korundu | ✅ |
| **3 — Kullanıcı Yönetimi** | Admin kullanıcı oluşturma/listeleme, kendi şifreni değiştirme | ✅ |

### Eklenen Dosyalar (Özet)

| Dosya | İçerik |
|---|---|
| `server/prisma/schema.prisma` | `User` modeli (username, passwordHash, role enum, active) |
| `server/src/lib/jwt.ts` | JWT sign/verify sarmalayıcı |
| `server/src/plugins/authPlugin.ts` | `app.authenticate` (token doğrulama) + `app.requireRole(...)` (rol kontrolü) Fastify decorator'ları |
| `server/src/routes/auth.ts` | `POST /api/auth/login`, `GET /api/auth/me` |
| `server/src/routes/users.ts` | `GET/POST /api/users` (admin), `POST /api/users/me/password` |
| `packages/core/src/store/useAuthStore.ts` | Login/logout, `localStorage` ile oturum kalıcılığı |
| `packages/ui/src/PosScreen.tsx` | **Giriş ekranı eklendi** — artık giriş yapmadan POS ekranı görünmüyor |
| `server/prisma/seed.ts` | Varsayılan kullanıcılar: `admin`/`admin123`, `kasiyer1`/`kasiyer123` (**sadece geliştirme için**) |

### RBAC — Hangi Rol Neye Erişebilir

| Rol | Erişim |
|---|---|
| `admin` | Tam erişim |
| `accountant` (Muhasebe) | Cari hesap, finans, raporlar |
| `cashier` (Kasiyer) | Satış, ödeme kaydı, çek kabul |
| `warehouse` (Depo) | Ürün/stok yönetimi |
| `viewer` (Sadece Görüntüleme) | Sadece okuma (henüz özel bir GET kısıtlaması yok, gelecekte eklenebilir) |

**Tüm endpoint'ler artık `Authorization: Bearer <token>` gerektiriyor** — `/api/health` ve
`/api/auth/login` hariç.

### Mimari Kararlar

- **JWT stateless** — hem web hem desktop için aynı token mekanizması, sunucu tarafında session
  saklanmıyor.
- **Token `localStorage`'da saklanıyor** — uygulama yeniden başlatıldığında kullanıcı tekrar
  giriş yapmak zorunda kalmıyor; `useAuthStore.init()` başlangıçta token'ı doğruluyor
  (`GET /api/auth/me`), geçersizse otomatik temizliyor.
- **`cashierId` artık gerçek kullanıcıdan geliyor** — `useSaleStore`'daki hardcoded
  `'CASHIER_DEV'` kaldırıldı, satışlar artık gerçekten giriş yapan kişiye atfediliyor.
- **Aynı hata mesajı (kullanıcı adı yanlış / şifre yanlış)** — kullanıcı numaralandırma
  (enumeration) saldırısını önlemek için.

### Bu Oturumda Bulunan ve Düzeltilen Gerçek Hata

`server/src/lib/jwt.ts`'de `jwt.sign()`'ın `expiresIn` seçeneği, `jsonwebtoken` kütüphanesinin
tip tanımlarında belirli bir string-literal formatı bekliyor (örn. `"12h"`) — env değişkeninden
gelen düz `string` tipiyle uyuşmuyordu. Açık bir tip cast'i ile düzeltildi (env değişkenlerinin
formatını derleme zamanında doğrulayamayacağımızı dürüstçe kabul eden standart bir yaklaşım).

### Doğrulama

```
✅ pnpm turbo run typecheck (core, ui, web, desktop)  →  4/4 PASS
✅ pnpm --filter @pazariopos/server exec tsc --noEmit  →  sadece bilinen 15 Prisma
   regenerate hatası (yeni bir hata yok, jwt.ts hatası dahil düzeltildi)
```

### ⚠️ ÖNEMLİ — Bu Güncelleme Sonrası Değişen Davranış

**Artık `pnpm dev:web` açtığında doğrudan POS ekranını görmeyeceksin — önce bir giriş ekranı
çıkacak.** Giriş bilgileri:

| Kullanıcı Adı | Şifre | Rol |
|---|---|---|
| `admin` | `admin123` | admin |
| `kasiyer1` | `kasiyer123` | cashier |

**Bu şifreler sadece geliştirme içindir — gerçek kullanımdan önce mutlaka değiştirilmeli.**

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm terminalleri durdur

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Yeni bağımlılıkları kur (bcryptjs, jsonwebtoken, fastify-plugin)
pnpm install

# 4. server\.env dosyana JWT_SECRET ve JWT_EXPIRES_IN satırlarını ekle
#    (server\env.example'daki güncel haliyle karşılaştır, eksikse elle ekle:)
#    JWT_SECRET=dev-only-change-me-before-production
#    JWT_EXPIRES_IN=12h

# 5. Yeni User tablosu için migration
pnpm db:migrate
# Migration adı sorarsa: "auth_phase1_3"

# 6. Seed'i tekrar çalıştır (admin + kasiyer1 kullanıcıları eklenecek)
pnpm --filter @pazariopos/server run db:seed

# 7. Doğrula
pnpm turbo run typecheck
# Beklenen: 5/5 PASS

# 8. Başlat
pnpm dev:server
pnpm dev:web
```

**Tarayıcıda test:** `admin` / `admin123` ile giriş yap, POS ekranının açıldığını doğrula,
sonra bir satış yap — Prisma Studio'da `Sale.cashierId`'nin artık gerçek kullanıcı ID'sini
taşıdığını gör (önceden hep `'CASHIER_DEV'` idi).

**PowerShell ile token alıp korumalı bir endpoint'i test etme:**
```powershell
$response = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" -Body '{"username": "admin", "password": "admin123"}'
$token = $response.token

Invoke-RestMethod "http://localhost:3000/api/products" -Headers @{ Authorization = "Bearer $token" }
```

**AUTH FAZ 1-3 — KOD TAMAMLANDI, KULLANICI DOĞRULAMASI BEKLENİYOR.**

### ✅ Kullanıcının Makinesinde Doğrulandı — 25 Temmuz 2026

Kullanıcı, tüm doğrulama adımlarının (install, migration, seed, typecheck 5/5, giriş ekranı,
`admin`/`kasiyer1` ile giriş, satış sonrası `Sale.cashierId`'nin gerçek kullanıcıya bağlandığı)
başarıyla çalıştığını onayladı.

**AUTH FAZ 1-3 — TAMAMLANDI VE UÇTAN UCA DOĞRULANDI.**

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm dev server'ları durdur (Ctrl+C) — web, desktop, server

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Yeni Product tablosu için migration oluştur
pnpm db:migrate
# Migration adı sorarsa: "add_product_inventory"

# 4. Seed'i tekrar çalıştır (3 ürün + demo hesap)
pnpm --filter @pos-erp/server run db:seed

# 5. Server'ın artık hatasız derlendiğini doğrula
pnpm --filter @pos-erp/server exec tsc --noEmit
# Beklenen: sessiz (hatasız)

# 6. Tüm monorepo'yu doğrula
pnpm turbo run typecheck
# Beklenen: 5/5 PASS

# 7. Server + web'i başlat, tarayıcıda test et
pnpm dev:server    # Terminal 1
pnpm dev:web       # Terminal 2
```

**Tarayıcıda test edilecekler:**
- Quick-Add kartları artık gerçek DB'den geliyor (3 ürün)
- "Ceramic Mug" kartında **"⚠ Low stock: 3"** kırmızı uyarısı görünmeli
- Bir satış yap (checkout) → Prisma Studio'da (`pnpm db:studio`) `Product` tablosunda ilgili
  ürünün `stock` alanının **gerçekten azaldığını** doğrula

### 🐛 Bu Oturumda Bulunan ve Düzeltilen Gerçek Hatalar

1. **`packages/core/src/api/salesApi.ts`** — `import.meta.env` kullanımı, platform-bağımsız
   pakette Vite'a özgü bir API'ye bağımlılık yaratıyordu (mimari ihlali). Çözüm:
   `setApiBaseUrl()` fonksiyonu eklendi, Vite coupling'i `apps/web` ve `apps/desktop`'un
   kendi `main.tsx`'lerine taşındı.

2. **`packages/core/src/services/web/receiptTemplate.ts`** — `noUncheckedIndexedAccess`
   kuralı altında `rows[0]` tipi `Record<string, unknown> | undefined` olarak çıkıyordu,
   `Object.keys()` çağrısı tip hatası veriyordu. Düzeltildi: erken dönüş + narrowing.

3. **`server/tsconfig.json`** — `NodeNext` module resolution modu tüm relative import'larda
   `.js` uzantısı zorunlu kılıyordu (gerçek Node ESM kuralı) ama proje `tsx`/esbuild ile
   çalıştığı için bu gereksiz katılıktı. `Bundler` moduna çevrildi (repo geneliyle tutarlı).

4. **`server/package.json`** — `build` script'i `tsc` ile emit yapıyordu ama `Bundler`
   resolution modu ile bu, çalışma zamanında Node'un çözemeyeceği uzantısız import'lar
   üretirdi. `tsup` (esbuild tabanlı) bundler'a geçirildi.

5. **`server/src/mappers/saleMapper.ts`** — `@pos-erp/core`'un tam barrel'ından
   (`index.ts`) tip import ediyordu, ama barrel DOM'a bağımlı sınıfları da (`BarcodeService`,
   `NetworkMonitor` — `window`/`document` kullanıyor) dışa aktarıyor. Server'da DOM lib
   olmadığı için tüm modül grafiği derleme hatası veriyordu. **Mimari düzeltme:**
   `packages/core/package.json`'a DOM-bağımsız `./types` subpath export'u eklendi;
   server artık `@pos-erp/core/types`'tan sadece saf veri tiplerini import ediyor.

### ❌ Bu Sandbox'ta Doğrulanamayan (Kod Sorunu DEĞİL — Ortam Kısıtlaması)

| Sorun | Neden | Senin Makinende Ne Olacak |
|-------|-------|---------------------------|
| **`prisma generate` başarısız** | `binaries.prisma.sh` bu sandbox'ın izin verilen domain listesinde yok (403 Forbidden) | Normal internet erişiminle sorunsuz çalışır: `pnpm --filter @pos-erp/server exec prisma generate` |
| **Rust/Cargo derlemesi test edilemedi** | Bu sandbox'ta Rust toolchain kurulu değil | `cd apps/desktop/src-tauri && cargo check` ile kendi makinende doğrula |
| **Docker Compose gerçekten başlatılamadı** | Bu sandbox'ta Docker kurulu değil (`docker: not found`) | `pnpm docker:up` ile PostgreSQL + Redis'i gerçekten ayağa kaldır |
| **Gerçek uçtan uca test yapılmadı** | Yukarıdaki ikisi olmadan satış akışını gerçekten deneyemedim | `pnpm dev` + tarayıcıda test et |

### 📋 Senin Yapman Gerekenler (Bu Sandbox'ın Yapamadıkları)

```bash
cd pos-erp

# 1. Bağımlılıkları kur (zaten test edildi, çalışıyor)
pnpm install

# 2. Veritabanını başlat
pnpm docker:up

# 3. Server .env dosyasını oluştur
cp server/env.example server/.env

# 4. Prisma client'ı üret + migration çalıştır (BU SANDBOX'TA YAPILAMADI)
pnpm db:migrate

# 5. Demo hesabı seed et
pnpm --filter @pos-erp/server run db:seed

# 6. Şimdi server tipi hatasız derlenmeli — doğrula:
pnpm --filter @pos-erp/server exec tsc --noEmit
# Beklenen: hiçbir hata (yukarıdaki 4 Prisma hatası kaybolacak)

# 7. Full stack'i çalıştır
pnpm dev:server    # Terminal 1
pnpm dev:web       # Terminal 2

# 8. http://localhost:5173 aç ve test et
```

---

## ⚠️ DÜRÜST DURUM ÖZETİ (Bu bölüm ilk oturumdan kalmıştı — 25 Temmuz 2026 itibarıyla güncellendi)

**"Yazılım bitti mi?"** sorusuna güncel cevap: **Ana modüller tamamlandı ve uçtan uca doğrulandı, ama hâlâ eksikler var.**

### ✅ Tamamlanan ve Uçtan Uca Doğrulanan
- POS (Hızlı Satış) — online + offline + auto-sync
- Hardware Integration altyapısı (printer/barcode, mock modda)
- Desktop uygulaması (Tauri penceresi gerçekten açılıyor)
- Stok Takibi (Inventory MVP) — atomik stok düşüşü
- KDV hesaplama düzeltmesi
- PazarioPOS rebrand
- Cari Hesap (Faz 1-3) — ledger, veresiye, FIFO eşleştirme, yaşlandırma, risk
- Gelir/Gider & Finans (Faz 1-3) — kasa, banka, çek/senet, raporlar
- Auth/Login (Faz 1-3) — JWT, RBAC, kullanıcı yönetimi

### ⏭️ Kullanıcı Kararıyla Atlanan
- Gerçek donanım testi (fiziksel yazıcı/barkod okuyucu yok)
- Cari Hesap & Finans Faz 4-5 (PDF mutabakat, döviz, CSV/OFX import, toplu SMS/e-posta — dış servis bağımlılığı)

### ❌ Hâlâ Yazılmayan
- Otomatik testler (unit/e2e)
- CI/CD (GitHub Actions)
- Production deployment (gerçek sunucu, domain, SSL)
- Kullanıcı yönetimi arayüzü (şu an sadece API üzerinden, admin panel UI yok)
- Kasa/Cari/Finans için özel ekranlar (şu an PosScreen'e entegre parçalar + API testleri var, ayrı "back office" ekranları yok)

Detaylı faz bazlı dökümantasyon için bu dosyanın üst kısımlarındaki ilgili bölümlere bakın.

---

## 🎨 WEB STYLING — TAILWIND V4 + TASARIM SİSTEMİ — 26 Temmuz 2026

### Tasarım Yönü

**"Pazario" ← Türkçe "pazar"** (açık hava çarşısı) — jenerik "kurumsal mavi" yerine sıcak,
dokunsal bir çarşı/tezgah kimliği. İmza öğe: sepet toplamının eski mekanik yazar kasa
ekranı gibi (koyu, girintili, amber ışıltılı rakamlarla) gösterilmesi.

| Token | Değer | Kullanım |
|---|---|---|
| `--color-petrol` | `#123738` | Üst bar, başlıklar |
| `--color-saffron` | `#d99a2b` | Ana aksan, "Ödeme Al" butonu |
| `--color-paper` | `#f6f1e4` | Ana zemin (makbuz/kağıt hissi, uzun mesai için yüksek kontrast) |
| `--color-copper` | `#b5551f` | Uyarılar, veresiye butonu |
| Font (başlık) | Fraunces | Marka adı, panel başlıkları |
| Font (arayüz) | IBM Plex Sans | Genel metin (Türkçe karakter desteği güçlü) |
| Font (rakamlar) | JetBrains Mono | Fiyatlar, toplam (tabular-nums — kasa şeridi hissi) |

### Eklenen/Değiştirilen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `packages/ui/src/styles.css` | **Yeni** — Tailwind v4 `@theme` token'ları + imza bileşen sınıfları (`register-display`, `price-tag`, `receipt-rule`) |
| `packages/ui/package.json` | `./styles.css` subpath export'u eklendi |
| `apps/web/vite.config.ts`, `apps/desktop/vite.config.ts` | `@tailwindcss/vite` plugin'i eklendi |
| `apps/web/src/main.tsx`, `apps/desktop/src/main.tsx` | `import '@pazariopos/ui/styles.css'` eklendi |
| `packages/ui/src/PosScreen.tsx` | **Tamamen yeniden stilize edildi** — inline `style` objesi kaldırıldı, Tailwind sınıflarına geçildi. **Mantık/hook'lar hiç değiştirilmedi**, sadece görünüm. |

### Mimari Not

CSS dosyası `packages/ui`'de tek bir kaynaktan geliyor (`styles.css`), hem `apps/web` hem
`apps/desktop` aynı dosyayı import ediyor — bu, web ve masaüstünün **piksel piksel aynı
görünmesini** garanti ediyor (mimari kuralı: tek kod tabanı, aynı görünüm).

### Doğrulama

```
✅ pnpm install                                       — @tailwindcss/vite, tailwindcss kuruldu
✅ pnpm turbo run typecheck (core, ui, web, desktop)  →  4/4 PASS
```

**Not:** Bu sandbox'ta gerçek bir tarayıcıda render edip ekran görüntüsü alamadım (headless
tarayıcı kurulamadı, network kısıtlaması) — tasarım tamamen kod/CSS mantığı üzerinden
oluşturuldu. İlk görsel doğrulama senin makinende olacak.

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm terminalleri durdur

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Yeni bağımlılıkları kur (tailwindcss, @tailwindcss/vite — Windows binary'leri otomatik iner)
pnpm install

# 4. Doğrula
pnpm turbo run typecheck
# Beklenen: 4/4 PASS (server'ı ayrıca kontrol etmene gerek yok, bu değişiklik server'ı etkilemiyor)

# 5. Başlat
pnpm dev:web
```

Tarayıcıda `localhost:5173` aç — giriş ekranının ve POS ekranının tamamen yeni bir görünümde
olduğunu göreceksin. **Özellikle sepet toplamındaki koyu/amber "yazar kasa ekranı" görünümüne
dikkat et** — bu, tasarımın imza öğesi.

**WEB STYLING — KOD TAMAMLANDI, GÖRSEL DOĞRULAMA BEKLENİYOR (bu sandbox'ta ekran görüntüsü alınamadı).**

### ✅ Kullanıcının Makinesinde Doğrulandı — 26 Temmuz 2026

İlk ekran görüntüsünde Tailwind utility class'larının hiç uygulanmadığı görüldü (sadece
`@layer components` özel sınıfları — `register-display` — çalışıyordu, düz CSS oldukları için
taramaya bağlı değiller). Kök neden teşhis edildi: **Tailwind v4'ün otomatik dosya taraması,
`apps/web`'in kendi klasör ağacının dışındaki `packages/ui/src` gibi workspace paketlerini
görmüyor** (bilinen bir monorepo kısıtlaması).

**Düzeltme:** `packages/ui/src/styles.css`'e `@source "./**/*.{ts,tsx}";` direktifi eklendi.

**Sonuç — ikinci ekran görüntüsünde tamamen doğrulandı:**
- Üst bar: petrol zemin, Fraunces başlık, safran vurgu ✅
- İmza öğe: TOPLAM kutusu koyu/amber "yazar kasa ekranı" görünümünde ✅
- Ürün kartları: fiyat etiketi notch detayı + düşük stok rozeti ✅
- Butonlar, dropdown, ÇEVRİMİÇİ rozeti — hepsi doğru stillenmiş ✅

**WEB STYLING — TAMAMLANDI VE GÖRSEL OLARAK DOĞRULANDI.**

---

## 📦 DESKTOP INSTALLER BUILD — 26 Temmuz 2026

### Yapılan Yapılandırma Değişiklikleri

`apps/desktop/src-tauri/tauri.conf.json`:

| Alan | Eski | Yeni | Neden |
|---|---|---|---|
| `bundle.targets` | `["msi","nsis","deb","appimage","dmg"]` | `"all"` | Karışık OS listesi yerine Tauri'nin host işletim sistemine göre otomatik filtrelemesi — Windows'ta sadece `msi`+`nsis` denenir, gereksiz hata/karışıklık önlenir |
| `bundle.publisher` | yok | `"Pazario"` | Kurulum sihirbazında görünür |
| `bundle.category` | yok | `"Business"` | Windows uygulama kategorisi |
| `bundle.shortDescription` / `longDescription` | yok | eklendi | Installer metadata'sı |
| `bundle.windows.webviewInstallMode` | yok | `downloadBootstrapper` | WebView2 runtime yoksa otomatik indirir |

### Bu Sandbox'ta Yapılamayan (Gerçek Kısıtlama)

Bu adımı **hiç çalıştıramadım** — bu sandbox'ta:
- Rust/Cargo toolchain yok (release derlemesi için gerekli)
- Windows'a özgü bundler araçları (WiX Toolset — `.msi` için, NSIS — `.exe` installer için) yok
- Bu araçlar zaten sadece Windows'ta anlamlı — Linux sandbox'ta hiçbir şekilde test edilemez

Bu, **tamamen senin makinende** yapılması gereken bir adım.

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm dev server'ları durdur (web, desktop dev, server) — build sırasında çakışmasınlar

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. Production build'i çalıştır
cd C:\Projects\STOK
pnpm --filter @pazariopos/desktop run tauri:build
```

**Beklenenler:**
- İlk çalıştırmada Tauri, NSIS ve WebView2 bootstrapper gibi araçları otomatik indirebilir
  (internet bağlantısı gerekir — bu senin makinende sorun olmamalı)
- Süreç şu sırayla ilerler: `tsc --noEmit && vite build` (frontend production build) →
  Rust release derlemesi (`cargo build --release`, birkaç dakika sürebilir) → bundling
- Sonunda terminalde installer dosyalarının **tam yolu** yazdırılır, örneğin:
  ```
  Finished 3 bundles at:
    C:\Projects\STOK\apps\desktop\src-tauri\target\release\bundle\msi\PazarioPOS_0.1.0_x64_en-US.msi
    C:\Projects\STOK\apps\desktop\src-tauri\target\release\bundle\nsis\PazarioPOS_0.1.0_x64-setup.exe
  ```

**Test etmen gerekenler:**
1. Üretilen `.msi` veya `.exe` dosyasına çift tıkla, kurulumu tamamla
2. **Windows SmartScreen "Bilinmeyen yayımcı" uyarısı verecek** — bu beklenen bir durum
   (kod imzalama sertifikası henüz yok, bu ayrı bir adım — istersen sonra ekleyebiliriz).
   "Yine de çalıştır" ile devam et.
3. Kurulan uygulamayı Başlat menüsünden aç, `admin`/`admin123` ile giriş yap, POS ekranının
   çalıştığını doğrula
4. Kurulumu kaldır (Denetim Masası → Program Ekle/Kaldır) ve düzgün kaldırıldığını doğrula

**Çıktıyı paylaş** — özellikle hata alırsan (Rust derleme hatası, eksik araç, vb.) tam metni
gönder, gerçek makinede ilk kez çalıştığı için beklenmedik bir şey çıkabilir.

**DESKTOP INSTALLER BUILD — YAPILANDIRMA HAZIR, KULLANICI TESTİ BEKLENİYOR (bu sandbox'ta hiç çalıştırılamadı).**

### ✅ Kullanıcının Makinesinde Doğrulandı — 26 Temmuz 2026

```
✅ pnpm --filter @pazariopos/desktop run tauri:build  — HİÇ HATA YOK
   • WiX Toolset ve NSIS otomatik indirildi (ilk çalıştırma)
   • Rust release derlemesi tamamlandı
   • İki installer üretildi:
     - target\release\bundle\msi\pazariopos-desktop_0.1.0_x64_en-US.msi
     - target\release\bundle\nsis\pazariopos-desktop_0.1.0_x64-setup.exe
```

**DESKTOP INSTALLER BUILD — TAMAMLANDI VE DOĞRULANDI.**

---

## 🐛 KURULU UYGULAMADA GİRİŞ HATASI — 2 GERÇEK HATA BULUNDU — 27 Temmuz 2026

Kurulan installer açılıp `admin`/`admin123` ile giriş denendiğinde **"Failed to fetch"** hatası
alındı. Araştırma sürecinde **iki ayrı gerçek hata** bulundu:

### Hata 1 — CORS: Paketlenmiş Uygulama Farklı Bir Origin'den Geliyor

`server/src/main.ts`'deki CORS `origin` listesi sadece dev-mode adreslerini
(`localhost:5173`, `localhost:1420`) içeriyordu. Ama **paketlenmiş/kurulu** Tauri uygulaması
production'da `https://tauri.localhost` origin'inden istek yapıyor — bu listede yoktu.

**Düzeltme:** `main.ts`'e ve `server/env.example`'a `https://tauri.localhost` ve
`tauri://localhost` eklendi.

**Kullanıcı eylemi gerekiyor:** Kendi `server\.env` dosyanda `CORS_ORIGIN` satırı zaten
tanımlıysa (env.example'dan kopyaladıysan tanımlı), bunu elle güncellemen gerekiyor:
```
CORS_ORIGIN=http://localhost:5173,http://localhost:1420,https://tauri.localhost,tauri://localhost
```

### Hata 2 — BarcodeService.ts: Tarayıcı Uzantısı Sentetik KeyboardEvent Gönderince Çöküyor

CORS düzeltmesinden sonra bile web sürümünde giriş sorunu sürdü. DevTools Console'da gerçek
neden ortaya çıktı:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'length')
    at HTMLDocument.keydownListener (BarcodeService.ts:131:17)
```

**Kök neden:** `BarcodeService`'in web modu, barkod taramasını yakalamak için `document`'e
global bir `keydown` dinleyicisi ekliyor. Bazı tarayıcı uzantıları (ör. alışveriş/fiyat
karşılaştırma uzantıları) kendi sentetik `KeyboardEvent`'lerini `.key` alanı **tanımsız**
bırakarak tetikliyor — bu da `e.key.length` çağrısında **her tuşa basışta** (giriş formuna
yazarken dahil, tarama ile hiç ilgisi olmasa da) bir JavaScript hatasına yol açıyordu.

**Düzeltme:** `if (e.key.length === 1)` → `if (typeof e.key === 'string' && e.key.length === 1)`

Bu, hem masaüstü hem web'i etkileyen, taramayla alakasız her yerde (özellikle formlara yazarken)
tetiklenebilen gizli bir kırılganlık hatasıydı — düzeltildi.

### ⚠️ SANDBOX SIFIRLANMASI VE KURTARMA — 28 Temmuz 2026

Bu iki düzeltmeyi yaptıktan hemen sonra, **Claude'un çalışma ortamı (sandbox) teknik bir
nedenle sıfırlandı** — `/home/claude/pos-erp` içindeki tüm dosyalar kayboldu, iki düzeltme
paketlenip kullanıcıya gönderilmeden kayboldu.

**Kurtarma:** Kullanıcı, projenin en son gönderilen zip halini (26 Temmuz, CORS ve
BarcodeService düzeltmelerinden ÖNCEki durum) tekrar yükledi. Proje bu yüklemeden geri
yüklendi, **her iki düzeltme de yeniden uygulandı**, typecheck ile doğrulandı (4/4 core/ui/web/
desktop temiz, server'da sadece bilinen 15 Prisma-regenerate hatası — yeni hata yok).

**Ders:** Bundan sonra her düzeltme yapıldığında **hemen zip'lenip kullanıcıya gönderilecek**,
"birkaç düzeltmeyi biriktirip toplu gönderme" riskinden kaçınılacak.

### 📋 Kullanıcının Yapması Gerekenler

```powershell
# 1. Tüm terminalleri durdur

# 2. Güncel zip'i indirip C:\Projects\STOK üzerine çıkart

# 3. server\.env dosyanda CORS_ORIGIN satırını elle güncelle:
#    CORS_ORIGIN=http://localhost:5173,http://localhost:1420,https://tauri.localhost,tauri://localhost

# 4. Doğrula
pnpm turbo run typecheck
# Beklenen: core/ui/web/desktop 4/4 PASS

# 5. Başlat ve test et
pnpm dev:server
pnpm dev:web
```

Tarayıcıda giriş yapmayı tekrar dene — hem CORS hem BarcodeService düzeltmesi devrede,
"Failed to fetch" hatasının artık çıkmaması gerekiyor. Kurulu masaüstü uygulamasını da
(zaten kurulu installer'ı yeniden açarak — kodu değiştirdiğimiz için yeniden build etmen
gerekebilir, `pnpm --filter @pazariopos/desktop run tauri:build` ile) test edebilirsin.

**GİRİŞ HATASI DÜZELTMELERİ — YENİDEN UYGULANDI, KULLANICI DOĞRULAMASI BEKLENİYOR.**


---

## Otomatik Testler (Vitest + Playwright) — 1 Ağustos 2026

### Kapsam ve yaklaşım

Kullanıcı "Otomatik testler" ile devam etmeyi seçti. Öncelik, en riskli/kritik iş mantığına
verildi: para ile ilgili atomik `$transaction` (satış + stok düşüşü + cari/kasa), KDV hesaplama,
offline-first servisler (NetworkMonitor/InventoryService/AccountBalanceService), ve barkod
tarama buffer/timeout mantığı.

**Bu sandbox'ta gerçek Postgres'e karşı Prisma-backed entegrasyon testi çalıştırılamadı**
(bilinen kısıt: `prisma generate` → `binaries.prisma.sh` 403, kod hatası değil). Bunun yerine
`routes/sales.ts` testleri Prisma'yı elle mocklayarak (`server/src/test/prismaMock.ts`) gerçek
Fastify `app.inject()` + gerçek JWT auth üzerinden çalıştırıldı — hem daha hızlı hem de tam
olarak hangi sorgunun transaction İÇİNDE/DIŞINDA çalıştığını doğrulayabiliyor (asıl garanti
edilen şey bu zaten).

### ✅ Bu sandbox'ta yazıldı VE gerçekten çalıştırılıp doğrulandı

**`packages/core`** (`pnpm --filter @pazariopos/core test`) — **33/33 PASS**
- `NetworkMonitor.test.ts` (11) — online/offline geçişleri, ping döngüsü, reconnect'te
  handler'ın 2x tetiklenmesi, start/stop idempotency
- `InventoryService.test.ts` (6) — offline'da cache'den servis, cache yokken hata, `findByBarcode`
- `AccountBalanceService.test.ts` (4) — offline'da `OfflineBalanceError`, asla stale bakiye dönmemesi
- `BarcodeService.test.ts` (12) — Enter ile flush, sessizlik timeout'u ile flush, kısa buffer'ları
  atma, modifier tuşlarını yok sayma, `e.key === undefined` sentetik event'te çökmeme
  (Hata #18'in regresyon testi), format tahmini (EAN_13/EAN_8/UPC_A)

**`server`** (`pnpm --filter @pazariopos/server test`) — **34/34 PASS**
- `routes/sales.test.ts` (14) — 401/403/400, nakit satışta stok düşüşü + kasa girişi (hepsi TEK
  transaction içinde), çok satırlı satışta her satır kendi miktarıyla düşülüyor, veresiye
  satışında cari hesaba ledger + bakiye artışı, hesap bulunamadığında 400 + rollback, kasa
  seed edilmemişse 500, P2025 → 400, **localId ile idempotency** (replay'de `$transaction`
  hiç açılmıyor — stok/cari/kasa asla iki kez uygulanmıyor), `/sync` endpoint'i 200 dönüyor
- `mappers/saleMapper.test.ts` (7) — **KDV taxRate geri hesaplama** regresyon testleri: %18 ve
  %1 oranları, miktarla çarpılmaması, `unitPrice=0`'da `NaN`/`Infinity` yerine `0` dönmesi
- `schemas/sale.test.ts` (13) — zod şema sınır durumları (boş satır/ödeme, negatif tutar,
  geçersiz UUID/enum, kesirli miktar kabul edilmesi)

**Doğrulama komutları (bu sandbox'ta çalıştırıldı):**
```
pnpm install
pnpm turbo run typecheck   # core/ui/web/desktop: 4/4 PASS, server: sadece bilinen 15 Prisma hatası (yeni hata yok)
pnpm --filter @pazariopos/core test    # 33/33 PASS
pnpm --filter @pazariopos/server test  # 34/34 PASS
```

### ⏳ Yazıldı ama BU SANDBOX'TA çalıştırılamadı — kullanıcı makinesinde doğrulanmalı

- **`apps/web/e2e/pos-checkout.spec.ts`** (Playwright, 3 senaryo: giriş→ürün ekle→nakit ödeme
  tam akışı + KDV net/brüt ayrıştırma doğrulaması, hatalı giriş, veresiye butonunun pasif kalması)
  — backend tamamen `page.route()` ile mocklandığı için canlı sunucu/DB gerekmiyor, sadece
  gerçek bir tarayıcı gerekiyor. Bu sandbox'ta `npx playwright install chromium` da
  `cdn.playwright.dev` izinli olmadığı için 403 ile başarısız oldu (Docker/Cargo gibi bilinen
  bir ortam kısıtı, kod hatası değil).

### ❌ Hâlâ yazılmadı (kapsam dışı bırakıldı, ileride ayrı iş)

- `packages/ui` (React component/PosScreen) testleri — mevcut testler iş mantığını
  (`packages/core`, `server`) ve kritik akışı (Playwright e2e) kapsıyor; component-level testler
  ayrı bir faz olarak ele alınabilir
- Gerçek Postgres'e karşı `server` entegrasyon suite'i (mock'lu suite'in tamamlayıcısı) — CI'da
  veya kullanıcının makinesinde `prisma generate` çalıştığı için oradan eklenebilir
- GitHub Actions CI/CD (bir sonraki checklist maddesi)

### 📋 Kullanıcının Yapması Gerekenler (C:\Projects\STOK)

```powershell
# 1. Güncel zip'i indirip proje klasörünün üzerine çıkart, sonra:
pnpm install

# 2. Unit/integration testleri çalıştır (Postgres/Docker gerekmiyor)
pnpm --filter @pazariopos/core test
pnpm --filter @pazariopos/server test
# Beklenen: core 33/33 PASS, server 34/34 PASS

# 3. Playwright tarayıcısını kur (bu sandbox'ta yapılamadı)
pnpm --filter @pazariopos/web exec playwright install chromium

# 4. E2E testi çalıştır (dev server'ı otomatik başlatır)
pnpm --filter @pazariopos/web test:e2e
# Beklenen: 3/3 PASS

# 5. Genel doğrulama
pnpm turbo run typecheck
# Beklenen: core/ui/web/desktop 4/4 PASS (server'da her zamanki 15 Prisma-regenerate hatası, yenisi yok)
```

**OTOMATİK TESTLER — KOD YAZILDI VE BU SANDBOX'TA (core 33/33, server 34/34, typecheck 4/4)
DOĞRULANDI. Playwright e2e, kullanıcı makinesinde tarayıcı kurulumu sonrası doğrulanmayı
BEKLİYOR.**

### 🔧 Güncelleme — kullanıcı Windows'ta çalıştırdıktan sonra (1 Ağustos 2026)

`pnpm --filter @pazariopos/web test:e2e` çalıştırıldı: **2/3 PASS**, 1 test hatası bulundu ve düzeltildi:

1. **Test hatası (kod hatası değil)**: `pos-checkout.spec.ts`'de `getByText(PRODUCT.name)` 3 farklı
   yerde eşleşiyordu (ürün kartı, "Eklendi: ..." bildirimi, sepet satırı) → Playwright strict-mode
   ihlali. Sepet tablosundaki hücreye özel `getByRole('cell', { name: PRODUCT.name })` ile
   düzeltildi.
2. **Bonus bulgu — gerçek bir CSS hatası**: Vite build çıktısında
   `@import must precede all other statements` uyarısı yakalandı. `packages/ui/src/styles.css`'te
   Google Fonts `@import`'u, Tailwind'in `@import "tailwindcss"` direktifinden SONRA geliyordu.
   Tailwind bu direktifi build'de gerçek CSS kurallarına genişlettiği için font import'u artık
   dosyanın başında sayılmıyordu — CSS spesifikasyonuna göre geçersiz, bazı tarayıcılarda font
   import'unun sessizce yok sayılmasına yol açabilir. Font `@import`'u dosyanın en başına
   (`@import "tailwindcss"`'ten önce) taşınarak düzeltildi.

Kullanıcının tekrar çalıştırması gereken komut: `pnpm --filter @pazariopos/web test:e2e`
(beklenen: 3/3 PASS).

### 🔧 Güncelleme #2 — aynı sınıftan ikinci locator hatası (1 Ağustos 2026)

`test:e2e` tekrar çalıştırıldı: aynı türden bir strict-mode ihlali daha bulundu —
`getByText('32.00', { exact: false })` de 3 yerde eşleşiyordu (ürün kartı fiyatı, sepet
hücresi, register-display toplamı). `.register-display` class'ına scope edilerek düzeltildi:
`page.locator('.register-display').getByText('32.00', ...)`.

Kalan tüm locator'lar (`getByLabel`, `getByRole('button', ...)`, `getByText(USER.name)` vb.)
önceki çalıştırmada zaten doğrulandı (2/3 PASS) — değiştirilmedi.

Tekrar çalıştırılacak komut: `pnpm --filter @pazariopos/web test:e2e` (beklenen: 3/3 PASS).

---

## CI/CD (GitHub Actions) — 1 Ağustos 2026

### Yol boyunca bulunan ve düzeltilen 3 gerçek hata (test/CI kurulumu sırasında)

1. **`lint` script'i tamamen kırıktı** — ESLint 9 kurulu ama `eslint.config.js` hiç yoktu,
   hiçbir TypeScript/React plugin'i kurulu değildi (`eslint src --ext .ts` her paketde anında
   "couldn't find an eslint.config.js file" ile patlıyordu). Kök dizine gerçek bir flat config
   (`eslint.config.js`) eklendi: `typescript-eslint` (recommended), Node/browser paketleri için
   ayrı global'ler, `react-hooks`/`react-refresh` (UI/web/desktop), test dosyaları için gevşetilmiş
   `no-explicit-any`. **Sonuç: 5/5 paket, 0 hata, 0 uyarı.**
   - Bu sırada ikinci bir hata da bulundu: flat config'te array sırası önemli (sonraki blok
     kazanıyor) — test-dosyası istisnası, sondaki genel blok tarafından eziliyordu. Blok sırası
     düzeltildi.
   - `server/src/db/prisma.ts`'te artık gereksiz olan bir `eslint-disable` yorumu temizlendi.
2. **`prisma/migrations/` klasörü hiç yoktu** — proje şimdiye kadar gerçek bir migration
   geçmişi oluşturmamış (muhtemelen local'de `db push` ile gidilmiş). Bu, gerçek prod deploy
   öncesi **mutlaka çözülmesi gereken ayrı bir eksik** (aşağıya not düşüldü). CI'daki
   `db-schema` job'ı bu yüzden `migrate deploy` yerine `db push` kullanıyor.
3. `turbo.json`'daki `test` task'ı var olmayan bir `coverage/**` çıktısı bekliyordu (vitest
   `--coverage` olmadan çalıştığı için hep boş) — her çalıştırmada gereksiz "no output files
   found" uyarısı veriyordu. `outputs` alanı kaldırıldı.

### ✅ `.github/workflows/ci.yml` eklendi — 5 job

| Job | Ne yapıyor | Bu sandbox'ta doğrulandı mı |
|---|---|---|
| `lint-and-typecheck` | `turbo run lint` + `turbo run typecheck` | ✅ (lint 5/5; typecheck 4/5 — server'daki 15 hata sadece Prisma engine indirilemediği için, gerçek CI'da internet olduğundan geçecek) |
| `unit-tests` | `turbo run test` (core+server, mocklu Prisma) | ✅ 67/67 PASS |
| `db-schema` **(yeni)** | Gerçek Postgres servisi + `prisma validate` + `prisma db push` — sandbox'ın hiç doğrulayamadığı "gerçek DB'ye karşı şema" kontrolü | ⏳ komutlar CLI ile doğrulandı, tam çalıştırma GH Actions'ta (gerçek internet) doğrulanmalı |
| `e2e` | Playwright (mocklu backend) | ⏳ tarayıcı indirme burada da engelli (`cdn.playwright.dev`) — kullanıcı makinesinde zaten 3/3 PASS edilmişti, aynı test dosyası kullanılıyor |
| `build` | `turbo run build --filter=web --filter=server` | ✅ ikisi de başarıyla build oldu |

**Kapsam dışı bırakıldı (bilinçli karar):** `apps/desktop` (Tauri) build'i — Rust +
GTK/WebKit native toolchain gerektiriyor, cross-platform installer üretimi ayrı ve daha büyük
bir CI işi. Ayrı bir takip maddesi olarak bırakıldı.

### 📋 Kullanıcının Yapması Gerekenler

1. Zip'i açtıktan sonra `git add . && git commit && git push` ile GitHub'a gönder (repo GitHub'da
   değilse önce oluşturulmalı) — workflow otomatik olarak `main`'e push/PR'da tetiklenecek.
2. Actions sekmesinden 5 job'ın da yeşil olduğunu doğrula. `db-schema` ve `e2e` job'ları bu
   sandbox'ta tam çalıştırılamadı (network kısıtları) — ilk gerçek doğrulamaları orada olacak.
3. **Ayrı, önemli takip maddesi**: `prisma/migrations/` klasörü yok. Prod deploy'dan önce:
   ```powershell
   cd server
   pnpm exec prisma migrate dev --name init
   ```
   ile gerçek bir migration geçmişi oluşturulmalı, sonra CI'daki `db-schema` job'ı `db push`
   yerine `migrate deploy` kullanacak şekilde güncellenmeli (workflow dosyasında net olarak
   işaretlendi).

### 🔧 Güncelleme #2 — GitHub'a ilk push sürecinde bulunan/çözülen sorunlar (2 Ağustos 2026)

Kullanıcı projeyi ilk kez GitHub'a push ederken art arda birkaç ortam/altyapı sorunu çıktı,
hepsi çözüldü:

1. **`git add .` ile 800+ MB'lık Rust derleme çıktıları commit'e giriyordu**
   (`apps/desktop/src-tauri/target/`) — kök neden: `.gitignore` kullanıcının makinesine hiç
   ulaşmamıştı (muhtemelen Windows'un yerleşik "Tümünü Ayıkla" aracı zip içindeki nokta (`.`)
   ile başlayan dosya/klasörleri (`.gitignore`, `.github`) atlıyor). `.git` silinip sıfırdan
   başlandı, `.gitignore` elle oluşturuldu.
2. **`.github/workflows/ci.yml` GitHub'a hiç gitmemişti** — aynı kök neden (nokta ile başlayan
   klasör). Actions sekmesi boş "Get started" şablon galerisini gösteriyordu. Dosya elle
   (PowerShell heredoc ile) oluşturuldu.
3. **`eslint.config.js` de eksikti** — bu sefer nokta ile başlamıyor ama muhtemelen kullanıcı,
   CI/CD turundan sonraki güncel zip'i hiç yeniden açmamıştı (önceki turlardan kalma dosyalarla
   devam ediliyordu). **Kesin çözüm**: `.git` hariç her şey silinip, `Expand-Archive` ile
   (Gezgin'in "Tümünü Ayıkla"sı yerine) zip'in tamamı temiz şekilde yeniden açıldı — böylece
   dosya-dosya avlamak yerine tüm eksikler tek seferde giderildi.
4. **`prisma generate` GitHub Actions'ta (gerçek internetle bile) otomatik çalışmamıştı** —
   kök neden: pnpm'in yeni varsayılan davranışı, allowlist'te olmayan bağımlılıkların
   `postinstall` script'lerini çalıştırmıyor; `@prisma/client`'ın kendi `postinstall`'ı
   (`prisma generate` çalıştıran) bu yüzden sessizce atlanmış. `tsc` gerçek üretilmiş tipleri
   bulamayınca `server#typecheck` "Module '@prisma/client' has no exported member
   'PrismaClient'" hatalarıyla düştü — **bu sandbox'ta gördüğümüz 15 hatanın birebir aynısı**,
   ama bu sefer nedeni engel indirme değil, script'in çalışmamasıydı. Çözüm: `ci.yml`'deki
   `lint-and-typecheck`, `unit-tests` ve `build` job'larına `pnpm exec prisma generate` adımı
   açıkça eklendi.

### ✅ SONUÇ — GERÇEKTEN UÇTAN UCA DOĞRULANDI (GitHub Actions, run #4, 2 Ağustos 2026)

**5/5 job yeşil, "Success", toplam 1m 3s:**
- Lint & Typecheck — 30s ✅
- Unit Tests (core + server) — 20s ✅ (67/67 test)
- Prisma Schema & Migrations (real Postgres) — 32s ✅ (bu sandbox'ın hiç doğrulayamadığı,
  gerçek Postgres'e karşı ilk gerçek doğrulama)
- E2E (Playwright, mocked backend) — 56s ✅ (bu sandbox'ın hiç doğrulayamadığı, gerçek
  tarayıcıyla ilk gerçek doğrulama)
- Build (web + server) — 27s ✅

**OTOMATİK TESTLER + CI/CD — TAMAMLANDI VE GERÇEKTEN UÇTAN UCA DOĞRULANDI** (GitHub Actions'ta,
kullanıcının kendi reposunda, gerçek Postgres + gerçek tarayıcı ile).

**Kalan tek ayrı takip maddesi** (kapsam dışı bırakıldı, ayrı iş): `prisma/migrations/`
geçmişi hâlâ yok — prod deploy öncesi `prisma migrate dev --name init` ile oluşturulmalı,
ardından `db-schema` job'ı `db push` yerine `migrate deploy` kullanacak şekilde güncellenmeli.

---

## Back-office Ekranları (Kasa/Cari/Finans Yönetimi) — 2 Ağustos 2026

### Tespit: backend + API client + store katmanı zaten tamamen hazırdı

Kod tabanını incelerken ortaya çıktı: `server/src/routes/{cashRegisters,accounts,bankAccounts,
cheques,categories,reports}.ts`, `packages/core/src/api/salesApi.ts`'deki tüm API client
metodları (`cashRegistersApi`, `accountsApi`, `bankAccountsApi`, `chequesApi`, `categoriesApi`,
`reportsApi`) ve `useFinanceStore`/`useAccountStore` Zustand store'ları **zaten tam
implementasyonluydu**. Eksik olan tek şey UI ekranlarıydı — bu tur sadece frontend işiydi.

### ✅ Eklenen ekranlar (packages/ui/src/BackOffice/)

- **`CashRegisterPanel.tsx`** — Kasa listesi, manuel para giriş/çıkış, hareket geçmişi,
  gün sonu kasa sayımı (beklenen/sayılan/fark).
- **`AccountsPanel.tsx`** — Cari hesap listesi (tip filtresi: müşteri/tedarikçi/çalışan/diğer),
  yeni hesap oluşturma, hesap detay + hareket geçmişi (fatura/ödeme/iade/faiz), ödeme alma,
  **riskli hesaplar** görünümü (kredi limiti aşanlar).
- **`FinancePanel.tsx`** — 4 alt-sekme: Banka Hesapları (liste + hareket), Çek/Senet (liste +
  durum filtreleme + vade takvimi + durum güncelleme), Kategoriler (gelir/gider), Raporlar
  (tarih aralıklı nakit akışı / gelir-gider / kâr-zarar).
- **`BackOfficeScreen.tsx`** — 3 panel arası sekme geçişi (Kasa / Cari Hesap / Finans).

### Navigasyon ve RBAC

`PosScreen.tsx`'e dokunmadan (mevcut login/POS akışını ve e2e testini bozmamak için) header'a
sadece `admin`/`accountant` rolündeki kullanıcılara görünen bir **"Yönetim Paneli"** butonu
eklendi — bu, back-office rotalarındaki sunucu tarafı RBAC ile birebir eşleşiyor (kasiyer/depo/
viewer rolleri butonu hiç görmüyor; zaten POS içindeki dar cari-ödeme işlemine erişimleri var).

### Küçük ek: `money()`/`parseMoneyInput()` paylaşılan hale getirildi

Daha önce `PosScreen.tsx` içinde özel olan bu yardımcılar `packages/ui/src/lib/format.ts`'e
taşındı (artık back-office panelleri de kullanıyor) — `PosScreen.tsx`'in kendisi de bu ortak
modülü kullanacak şekilde güncellendi, davranışta değişiklik yok.

### ✅ Bu sandbox'ta doğrulanan

```
pnpm turbo run typecheck --filter=@pazariopos/ui --filter=@pazariopos/web --filter=@pazariopos/desktop
# 3/3 PASS
pnpm turbo run lint --filter=@pazariopos/ui --filter=@pazariopos/web --filter=@pazariopos/desktop
# 4/4 PASS (core dahil, cache nedeniyle otomatik tetiklendi)
pnpm turbo run build --filter=@pazariopos/web
# PASS — CSS boyutu 20.44 kB'a çıktı (yeni BackOffice class'ları Tailwind tarafından
# doğru şekilde tarandığının kanıtı, styles.css'teki @source direktifi sayesinde)
pnpm --filter @pazariopos/core test && pnpm --filter @pazariopos/server test
# 67/67 PASS — regresyon yok
```

Server typecheck'teki her zamanki 15 Prisma-regenerate hatası (bilinen sandbox kısıtı,
CI'da `prisma generate` adımıyla çözülüyor) dışında hiç yeni hata yok.

### ⏳ Kapsam dışı bırakılan (ayrı takip maddeleri)

- Bu ekranlar için ayrı otomatik test yazılmadı (component-level UI testleri, mevcut
  "hâlâ yazılmadı" listesindeki `packages/ui` test maddesiyle birleştirilebilir).
- Kullanıcı yönetimi ekranı (`usersApi` zaten hazır ama UI'ı yok) — ayrı bir iş.
- `AccountsPanel`'deki "yeni hesap" formu temel alanları kapsıyor (ad, tip, telefon, kredi
  limiti, vade); vergi no/adres/IBAN/indirim oranı gibi alanlar formda yok — API zaten
  destekliyor, istenirse form genişletilebilir.

**Kullanıcı makinesinde henüz doğrulanmadı** — zip'i aldıktan sonra `pnpm dev` ile `Yönetim
Paneli` butonunu (admin/accountant kullanıcıyla giriş yaparak) test etmesi gerekiyor.

### 🔧 Güncelleme #3 — gerçek migration geçmişi oluşturuldu (2 Ağustos 2026)

Kullanıcı local ortamında (Docker Postgres + `prisma migrate dev --name init`) projenin
**ilk gerçek migration geçmişini** oluşturdu (`server/prisma/migrations/`). Bu, en baştan beri
"hâlâ yazılmadı" listesindeki bir eksikti. CI'daki `db-schema` job'ı buna göre güncellendi:
`prisma db push` (geçici çözüm) yerine artık `prisma migrate deploy` kullanıyor — yani CI,
gerçek production deploy'un izleyeceği aynı yolu (migration dosyalarını sırayla uygulama)
doğruluyor. Ayrıca bir drift-check adımı eklendi (`prisma migrate diff --exit-code`) — şema
dosyası ile migration geçmişi birbirinden saparsa CI kırmızı olur.

---

## 📋 PLANLANAN İŞ — Ürün Yönetimi, Kategori, Satış/Alış Faturaları (2 Ağustos 2026)

Kullanıcının sorduğu 3 soru üzerine yapılan envanter çıkarma sonucu:

| Alan | Mevcut Durum |
|---|---|
| Ürünler Sayfası (ekle/düzenle/sil) | ❌ Backend'de sadece liste+ekle+stok güncelleme var; düzenleme/silme API'si yok, UI hiç yok |
| Ürün Kategorisi | ❌ `Product.categoryId` gerçek bir ilişki değil, boş bırakılabilen düz metin alanı |
| Satış Fatura Listesi | ⚠️ Satış çalışıyor ama geçmiş satışları listeleyen `GET /api/sales` endpoint'i / ekranı yok |
| Alış Faturası | ❌ Şemada, route'ta, hiçbir yerde yok — sıfırdan yeni modül |
| Tedarikçi/Müşteri Sayfası | ✅ Zaten var — Cari Hesap (Account, type=supplier/customer), bugünkü Cari Hesap panelinde tip filtresiyle yönetiliyor |

### Onaylanan sıra (küçükten büyüğe, bağımlılık sırasına göre)

**Faz 1 — Ürün Yönetimi + Kategori**
- Şema: `Category.type` enum'una `product` eklenir; `Product.categoryId` gerçek bir FK ilişkisine
  çevrilir (yeni migration).
- Backend: `PUT /api/products/:id` (düzenleme), `PATCH /api/products/:id/deactivate` (soft-delete
  — gerçek silme yerine, çünkü satış geçmişindeki ürünler referans bütünlüğü için silinemez).
- Frontend: `ProductsPanel.tsx` (BackOffice'e 4. sekme) — liste, ekle, düzenle, pasife alma,
  kategori seçici/yönetimi.

**Faz 2 — Satış Fatura Listesi**
- Backend: `GET /api/sales` (tarih aralığı/müşteri/kasiyer filtreli liste), `GET /api/sales/:id`
  (detay).
- Frontend: `SalesInvoicesPanel.tsx` — liste + makbuz benzeri detay görünümü.
- Şema değişikliği gerekmiyor, en düşük riskli faz.

**Faz 3 — Alış Faturası (en büyük, yeni modül)**
- Şema: `Purchase` + `PurchaseLine` modelleri (Sale/SaleLine'ın alış yönündeki karşılığı),
  atomik stok **artışı** (satışın tersi), tedarikçiye borçlanma.
- **Kritik tasarım kararı**: `TransactionType` enum'una yeni bir değer eklenmeli (örn. `purchase`)
  — mevcut `invoice` tipi yalnızca "veresiye satış" için tanımlı (`balance`'ı artırır). Tedarikçiye
  borçlanmada ise mantık ters: `Account.balance` "bu hesabın bize borcu" anlamına geldiği için,
  tedarikçiye borçlanmak bakiyeyi **azaltmalı/negatife çekmeli** (negatif bakiye = biz onlara
  borçluyuz). Bu detay yanlış kurulursa cari hesap raporları hatalı olur — implementasyonda özel
  dikkat gerekiyor.
- Backend: `purchases.ts` route, `Purchase`/`PurchaseLine` mapper'ları, atomik `$transaction`
  (stok artışı + tedarikçi cari hareketi + opsiyonel kasa/banka çıkışı).
- Frontend: `PurchaseInvoicesPanel.tsx` — yeni alış faturası oluşturma (ürün seç, miktar,
  tedarikçi, ödeme şekli) + liste/detay.

Her faz kendi turunda: kod → sandbox'ta typecheck/lint/test doğrulama → kullanıcı makinesinde
gerçek doğrulama (migration + UI testi) → CI yeşil → sonraki faza geçiş.

**Şu an Faz 1'e başlanıyor.**

### 🔧 Ödeme yöntemi netleştirmesi (kullanıcıdan gelen bilgi)

Kullanıcı Alış/Satış ödeme yöntemlerini netleştirdi: **Satış** → Nakit/Kredi Kartı/Veresiye,
**Alış** → Nakit/Kredi Kartı-Çek/Açık Hesap (vadeli). İnceleme sonucu: backend'in
`PaymentMethod` enum'u (`cash|card|transfer|cheque|account`) zaten **Satış için** kredi kartını
destekliyordu — sadece POS ekranında buton yoktu. Eklendi: `PosScreen.tsx`'e "Ödeme Al (Kredi
Kartı)" butonu (Nakit ile Veresiye arasında). Alış Faturası (Faz 3) tasarımı da netleşti: aynı
`PaymentMethod` enum'u yeniden kullanılacak, Çek modülündeki `own_cheque` (Kendi Çekimiz) tipi
tam bu senaryo için zaten var.

## ✅ Faz 1 TAMAMLANDI — Ürün Yönetimi + Ürün Kategorisi (2 Ağustos 2026)

### Şema değişikliği (yeni migration gerekiyor — kullanıcı makinesinde çalıştırılmalı)

- `CategoryType` enum'una `product` eklendi.
- `Product.categoryId`: artık gerçek bir **foreign key** (`Category` tablosuna, `onDelete: SetNull`)
  — önceden serbest metin alanıydı (`@default("")`), hiçbir referans bütünlüğü yoktu.
- `Product.isActive` eklendi (`@default(true)`) — **soft-delete** için. Gerçek `DELETE` yok, çünkü
  geçmiş satışlardaki `SaleLine.productId` referansını bozar; pasife alınan ürünler POS
  kataloğundan düşer ama geçmiş satış/rapor verisinde bozulmadan kalır.
- `server/prisma/seed.ts` güncellendi: ürünler artık gerçek `Category` kayıtlarına (Kahve,
  Aksesuar, Süt Ürünleri — `type: product`) referans veriyor.

### Backend

- `GET /api/products?includeInactive=true` — varsayılan sadece aktif ürünler (POS kataloğu),
  back-office `includeInactive=true` ile pasifleri de görebiliyor.
- `PUT /api/products/:id` — tam düzenleme (sku ve stok hariç — stok sadece `/stock` endpoint'i
  veya satış transaction'ı üzerinden değişebilir, kör bir `PUT` ile ezilmemesi için).
- `PATCH /api/products/:id/deactivate` / `/activate` — soft-delete.
- `categories.ts` route + `finance.ts` şeması: `type` filtresine/create'e `product` eklendi.

### Frontend

- `packages/ui/src/BackOffice/ProductsPanel.tsx` — liste (arama, aktif/pasif filtre), ekle,
  düzenle, pasife al/aktifleştir, ürün kategorisi hızlı ekleme. BackOffice'e 4. sekme
  ("📦 Ürünler") olarak eklendi.
- `packages/core`: `productsApi`'ye `createProduct`/`updateProduct`/`activateProduct`/
  `deactivateProduct`/`adjustStock` eklendi (önceden sadece `listProducts` vardı — backend
  hazır olmasına rağmen client'ta hiç kullanılmıyordu).

### ✅ Bu sandbox'ta doğrulanan

```
typecheck (core/ui/web/desktop): 4/4 PASS
lint (5 paket): 5/5 PASS
test (core+server, mocklu Prisma): 67/67 PASS — regresyon yok
build (web): PASS
```

### 📋 Kullanıcının yapması gereken (önemli — şema değişti)

```powershell
cd server
pnpm exec prisma generate
pnpm exec prisma migrate dev --name add_product_category_and_isactive
pnpm db:seed   # seed.ts güncellendi, kategoriler + ürünler yeniden yüklenmeli
cd ..
pnpm dev
```

Sonra "Yönetim Paneli" → "📦 Ürünler" sekmesini ve POS'taki yeni "Ödeme Al (Kredi Kartı)"
butonunu test etmesi gerekiyor.

### 🔧 Güncelleme — Ürün Ekleme ekranı, kullanıcının verdiği mockup'a göre yeniden tasarlandı (2 Ağustos 2026)

Kullanıcı bir ekran taslağı (URUNEKLEME.jpg) paylaştı. Bu, bir şema eklemesi gerektirdi:

- **Şema**: `Product.costPrice` eklendi (Alış Fiyatı — KDV dahil, kuruş, nullable). Önceden
  sadece tek bir `price` (Satış Fiyatı) vardı.
- **`ProductsPanel.tsx` mockup'a göre tamamen yeniden yazıldı**:
  - Barkod + "Yeni Barkod Oluştur" (geçerli check-digit'li, GS1 iç-kullanım aralığında (20x)
    rastgele EAN-13 üretiyor — gerçek ürün barkodlarıyla asla çakışmaz)
  - Ürün Adı / Birim + Ürün Kodu (=sku, düzenlemede değiştirilemez)
  - Alış Fiyatı + Satış Fiyatı, her biri kendi "KDV Dahil" checkbox'ıyla — işaretli değilse
    girilen tutar net kabul edilip KDV oranıyla brüte çevriliyor (sistem içeride her zaman
    KDV dahil/brüt tutuyor, checkbox sadece veri girişi kolaylığı)
  - KDV Oranı + Kritik Stok (=lowStockThreshold)
  - **Ana Kategori / Alt Kategori** — `Category.parentId` hiyerarşisi zaten backend'de tam
    hazırdı, sadece UI'ı yoktu; bu panel onu kullanan ilk ekran
  - Mevcut Stok (salt okunur, düzenlemede) / Eklenen Stok (yeni üründe başlangıç stoğu;
    düzenlemede mevcut stoğa eklenecek miktar — `adjustStock` API'si üzerinden ayrı bir
    çağrıyla, `PUT` ile kör ezme değil)
  - Ana Depo

### ✅ Bu sandbox'ta doğrulanan

```
typecheck (core/ui/web/desktop): 4/4 PASS
lint (5 paket): 5/5 PASS
test (core+server): 67/67 PASS — regresyon yok
build (web): PASS
```

### 📋 Kullanıcının yapması gereken

Önceki turdaki migration (`isActive`/kategori FK) henüz uygulanmadığı için, Prisma bu ikisini
**otomatik olarak tek migration'da** birleştirecek — ayrı ayrı komut çalıştırmana gerek yok:

```powershell
cd server
pnpm exec prisma generate
pnpm exec prisma migrate dev --name product_management_fields
pnpm db:seed
cd ..
pnpm dev
```
