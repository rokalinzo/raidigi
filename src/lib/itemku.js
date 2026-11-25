import crypto from "crypto";

/* Integrasi Itemku / Tokoku Open API (kanal penjualan marketplace) —
   berdasarkan "Tokoku API Documentation" resmi itemku (salinan Des 2023 /
   Mei 2024; halaman FAQ aslinya sudah tidak ada):
   - Base produksi: https://tokoku-gateway.itemku.com — semua POST JSON.
   - Endpoint: /api/order/list (daftar order), /api/order/action
     (DELIVER/REJECT order), /api/product/price/update (ubah harga).
   - Autentikasi: API Key + Secret Key yang DIKIRIM VIA EMAIL setelah
     permintaan akses lewat dashboard Tokoku disetujui itemku (tidak ada
     tombol generate mandiri). Setiap request membawa header:
       X-Api-Key, Nonce (timestamp), Content-Type: application/json,
       Authorization: Bearer <JWT HS256>
     JWT: header {"alg":"HS256","X-Api-Key":..,"Nonce":..}, payload = persis
     parameter body request, signature = HMAC-SHA256(secret). Body yang
     berbeda dari payload token ditolak (401).
   - API hanya menerima request dari IP terdaftar → di produksi,
     ITEMKU_API_BASE diarahkan ke relay ber-IP statis (VPS yang sama
     dengan relay Digiflazz) dan header x-relay-key dikirim dari
     ITEMKU_RELAY_KEY (atau DIGIFLAZZ_RELAY_KEY bila itu yang diisi).
   Kredensial hanya dibaca dari env server; tanpa keduanya modul ini
   nonaktif secara anggun (pola yang sama dengan digiflazz.js). */

const apiBase = () =>
  (process.env.ITEMKU_API_BASE || "https://tokoku-gateway.itemku.com").replace(/\/+$/, "");
const apiKey = () => process.env.ITEMKU_API_KEY || "";
const apiSecret = () => process.env.ITEMKU_API_SECRET || "";

export function itemkuConfigured() {
  return !!(apiKey() && apiSecret());
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/* Parameter dikirim apa adanya sebagai body JSON dan payload JWT harus
   identik dengannya; nilai string di-trim sesuai dokumentasi. */
function cleanParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function authToken(params, nonce) {
  const header = { alg: "HS256", "X-Api-Key": apiKey(), Nonce: nonce };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(params))}`;
  const sig = crypto.createHmac("sha256", apiSecret()).update(unsigned).digest();
  return `${unsigned}.${b64url(sig)}`;
}

async function post(path, params) {
  if (!itemkuConfigured()) {
    return { ok: false, reason: "no_key", message: "Itemku belum dikonfigurasi di server (ITEMKU_API_KEY / ITEMKU_API_SECRET kosong)." };
  }
  const body = cleanParams(params);
  const nonce = String(Date.now());
  const headers = {
    "Content-Type": "application/json",
    "X-Api-Key": apiKey(),
    Nonce: nonce,
    Authorization: `Bearer ${authToken(body, nonce)}`,
  };
  const relayKey = process.env.ITEMKU_RELAY_KEY || process.env.DIGIFLAZZ_RELAY_KEY || "";
  if (process.env.ITEMKU_API_BASE && relayKey) headers["x-relay-key"] = relayKey;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res, text;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    text = await res.text();
  } catch {
    return { ok: false, reason: "network", message: "Tidak dapat menghubungi Itemku." };
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* respons non-JSON diteruskan apa adanya lewat field raw */
  }
  return { ok: res.status >= 200 && res.status < 300, httpStatus: res.status, data: json, raw: text };
}

/* Daftar order toko. date_start wajib (YYYY-MM-DD, maks 60 hari ke
   belakang); order_status salah satu REQUIRE_PROCESS | DELIVERED |
   REFUNDED; limit 1–30 (bawaan 10). */
export async function listOrders({ dateStart, orderId, orderStatus, limit } = {}) {
  const params = { date_start: dateStart };
  if (orderId) params.order_id = Number(orderId);
  if (orderStatus) params.order_status = orderStatus;
  if (limit) params.limit = Math.min(30, Math.max(1, Number(limit)));
  const r = await post("/api/order/list", params);
  if (!r.ok) return { ...r, orders: [] };
  const arr =
    (Array.isArray(r.data) && r.data) ||
    (r.data && Array.isArray(r.data.data) && r.data.data) ||
    (r.data && Array.isArray(r.data.orders) && r.data.orders) ||
    [];
  return { ...r, orders: arr };
}

/* Ambil satu order spesifik (untuk verifikasi callback sesuai anjuran
   dokumentasi: jangan percaya payload callback, cek ulang lewat API). */
export async function getOrder(orderId) {
  const today = new Date();
  const past = new Date(today.getTime() - 59 * 24 * 3600 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const r = await listOrders({ dateStart: fmt(past), orderId, limit: 1 });
  if (!r.ok) return null;
  return r.orders.find((o) => String(o.order_id) === String(orderId)) || null;
}

/* DELIVER atau REJECT satu order. Untuk produk topup (ML/FF,
   using_delivery_info=false) delivery_info tidak perlu dikirim.
   refund_reason wajib saat REJECT: NO_STOCK | WRONG_BUYER_INFORMATION |
   SERVER_ERROR | PRICE_CHANGED. */
export async function orderAction({ orderId, action, deliveryInfo, refundReason }) {
  const params = { order_id: Number(orderId), action };
  if (action === "DELIVER" && Array.isArray(deliveryInfo) && deliveryInfo.length) {
    params.delivery_info = deliveryInfo;
  }
  if (action === "REJECT" && refundReason) params.refund_reason = refundReason;
  return post("/api/order/action", params);
}

/* Ubah harga produk (new_price kelipatan 100; ada batas jumlah perubahan
   per hari dari itemku). */
export async function updatePrice({ productId, newPrice }) {
  return post("/api/product/price/update", {
    product_id: Number(productId),
    new_price: Number(newPrice),
  });
}
