import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { getOrderByCode } from "../../../../lib/db";
import { digiflazzConfigured } from "../../../../lib/digiflazz";
import { fulfillOrder, recheckOrder } from "../../../../lib/fulfill";

export const dynamic = "force-dynamic";

/* POST /api/admin/fulfill {code} — picu/cek ulang pengiriman otomatis
   Digiflazz untuk satu pesanan yang sudah dibayar. Mengirim item yang
   belum terkirim dan mengecek ulang yang Pending/Error, selalu dengan
   ref_id yang sama (idempoten). */
export async function POST(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  if (!digiflazzConfigured())
    return NextResponse.json(
      { error: "Digiflazz belum dikonfigurasi di server (DIGIFLAZZ_USERNAME / DIGIFLAZZ_API_KEY kosong)." },
      { status: 503 }
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const code = String(body.code || "").trim();
  if (!code) return NextResponse.json({ error: "Kode pesanan wajib diisi." }, { status: 422 });
  try {
    const order = await getOrderByCode(code);
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    if (!["dibayar", "diproses"].includes(order.status))
      return NextResponse.json(
        { error: `Pesanan berstatus "${order.status}" — pengiriman otomatis hanya untuk pesanan yang sudah dibayar.` },
        { status: 422 }
      );
    await fulfillOrder(order);
    await recheckOrder(order);
    const fresh = await getOrderByCode(code);
    return NextResponse.json({ order: fresh });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    return NextResponse.json({ error: "Gagal memicu pengiriman otomatis." }, { status: 500 });
  }
}
