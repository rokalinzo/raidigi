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

export function normalizeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    price: Number(row.price),
    compare_at_price: Number(row.compare_at_price || 0),
    stock: row.stock === null || row.stock === undefined ? null : Number(row.stock),
    specs: parseJson(row.specs, []),
    denoms: parseJson(row.denoms, []),
    form_fields: parseJson(row.form_fields, []),
    tile: parseJson(row.tile, null),
    popular: !!row.popular,
    qty_allowed: !!row.qty_allowed,
    is_sample: !!row.is_sample,
    active: row.active !== false,
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
      qty_allowed, is_sample, active, sort_order)
    VALUES (${p.slug}, ${p.name}, ${p.game || ""}, ${p.category}, ${p.category_label || ""}, ${p.type}, ${p.price},
      ${p.compare_at_price || 0}, ${p.stock}, ${p.image || null}, ${p.image_alt || ""}, ${p.description || ""},
      ${p.category_label || ""}, ${JSON.stringify(p.specs || [])}, ${JSON.stringify(p.denoms || [])},
      ${JSON.stringify(p.form_fields || [])}, ${p.tile ? JSON.stringify(p.tile) : null}, ${!!p.popular},
      ${!!p.qty_allowed}, ${!!p.is_sample}, ${p.active !== false}, ${p.sort_order || 0})
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
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`;
  return rows.length ? normalizeProduct(rows[0]) : null;
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
