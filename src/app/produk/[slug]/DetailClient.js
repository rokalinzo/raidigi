"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../../components/icons";
import { Thumb } from "../../../components/thumb";
import { useStore } from "../../../components/store";
import { discPct, fmtIDR } from "../../../lib/format";
import { TYPE_INSTRUCTIONS } from "../../../lib/catalog";

export default function DetailClient({ product: p }) {
  const router = useRouter();
  const { addToCart, toast } = useStore();
  const [denomIdx, setDenomIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});

  // Cek nickname ML: hanya untuk produk yang punya kolom User ID + Zone ID.
  const fieldKeys = (p.form_fields || []).map((f) => f.key);
  const canCheckMl = fieldKeys.includes("userId") && fieldKeys.includes("zoneId");
  const [nick, setNick] = useState({ status: "idle", name: "", country: null, error: "" });

  useEffect(() => {
    setNick({ status: "idle", name: "", country: null, error: "" });
  }, [values.userId, values.zoneId]);

  async function checkNickname() {
    const userId = (values.userId || "").trim();
    const zoneId = (values.zoneId || "").trim();
    if (!userId || !zoneId) {
      toast("Isi dulu User ID dan Zone ID-nya", "i-info");
      return;
    }
    setNick({ status: "loading", name: "", country: null, error: "" });
    try {
      const res = await fetch(
        `/api/check-ml?userId=${encodeURIComponent(userId)}&zoneId=${encodeURIComponent(zoneId)}`
      );
      const data = await res.json();
      if (data.success) {
        setNick({ status: "found", name: data.nickname, country: data.country, error: "" });
      } else if (res.status === 502) {
        setNick({ status: "error", name: "", country: null, error: data.error || "Layanan cek nickname sedang tidak tersedia." });
      } else {
        setNick({ status: "notfound", name: "", country: null, error: data.error || "Nickname tidak ditemukan." });
      }
    } catch {
      setNick({ status: "error", name: "", country: null, error: "Layanan cek nickname sedang tidak tersedia." });
    }
  }

  const denom = p.denoms[denomIdx] || p.denoms[0] || { label: p.name, price: p.price };
  const total = denom.price * qty;
  const d = discPct(p.price, p.compare_at_price);
  const outOfStock = p.stock !== null && p.stock <= 0;
  const maxQty = p.qty_allowed ? Math.max(1, p.stock || 99) : 1;

  const instructions = useMemo(() => TYPE_INSTRUCTIONS[p.type] || TYPE_INSTRUCTIONS.topup, [p.type]);

  function validate() {
    const errs = {};
    (p.form_fields || []).forEach((f) => {
      if (f.required && !(values[f.key] || "").trim()) errs[f.key] = true;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildItem() {
    const formData = {};
    (p.form_fields || []).forEach((f) => {
      const v = (values[f.key] || "").trim();
      if (v) formData[f.label] = v;
    });
    if (canCheckMl && nick.status === "found" && nick.name) formData["Nickname"] = nick.name;
    const metaParts = Object.keys(formData).map((k) => `${k}: ${formData[k]}`);
    return {
      key: `${p.slug}|${denom.label}|${metaParts.join("|")}`,
      slug: p.slug,
      name: p.name,
      variant: denom.label,
      price: denom.price,
      qty,
      meta: metaParts.join(" · "),
      formData,
      image: p.image,
      tile: p.tile,
    };
  }

  function handleAdd(buyNow) {
    if (outOfStock) {
      toast("Stok produk ini sedang habis", "i-info");
      return;
    }
    if (!validate()) {
      toast("Lengkapi dulu data pengiriman yang wajib diisi", "i-info");
      return;
    }
    addToCart(buildItem());
    toast(buyNow ? "Pesanan siap di-checkout" : "Ditambahkan ke keranjang", "i-cart");
    if (buyNow) router.push("/keranjang");
  }

  return (
    <>
      <div className="detail-grid">
        <div className="detail-media">
          <Thumb product={p} />
        </div>
        <div className="detail-info">
          <span className="d-cat">
            {p.category_label}
            {p.is_sample ? " · Produk Contoh" : ""}
          </span>
          <h1>{p.name}</h1>
          <div className="d-game">
            {p.game} ·{" "}
            {p.stock === null ? "Selalu tersedia" : p.stock > 0 ? `Stok tersedia: ${p.stock}` : "Stok habis"}
          </div>
          <div className="d-price">
            <b>{fmtIDR(total)}</b>
            {p.compare_at_price > p.price && (
              <>
                <s>{fmtIDR(p.compare_at_price)}</s>
                <span className="save">Hemat {d}%</span>
              </>
            )}
          </div>
          <p className="d-desc">{p.description}</p>

          <div className="d-block">
            <h3>Spesifikasi &amp; Keunggulan</h3>
            <ul className="spec-list">
              {p.specs.map((s, i) => (
                <li key={i}>
                  <Icon name="i-check" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {p.denoms.length > 1 && (
            <div className="d-block">
              <h3>{p.type === "streaming" ? "Pilih Paket" : "Pilih Nominal"}</h3>
              <div className="denom-grid">
                {p.denoms.map((dn, i) => (
                  <button key={i} className={"denom" + (i === denomIdx ? " on" : "")} onClick={() => setDenomIdx(i)}>
                    <b>{dn.label}</b>
                    <span>{fmtIDR(dn.price)}</span>
                    {dn.note && <small>{dn.note}</small>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {p.form_fields && p.form_fields.length > 0 && (
            <div className="d-block">
              <h3>Data Pengiriman</h3>
              {p.form_fields.map((f) => (
                <div className={"field" + (errors[f.key] ? " invalid" : "")} key={f.key}>
                  <label htmlFor={"df-" + f.key}>
                    {f.label}
                    {!f.required && <small> (opsional)</small>}
                  </label>
                  <input
                    id={"df-" + f.key}
                    type="text"
                    placeholder={f.ph}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                  {f.hint && <p className="hint">{f.hint}</p>}
                  <p className="err">Kolom ini wajib diisi.</p>
                </div>
              ))}
              {canCheckMl && (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={checkNickname}
                    disabled={nick.status === "loading"}
                  >
                    {nick.status === "loading" ? "Mengecek…" : "Cek Nickname"}
                  </button>
                  {nick.status === "found" && (
                    <p style={{ marginTop: 8, color: "#5FE08C", fontWeight: 700 }}>
                      Nickname: {nick.name}
                      {nick.country ? (
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {nick.country}</span>
                      ) : null}
                    </p>
                  )}
                  {nick.status === "notfound" && (
                    <p style={{ marginTop: 8, color: "#FF6B7A" }}>{nick.error}</p>
                  )}
                  {nick.status === "error" && (
                    <p className="hint" style={{ marginTop: 8 }}>
                      {nick.error} Kamu tetap bisa lanjut checkout — pastikan ID yang kamu isi sudah benar.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {p.qty_allowed && (
            <div className="d-block">
              <h3>Jumlah</h3>
              <div className="qty-row">
                <div className="qty-ctrl">
                  <button aria-label="Kurangi" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    <Icon name="i-minus" />
                  </button>
                  <output>{qty}</output>
                  <button aria-label="Tambah" onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
                    <Icon name="i-plus" />
                  </button>
                </div>
                <span style={{ color: "var(--muted)", fontSize: ".83rem" }}>Maks. sesuai stok ({p.stock})</span>
              </div>
            </div>
          )}

          <div className="d-block">
            <h3>Cara Pembelian</h3>
            <ul className="spec-list">
              {instructions.map((s, i) => (
                <li key={i}>
                  <Icon name="i-arrow-r" />
                  <span>
                    <b>{i + 1}.</b> {s}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="buy-actions">
            <button className="btn btn-ghost" onClick={() => handleAdd(false)} disabled={outOfStock}>
              + Keranjang
            </button>
            <button className="btn btn-gold btn-buy" onClick={() => handleAdd(true)} disabled={outOfStock}>
              {outOfStock ? "Stok Habis" : "Beli Sekarang"}
            </button>
          </div>
        </div>
      </div>

      <div className="sticky-buy show">
        <div className="sb-in">
          <div className="sb-price">
            <small>Total Harga</small>
            <b>{fmtIDR(total)}</b>
          </div>
          <button className="btn btn-ghost" style={{ flex: "0 0 auto" }} onClick={() => handleAdd(false)} disabled={outOfStock}>
            + Keranjang
          </button>
          <button className="btn btn-gold btn-buy" onClick={() => handleAdd(true)} disabled={outOfStock}>
            {outOfStock ? "Stok Habis" : "Beli Sekarang"}
          </button>
        </div>
      </div>
    </>
  );
}
