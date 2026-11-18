"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Thumb } from "./thumb";
import { useStore } from "./store";
import { fmtIDR } from "../lib/format";
import { LOGO } from "../lib/assets-data";

const NAV = [
  { href: "/", label: "Beranda", icon: "i-home", match: (p) => p === "/" },
  { href: "/kategori", label: "Kategori", icon: "i-grid", match: (p) => p.startsWith("/kategori") || p.startsWith("/produk") },
  { href: "/transaksi", label: "Transaksi", icon: "i-receipt", match: (p) => p.startsWith("/transaksi") || p.startsWith("/pembayaran") },
  { href: "/akun", label: "Akun", icon: "i-user", match: (p) => p.startsWith("/akun") },
];

export default function Header() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { cartCount } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [popular, setPopular] = useState([]);
  const [notifSeen, setNotifSeen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setPopular((d.products || []).filter((p) => p.popular)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [searchOpen]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch("/api/products")
        .then((r) => r.json())
        .then((d) => {
          const list = (d.products || []).filter((p) =>
            (p.name + " " + p.game + " " + p.category_label).toLowerCase().includes(q)
          );
          setResults(list.slice(0, 8));
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSheetOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const showList = query.trim() ? results : popular;

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-in">
          <Link className="logo" href="/" aria-label="RaiDigi — Beranda">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-mark" src={LOGO} alt="" />
            <span className="logo-name">RaiDigi</span>
          </Link>
          <nav className="topnav" aria-label="Navigasi utama">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={n.match(pathname) ? "active nav-link" : "nav-link"}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="top-actions">
            <button className="icon-btn" aria-label="Cari produk" onClick={() => setSearchOpen(true)}>
              <Icon name="i-search" />
            </button>
            <button
              className="icon-btn"
              aria-label="Notifikasi"
              onClick={() => {
                setSheetOpen(true);
                setNotifSeen(true);
              }}
            >
              <Icon name="i-bell" />
              {!notifSeen && <span className="dot" />}
            </button>
            <button className="icon-btn" aria-label="Keranjang belanja" onClick={() => router.push("/keranjang")}>
              <Icon name="i-cart" />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <nav className="bottomnav" aria-label="Navigasi bawah">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={n.match(pathname) ? "active" : ""}>
            <Icon name={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>

      {(searchOpen || sheetOpen) && (
        <div
          className="overlay show"
          onClick={() => {
            setSearchOpen(false);
            setSheetOpen(false);
          }}
        />
      )}

      {searchOpen && (
        <div className="search-sheet show" role="dialog" aria-label="Pencarian produk">
          <div className="ss-in">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label className="searchbar" style={{ flex: 1 }}>
                <Icon name="i-search" />
                <input
                  ref={inputRef}
                  type="search"
                  placeholder="Cari diamond, robux, akun, voucher…"
                  aria-label="Cari produk"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button
                className="icon-btn"
                aria-label="Tutup pencarian"
                style={{ borderColor: "var(--border)" }}
                onClick={() => setSearchOpen(false)}
              >
                <Icon name="i-x" />
              </button>
            </div>
            <div className="search-results">
              <p style={{ color: "var(--muted)", fontSize: ".82rem", fontWeight: 700, margin: "4px 0 0" }}>
                {query.trim() ? `${showList.length} hasil untuk "${query}"` : "Produk populer"}
              </p>
              {showList.length ? (
                showList.map((p) => (
                  <button
                    className="sr-item"
                    key={p.slug}
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(`/produk/${p.slug}`);
                    }}
                  >
                    <span className="ci-thumb">
                      <Thumb product={p} />
                    </span>
                    <span>
                      <b>{p.name}</b>
                      <span>
                        {p.category_label} · {p.game}
                      </span>
                    </span>
                    <span className="sr-price">{fmtIDR(p.price)}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <b>Tidak ada hasil</b>
                  <p>Coba kata kunci lain, misalnya "diamond" atau "robux".</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div className="sheet show" role="dialog" aria-modal="true">
          <div className="grab" />
          <h3>Notifikasi</h3>
          <div className="notif-item">
            <div className="n-ico">
              <Icon name="i-tag" />
            </div>
            <div>
              <b>Diskon Topup s/d 20%</b>
              <p>Promo topup game berlaku minggu ini untuk produk bertanda Contoh dan katalog pilihan.</p>
            </div>
          </div>
          <div className="notif-item">
            <div className="n-ico">
              <Icon name="i-crown" />
            </div>
            <div>
              <b>Robux 800 turun harga</b>
              <p>Sekarang Rp159.000 dari Rp185.000 — via gift resmi.</p>
            </div>
          </div>
          <div className="notif-item">
            <div className="n-ico">
              <Icon name="i-package" />
            </div>
            <div>
              <b>Pembayaran QRIS kini aktif</b>
              <p>Checkout langsung di website — scan QRIS dan pesananmu otomatis terkonfirmasi.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
