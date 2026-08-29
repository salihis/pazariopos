# PazarioPOS Mobile — React Native (Expo) Uygulaması

## 📱 Genel Bakış

PazarioPOS'un native mobil uygulaması. Web ve desktop'taki aynı iş mantığını (`@pazariopos/core`) paylaşır, React Native + Expo ile native Android/iOS deneyimi sunar.

## 🚀 Özellikler

- **Barkod Tarama**: Kamera ile EAN13, EAN8, QR, Code128, Code39 barkodları okuma
- **Offline Destek**: İnternet yokken satış yapma, bağlantı gelince senkronizasyon
- **Sepet Yönetimi**: Ürün ekleme/çıkarma, miktar güncelleme
- **Ödeme Yöntemleri**: Nakit, Kredi Kartı, Veresiye (cari hesap)
- **Müşteri Hesapları**: Cari hesap bakiye sorgulama, ödeme kaydetme
- **Responsive Tasarım**: Telefon ve tablet uyumlu

## 🛠️ Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Framework | React Native 0.79 + Expo SDK 53 |
| Navigasyon | React Navigation v7 (Tabs + Stack) |
| State Management | Zustand v5 (web/desktop ile aynı) |
| Barkod | expo-camera + expo-barcode-scanner |
| UI | React Native StyleSheet (Tailwind alternatifi) |
| Dil | TypeScript 5.8 |

## 📦 Kurulum

### 1. Bağımlılıkları Yükle

```bash
cd /workspace
pnpm install
```

### 2. Geliştirme Sunucusunu Başlat

```bash
cd apps/mobile
pnpm dev
```

QR kodu tarayarak:
- **Expo Go** uygulaması ile test et (iOS/Android)
- **Metro bundler** otomatik başlar

### 3. Native Build (Opsiyonel)

```bash
# Android emülatörde çalıştır
pnpm android

# iOS simülatörde çalıştır (macOS gerekli)
pnpm ios

# Web'de çalıştır
pnpm web
```

## 🏗️ Mimari

```
apps/mobile/
├── src/
│   ├── App.tsx              # Root component + Navigation
│   ├── PosScreenMobile.tsx  # Ana POS ekranı (web'deki PosScreen.tsx alternatifi)
│   └── NetworkBadge.tsx     # Ağ durumu badge'i
├── assets/                  # İkon, splash screen
├── app.json                 # Expo konfigürasyonu
├── package.json
└── tsconfig.json
```

### Web/Desktop ile Kod Paylaşımı

```typescript
// Aynı business logic, farklı UI implementasyonu
import { useSaleStore, getBarcodeService } from '@pazariopos/core'

// Web/Desktop: React DOM + Tailwind
// Mobile: React Native + StyleSheet
// Ama ikisi de aynı Zustand store'u kullanıyor!
```

## 📲 Barkod Tarama

Uygulama kamera üzerinden şu barkod formatlarını destekler:

- EAN13 (standart ürün barkodu)
- EAN8 (küçük ürünler)
- UPC-A / UPC-E
- Code128 (lojistik)
- Code39 (endüstriyel)
- QR Kod

### Kullanım

1. "📷 Tara" butonuna bas
2. Kamerayı barkoda tut
3. Otomatik algılama → ürünü sepete ekle

## 🔐 İzinler

### Android (`app.json`)

```json
{
  "android": {
    "permissions": ["CAMERA", "INTERNET"]
  }
}
```

### iOS (`app.json`)

```json
{
  "ios": {
    "infoPlist": {
      "NSCameraUsageDescription": "Barkod taramak için kamera izni gerekli"
    }
  }
}
```

## 🧪 Test

```bash
# Tip kontrolü
pnpm typecheck

# Lint
pnpm lint

# Build testi
pnpm build
```

## 🚀 Production Build

### EAS Build (Önerilen)

```bash
# EAS CLI yükle
npm install -g eas-cli

# Yapılandır
eas build:configure

# Android APK
eas build --platform android --profile production

# iOS IPA (Apple Developer hesabı gerekli)
eas build --platform ios --profile production
```

### Local Build

```bash
# Android APK
expo run:android --variant release

# iOS (Xcode gerekli)
expo run:ios --configuration Release
```

## 🎨 Tasarım Token'ları

Web/desktop ile aynı renk paleti:

| Renk | Değer | Kullanım |
|------|-------|----------|
| Petrol | `#1A3A4A` | Header, primary butonlar |
| Saffron | `#D97706` | Vurgular, toplam tutar |
| Paper | `#F5F2EB` | Arkaplan |
| Ink | `#1A3A4A` | Metin |

## 🔄 Senkronizasyon

Mobil uygulama da web/desktop gibi offline-first çalışır:

1. **Online**: Satışlar direkt API'ye POST edilir
2. **Offline**: SQLite kuyruğuna kaydedilir
3. **Bağlantı Gelince**: Otomatik senkronizasyon

```typescript
// useSaleStore tüm platformlarda aynı çalışır
const submitSale = useSaleStore(s => s.submitSale)
await submitSale([{ method: 'cash', amount: 10000 }])
// Online → API, Offline → sync_queue
```

## 🐛 Bilinen Sorunlar

- iOS'te kamera izni ilk açılışta alınmalı (App Transport Security ayarları gerekli olabilir)
- Android'de bazı cihazlarda barkod tarama yavaş olabilir (odaklama ayarları iyileştirilmeli)

## 📝 Sonraki Adımlar

1. **Satış Geçmişi**: Tam fonksiyonel liste + detay ekranı
2. **Raporlar**: Günlük/haftalık satış özetleri
3. **Ürün Yönetimi**: Mobil'den stok ekleme/düzenleme
4. **Bildirimler**: Push notification (stok uyarısı, günlük rapor)
5. **Çevrimdışı Rapor**: Local veriden rapor üretimi

## 📄 Lisans

Internal project — PazarioPOS Team
