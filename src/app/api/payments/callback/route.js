import { NextResponse } from "next/server";
import { getOrderByInvoice } from "../../../../lib/db";
import { syncOrderPayment } from "../../../../lib/verify";

export const dynamic = "force-dynamic";

/* POST /api/payments/callback — webhook Bayar.gg.
 *
 * Isi webhook TIDAK pernah dipercaya langsung. Handler ini hanya memakai
 * invoice_id dari webhook sebagai pemicu, lalu memverifikasi status asli
 * lewat GET /api/check-payment.php (disebut di lib/verify.js) sebelum ada
 * status yang berubah menjadi dibayar.
 *
 * Hook verifikasi tanda tangan (opsional, untuk penguatan berikutnya):
 * Bayar.gg menandatangani callback dengan HMAC-SHA256 atas gabungan
 * invoice_id + status + final_amount + timestamp memakai webhook secret
 * yang terpisah dari API key. Bila BAYAR_GG_WEBHOOK_SECRET sudah diisi,
 * aktifkan pemeriksaan seperti contoh di bawah ini:
 *
 *   import crypto from "crypto";
 *   const secret = process.env.BAYAR_GG_WEBHOOK_SECRET;
 *   if (secret) {
 *     const signature = req.headers.get("x-signature") || "";
 *     const signed = `${invoiceId}${status}${finalAmount}${timestamp}`;
 *     const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
 *     const a = Buffer.from(signature);
 *     const b = Buffer.from(expected);
 *     if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
 *       return NextResponse.json({ success: false }, { status: 401 });
 *     }
 *   }
 */
export async function POST(req) {
  let invoiceId = null;
  try {
    const text = await req.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }
    invoiceId =
      body?.invoice_id || body?.invoice || body?.data?.invoice_id || body?.data?.invoice || null;
  } catch {
    invoiceId = null;
  }

  if (invoiceId) {
    try {
      const order = await getOrderByInvoice(String(invoiceId));
      if (order) await syncOrderPayment(order);
    } catch {
      // Tetap balas 200 agar gateway tidak mengulang tanpa henti;
      // polling halaman pembayaran akan menyinkronkan status kemudian.
    }
  }
  return NextResponse.json({ success: true });
}
