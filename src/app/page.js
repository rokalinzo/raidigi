import Link from "next/link";
import { listProducts, listPromos } from "../lib/db";
import { Icon } from "../components/icons";
import ProductCard from "../components/ProductCard";
import PromoCarousel from "../components/PromoCarousel";
import { IMG_7F3A9C1E } from "../lib/assets-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await listProducts();
  const popular = products.filter((p) => p.popular);
  const promos = await listPromos().catch(() => []);

  return (
    <div className="wrap">
      <div className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>
              Semua Kebutuhan Digital, <span className="gold">di Satu Tempat.</span>
            </h1>
            <p>Topup game, akun premium, voucher, dan item digital dengan proses cepat dan aman.</p>
            <Link className="btn btn-gold" href="/kategori">
              Jelajahi Produk <Icon name="i-arrow-r" cls="sm" />
            </Link>
            <div className="hero-trust">
              <span>
                <Icon name="i-check" /> Proses Cepat
              </span>
              <span>
                <Icon name="i-check" /> Aman
              </span>
              <span>
                <Icon name="i-check" /> Harga Terbaik
              </span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hv-main" src={IMG_7F3A9C1E} alt="" />
            <div className="hv-chip c1">
              <Icon name="i-zap" />
              <span>
                Proses 5–15 Menit<small>Rata-rata pengiriman</small>
              </span>
            </div>
            <div className="hv-chip c2">
              <Icon name="i-shield" />
              <span>
                Garansi 100%<small>Item tak masuk, uang kembali</small>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="cat3" role="group" aria-label="Kategori utama">
        <Link className="cat-card sel" href="/kategori?filter=game" style={{ textDecoration: "none" }}>
          <Icon name="i-gamepad" />
          <b>Game</b>
          <small>Akun Game · Topup Game · Item Game (Trade)</small>
        </Link>
        <Link className="cat-card" href="/kategori?filter=voucher" style={{ textDecoration: "none" }}>
          <Icon name="i-ticket" />
          <b>Voucher</b>
          <small>Voucher Game · Gift Card · Voucher Digital</small>
        </Link>
        <Link className="cat-card" href="/kategori?filter=akun-digital" style={{ textDecoration: "none" }}>
          <Icon name="i-monitor" />
          <b>Akun</b>
          <small>Akun Streaming · Akun Premium · Akun Aplikasi</small>
        </Link>
      </div>

      <div className="sec-head">
        <h2>
          <Icon name="i-gamepad" /> Game
        </h2>
        <Link className="see-all" href="/kategori?filter=game">
          Lihat Semua <Icon name="i-chev-r" />
        </Link>
      </div>
      <div className="svc3">
        <Link className="svc-card" href="/kategori?filter=akun-game" style={{ textDecoration: "none" }}>
          <Icon name="i-user" />
          <b>Akun Game</b>
          <small>Akun siap main, full akses, bergaransi.</small>
          <span className="chev">
            <Icon name="i-chev-r" />
          </span>
        </Link>
        <Link className="svc-card" href="/kategori?filter=topup" style={{ textDecoration: "none" }}>
          <Icon name="i-coins" />
          <b>Topup</b>
          <small>Diamond, Robux, dan poin game — masuk otomatis.</small>
          <span className="chev">
            <Icon name="i-chev-r" />
          </span>
        </Link>
        <Link className="svc-card" href="/kategori?filter=item-trade" style={{ textDecoration: "none" }}>
          <Icon name="i-trade" />
          <b>Jual Item (Trade)</b>
          <small>Item Blox Fruits &amp; Fish It, ditrade langsung in-game.</small>
          <span className="chev">
            <Icon name="i-chev-r" />
          </span>
        </Link>
      </div>

      <div className="sec-head">
        <h2>
          <Icon name="i-ticket" /> Promo Terbaru
        </h2>
        <Link className="see-all" href="/kategori">
          Lihat Semua <Icon name="i-chev-r" />
        </Link>
      </div>
      <PromoCarousel promos={promos} />

      <div className="sec-head">
        <h2>
          <Icon name="i-flame" /> Produk Populer
        </h2>
        <Link className="see-all" href="/kategori">
          Lihat Semua <Icon name="i-chev-r" />
        </Link>
      </div>
      <div className="pgrid">
        {popular.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

      <div className="sec-head">
        <h2>
          <Icon name="i-shield" /> Kenapa RaiDigi?
        </h2>
      </div>
      <div className="feat4">
        <div className="feat">
          <Icon name="i-zap" />
          <b>Proses Cepat</b>
          <p>Mayoritas pesanan selesai dalam 5–15 menit setelah pembayaran terkonfirmasi.</p>
        </div>
        <div className="feat">
          <Icon name="i-shield" />
          <b>Aman &amp; Bergaransi</b>
          <p>Item tidak masuk atau akun bermasalah? Uang kembali 100%, tanpa ribet.</p>
        </div>
        <div className="feat">
          <Icon name="i-tag" />
          <b>Harga Terbaik</b>
          <p>Harga bersaing dengan promo berkala untuk topup dan akun premium.</p>
        </div>
        <div className="feat">
          <Icon name="i-msg" />
          <b>Admin Responsif</b>
          <p>Admin online setiap hari pukul 08.00–22.00 WIB, siap bantu lewat WhatsApp.</p>
        </div>
      </div>

      <div className="sec-head">
        <h2>
          <Icon name="i-package" /> Cara Beli
        </h2>
      </div>
      <div className="steps">
        <div className="step">
          <span className="num">1</span>
          <div>
            <b>Pilih Produk</b>
            <p>Telusuri kategori atau cari produk digital yang kamu butuhkan.</p>
          </div>
        </div>
        <div className="step">
          <span className="num">2</span>
          <div>
            <b>Isi Data</b>
            <p>Masukkan User ID, username, atau data lain sesuai jenis produk.</p>
          </div>
        </div>
        <div className="step">
          <span className="num">3</span>
          <div>
            <b>Bayar</b>
            <p>Selesaikan pembayaran via QRIS — bisa dipindai dari semua e-wallet &amp; mobile banking.</p>
          </div>
        </div>
        <div className="step">
          <span className="num">4</span>
          <div>
            <b>Produk Dikirim</b>
            <p>Topup masuk otomatis; item &amp; akun dikirim admin dalam 5–15 menit.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
