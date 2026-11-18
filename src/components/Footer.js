import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap f-grid">
        <div>
          <b style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.02rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-mark" src="/assets/logo-38a70cd657.png" alt="" style={{ width: 26, height: 26 }} /> RaiDigi
          </b>
          <p style={{ margin: "8px 0 0" }}>
            Platform jual beli produk digital terpercaya — topup game, akun premium, voucher, dan item digital. Admin
            online setiap hari 08.00–22.00 WIB.
          </p>
        </div>
        <div>
          <b>Belanja</b>
          <Link className="f-link" href="/kategori?filter=topup">Topup Game</Link>
          <Link className="f-link" href="/kategori?filter=akun-game">Akun Game</Link>
          <Link className="f-link" href="/kategori?filter=item-trade">Item Trade</Link>
          <Link className="f-link" href="/kategori?filter=voucher">Voucher</Link>
          <Link className="f-link" href="/kategori?filter=akun-digital">Akun Digital</Link>
        </div>
        <div>
          <b>Bantuan</b>
          <Link className="f-link" href="/transaksi">Lacak Transaksi</Link>
          <Link className="f-link" href="/akun">Akun Saya</Link>
          <Link className="f-link" href="/keranjang">Keranjang</Link>
        </div>
      </div>
      <div className="wrap" style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)", fontSize: ".76rem" }}>
        © 2026 RaiDigi. Katalog Robux, Blox Fruits &amp; Fish It mengikuti daftar harga toko Raidigital yang berjalan;
        produk bertanda “Contoh” adalah data demo untuk pratinjau katalog.
      </div>
    </footer>
  );
}
