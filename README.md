# RaiDigi — Toko Produk Digital (Next.js)

Aplikasi toko online RaiDigi versi produksi: katalog produk digital (topup game,
item trade, akun game, voucher, akun digital) dengan akun pembeli, keranjang,
checkout QRIS asli lewat **Bayar.gg**, pelacakan status pesanan, dan panel admin.

Dibangun dengan Next.js (App Router) + Neon Postgres. Semua teks antarmuka
dalam Bahasa Indonesia dan semua harga dalam Rupiah (IDR).

## Fitur

- **Beranda, Kategori, Detail Produk** — katalog dari database dengan pencarian,
  filter kategori, dan sortir. Form pemesanan dinamis per tipe produk
  (topup: User ID/Zone ID; trade: username Roblox; streaming: pilihan paket;
  voucher: pilihan nominal).
- **Akun pembeli** — daftar/masuk dengan email + kata sandi (bcrypt),
  sesi cookie bertanda tangan HMAC.
- **Checkout QRIS asli** — server membuat invoice Bayar.gg, kode QRIS tampil
  di halaman pembayaran website ini (pembeli tidak meninggalkan situs),
  lengkap dengan hitung mundur masa berlaku dan polling status otomatis.
- **Verifikasi pembayaran server-side** — status hanya berubah menjadi
  *Dibayar* setelah server memverifikasi ke `check-payment.php` Bayar.gg.
  Webhook tidak pernah dipercaya langsung; stok berkurang tepat satu kali.
- **Transaksi** — riwayat pesanan pembeli dengan status langsung:
  Menunggu Pembayaran, Dibayar, Diproses, Selesai, Batal, Kedaluwarsa.
- **Panel admin** di `/admin` — kelola pesanan (Dibayar → Diproses → Selesai /
  Batal) dan produk (buat, ubah harga/stok/detail, aktif/nonaktif, tanda “Contoh”).

## Teknologi

- Next.js 15 (App Router), React 19
- Neon Postgres via `@neondatabase/serverless` — skema dibuat otomatis
  (`CREATE TABLE IF NOT EXISTS`) dan katalog disemai (seed) pada request pertama
- `bcryptjs` untuk hashing kata sandi, `qrcode` untuk merender kode QRIS

## Menjalankan Secara Lokal

1. Instal dependensi:

   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env.local` dan isi variabelnya (lihat daftar
   di bawah). Minimal untuk melihat katalog, semua boleh dikosongkan dulu —
   tanpa `DATABASE_URL`, katalog tampil dari data seed (read-only) dan
   fitur akun/pesanan menampilkan pesan bahwa database belum dikonfigurasi.

   ```bash
   cp .env.example .env.local
   ```

3. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

   Buka http://localhost:3000 — panel admin di http://localhost:3000/admin.

4. Untuk build produksi:

   ```bash
   npm run build
   npm run start
   ```

## Variabel Lingkungan

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | Ya (untuk fitur penuh) | URL koneksi Neon Postgres, mis. `postgresql://user:pass@host/db?sslmode=require`. Tanpa ini, katalog tampil read-only dari seed dan akun/pesanan/checkout dinonaktifkan dengan pesan yang jelas. |
| `BAYAR_GG_API_KEY` | Ya (untuk pembayaran) | API key Bayar.gg. Hanya dibaca di server — jangan pernah memakai awalan `NEXT_PUBLIC_`. Tanpa key, pesanan tetap tersimpan tetapi invoice pembayaran tidak dibuat dan pembeli melihat pesan yang jelas. |
| `SESSION_SECRET` | Ya | String acak panjang untuk menandatangani cookie sesi (HMAC-SHA256). |
| `ADMIN_EMAIL` | Ya (untuk /admin) | Email login panel admin. Terpisah dari akun pembeli. |
| `ADMIN_PASSWORD` | Ya (untuk /admin) | Kata sandi login panel admin. |
| `APP_URL` | Ya | URL publik aplikasi, mis. `https://raidigi.vercel.app`. Dipakai untuk `callback_url` webhook dan `redirect_url` Bayar.gg. |
| `BAYAR_GG_WEBHOOK_SECRET` | Tidak | Webhook secret Bayar.gg untuk verifikasi tanda tangan HMAC callback (hook sudah disiapkan di `src/app/api/payments/callback/route.js`; saat ini status selalu diverifikasi ulang lewat API check-payment). |

## Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Di Vercel, **Import Project** dari repo tersebut (framework terdeteksi
   otomatis sebagai Next.js).
3. Buat database Neon (Vercel Marketplace → Neon, atau neon.tech) dan hubungkan
   `DATABASE_URL` ke project.
4. Isi semua variabel lingkungan di atas di **Project Settings → Environment
   Variables**, dengan `APP_URL` = domain produksi kamu.
5. Deploy. Pada request API pertama, tabel dibuat otomatis dan katalog
   16 produk disemai ke database.
6. Di dashboard Bayar.gg, pastikan API key aktif untuk metode **QRIS Admin**.
   Webhook per-transaksi dikirim otomatis lewat field `callback_url`
   (`<APP_URL>/api/payments/callback`) setiap invoice dibuat.

## Catatan Penting

- **Batas QRIS Admin Bayar.gg:** total pesanan (termasuk biaya layanan
  Rp 1.500) harus berada dalam rentang **Rp 5.000 – Rp 500.000**. Checkout di
  luar rentang itu diblokir dengan pesan penjelasan dalam Bahasa Indonesia.
- **Jumlah yang dibayar:** Bayar.gg dapat menambah kode unik di atas nominal
  yang diminta (terverifikasi: meminta Rp 5.000 menghasilkan `final_amount`
  Rp 5.150). Halaman pembayaran selalu menampilkan `final_amount` sebagai
  jumlah persis yang harus dibayar.
- **Keamanan pembayaran:** webhook (`/api/payments/callback`) hanya menjadi
  pemicu — status lunas selalu dikonfirmasi ulang dari server lewat
  `check-payment.php`, dan pengurangan stok bersifat idempoten.
- **Produk “Contoh”:** 8 dari 16 produk seed bertanda `is_sample` (label
  “Contoh”) — data demo untuk pratinjau katalog. Nonaktifkan atau ganti
  lewat panel admin sebelum go-live bila tidak diperlukan.
- **Gambar tertanam (data URI):** logo dan gambar produk tidak disimpan
  sebagai file biner, melainkan tertanam sebagai data URI di
  `src/lib/assets-data.js` — karena jalur sinkronisasi repo hanya mendukung
  file teks UTF-8. Untuk mengganti gambar: taruh file barunya di folder
  `public/assets/` (folder lokal, terdaftar di `.gitignore`), lalu jalankan
  `node scripts/gen-assets.mjs` dan commit hasilnya.

## Struktur Singkat

```
src/
  app/            halaman (beranda, kategori, produk, keranjang, pembayaran,
                  transaksi, akun, admin) + route API
  components/     header, footer, kartu produk, keranjang/wishlist (client store)
  lib/
    db.js         lapisan data Neon + skema + seed katalog
    catalog.js    data katalog awal (16 produk)
    auth.js       sesi HMAC + bcrypt + kredensial admin
    bayar.js      klien API Bayar.gg (server-side saja)
    verify.js     sinkronisasi status pembayaran terverifikasi
    format.js     format IDR, tanggal, label status
    assets-data.js  logo + gambar produk tertanam sebagai data URI
                    (dibangkitkan oleh scripts/gen-assets.mjs — jangan
                    disunting manual)
scripts/
  gen-assets.mjs  membangkitkan src/lib/assets-data.js dari public/assets/
```
