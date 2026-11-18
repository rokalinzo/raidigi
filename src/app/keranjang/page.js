"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "../../components/icons";
import { Thumb } from "../../components/thumb";
import { useStore } from "../../components/store";
import { fmtIDR, QRIS_MAX, QRIS_MIN, SERVICE_FEE } from "../../lib/format";

export default function KeranjangPage() {
  const router = useRouter();
  const { cart, removeFromCart, clearCart, toast } = useStore();
  const [user, setUser] = useState(undefined); // undefined = memuat
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user || null);
        if (d.user) {
          setName(d.user.name || "");
          setEmail(d.user.email || "");
        }
      })
      .catch(() => setUser(null));
  }, []);

  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const fee = cart.length ? SERVICE_FEE : 0;
  const total = subtotal + fee;
  const outOfRange = cart.length > 0 && (total < QRIS_MIN || total > QRIS_MAX);

  async function doCheckout() {
    const errs = {};
    if (!name.trim()) errs.name = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = true;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) errs.phone = true;
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast("Periksa lagi data kontak kamu", "i-info");
      return;
    }
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({ slug: c.slug, variant: c.variant, qty: c.qty, formData: c.formData })),
          buyer: { name: name.trim(), email: email.trim(), phone: phone.trim() },
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast("Sesi kamu berakhir — silakan masuk lagi", "i-user");
        router.push("/akun?next=/keranjang");
        return;
      }
      if (!res.ok || !data.order) {
        setServerError(data.error || "Gagal membuat pesanan. Coba lagi.");
        setSubmitting(false);
        return;
      }
      clearCart();
      if (data.paymentError) {
        toast("Pesanan dibuat, tetapi pembayaran belum bisa dimulai", "i-info");
        router.push("/transaksi");
      } else {
        router.push(`/pembayaran/${data.order.code}`);
      }
    } catch {
      setServerError("Tidak dapat menghubungi server. Periksa koneksimu lalu coba lagi.");
      setSubmitting(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="wrap">
        <h1 className="page-title">Keranjang &amp; Checkout</h1>
        <p className="page-sub">Memuat…</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <h1 className="page-title">Keranjang &amp; Checkout</h1>
      <p className="page-sub">Periksa pesananmu, isi data kontak, lalu bayar dengan QRIS.</p>

      {!user ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <Icon name="i-user" />
          <b>Masuk dulu untuk checkout</b>
          <p>Pesanan dan pembayaran terhubung ke akunmu supaya bisa dilacak di halaman Transaksi.</p>
          <Link className="btn btn-gold" href="/akun?next=/keranjang">
            Masuk / Daftar
          </Link>
        </div>
      ) : cart.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <Icon name="i-cart" />
          <b>Keranjang masih kosong</b>
          <p>Jelajahi katalog dan tambahkan produk digital favoritmu.</p>
          <Link className="btn btn-gold" href="/kategori">
            Jelajahi Produk
          </Link>
        </div>
      ) : (
        <div className="checkout-grid">
          <div>
            <div>
              {cart.map((c) => (
                <div className="cart-item" key={c.key}>
                  <div className="ci-thumb">
                    <Thumb product={{ image: c.image, tile: c.tile, name: c.name, image_alt: c.name }} />
                  </div>
                  <div className="ci-body">
                    <b>{c.name}</b>
                    <div className="ci-meta">
                      {c.variant}
                      {c.meta ? (
                        <>
                          <br />
                          {c.meta}
                        </>
                      ) : null}
                    </div>
                    <div className="ci-row">
                      <span className="ci-price">{fmtIDR(c.price * c.qty)}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "var(--muted)", fontSize: ".83rem" }}>× {c.qty}</span>
                        <button
                          className="ci-del"
                          onClick={() => {
                            removeFromCart(c.key);
                            toast("Item dihapus dari keranjang", "i-trash");
                          }}
                        >
                          <Icon name="i-trash" />
                          Hapus
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel" style={{ marginTop: 16 }}>
              <h3>Data Kontak</h3>
              <div className={"field" + (errors.name ? " invalid" : "")}>
                <label htmlFor="coName">Nama Lengkap</label>
                <input id="coName" type="text" placeholder="Nama kamu" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <p className="err">Nama wajib diisi.</p>
              </div>
              <div className={"field" + (errors.email ? " invalid" : "")}>
                <label htmlFor="coEmail">
                  Email <small>— untuk pengiriman produk &amp; bukti transaksi</small>
                </label>
                <input id="coEmail" type="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <p className="err">Masukkan alamat email yang valid.</p>
              </div>
              <div className={"field" + (errors.phone ? " invalid" : "")} style={{ marginBottom: 0 }}>
                <label htmlFor="coWa">
                  Nomor WhatsApp <small>— admin menghubungimu di sini bila perlu</small>
                </label>
                <input id="coWa" type="tel" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                <p className="err">Masukkan nomor WhatsApp yang valid (min. 9 digit).</p>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 14 }}>
              <h3>Metode Pembayaran</h3>
              <div className="pay-grid">
                <button className="pay-opt on" type="button">
                  <Icon name="i-qr" />
                  QRIS — Semua E-Wallet &amp; Bank
                </button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: ".8rem", lineHeight: 1.6, margin: "10px 0 0" }}>
                Satu kode QRIS untuk GoPay, DANA, OVO, ShopeePay, dan semua mobile banking. Kode QR tampil di halaman
                berikutnya setelah pesanan dibuat — kamu tetap di website ini selama membayar.
              </p>
            </div>
          </div>

          <div className="panel">
            <h3>Ringkasan Pesanan</h3>
            {serverError && (
              <div className="alert error">
                <Icon name="i-info" />
                <span>{serverError}</span>
              </div>
            )}
            {outOfRange && (
              <div className="alert warn">
                <Icon name="i-info" />
                <span>
                  Total pesanan ini <b>{fmtIDR(total)}</b> berada di luar batas QRIS ({fmtIDR(QRIS_MIN)} –{" "}
                  {fmtIDR(QRIS_MAX)}), jadi pembayaran belum bisa dibuat. Kurangi atau tambah isi keranjang agar total
                  berada dalam batas tersebut.
                </span>
              </div>
            )}
            <div>
              {cart.map((c) => (
                <div className="sum-row" key={c.key}>
                  <span>
                    {c.name} — {c.variant} × {c.qty}
                  </span>
                  <span>{fmtIDR(c.price * c.qty)}</span>
                </div>
              ))}
              <div className="sum-row">
                <span>Subtotal</span>
                <span>{fmtIDR(subtotal)}</span>
              </div>
              <div className="sum-row">
                <span>Biaya layanan</span>
                <span>{fmtIDR(fee)}</span>
              </div>
              <div className="sum-row total">
                <span>Total Bayar</span>
                <span>{fmtIDR(total)}</span>
              </div>
            </div>
            <button
              className="btn btn-gold btn-block"
              style={{ marginTop: 14 }}
              onClick={doCheckout}
              disabled={submitting || outOfRange}
            >
              {submitting ? "Membuat Pesanan…" : "Buat Pesanan & Bayar QRIS"}
            </button>
            <p style={{ color: "var(--muted)", fontSize: ".76rem", lineHeight: 1.6, margin: "11px 0 0", textAlign: "center" }}>
              Dengan membuat pesanan, kamu menyetujui syarat &amp; ketentuan RaiDigi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
