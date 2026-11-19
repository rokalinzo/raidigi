import { NextResponse } from "next/server";
import { getItemBySupplierRef, setItemSupplierResult } from "../../../../lib/db";
import {
  digiflazzConfigured,
  createTransaction,
  verifyWebhookSignature,
  webhookSecretConfigured,
} from "../../../../lib/digiflazz";
import { buildCustomerNo, maybeCompleteOrder } from "../../../../lib/fulfill";

export const dynamic = "force-dynamic";

/* POST /api/digiflazz/callback — webhook Digiflazz (event create/update).
 *
 * Kepercayaan berlapis:
 * - Bila DIGIFLAZZ_WEBHOOK_SECRET diisi, tanda tangan X-Hub-Signature
 *   (HMAC-SHA1 atas body mentah) wajib valid; payload lalu dipercaya.
 * - Bila secret belum diisi, payload TIDAK dipercaya: status resmi dicek
 *   ulang lewat API dengan mengulang transaksi ref_id yang sama
 *   (mekanisme recheck resmi Digiflazz untuk transaksi Pending).
 * Event ping (tanpa data.ref_id) dijawab 200 tanpa aksi. */
export async function POST(req) {
  const raw = await req.text();
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: true });
  }
  const data = body && body.data;
  if (!data || !data.ref_id) return NextResponse.json({ success: true });

  try {
    const item = await getItemBySupplierRef(String(data.ref_id));
    if (!item) return NextResponse.json({ success: true });

    if (webhookSecretConfigured()) {
      const sig = req.headers.get("x-hub-signature") || "";
      if (!verifyWebhookSignature(raw, sig)) {
        return NextResponse.json({ success: false }, { status: 401 });
      }
      await setItemSupplierResult(item.item_id, {
        status: String(data.status || item.supplier_status || ""),
        sn: data.sn ? String(data.sn) : item.supplier_sn,
      });
    } else if (digiflazzConfigured() && item.supplier_sku) {
      const r = await createTransaction({
        sku: item.supplier_sku,
        customerNo: buildCustomerNo(item.form_data),
        refId: String(data.ref_id),
      });
      if (r.ok) {
        await setItemSupplierResult(item.item_id, { status: r.status, sn: r.sn || item.supplier_sn });
      }
    } else {
      // Tidak ada secret dan API tidak terkonfigurasi: tidak ada cara
      // memverifikasi — payload diabaikan demi keamanan.
      return NextResponse.json({ success: true });
    }
    await maybeCompleteOrder(item.order_id);
  } catch {
    // Tetap 200 agar Digiflazz tidak mengulang tanpa henti; status item
    // akan terkoreksi oleh webhook berikutnya atau recheck manual.
  }
  return NextResponse.json({ success: true });
}
