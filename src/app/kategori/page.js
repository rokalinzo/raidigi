"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "../../components/icons";
import ProductCard from "../../components/ProductCard";

const FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "game", label: "Game" },
  { id: "topup", label: "Topup" },
  { id: "akun-game", label: "Akun Game" },
  { id: "item-trade", label: "Item Trade" },
  { id: "voucher", label: "Voucher" },
  { id: "akun-digital", label: "Akun Digital" },
];
const SORTS = [
  { id: "populer", label: "Paling Populer" },
  { id: "murah", label: "Harga Terendah" },
  { id: "mahal", label: "Harga Tertinggi" },
  { id: "nama", label: "Nama A–Z" },
];

function matchFilter(p, filter) {
  if (filter === "semua") return true;
  if (filter === "game") return ["topup", "akun-game", "item-trade"].includes(p.category);
  return p.category === filter;
}

function KategoriInner() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState(null);
  const [filter, setFilter] = useState(searchParams.get("filter") || "semua");
  const [sort, setSort] = useState("populer");
  const [query, setQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f && FILTERS.some((x) => x.id === f)) setFilter(f);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]));
  }, []);

  const list = useMemo(() => {
    if (!products) return [];
    let out = products.filter(
      (p) =>
        matchFilter(p, filter) &&
        (p.name + " " + p.game + " " + p.category_label).toLowerCase().includes(query.toLowerCase())
    );
    if (sort === "murah") out = [...out].sort((a, b) => a.price - b.price);
    else if (sort === "mahal") out = [...out].sort((a, b) => b.price - a.price);
    else if (sort === "nama") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    else out = [...out].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || a.sort_order - b.sort_order);
    return out;
  }, [products, filter, sort, query]);

  return (
    <div className="wrap">
      <h1 className="page-title">Kategori</h1>
      <p className="page-sub">Telusuri semua produk digital RaiDigi.</p>
      <div className="toolbar">
        <label className="searchbar">
          <Icon name="i-search" />
          <input
            type="search"
            placeholder="Cari produk… mis. diamond, robux, netflix"
            aria-label="Cari produk"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="chips" role="group" aria-label="Filter kategori">
          {FILTERS.map((f) => (
            <button key={f.id} className={"chip" + (filter === f.id ? " on" : "")} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="sort-row">
          <span className="count">{products === null ? "Memuat…" : `${list.length} produk`}</span>
          <button className="sort-btn" onClick={() => setSortOpen(true)}>
            <Icon name="i-sort" /> <span>{SORTS.find((s) => s.id === sort).label}</span>
          </button>
        </div>
      </div>

      {products === null ? (
        <div className="skl-grid" style={{ marginTop: 14 }}>
          <div className="skl" style={{ height: 230 }} />
          <div className="skl" style={{ height: 230 }} />
          <div className="skl" style={{ height: 230 }} />
          <div className="skl" style={{ height: 230 }} />
        </div>
      ) : list.length ? (
        <div className="pgrid" style={{ marginTop: 14 }}>
          {list.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <Icon name="i-search" />
          <b>Produk tidak ditemukan</b>
          <p>Coba kata kunci atau kategori lain.</p>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setFilter("semua");
              setQuery("");
            }}
          >
            Reset Filter
          </button>
        </div>
      )}

      {sortOpen && (
        <>
          <div className="overlay show" onClick={() => setSortOpen(false)} />
          <div className="sheet show" role="dialog" aria-modal="true">
            <div className="grab" />
            <h3>Urutkan Produk</h3>
            {SORTS.map((s) => (
              <button
                className="opt"
                key={s.id}
                onClick={() => {
                  setSort(s.id);
                  setSortOpen(false);
                }}
              >
                <span>{s.label}</span>
                {sort === s.id && <Icon name="i-check" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function KategoriPage() {
  return (
    <Suspense fallback={<div className="wrap"><p className="page-sub" style={{ marginTop: 20 }}>Memuat katalog…</p></div>}>
      <KategoriInner />
    </Suspense>
  );
}
