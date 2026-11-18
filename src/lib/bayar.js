/* Integrasi Bayar.gg (QRIS Admin).
   API key hanya dibaca di server dari env BAYAR_GG_API_KEY dan tidak pernah
   dikirim ke klien. Tanpa key, fungsi pembayaran gagal secara anggun dengan
   pesan yang jelas — tidak melempar error mentah. */

const API_BASE = "https://www.bayar.gg/api";

export function bayarConfigured() {
  return !!process.env.BAYAR_GG_API_KEY;
}

export function appUrl() {
  const raw = process.env.APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

function parseBayarDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  const d2 = new Date(String(value).replace(" ", "T"));
  if (!Number.isNaN(d2.getTime())) return d2;
  return null;
}

/* Buat pembayaran QRIS untuk satu pesanan.
   Return: { ok:true, invoiceId, qrisString, finalAmount, expiresAt, paymentUrl }
           { ok:false, reason, message } */
export async function createPayment({ amount, description, customer }) {
  if (!bayarConfigured()) {
    return {
      ok: false,
      reason: "no_key",
      message:
        "Pembayaran belum dikonfigurasi di server (BAYAR_GG_API_KEY kosong). Pesananmu tersimpan — hubungi admin untuk menyelesaikan pembayaran.",
    };
  }
  let res;
  try {
    res = await fetch(`${API_BASE}/create-payment.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.BAYAR_GG_API_KEY,
      },
      body: JSON.stringify({
        amount,
        description,
        payment_url: "https://www.bayar.gg/pay",
        payment_method: "qris",
        callback_url: `${appUrl()}/api/payments/callback`,
        redirect_url: `${appUrl()}/transaksi`,
        customer_name: customer?.name || "",
        customer_email: customer?.email || "",
        customer_phone: customer?.phone || "",
      }),
    });
  } catch (e) {
    return { ok: false, reason: "network", message: "Tidak dapat menghubungi gateway pembayaran. Coba lagi sebentar lagi." };
  }
  let json = null;
  try { json = await res.json(); } catch { /* abaikan */ }
  const d = (json && (json.data || json)) || {};
  const invoiceId = d.invoice_id || d.invoice || null;
  if (!res.ok || !invoiceId) {
    return {
      ok: false,
      reason: "api_error",
      message:
        (json && (json.message || json.error)) ||
        "Gateway pembayaran menolak permintaan. Pesananmu tersimpan — coba lagi atau hubungi admin.",
    };
  }
  const expires = parseBayarDate(d.expires_at) || new Date(Date.now() + 2 * 60 * 60 * 1000);
  return {
    ok: true,
    invoiceId,
    qrisString: d.qris_string || "",
    // Bayar.gg dapat menambah nominal di atas amount yang diminta
    // (terverifikasi: amount 5000 -> final_amount 5150). Selalu pakai final_amount.
    finalAmount: d.final_amount !== undefined && d.final_amount !== null ? Number(d.final_amount) : amount,
    expiresAt: expires.toISOString(),
    paymentUrl: d.payment_url || null,
  };
}

/* Cek status pembayaran langsung ke Bayar.gg (sumber kebenaran status).
   Return: { ok:true, status, finalAmount, paidAt } | { ok:false, reason, message } */
export async function checkPayment(invoiceId) {
  if (!bayarConfigured()) {
    return { ok: false, reason: "no_key", message: "BAYAR_GG_API_KEY belum dikonfigurasi." };
  }
  let res;
  try {
    res = await fetch(`${API_BASE}/check-payment.php?invoice=${encodeURIComponent(invoiceId)}`, {
      method: "GET",
      headers: { "X-API-Key": process.env.BAYAR_GG_API_KEY },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: "network", message: "Tidak dapat menghubungi gateway pembayaran." };
  }
  let json = null;
  try { json = await res.json(); } catch { /* abaikan */ }
  const d = (json && (json.data || json)) || {};
  const status = String(d.status || "").toLowerCase();
  if (!res.ok || !status) {
    return { ok: false, reason: "api_error", message: (json && (json.message || json.error)) || "Gagal memeriksa status pembayaran." };
  }
  return {
    ok: true,
    status,
    finalAmount: d.final_amount !== undefined && d.final_amount !== null ? Number(d.final_amount) : null,
    paidAt: d.paid_at || null,
  };
}
