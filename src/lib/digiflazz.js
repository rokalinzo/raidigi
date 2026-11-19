import crypto from "crypto";

/* Integrasi Digiflazz (supplier B2B topup) — sesuai dokumentasi resmi
   developer.digiflazz.com:
   - Semua endpoint POST JSON ke https://api.digiflazz.com/v1.
   - Transaksi: POST /transaction, sign = md5(username + apiKey + ref_id).
     Transaksi sinkron: respons langsung berisi status Sukses/Gagal/Pending.
     Status Pending bisa dicek ulang dengan mengulang transaksi ref_id sama.
   - Daftar harga: POST /price-list, sign = md5(username + apiKey + "pricelist").
   - Cek saldo: POST /cek-saldo {cmd:"deposit"}, sign = md5(username + apiKey + "depo").
   - Webhook: header X-Hub-Signature = "sha1=" + HMAC-SHA1(body mentah, webhook secret).
   Kredensial hanya dibaca di server dari env dan tidak pernah dikirim ke
   klien. Tanpa kredensial, semua fungsi gagal secara anggun.
   DIGIFLAZZ_API_BASE dapat dioverride (mis. relay ber-IP statis, karena
   Digiflazz mewajibkan whitelist IP server pengirim). */

const apiBase = () => (process.env.DIGIFLAZZ_API_BASE || "https://api.digiflazz.com/v1").replace(/\/+$/, "");
const username = () => process.env.DIGIFLAZZ_USERNAME || "";
const apiKey = () => process.env.DIGIFLAZZ_API_KEY || "";

export function digiflazzConfigured() {
  return !!(username() && apiKey());
}

export function digiflazzTesting() {
  return process.env.DIGIFLAZZ_TESTING === "true";
}

function md5(s) {
  return crypto.createHash("md5").update(s).digest("hex");
}

async function post(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    return { res, json };
  } finally {
    clearTimeout(timer);
  }
}

/* Buat transaksi topup. Idempoten di sisi Digiflazz lewat ref_id:
   mengulang ref_id yang sama mengembalikan transaksi yang sudah ada.
   Return: { ok:true, status, rc, sn, message, price, saldo }
           { ok:false, reason, message } */
export async function createTransaction({ sku, customerNo, refId }) {
  if (!digiflazzConfigured()) {
    return { ok: false, reason: "no_key", message: "Digiflazz belum dikonfigurasi di server (DIGIFLAZZ_USERNAME / DIGIFLAZZ_API_KEY kosong)." };
  }
  const body = {
    username: username(),
    buyer_sku_code: sku,
    customer_no: customerNo,
    ref_id: refId,
    sign: md5(username() + apiKey() + refId),
  };
  if (digiflazzTesting()) body.testing = true;
  let out;
  try {
    out = await post("/transaction", body);
  } catch {
    return { ok: false, reason: "network", message: "Tidak dapat menghubungi Digiflazz." };
  }
  const d = out.json && out.json.data;
  if (!d || !d.status) {
    return {
      ok: false,
      reason: "api_error",
      message: (out.json && (out.json.message || out.json.error)) || "Digiflazz menolak permintaan transaksi.",
    };
  }
  return {
    ok: true,
    status: String(d.status),
    rc: d.rc !== undefined ? String(d.rc) : "",
    sn: d.sn ? String(d.sn) : null,
    message: d.message ? String(d.message) : "",
    price: d.price !== undefined ? Number(d.price) : null,
    saldo: d.buyer_last_saldo !== undefined ? Number(d.buyer_last_saldo) : null,
  };
}

/* Sisa deposit Digiflazz. Return: { ok:true, deposit } | { ok:false, ... } */
export async function checkBalance() {
  if (!digiflazzConfigured()) {
    return { ok: false, reason: "no_key", message: "Digiflazz belum dikonfigurasi di server." };
  }
  let out;
  try {
    out = await post("/cek-saldo", {
      cmd: "deposit",
      username: username(),
      sign: md5(username() + apiKey() + "depo"),
    });
  } catch {
    return { ok: false, reason: "network", message: "Tidak dapat menghubungi Digiflazz." };
  }
  const d = out.json && out.json.data;
  if (!d || d.deposit === undefined) {
    return { ok: false, reason: "api_error", message: (out.json && out.json.message) || "Gagal memeriksa saldo Digiflazz." };
  }
  return { ok: true, deposit: Number(d.deposit) };
}

/* Verifikasi tanda tangan webhook Digiflazz:
   X-Hub-Signature = "sha1=" + HMAC-SHA1(body mentah, secret). */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.DIGIFLAZZ_WEBHOOK_SECRET || "";
  if (!secret || !signatureHeader) return false;
  const expected = "sha1=" + crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
  const a = Buffer.from(String(signatureHeader));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function webhookSecretConfigured() {
  return !!process.env.DIGIFLAZZ_WEBHOOK_SECRET;
}
