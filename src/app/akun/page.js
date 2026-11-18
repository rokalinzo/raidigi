"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "../../components/icons";
import ProductCard from "../../components/ProductCard";
import { useStore } from "../../components/store";

function AkunInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "";
  const { wishlist, toast } = useStore();
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("masuk");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wishProducts, setWishProducts] = useState([]);
  const [showWish, setShowWish] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!wishlist.length) {
      setWishProducts([]);
      return;
    }
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setWishProducts((d.products || []).filter((p) => wishlist.includes(p.slug))))
      .catch(() => {});
  }, [wishlist]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }
    if (tab === "daftar" && !name.trim()) {
      setError("Nama lengkap wajib diisi untuk mendaftar.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(tab === "daftar" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan. Coba lagi.");
        setBusy(false);
        return;
      }
      setUser(data.user);
      toast(`Selamat datang, ${data.user.name}!`, "i-user");
      if (next) router.push(next);
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    }
    setBusy(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    toast("Kamu sudah keluar", "i-logout");
  }

  if (user === undefined) {
    return (
      <div className="wrap">
        <p className="page-sub" style={{ marginTop: 20 }}>
          Memuat akun…
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="wrap">
        <div className="auth-card">
          <h1>Selamat datang di RaiDigi</h1>
          <p>Masuk untuk melihat wishlist, riwayat transaksi, dan pesananmu.</p>
          <div className="auth-tabs">
            <button className={tab === "masuk" ? "on" : ""} onClick={() => setTab("masuk")}>
              Masuk
            </button>
            <button className={tab === "daftar" ? "on" : ""} onClick={() => setTab("daftar")}>
              Daftar
            </button>
          </div>
          {error && (
            <div className="alert error">
              <Icon name="i-info" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={submit}>
            {tab === "daftar" && (
              <div className="field">
                <label htmlFor="authName">Nama Lengkap</label>
                <input id="authName" type="text" placeholder="Nama kamu" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="authEmail">Email</label>
              <input id="authEmail" type="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="authPass">Kata Sandi</label>
              <input id="authPass" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-gold btn-block" type="submit" disabled={busy}>
              {busy ? "Memproses…" : tab === "daftar" ? "Daftar" : "Masuk"}
            </button>
          </form>
          <p style={{ textAlign: "center", margin: "14px 0 0", fontSize: ".8rem", color: "var(--muted)" }}>
            Kata sandimu tersimpan terenkripsi (bcrypt) di server RaiDigi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <h1 className="page-title">Akun Saya</h1>
      <p className="page-sub">Kelola profil dan aktivitas belanjamu.</p>
      <div className="profile-head" style={{ marginTop: 14 }}>
        <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
        <div>
          <b>{user.name}</b>
          <span>{user.email}</span>
        </div>
      </div>
      <div className="menu-list">
        <Link className="menu-item" href="/transaksi" style={{ textDecoration: "none" }}>
          <Icon name="i-receipt" />
          Riwayat Transaksi
          <span className="chev">
            <Icon name="i-chev-r" />
          </span>
        </Link>
        <button
          className="menu-item"
          onClick={() => {
            setShowWish((s) => !s);
          }}
        >
          <Icon name="i-heart" />
          Wishlist Saya ({wishProducts.length})
          <span className="chev">
            <Icon name="i-chev-r" />
          </span>
        </button>
        <button className="menu-item" onClick={() => toast("Pengaturan akun menyusul — data akunmu sudah tersimpan aman", "i-gear")}>
          <Icon name="i-gear" />
          Pengaturan Akun
          <span className="chev">
            <Icon name="i-chev-r" />
          </span>
        </button>
        <button className="menu-item" onClick={() => toast("Admin online 08.00–22.00 WIB — hubungi lewat WhatsApp resmi RaiDigi", "i-help")}>
          <Icon name="i-help" />
          Bantuan &amp; Dukungan
          <span className="chev">
            <Icon name="i-chev-r" />
          </span>
        </button>
        <button className="menu-item danger" onClick={logout}>
          <Icon name="i-logout" />
          Keluar
        </button>
      </div>

      {showWish &&
        (wishProducts.length ? (
          <>
            <div className="sec-head">
              <h2>
                <Icon name="i-heart" /> Wishlist Saya
              </h2>
            </div>
            <div className="pgrid">
              {wishProducts.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ marginTop: 14 }}>
            <b>Wishlist masih kosong</b>
            <p>Ketuk ikon hati pada produk untuk menyimpannya di sini.</p>
          </div>
        ))}
    </div>
  );
}

export default function AkunPage() {
  return (
    <Suspense fallback={<div className="wrap"><p className="page-sub" style={{ marginTop: 20 }}>Memuat akun…</p></div>}>
      <AkunInner />
    </Suspense>
  );
}
