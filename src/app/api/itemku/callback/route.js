import { NextResponse } from "next/server";
import { itemkuConfigured } from "../../../../lib/itemku";
import { handleItemkuCallbackOrder } from "../../../../lib/itemku-fulfill";

export const dynamic = "force-dynamic";

/* POST /api/itemku/callback — Order Callback dari Itemku (notifikasi
 * order lunas). Sesuai dokumentasi Itemku:
 * - Header X-itemku berisi shop_id pengirim; bila ITEMKU_SHOP_ID diisi
 *   di env, header wajib cocok.
 * - Payload TIDAK dipercaya: status resmi order dicek ulang lewat
 *   /api/order/list sebelum diproses.
 * - Respons kami diabaikan Itemku dan callback yang error TIDAK
 *   diulang — polling /api/itemku/poll adalah cadangannya.
 * Catatan: Itemku meminta verifikasi kepemilikan domain via DNS TXT
 * "v-api-itemku-<SHOPNAME>=1" sebelum menerima URL callback; selama
 * domain masih subdomain vercel.app, callback mungkin belum aktif dan
 * polling yang bekerja. */
export async function POST(req) {
  try {
    if (!itemkuConfigured()) return NextResponse.json({ success: true });
    const shopId = process.env.ITEMKU_SHOP_ID || "";
    if (shopId) {
      const from = req.headers.get("x-itemku") || "";
      if (from !== shopId) return NextResponse.json({ success: true });
    }
    const body = await req.json().catch(() => null);
    const orderId = body && (body.order_id || body.orderId);
    if (!orderId) return NextResponse.json({ success: true });
    await handleItemkuCallbackOrder(orderId);
  } catch {
    // Tetap 200: Itemku mengabaikan respons dan tidak mengulang.
  }
  return NextResponse.json({ success: true });
}
