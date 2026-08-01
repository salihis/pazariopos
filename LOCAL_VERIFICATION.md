# Yerel Makinende Doğrulama — Adım Adım

Bu sandbox'ta Docker, Rust/Cargo ve gerçek Prisma engine yok. Bu yüzden şu adımları
**kendi makinende** çalıştırıp çıktıları bana yapıştırman gerekiyor. Her adımda ne
beklediğimi ve hata alırsan ne göndermen gerektiğini yazdım.

---

## Ön Koşullar (Bir Kere Kur)

```bash
# Node.js ≥20 kurulu mu kontrol et
node --version

# pnpm yoksa kur
npm install -g pnpm

# Rust yoksa kur (sadece desktop app için gerekli, web için gerekmez)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Docker Desktop kurulu olmalı (Mac/Windows) veya Docker Engine (Linux)
docker --version
```

---

## ADIM 1 — Projeyi Aç ve Bağımlılıkları Kur

```bash
cd pos-erp
pnpm install
```

**Ne beklenir:** Hatasız tamamlanmalı (bende de çalıştı — 354 paket).

**Hata alırsan gönder:**
- Tam terminal çıktısı
- `node --version` ve `pnpm --version` çıktısı

---

## ADIM 2 — Veritabanını Başlat

```bash
pnpm docker:up
docker ps    # postgres ve redis container'larının "Up" durumda olduğunu kontrol et
```

**Ne beklenir:**
```
NAME                 STATUS
pos-erp-postgres     Up (healthy)
pos-erp-redis        Up (healthy)
```

**Hata alırsan gönder:**
- `docker ps -a` çıktısı (durmuş container'lar da görünsün)
- `docker logs pos-erp-postgres` çıktısı

---

## ADIM 3 — Server Environment Dosyası

```bash
cp server/env.example server/.env
```

Bu dosyanın içeriği docker-compose.yml'deki kullanıcı/şifre ile eşleşiyor —
değiştirmene gerek yok, direkt kullanılabilir.

---

## ADIM 4 — Prisma Client Üret + Migration Çalıştır ⚠️ KRİTİK ADIM

Bu, benim sandbox'ımda **çalışmayan** tek adımdı (network kısıtlaması). Senin
makinende normal internet olduğu için çalışmalı:

```bash
pnpm db:migrate
```

**Ne beklenir:**
```
✔ Enter a name for the new migration: init
Applying migration `20250714_init`
✔ Generated Prisma Client
```

**Hata alırsan gönder:**
- Tam terminal çıktısı
- `docker logs pos-erp-postgres` (DB bağlantı sorunu olabilir)

---

## ADIM 5 — Demo Hesabı Seed Et

```bash
pnpm --filter @pos-erp/server run db:seed
```

**Ne beklenir:**
```
Seeded account: { id: 'demo-customer-1', name: 'Demo Customer', balance: 15000, ... }
```

---

## ADIM 6 — Server'ın Artık Hatasız Derlendiğini Doğrula

```bash
pnpm --filter @pos-erp/server exec tsc --noEmit
```

**Ne beklenir:** **Hiçbir çıktı olmamalı** (sessiz = başarılı).

Bende bu adımda 4 hata vardı (hepsi Prisma client eksikliğinden) — ADIM 4
tamamlandıktan sonra bunlar kaybolmalı.

**Hata alırsan gönder:**
- Tam hata çıktısı — büyük ihtimalle yeni bir gerçek hata olur, düzeltirim

---

## ADIM 7 — Tüm Monorepo'yu Typecheck Et

```bash
pnpm turbo run typecheck
```

**Ne beklenir:** 5/5 paket ✅ (bende 4/5'ti, server hariç — artık 5/5 olmalı)

---

## ADIM 8 — Rust/Tauri Derlemesini Doğrula (Desktop için)

```bash
cd apps/desktop/src-tauri
cargo check
cd ../../..
```

**Ne beklenir:** Derleme hatasız tamamlanmalı (biraz zaman alabilir, ilk seferde
tüm crate'leri indirir).

**Hata alırsan gönder:**
- Tam `cargo check` çıktısı — bu kodu hiç derletemedim, gerçek hatalar çıkabilir

---

## ADIM 9 — Server'ı Çalıştır

```bash
pnpm dev:server
```

**Ne beklenir:**
```
[server] listening on http://localhost:3000
```

Başka bir terminalde test et:
```bash
curl http://localhost:3000/api/health
# Beklenen: {"status":"ok","timestamp":"..."}

curl http://localhost:3000/api/accounts/demo-customer-1/balance
# Beklenen: {"accountId":"demo-customer-1","balance":15000,"asOf":"..."}
```

---

## ADIM 10 — Web Uygulamasını Çalıştır ve Gerçek Testi Yap

```bash
# Yeni terminal
pnpm dev:web
```

Tarayıcıda `http://localhost:5173` aç:

1. **"Quick Add" butonlarından birine tıkla** (ör: "Espresso Beans 250g")
   → Sepete eklenmeli
2. **"Checkout (Cash)" butonuna tıkla**
   → "Sale completed online. Receipt: printed" mesajı görünmeli
   → Tarayıcı print dialog'u açılmalı
3. **"Check Account Balance" butonuna tıkla**
   → "Balance: 150.00" görünmeli (seed'lediğimiz demo hesap)
4. **Network'ü kapat** (DevTools → Network → Offline) ve tekrar checkout yap
   → "Offline — sale queued locally..." mesajı görünmeli
   → Üstte "OFFLINE" badge + "1 pending sync" görünmeli
5. **Network'ü tekrar aç**
   → Birkaç saniye içinde "pending sync" sayısı 0'a düşmeli (auto-sync)

**Herhangi bir adımda beklenmeyen davranış olursa gönder:**
- Tarayıcı console'undaki hata (F12 → Console)
- Hangi adımda ne olduğunu / ne beklediğini

---

## ADIM 11 (Opsiyonel) — Desktop App'i Dene

```bash
pnpm dev:desktop
```

Bu, Tauri penceresini açmalı ve aynı POS ekranını göstermeli. Barkod tarama için
klavyeyle `8690000000017` yazıp Enter'a basmayı dene.

---

## 📋 Bana Rapor Ederken Kullanabileceğin Şablon

```
ADIM: [hangi adımda]
DURUM: ✅ Başarılı / ❌ Hata
ÇIKTI:
[terminal çıktısını buraya yapıştır]

SİSTEM BİLGİSİ:
- OS: [Windows/Mac/Linux + versiyon]
- Node: [node --version çıktısı]
- pnpm: [pnpm --version çıktısı]
- Docker: [docker --version çıktısı]
- Rust: [rustc --version çıktısı, eğer ADIM 8 yapıldıysa]
```

Bu bilgiyle hataları hızlıca teşhis edip düzeltebilirim — ben kod tabanını
görüyorum ama senin ortamındaki gerçek çalışma zamanı davranışını sadece
senin raporunla görebiliyorum.
