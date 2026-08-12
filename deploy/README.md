# Production Deployment — `erp.pazario.tr`

Bu rehber, PazarioPOS'u kendi yönettiğin bir VPS'e (DigitalOcean, Hetzner, AWS EC2, vb. —
hangisi olursa olsun, Ubuntu 22.04 veya 24.04 varsayılıyor) tek bir subdomain (`erp.pazario.tr`)
altında, Nginx + PM2 + Docker'daki Postgres ile kurmanı sağlar.

**Kapsam notu**: `ARCHITECTURE.md` §9'da tarif edilen mimari (Cloudflare CDN, Postgres
primary+replica, Redis cache/queue, PM2 cluster mode) daha büyük ölçek için ileriye dönük bir
plan — şu anki demo/test aşaması için gereğinden fazla. Bu rehber, projenin **şu anki gerçek
ihtiyacına** göre boyutlandırılmış: tek VPS, tek Postgres, PM2 fork modu. Redis hiç dahil
edilmedi çünkü kod tabanında (`server/src/`) şu an hiçbir yerde kullanılmıyor. İleride trafik
artarsa bu daha büyük mimariye geçmek, bu kurulumu değiştirmeyi gerektirmez, üzerine eklenir.

---

## 0. Ön Gereksinimler

- Bir VPS (en az 1 GB RAM, Ubuntu 22.04/24.04), SSH erişimi
- `erp.pazario.tr` için domain'inin DNS panelinde A kaydı ekleme yetkisi
- Yerel makinende bu repo'nun GitHub'daki hali (`https://github.com/salihis/pazariopos`)

---

## 0.5. AWS EC2'ye özel hazırlık (senin durumun: Ubuntu, Elastic IP henüz yok)

**a) Elastic IP ayır ve instance'a bağla** — bunu yapmazsan instance her durup yeniden
başladığında IP değişir, DNS kaydın (adım 10) kırılır. Elastic IP, çalışan bir instance'a
bağlıyken AWS Free Tier'da **ücretsizdir** (sadece boşta/bağlı olmayan Elastic IP'lere ücret
alınır — o yüzden allocate ettikten hemen sonra instance'a bağla, boşta bırakma):

1. AWS Console → **EC2 → Network & Security → Elastic IPs**
2. **Allocate Elastic IP address** → Allocate
3. Yeni ayrılan IP'yi seç → **Actions → Associate Elastic IP address**
4. Instance'ını seç → Associate

Bu andan itibaren bu IP senin sabit adresin — aşağıdaki adımlarda "VPS_IP_ADRESIN" yerine bunu kullan.

**b) Security Group'ta gerekli portları aç:**

1. EC2 Console → instance'ını seç → **Security** sekmesi → Security group'a tıkla
2. **Edit inbound rules** → şu 3 kuralı ekle (yoksa):

| Type | Port | Source |
|---|---|---|
| SSH | 22 | Kendi IP'n (`My IP` seçeneği — herkese açık bırakma) |
| HTTP | 80 | Anywhere (`0.0.0.0/0`) |
| HTTPS | 443 | Anywhere (`0.0.0.0/0`) |

**c) SSH bağlantısı** — EC2'de genelde `root` yerine `ubuntu` kullanıcısı ve bir `.pem` anahtar dosyasıyla bağlanılır:

```bash
ssh -i "senin-anahtarin.pem" ubuntu@ELASTIC_IP_ADRESIN
```

Aşağıdaki adım 1'deki "root'tan yeni kullanıcı oluştur" kısmı EC2'de gerekli değil —
`ubuntu` kullanıcısı zaten `sudo` yetkili geliyor, doğrudan adım 2'den devam edebilirsin.

---

## 1. VPS'e ilk bağlantı ve temel güvenlik

**EC2 + Ubuntu için** (senin durumun): `ubuntu` kullanıcısı zaten sudo yetkili geliyor, ayrıca
kullanıcı oluşturmana gerek yok, `0.5.c`'deki komutla direkt bağlan ve adım 2'ye geç. Güvenlik
duvarı işini zaten AWS Security Group (adım 0.5.b) görüyor, `ufw`'e gerek yok.

<details>
<summary>Genel VPS (DigitalOcean/Hetzner vb. — EC2 kullanmıyorsan bunu aç)</summary>

```bash
ssh root@VPS_IP_ADRESIN

# Root yerine çalışacak bir kullanıcı oluştur
adduser deploy
usermod -aG sudo deploy

# SSH ile bu kullanıcıya geç (yeni terminalde)
ssh deploy@VPS_IP_ADRESIN

# Temel güvenlik duvarı: sadece SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```
</details>

## 2. Node.js, pnpm, Docker kurulumu

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm (proje package.json'daki packageManager alanıyla eşleşen sürüm)
sudo npm install -g pnpm@9.7.0 pm2

# Docker (Postgres için)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # grup değişikliğini bu oturumda hemen uygula
```

## 3. Projeyi sunucuya al

```bash
sudo mkdir -p /var/www/pazariopos
sudo chown $USER:$USER /var/www/pazariopos
git clone https://github.com/salihis/pazariopos.git /var/www/pazariopos
cd /var/www/pazariopos
pnpm install --frozen-lockfile
```

## 4. Ortam değişkenleri (`.env` dosyaları — GERÇEK, GÜÇLÜ değerlerle)

```bash
cp server/env.example server/.env
nano server/.env    # ya da vim/istediğin editör
```

`server/.env` içinde **mutlaka değiştirmen gerekenler**:

| Değişken | Ne olmalı |
|---|---|
| `DATABASE_URL` | `postgresql://pos_user:GERÇEK_ŞİFRE@localhost:5432/pos_erp?schema=public` (aşağıdaki adım 5'teki `.env.prod` ile aynı şifre) |
| `JWT_SECRET` | **Rastgele, uzun bir değer** — `openssl rand -base64 48` ile üret. Uygulama, `NODE_ENV=production` iken bu hâlâ varsayılan placeholder ise **başlamayı reddediyor** (bilinçli bir güvenlik önlemi, `server/src/lib/jwt.ts`'te) |
| `CORS_ORIGIN` | `https://erp.pazario.tr` (Nginx aynı origin'den servis ettiği için pratikte az kullanılır, ama yine de doğru olsun) |
| `NODE_ENV` | `production` (PM2 config'i bunu zaten otomatik ayarlıyor, `.env`'e de eklemen zarar vermez) |

```bash
openssl rand -base64 48   # JWT_SECRET için rastgele değer üretir, çıktıyı .env'e yapıştır
```

`deploy/.env.prod` dosyasını oluştur (Postgres container'ı için — `server/.env`'deki
`DATABASE_URL` ile aynı kullanıcı adı/şifreyi kullanmalı):

```bash
cat > deploy/.env.prod << 'EOF'
POSTGRES_USER=pos_user
POSTGRES_PASSWORD=BURAYA_GUCLU_BIR_SIFRE_YAZ
POSTGRES_DB=pos_erp
EOF
```

**Bu iki dosya (`server/.env`, `deploy/.env.prod`) asla git'e commit edilmemeli** — zaten
`.gitignore`'da hariç tutuluyorlar, ama kontrol etmekte fayda var: `git status` çalıştırıp bu
dosyaların "untracked"/görünmez olduğundan emin ol.

## 5. Postgres'i Docker ile başlat

```bash
cd /var/www/pazariopos/deploy
docker compose -f ../docker/docker-compose.prod.yml --env-file .env.prod up -d
docker compose -f ../docker/docker-compose.prod.yml --env-file .env.prod ps
# "healthy" görene kadar birkaç saniye bekle
```

Bu Postgres'i **sadece `127.0.0.1`'e** bağlar — internetten asla erişilemez, dışarıdan tek giriş
noktası Nginx (adım 9) üzerinden `erp.pazario.tr`'dur.

## 6. Veritabanı şemasını uygula + (isteğe bağlı) örnek veri

```bash
cd /var/www/pazariopos/server
pnpm exec prisma generate
pnpm exec prisma migrate deploy    # migrate dev DEĞİL — deploy, sadece var olan
                                     # migration'ları uygular, yenisini oluşturmaz
```

Gerçek/canlı kullanım öncesi test amaçlı örnek veri istersen (demo müşteri/ürünler):

```bash
pnpm db:seed
```

**Gerçek kullanıma geçtiğinde bu adımı atla** — `seed.ts` demo verisi ekliyor, prod veritabanını
kirletmemesi için gerçek kullanımda çalıştırma.

## 7. Build

```bash
cd /var/www/pazariopos
pnpm turbo run build --filter=@pazariopos/web --filter=@pazariopos/server
```

Bu, `apps/web/dist/` (Nginx'in servis edeceği statik dosyalar) ve `server/dist/main.js`
(PM2'nin çalıştıracağı derlenmiş sunucu) üretir.

## 8. PM2 ile sunucuyu başlat

```bash
cd /var/www/pazariopos
mkdir -p logs
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # çıktıdaki "sudo env PATH=... pm2 startup ..." komutunu KOPYALA ve çalıştır
              # — bu, sunucu yeniden başladığında PM2'nin (ve uygulamanın) otomatik
              # ayağa kalkmasını sağlıyor, tek seferlik bir kurulum adımı

# Log rotasyonu (loglar sınırsız büyümesin)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 7
```

Kontrol et:
```bash
pm2 status          # "pazariopos-server" online görünmeli
pm2 logs pazariopos-server --lines 30
curl http://localhost:3000/api/health   # {"status":"ok",...} dönmeli
```

## 9. Nginx kurulumu

```bash
sudo apt-get install -y nginx
sudo cp /var/www/pazariopos/deploy/nginx.conf.example /etc/nginx/sites-available/pazariopos
# server_name zaten "erp.pazario.tr" olarak ayarlı, düzenlemene gerek yok

sudo ln -s /etc/nginx/sites-available/pazariopos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # varsayılan "Welcome to nginx" sayfasını kaldır
sudo nginx -t                                  # ÖNCE syntax doğrula
sudo systemctl reload nginx
```

## 10. DNS — domain panelinde A kaydı ekle

`pazario.tr` AWS Route 53'te değil (kontrol edildi) — domain'i satın aldığın registrar'ın
kendi panelinden ekle:

| Tip | Ad | Değer |
|---|---|---|
| A | `erp` | (Elastic IP adresin — adım 0.5.a) |

Yayılması birkaç dakika ile birkaç saat sürebilir. Kontrol için:
```bash
# Kendi bilgisayarında (VPS'te değil):
nslookup erp.pazario.tr
```
Elastic IP adresinle eşleşen bir sonuç dönene kadar bekle.


## 11. SSL — Let's Encrypt (ücretsiz, otomatik yenilenir)

DNS yayıldıktan (yukarıdaki `nslookup` doğru IP'yi gösterdikten) SONRA:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d erp.pazario.tr
```

Certbot, e-posta adresini soracak (sertifika süresi dolmadan uyarı için) ve Nginx config'ini
otomatik olarak HTTPS'e yönlendirecek şekilde güncelleyecek. Yenileme otomatik (systemd timer),
elle bir şey yapmana gerek yok.

## 12. Doğrulama

Tarayıcıda `https://erp.pazario.tr` aç:
- [ ] Kilit ikonu (geçerli SSL) görünüyor
- [ ] Login ekranı geliyor
- [ ] Admin kullanıcıyla giriş yapabiliyorsun
- [ ] "Yönetim Paneli" → tüm sekmeler (Kasa/Cari Hesap/Finans/Ürünler/Alış Faturası/Satış
      Faturaları) açılıyor

---

## Güncelleme / yeniden deploy (kod değiştiğinde)

```bash
cd /var/www/pazariopos
git pull
pnpm install --frozen-lockfile
cd server && pnpm exec prisma generate && pnpm exec prisma migrate deploy && cd ..
pnpm turbo run build --filter=@pazariopos/web --filter=@pazariopos/server
pm2 restart pazariopos-server
```

Bu adımları her manuel deploy'da tekrarlamak yerine, aynı komutlar `deploy/redeploy.sh`
içinde hazır — `bash deploy/redeploy.sh` ile tek komutla çalıştırabilirsin. GitHub Actions
üzerinden otomatik deploy (push'ta otomatik güncelleme) da mümkün — CI/CD altyapısı zaten
hazır olduğu için doğal bir sonraki adım, istersen ayrı bir iş olarak ele alabiliriz.

## Sorun giderme

- **`pm2 status` "errored" gösteriyor** → `pm2 logs pazariopos-server --lines 50` ile hatayı
  gör. En sık neden: `server/.env` eksik/yanlış (adım 4), ya da `JWT_SECRET` hâlâ placeholder
  (uygulama bunu bilinçli olarak reddediyor).
- **Nginx 502 Bad Gateway** → PM2'deki sunucu çalışmıyor demektir, `pm2 status` kontrol et.
- **`nginx -t` hata veriyor** → muhtemelen `erp.pazario.tr` yerine hâlâ placeholder metin
  var, ya da bir satırda noktalı virgül eksik. Hata mesajı hangi satırı işaret ediyorsa onu kontrol et.
- **Certbot "DNS problem" hatası** → DNS henüz yayılmamış olabilir, birkaç dakika/saat bekleyip tekrar dene.
