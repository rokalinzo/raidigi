"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import { fmtDateTime, fmtIDR, statusInfo } from "../../lib/format";

const CATEGORIES = ["topup", "item-trade", "akun-game", "akun-digital", "voucher"];
const TYPES = ["topup", "trade", "streaming", "voucher", "akun"];
const NEXT_ACTIONS = {
  menunggu_pembayaran: [{ to: "batal", label: "Batalkan" }],
  dibayar: [
    { to: "diproses", label: "Proses" },
    { to: "batal", label: "Batalkan" },
  ],
  diproses: [
    { to: "selesai", label: "Selesaikan" },
    { to: "batal", label: "Batalkan" },
  ],
  selesai: [],
  batal: [],
  kedaluwarsa: [],
};

function blankProduct() {
  return {
    slug: "", name: "", game: "", category: "topup", category_label: "Topup", type: "topup",
    price: 0, compare_at_price: 0, stock: "", image: "", image_alt: "", description: "",
    specsText: "", denoms: [{ label: "", price: 0, note: "" }], form_fields: [],
    popular: false, qty_allowed: false, is_sample: false, active: true, sort_order: 0,
  };
}

function toForm(p) {
  return {
    ...p,
    stock: p.stock === null ? "" : p.stock,
    specsText: (p.specs || []).join("\n"),
    denoms: (p.denoms && p.denoms.length ? p.denoms : [{ label: p.name, price: p.price }]).map((d) => ({
      label: d.label, price: d.price, note: d.note || "",
    })),
    form_fields: (p.form_fields || []).map((f) => ({
      key: f.key || "", label: f.label || "", ph: f.ph || "", hint: f.hint || "", required: !!f.required,
    })),
  };
}

export default function AdminPage() {
  const [state, setState] = useState("loading"); // loading | login | ready
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState("pesanan");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [dataError, setDataError] = useState("");
  const [editing, setEditing] = useState(null); // form object | null
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadAll = useCallback(async () => {
    setDataError("");
    try {
      const [o, p] = await Promise.all([
        fetch("/api/admin/orders", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/products", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (o.error) setDataError(o.error);
      else setOrders(o.orders || []);
      if (!p.error) setProducts(p.products || []);
    } catch {
      setDataError("Gagal memuat data admin.");
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured);
        if (d.admin) {
          setState("ready");
          loadAll();
        } else setState("login");
      })
      .catch(() => setState("login"));
  }, [loadAll]);

  async function login(e) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error || "Gagal masuk.");
      return;
    }
    setState("ready");
    loadAll();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setState("login");
  }

  async function changeStatus(order, to) {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, status: to }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Gagal mengubah status.");
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
  }

  async function saveProduct(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    const payload = {
      ...editing,
      specs: editing.specsText,
      stock: editing.stock === "" ? null : parseInt(editing.stock, 10),
      denoms: editing.denoms.filter((d) => d.label.trim()),
      form_fields: (editing.form_fields || [])
        .filter((f) => (f.label || "").trim())
        .map((f) => ({
          key: f.key || f.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          label: f.label.trim(),
          ph: f.ph || "",
          hint: f.hint || "",
          required: !!f.required,
        })),
    };
    delete payload.specsText;
    const isNew = !editing.id;
    const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${editing.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFormError(data.error || "Gagal menyimpan produk.");
      return;
    }
    setEditing(null);
    loadAll();
  }

  async function deleteProduct(p) {
    const yakin = window.confirm(
      `Hapus permanen produk "${p.name}"?\n\nProduk akan hilang dari panel admin dan etalase, dan tidak bisa dibatalkan. Riwayat pesanan lama tetap aman karena nama produk tersimpan di pesanannya.`
    );
    if (!yakin) return;
    const res = await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Gagal menghapus produk.");
      return;
    }
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
  }

  if (state === "loading") {
    return (
      <div className="wrap">
        <p className="page-sub" style={{ marginTop: 20 }}>
          Memuat panel admin…
        </p>
      </div>
    );
  }

  if (state === "login") {
    return (
      <div className="wrap">
        <div className="auth-card">
          <h1>Admin RaiDigi</h1>
          <p>Masuk dengan kredensial admin yang diatur di server (ADMIN_EMAIL &amp; ADMIN_PASSWORD).</p>
          {!configured && (
            <div className="alert warn">
              <Icon name="i-info" />
              <span>Kredensial admin belum dikonfigurasi di server, jadi login admin belum bisa dipakai.</span>
            </div>
          )}
          {loginError && (
            <div className="alert error">
              <Icon name="i-info" />
              <span>{loginError}</span>
            </div>
          )}
          <form onSubmit={login}>
            <div className="field">
              <label htmlFor="admEmail">Email Admin</label>
              <input id="admEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="admPass">Kata Sandi Admin</label>
              <input id="admPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-gold btn-block" type="submit">
              Masuk Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap admin-wrap">
      <h1 className="page-title">Panel Admin</h1>
      <p className="page-sub">Kelola pesanan dan katalog RaiDigi.</p>

      <div className="admin-tabs">
        <button className={"chip" + (tab === "pesanan" ? " on" : "")} onClick={() => setTab("pesanan")}>
          Pesanan ({orders.length})
        </button>
        <button className={"chip" + (tab === "produk" ? " on" : "")} onClick={() => setTab("produk")}>
          Produk ({products.length})
        </button>
        <button className="chip" onClick={loadAll}>
          Muat Ulang
        </button>
        <button className="chip" onClick={logout}>
          Keluar Admin
        </button>
      </div>

      {dataError && (
        <div className="alert error">
          <Icon name="i-info" />
          <span>{dataError}</span>
        </div>
      )}

      {tab === "pesanan" &&
        (orders.length === 0 ? (
          <div className="empty-state">
            <Icon name="i-receipt" />
            <b>Belum ada pesanan</b>
            <p>Pesanan pembeli akan muncul di sini.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pesanan</th>
                  <th>Pembeli</th>
                  <th>Item &amp; Data</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const st = statusInfo(o.status);
                  return (
                    <tr key={o.id}>
                      <td>
                        <b style={{ color: "var(--text)" }}>{o.code}</b>
                        <br />
                        <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>{fmtDateTime(o.created_at)}</span>
                        {o.bayar_invoice_id && (
                          <>
                            <br />
                            <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>Inv: {o.bayar_invoice_id}</span>
                          </>
                        )}
                      </td>
                      <td>
                        {o.buyer_name}
                        <br />
                        <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>
                          {o.buyer_email}
                          <br />
                          {o.buyer_phone}
                        </span>
                      </td>
                      <td>
                        {o.items.map((it, i) => (
                          <div key={i} style={{ marginBottom: 6 }}>
                            {it.product_name} — {it.variant_label} × {it.qty}
                            {Object.keys(it.form_data || {}).length > 0 && (
                              <ul className="formdata-list">
                                {Object.entries(it.form_data).map(([k, v]) => (
                                  <li key={k}>
                                    <b>{k}:</b> {v}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </td>
                      <td style={{ color: "var(--gold)", fontWeight: 800 }}>{fmtIDR(o.total)}</td>
                      <td>
                        <span className={"status " + st.cls}>{st.label}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(NEXT_ACTIONS[o.status] || []).map((a) => (
                            <button key={a.to} className="btn btn-ghost btn-sm" onClick={() => changeStatus(o, a.to)}>
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "produk" && (
        <>
          {!editing && (
            <button className="btn btn-gold" style={{ marginBottom: 14 }} onClick={() => setEditing(blankProduct())}>
              + Produk Baru
            </button>
          )}
          {editing ? (
            <form className="panel" onSubmit={saveProduct}>
              <h3>{editing.id ? `Ubah Produk — ${editing.name}` : "Produk Baru"}</h3>
              {formError && (
                <div className="alert error">
                  <Icon name="i-info" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="field">
                <label>Nama Produk</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Slug (URL) {editing.id ? "— tidak dapat diubah" : ""}</label>
                <input className="input" value={editing.slug} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} required={!editing.id} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Game / Platform</label>
                  <input className="input" value={editing.game} onChange={(e) => setEditing({ ...editing, game: e.target.value })} />
                </div>
                <div className="field">
                  <label>Label Kategori</label>
                  <input className="input" value={editing.category_label} onChange={(e) => setEditing({ ...editing, category_label: e.target.value })} />
                </div>
                <div className="field">
                  <label>Kategori</label>
                  <select className="input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Tipe Produk</label>
                  <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Harga Coret (Rp, 0 = tidak ada)</label>
                  <input className="input" type="number" min="0" value={editing.compare_at_price} onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value })} />
                </div>
                <div className="field">
                  <label>Stok (kosongkan = tidak dilacak)</label>
                  <input className="input" type="number" min="0" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} />
                </div>
                <div className="field">
                  <label>Urutan Tampil</label>
                  <input className="input" type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
                </div>
                <div className="field">
                  <label>Gambar (URL gambar atau data URI)</label>
                  <input className="input" value={editing.image || ""} onChange={(e) => setEditing({ ...editing, image: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Deskripsi</label>
                <textarea className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="field">
                <label>Spesifikasi (satu per baris)</label>
                <textarea className="input" value={editing.specsText} onChange={(e) => setEditing({ ...editing, specsText: e.target.value })} />
              </div>
              <div className="field">
                <label>Denominasi / Paket (harga produk = denominasi termurah)</label>
                {editing.denoms.map((d, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr auto", gap: 8, marginBottom: 8 }}>
                    <input className="input" placeholder="Label" value={d.label} onChange={(e) => { const denoms = [...editing.denoms]; denoms[i] = { ...d, label: e.target.value }; setEditing({ ...editing, denoms }); }} />
                    <input className="input" type="number" min="0" placeholder="Harga" value={d.price} onChange={(e) => { const denoms = [...editing.denoms]; denoms[i] = { ...d, price: e.target.value }; setEditing({ ...editing, denoms }); }} />
                    <input className="input" placeholder="Catatan (opsional)" value={d.note} onChange={(e) => { const denoms = [...editing.denoms]; denoms[i] = { ...d, note: e.target.value }; setEditing({ ...editing, denoms }); }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...editing, denoms: editing.denoms.filter((_, x) => x !== i) })}>
                      Hapus
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...editing, denoms: [...editing.denoms, { label: "", price: 0, note: "" }] })}>
                  + Denominasi
                </button>
              </div>
              <div className="field">
                <label>Kolom Data Pembeli (diisi pembeli di halaman produk, mis. User ID / Username)</label>
                {(editing.form_fields || []).map((f, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 1.6fr auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input className="input" placeholder="Label (mis. User ID)" value={f.label} onChange={(e) => { const form_fields = [...editing.form_fields]; form_fields[i] = { ...f, label: e.target.value }; setEditing({ ...editing, form_fields }); }} />
                    <input className="input" placeholder="Placeholder" value={f.ph || ""} onChange={(e) => { const form_fields = [...editing.form_fields]; form_fields[i] = { ...f, ph: e.target.value }; setEditing({ ...editing, form_fields }); }} />
                    <input className="input" placeholder="Petunjuk (opsional)" value={f.hint || ""} onChange={(e) => { const form_fields = [...editing.form_fields]; form_fields[i] = { ...f, hint: e.target.value }; setEditing({ ...editing, form_fields }); }} />
                    <label className="switch-row">
                      <input type="checkbox" checked={!!f.required} onChange={(e) => { const form_fields = [...editing.form_fields]; form_fields[i] = { ...f, required: e.target.checked }; setEditing({ ...editing, form_fields }); }} /> Wajib
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...editing, form_fields: editing.form_fields.filter((_, x) => x !== i) })}>
                      Hapus
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...editing, form_fields: [...(editing.form_fields || []), { key: "", label: "", ph: "", hint: "", required: true }] })}>
                  + Kolom Data
                </button>
                <p className="hint">Produk topup yang kolomnya dikosongkan otomatis memakai kolom bawaan sesuai game (Mobile Legends: User ID + Zone ID; Roblox: Username; Free Fire: Player ID).</p>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "6px 0 14px" }}>
                <label className="switch-row">
                  <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Aktif
                </label>
                <label className="switch-row">
                  <input type="checkbox" checked={editing.is_sample} onChange={(e) => setEditing({ ...editing, is_sample: e.target.checked })} /> Tandai “Contoh”
                </label>
                <label className="switch-row">
                  <input type="checkbox" checked={editing.popular} onChange={(e) => setEditing({ ...editing, popular: e.target.checked })} /> Populer
                </label>
                <label className="switch-row">
                  <input type="checkbox" checked={editing.qty_allowed} onChange={(e) => setEditing({ ...editing, qty_allowed: e.target.checked })} /> Boleh pilih jumlah
                </label>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-gold" type="submit" disabled={saving}>
                  {saving ? "Menyimpan…" : "Simpan Produk"}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                  Batal
                </button>
              </div>
            </form>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Kategori</th>
                    <th>Harga</th>
                    <th>Stok</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b style={{ color: "var(--text)" }}>{p.name}</b>
                        <br />
                        <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>{p.slug}</span>
                      </td>
                      <td>{p.category_label}</td>
                      <td style={{ color: "var(--gold)", fontWeight: 700 }}>{fmtIDR(p.price)}</td>
                      <td>{p.stock === null ? "∞" : p.stock}</td>
                      <td>
                        {p.active ? <span className="chip-static">Aktif</span> : <span className="chip-static">Nonaktif</span>}{" "}
                        {p.is_sample && <span className="chip-static">Contoh</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(toForm(p))}>
                            Ubah
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => deleteProduct(p)}>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
