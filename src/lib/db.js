import { neon } from "@neondatabase/serverless";
import { SEED_PRODUCTS } from "./catalog";

/* Lapisan data RaiDigi.
   - Memakai Neon Postgres bila DATABASE_URL tersedia.
   - Tanpa DATABASE_URL: katalog dibaca dari data seed (read-only) supaya
     situs tetap bisa dirender; operasi tulis melempar error NO_DB. */

let _sql = null;
let _initPromise = null;

export function hasDb() {
  return !!process.env.DATABASE_URL;
}

function getSql() {
  if (!hasDb()) return null;
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

function parseJson(v, fallback) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return v;
}

/* Kolom data bawaan untuk produk topup yang form_fields-nya kosong
   (mis. produk yang dibuat dari panel admin, yang belum punya editor
   kolom). Tanpa ini pembeli tidak dimintai User ID/UID sama sekali,
   jadi topup tidak bisa dikirim. */
function defaultTopupFields(row) {
  const g = `${row.game || ""} ${row.name || ""}`.toLowerCase();
  if (g.includes("mobile legends"))
    return [
      { key: "userId", label: "User ID", ph: "Contoh: 12345678", hint: "Lihat di profil game, di bawah avatar.", required: true },
      { key: "zoneId", label: "Zone ID (Server)", ph: "Contoh: 1234", hint: "Angka di dalam kurung setelah User ID.", required: true },
    ];
  if (g.includes("free fire"))
    return [
      { key: "playerId", label: "Player ID", ph: "Masukkan Player ID Free Fire", hint: "Buka profil di game untuk melihat Player ID.", required: true },
    ];
  if (g.includes("valorant"))
    return [
      { key: "riotId", label: "Riot ID", ph: "Nama Riot ID kamu", hint: "Contoh: RaiDigi", required: true },
      { key: "tag", label: "Tagline", ph: "Contoh: 1234", hint: "Angka setelah tanda # pada Riot ID.", required: true },
    ];
  if (g.includes("roblox"))
    return [
      { key: "username", label: "Username Roblox", ph: "Masukkan username Roblox kamu", hint: "Pastikan ejaan username benar. Kami tidak pernah meminta password.", required: true },
    ];
  return [
    { key: "userId", label: "User ID / Username", ph: "Masukkan User ID atau username akun game kamu", hint: "Pastikan data benar agar topup tidak salah kirim.", required: true },
  ];
}

export function normalizeProduct(row) {
  if (!row) return null;
  const parsedFields = parseJson(row.form_fields, []);
  const basePrice = Number(row.price) || 0;
  /* Normalisasi harga denominasi di satu-satunya jalur baca produk, supaya
     halaman produk, keranjang, dan checkout selalu memakai harga yang sama
     dengan daftar produk:
     - denom tanpa price (format lama {label, delta}) memakai harga produk + delta;
     - produk satu denominasi: harga denom selalu = harga produk, jadi harga
       tidak pernah basi sebelah bila salah satu kolom berubah;
     - produk banyak denominasi: harga produk = denominasi termurah
       (sesuai aturan form admin). */
  let denoms = parseJson(row.denoms, []).map((d) => {
    if (!d || typeof d !== "object") return d;
    let p = Number(d.price);
    if (!Number.isFinite(p)) p = basePrice + (Number(d.delta) || 0);
    return { ...d, price: p };
  });
  let price = basePrice;
  if (denoms.length === 1 && denoms[0] && typeof denoms[0] === "object") {
    denoms = [{ ...denoms[0], price: basePrice }];
  } else if (denoms.length > 1) {
    const prices = denoms
      .map((d) => (d && typeof d === "object" ? d.price : NaN))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (prices.length) price = Math.min(...prices);
  }
  return {
    ...row,
    price,
    compare_at_price: Number(row.compare_at_price || 0),
    stock: row.stock === null || row.stock === undefined ? null : Number(row.stock),
    specs: parseJson(row.specs, []),
    denoms,
    form_fields:
      row.type === "topup" && (!parsedFields || parsedFields.length === 0)
        ? defaultTopupFields(row)
        : parsedFields,
    tile: parseJson(row.tile, null),
    popular: !!row.popular,
    qty_allowed: !!row.qty_allowed,
    is_sample: !!row.is_sample,
    active: row.active !== false,
    supplier_sku: row.supplier_sku || "",
  };
}

function seedAsRows() {
  return SEED_PRODUCTS.map((p, i) => normalizeProduct({ ...p, id: i + 1, sort_order: i, active: true }));
}

export async function ensureDb() {
  const sql = getSql();
  if (!sql) return false;
  if (!_initPromise) {
    _initPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          slug TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          game TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL,
          category_label TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL,
          price INTEGER NOT NULL,
          compare_at_price INTEGER NOT NULL DEFAULT 0,
          stock INTEGER,
          image TEXT,
          image_alt TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          badge TEXT NOT NULL DEFAULT '',
          specs JSONB NOT NULL DEFAULT '[]',
          denoms JSONB NOT NULL DEFAULT '[]',
          form_fields JSONB NOT NULL DEFAULT '[]',
          tile JSONB,
          popular BOOLEAN NOT NULL DEFAULT false,
          qty_allowed BOOLEAN NOT NULL DEFAULT false,
          is_sample BOOLEAN NOT NULL DEFAULT false,
          active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id),
          buyer_name TEXT NOT NULL DEFAULT '',
          buyer_email TEXT NOT NULL DEFAULT '',
          buyer_phone TEXT NOT NULL DEFAULT '',
          subtotal INTEGER NOT NULL,
          service_fee INTEGER NOT NULL DEFAULT 1500,
          total INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'menunggu_pembayaran',
          bayar_invoice_id TEXT,
          qris_string TEXT,
          final_amount INTEGER,
          expires_at TIMESTAMPTZ,
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_sku TEXT NOT NULL DEFAULT ''`;
      await sql`
        CREATE TABLE IF NOT EXISTS promos (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '',
          tag TEXT NOT NULL DEFAULT '',
          image TEXT,
          product_slug TEXT NOT NULL DEFAULT '',
          cta TEXT NOT NULL DEFAULT 'Lihat Promo',
          active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id),
          product_name TEXT NOT NULL,
          variant_label TEXT NOT NULL DEFAULT '',
          unit_price INTEGER NOT NULL,
          qty INTEGER NOT NULL DEFAULT 1,
          form_data JSONB NOT NULL DEFAULT '{}'
        )`;
      await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS supplier_ref TEXT`;
      await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS supplier_status TEXT`;
      await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS supplier_sn TEXT`;
      await sql`
        CREATE TABLE IF NOT EXISTS itemku_product_map (
          id SERIAL PRIMARY KEY,
          itemku_product_id BIGINT UNIQUE NOT NULL,
          itemku_product_name TEXT NOT NULL DEFAULT '',
          product_id INTEGER REFERENCES products(id),
          variant_label TEXT NOT NULL DEFAULT '',
          sku TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS itemku_orders (
          id SERIAL PRIMARY KEY,
          itemku_order_id BIGINT UNIQUE NOT NULL,
          order_number TEXT NOT NULL DEFAULT '',
          itemku_product_id BIGINT,
          product_name TEXT NOT NULL DEFAULT '',
          required_information JSONB NOT NULL DEFAULT '{}',
          customer_no TEXT NOT NULL DEFAULT '',
          sku TEXT NOT NULL DEFAULT '',
          qty INTEGER NOT NULL DEFAULT 1,
          price INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'baru',
          supplier_ref TEXT,
          supplier_status TEXT,
          supplier_sn TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT NOT NULL DEFAULT '',
          raw JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM products`;
      if (count === 0) {
        for (let i = 0; i < SEED_PRODUCTS.length; i++) {
          const p = SEED_PRODUCTS[i];
          await sql`
            INSERT INTO products (slug, name, game, category, category_label, type, price, compare_at_price,
              stock, image, image_alt, description, badge, specs, denoms, form_fields, tile, popular,
              qty_allowed, is_sample, active, sort_order)
            VALUES (${p.slug}, ${p.name}, ${p.game}, ${p.category}, ${p.category_label}, ${p.type}, ${p.price},
              ${p.compare_at_price}, ${p.stock}, ${p.image}, ${p.image_alt || ""}, ${p.description}, ${p.category_label},
              ${JSON.stringify(p.specs)}, ${JSON.stringify(p.denoms)}, ${JSON.stringify(p.form_fields)},
              ${p.tile ? JSON.stringify(p.tile) : null}, ${p.popular}, ${p.qty_allowed}, ${p.is_sample}, true, ${i})
            ON CONFLICT (slug) DO NOTHING`;
        }
      }
      return true;
    })().catch((e) => {
      _initPromise = null;
      throw e;
    });
  }
  return _initPromise;
}

function noDbError() {
  const e = new Error("Database belum dikonfigurasi (DATABASE_URL kosong).");
  e.code = "NO_DB";
  return e;
}

/* ---------------- Products ---------------- */

export async function listProducts({ includeInactive = false } = {}) {
  const sql = getSql();
  if (!sql) {
    const rows = seedAsRows();
    return includeInactive ? rows : rows.filter((p) => p.active);
  }
  await ensureDb();
  const rows = includeInactive
    ? await sql`SELECT * FROM products ORDER BY sort_order ASC, id ASC`
    : await sql`SELECT * FROM products WHERE active = true ORDER BY sort_order ASC, id ASC`;
  return rows.map(normalizeProduct);
}

export async function getProductBySlug(slug) {
  const sql = getSql();
  if (!sql) return seedAsRows().find((p) => p.slug === slug) || null;
  await ensureDb();
  const rows = await sql`SELECT * FROM products WHERE slug = ${slug} LIMIT 1`;
  return rows.length ? normalizeProduct(rows[0]) : null;
}

export async function adminCreateProduct(p) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    INSERT INTO products (slug, name, game, category, category_label, type, price, compare_at_price,
      stock, image, image_alt, description, badge, specs, denoms, form_fields, tile, popular,
      qty_allowed, is_sample, active, sort_order, supplier_sku)
    VALUES (${p.slug}, ${p.name}, ${p.game || ""}, ${p.category}, ${p.category_label || ""}, ${p.type}, ${p.price},
      ${p.compare_at_price || 0}, ${p.stock}, ${p.image || null}, ${p.image_alt || ""}, ${p.description || ""},
      ${p.category_label || ""}, ${JSON.stringify(p.specs || [])}, ${JSON.stringify(p.denoms || [])},
      ${JSON.stringify(p.form_fields || [])}, ${p.tile ? JSON.stringify(p.tile) : null}, ${!!p.popular},
      ${!!p.qty_allowed}, ${!!p.is_sample}, ${p.active !== false}, ${p.sort_order || 0}, ${p.supplier_sku || ""})
    RETURNING *`;
  return normalizeProduct(rows[0]);
}

export async function adminUpdateProduct(id, p) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    UPDATE products SET
      name = ${p.name}, game = ${p.game || ""}, category = ${p.category}, category_label = ${p.category_label || ""},
      type = ${p.type}, price = ${p.price}, compare_at_price = ${p.compare_at_price || 0}, stock = ${p.stock},
      image = ${p.image || null}, image_alt = ${p.image_alt || ""}, description = ${p.description || ""},
      badge = ${p.category_label || ""}, specs = ${JSON.stringify(p.specs || [])},
      denoms = ${JSON.stringify(p.denoms || [])}, form_fields = ${JSON.stringify(p.form_fields || [])},
      tile = ${p.tile ? JSON.stringify(p.tile) : null}, popular = ${!!p.popular}, qty_allowed = ${!!p.qty_allowed},
      is_sample = ${!!p.is_sample}, active = ${p.active !== false}, sort_order = ${p.sort_order || 0},
      supplier_sku = ${p.supplier_sku || ""}, updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return rows.length ? normalizeProduct(rows[0]) : null;
}

export async function adminDeleteProduct(id) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`SELECT id, name FROM products WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return null;
  // Riwayat pesanan menyimpan nama & harga produk sebagai snapshot di
  // order_items, jadi referensi product_id aman dilepas sebelum produk
  // dihapus permanen — riwayat transaksi tidak rusak.
  await sql`UPDATE order_items SET product_id = NULL WHERE product_id = ${id}`;
  await sql`DELETE FROM products WHERE id = ${id}`;
  return rows[0];
}

/* ---------------- Promos ----------------
   Banner "Promo Terbaru" di beranda, dikelola dari panel admin.
   image boleh URL atau data URI (hasil unggahan admin); product_slug
   adalah tujuan klik banner di etalase. */

export function normalizePromo(row) {
  if (!row) return null;
  return {
    ...row,
    active: row.active !== false,
    sort_order: Number(row.sort_order || 0),
  };
}

export async function listPromos({ includeInactive = false } = {}) {
  const sql = getSql();
  if (!sql) return [];
  await ensureDb();
  const rows = includeInactive
    ? await sql`SELECT * FROM promos ORDER BY sort_order ASC, id ASC`
    : await sql`SELECT * FROM promos WHERE active = true ORDER BY sort_order ASC, id ASC`;
  return rows.map(normalizePromo);
}

export async function adminCreatePromo(p) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    INSERT INTO promos (title, tag, image, product_slug, cta, active, sort_order)
    VALUES (${p.title || ""}, ${p.tag || ""}, ${p.image || null}, ${p.product_slug}, ${p.cta || "Lihat Promo"},
      ${p.active !== false}, ${p.sort_order || 0})
    RETURNING *`;
  return normalizePromo(rows[0]);
}

export async function adminUpdatePromo(id, p) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    UPDATE promos SET
      title = ${p.title || ""}, tag = ${p.tag || ""}, image = ${p.image || null},
      product_slug = ${p.product_slug}, cta = ${p.cta || "Lihat Promo"},
      active = ${p.active !== false}, sort_order = ${p.sort_order || 0}, updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return rows.length ? normalizePromo(rows[0]) : null;
}

export async function adminDeletePromo(id) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`SELECT id, title FROM promos WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return null;
  await sql`DELETE FROM promos WHERE id = ${id}`;
  return rows[0];
}

/* ---------------- Users ---------------- */

export async function createUser({ name, email, passwordHash }) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    INSERT INTO users (name, email, password_hash) VALUES (${name}, ${email}, ${passwordHash})
    RETURNING id, name, email, created_at`;
  return rows[0];
}

export async function findUserByEmail(email) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  return rows.length ? rows[0] : null;
}

/* ---------------- Orders ---------------- */

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "RDG-" + s;
}

export async function createOrderWithItems(order, items) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode();
    try {
      const rows = await sql`
        INSERT INTO orders (code, user_id, buyer_name, buyer_email, buyer_phone, subtotal, service_fee, total, status)
        VALUES (${code}, ${order.user_id}, ${order.buyer_name}, ${order.buyer_email}, ${order.buyer_phone},
          ${order.subtotal}, ${order.service_fee}, ${order.total}, 'menunggu_pembayaran')
        RETURNING *`;
      const saved = rows[0];
      for (const it of items) {
        await sql`
          INSERT INTO order_items (order_id, product_id, product_name, variant_label, unit_price, qty, form_data)
          VALUES (${saved.id}, ${it.product_id}, ${it.product_name}, ${it.variant_label}, ${it.unit_price},
            ${it.qty}, ${JSON.stringify(it.form_data || {})})`;
      }
      return await getOrderByCode(code);
    } catch (e) {
      if (e && (e.code === "23505" || String(e.message || "").includes("orders_code"))) { lastErr = e; continue; }
      throw e;
    }
  }
  throw lastErr || new Error("Gagal membuat kode pesanan unik.");
}

export function normalizeOrder(row, items) {
  if (!row) return null;
  return {
    ...row,
    subtotal: Number(row.subtotal),
    service_fee: Number(row.service_fee),
    total: Number(row.total),
    final_amount: row.final_amount === null || row.final_amount === undefined ? null : Number(row.final_amount),
    items: (items || []).map((it) => ({
      ...it,
      unit_price: Number(it.unit_price),
      qty: Number(it.qty),
      form_data: parseJson(it.form_data, {}),
    })),
  };
}

export async function getOrderByCode(code) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`SELECT * FROM orders WHERE code = ${code} LIMIT 1`;
  if (!rows.length) return null;
  const items = await sql`SELECT * FROM order_items WHERE order_id = ${rows[0].id} ORDER BY id ASC`;
  return normalizeOrder(rows[0], items);
}

export async function getOrderByInvoice(invoiceId) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`SELECT * FROM orders WHERE bayar_invoice_id = ${invoiceId} LIMIT 1`;
  if (!rows.length) return null;
  const items = await sql`SELECT * FROM order_items WHERE order_id = ${rows[0].id} ORDER BY id ASC`;
  return normalizeOrder(rows[0], items);
}

export async function getOrdersByUser(userId) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`;
  const out = [];
  for (const r of rows) {
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${r.id} ORDER BY id ASC`;
    out.push(normalizeOrder(r, items));
  }
  return out;
}

export async function adminListOrders() {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`;
  const out = [];
  for (const r of rows) {
    const items = await sql`SELECT * FROM order_items WHERE order_id = ${r.id} ORDER BY id ASC`;
    out.push(normalizeOrder(r, items));
  }
  return out;
}

export async function attachInvoice(orderId, { invoiceId, qrisString, finalAmount, expiresAt }) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  await sql`
    UPDATE orders SET bayar_invoice_id = ${invoiceId}, qris_string = ${qrisString},
      final_amount = ${finalAmount}, expires_at = ${expiresAt}, updated_at = now()
    WHERE id = ${orderId}`;
}

/* Transisi idempoten menunggu_pembayaran -> dibayar.
   UPDATE bersyarat memastikan stok hanya berkurang tepat satu kali. */
export async function markOrderPaidIfPending(orderId) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    UPDATE orders SET status = 'dibayar', paid_at = now(), updated_at = now()
    WHERE id = ${orderId} AND status = 'menunggu_pembayaran'
    RETURNING id`;
  if (!rows.length) return false;
  const items = await sql`SELECT * FROM order_items WHERE order_id = ${orderId}`;
  for (const it of items) {
    if (it.product_id) {
      await sql`UPDATE products SET stock = stock - ${it.qty}, updated_at = now()
                 WHERE id = ${it.product_id} AND stock IS NOT NULL`;
    }
  }
  return true;
}

export async function expireOrderIfPending(orderId) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    UPDATE orders SET status = 'kedaluwarsa', updated_at = now()
    WHERE id = ${orderId} AND status = 'menunggu_pembayaran'
    RETURNING id`;
  return rows.length > 0;
}

export async function setOrderStatus(orderId, status) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${orderId} RETURNING id`;
  return rows.length > 0;
}

/* ---------------- Fulfillment otomatis (Digiflazz) ----------------
   Item pesanan yang produknya punya supplier_sku dikirim otomatis ke
   Digiflazz begitu pesanan dibayar. supplier_ref adalah ref_id unik
   per item ("<kode pesanan>-<id item>") dan menjadi jangkar idempotensi:
   item yang sudah punya supplier_ref tidak pernah dikirim ulang. */

export async function getFulfillmentItems(orderId) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    SELECT oi.id AS item_id, oi.product_id, oi.product_name, oi.qty, oi.form_data,
      oi.variant_label, oi.supplier_ref, oi.supplier_status, oi.supplier_sn,
      p.supplier_sku, p.denoms
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId}
    ORDER BY oi.id ASC`;
  return rows.map((r) => {
    /* SKU efektif per item: denominasi yang dipilih pembeli dapat membawa
       SKU Digiflazz sendiri (produk gabungan "Produk > Jumlah"); bila
       denominasi tidak punya SKU, pakai SKU level produk seperti semula. */
    const denoms = parseJson(r.denoms, []);
    const denom = Array.isArray(denoms)
      ? denoms.find((d) => d && d.label === r.variant_label)
      : null;
    const { denoms: _denoms, ...rest } = r;
    return {
      ...rest,
      supplier_sku: (denom && denom.sku) || r.supplier_sku || "",
      form_data: parseJson(r.form_data, {}),
    };
  });
}

/* Klaim satu item untuk dikirim (hanya berhasil bila belum pernah
   diklaim) — mencegah pengiriman ganda saat webhook & polling balapan. */
export async function claimItemSupplierRef(itemId, ref) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    UPDATE order_items SET supplier_ref = ${ref}, supplier_status = 'Mengirim'
    WHERE id = ${itemId} AND supplier_ref IS NULL
    RETURNING id`;
  return rows.length > 0;
}

export async function setItemSupplierResult(itemId, { status, sn }) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  await sql`
    UPDATE order_items SET supplier_status = ${status}, supplier_sn = ${sn || null}
    WHERE id = ${itemId}`;
}

export async function getItemBySupplierRef(ref) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    SELECT oi.id AS item_id, oi.order_id, oi.form_data, oi.supplier_status, oi.supplier_sn,
      p.supplier_sku, o.code AS order_code, o.status AS order_status
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.supplier_ref = ${ref}
    LIMIT 1`;
  if (!rows.length) return null;
  return { ...rows[0], form_data: parseJson(rows[0].form_data, {}) };
}

/* Ubah status pesanan hanya dari status tertentu (transisi bersyarat,
   aman dari balapan webhook/polling/admin). */
export async function setOrderStatusIf(orderId, from, to) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    UPDATE orders SET status = ${to}, updated_at = now()
    WHERE id = ${orderId} AND status = ${from}
    RETURNING id`;
  return rows.length > 0;
}

/* ===== Itemku (Tokoku Open API) — kanal penjualan marketplace =====
   Pemetaan produk Itemku → SKU Digiflazz dan jurnal order Itemku yang
   diproses sistem. Order Itemku TIDAK masuk tabel orders (itu pesanan
   situs sendiri); fulfillment-nya menumpang mesin Digiflazz yang sama. */

export async function listItemkuMap() {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  return sql`
    SELECT m.*, p.slug AS product_slug, p.name AS product_name_rai
    FROM itemku_product_map m
    LEFT JOIN products p ON p.id = m.product_id
    ORDER BY m.id ASC`;
}

export async function upsertItemkuMap({ itemku_product_id, itemku_product_name, product_id, variant_label, sku, active }) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    INSERT INTO itemku_product_map (itemku_product_id, itemku_product_name, product_id, variant_label, sku, active)
    VALUES (${Number(itemku_product_id)}, ${itemku_product_name || ""}, ${product_id ? Number(product_id) : null},
      ${variant_label || ""}, ${sku || ""}, ${active !== false})
    ON CONFLICT (itemku_product_id) DO UPDATE SET
      itemku_product_name = EXCLUDED.itemku_product_name,
      product_id = EXCLUDED.product_id,
      variant_label = EXCLUDED.variant_label,
      sku = EXCLUDED.sku,
      active = EXCLUDED.active,
      updated_at = now()
    RETURNING *`;
  return rows[0];
}

/* SKU Digiflazz efektif untuk satu produk Itemku: SKU eksplisit di
   pemetaan menang; kalau kosong, turunkan dari produk RaiDigi tertaut
   (SKU denominasi sesuai variant_label, lalu SKU level produk). */
export async function resolveItemkuSku(itemkuProductId) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    SELECT m.sku AS map_sku, m.variant_label, p.supplier_sku, p.denoms
    FROM itemku_product_map m
    LEFT JOIN products p ON p.id = m.product_id
    WHERE m.itemku_product_id = ${Number(itemkuProductId)} AND m.active = true
    LIMIT 1`;
  if (!rows.length) return "";
  const r = rows[0];
  if (r.map_sku) return r.map_sku;
  const denoms = parseJson(r.denoms, []);
  const denom = Array.isArray(denoms)
    ? denoms.find((d) => d && d.label === r.variant_label)
    : null;
  return (denom && denom.sku) || r.supplier_sku || "";
}

/* Klaim satu order Itemku untuk diproses (unik per itemku_order_id —
   callback dan polling yang balapan tidak memproses dua kali).
   Mengembalikan baris baru, atau null bila order sudah pernah diklaim. */
export async function claimItemkuOrder(o) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    INSERT INTO itemku_orders (itemku_order_id, order_number, itemku_product_id, product_name,
      required_information, qty, price, status, raw)
    VALUES (${Number(o.order_id)}, ${o.order_number || ""}, ${o.product_id ? Number(o.product_id) : null},
      ${o.product_name || ""}, ${JSON.stringify(o.required_information || {})},
      ${Math.max(1, Number(o.quantity || o.qty || 1))}, ${Number(o.price || 0)}, 'baru',
      ${JSON.stringify(o.raw || o)})
    ON CONFLICT (itemku_order_id) DO NOTHING
    RETURNING *`;
  return rows.length ? rows[0] : null;
}

export async function getItemkuOrder(itemkuOrderId) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const rows = await sql`
    SELECT * FROM itemku_orders WHERE itemku_order_id = ${Number(itemkuOrderId)} LIMIT 1`;
  return rows.length ? rows[0] : null;
}

export async function updateItemkuOrder(id, fields) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  const allowed = ["status", "customer_no", "sku", "supplier_ref", "supplier_status", "supplier_sn", "attempts", "last_error"];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      sets.push(`${k} = $${sets.length + 1}`);
      vals.push(fields[k]);
    }
  }
  if (!sets.length) return null;
  const rows = await sql.query(
    `UPDATE itemku_orders SET ${sets.join(", ")}, updated_at = now() WHERE id = $${sets.length + 1} RETURNING *`,
    [...vals, id]
  );
  return rows.length ? rows[0] : null;
}

export async function listItemkuOrdersByStatus(statuses) {
  const sql = getSql();
  if (!sql) throw noDbError();
  await ensureDb();
  return sql`
    SELECT * FROM itemku_orders WHERE status = ANY(${statuses}) ORDER BY id ASC LIMIT 50`;
}
