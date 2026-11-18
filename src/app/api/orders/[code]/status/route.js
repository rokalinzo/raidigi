import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getOrderByCode } from "../../../../../lib/db";
import { syncOrderPayment } from "../../../../../lib/verify";

export const dynamic = "force-dynamic";

/* GET /api/orders/[code]/status — dipolling halaman pembayaran.
   Setiap panggilan memverifikasi ulang ke Bayar.gg dari server sebelum
   status pesanan boleh berubah menjadi dibayar. */
export async function GET(req, { params }) {
  const { code } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  try {
    let order = await getOrderByCode(code);
    if (!order || order.user_id !== user.id)
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    order = await syncOrderPayment(order);
    return NextResponse.json({
      order: {
        code: order.code,
        status: order.status,
        total: order.total,
        final_amount: order.final_amount,
        expires_at: order.expires_at,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Gagal memeriksa status pesanan." }, { status: 500 });
  }
}
