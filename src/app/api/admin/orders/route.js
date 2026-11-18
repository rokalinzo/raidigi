import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { adminListOrders, setOrderStatus } from "../../../../lib/db";
import { syncOrderPayment } from "../../../../lib/verify";

export const dynamic = "force-dynamic";

const TRANSITIONS = {
  dibayar: ["diproses", "batal"],
  diproses: ["selesai", "batal"],
  menunggu_pembayaran: ["batal"],
  selesai: [],
  batal: [],
  kedaluwarsa: [],
};

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  try {
    let orders = await adminListOrders();
    // Segarkan status pesanan yang masih menunggu pembayaran.
    const refreshed = [];
    for (const o of orders) {
      refreshed.push(o.status === "menunggu_pembayaran" ? await syncOrderPayment(o) : o);
    }
    orders = refreshed;
    return NextResponse.json({ orders });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    return NextResponse.json({ error: "Gagal memuat pesanan." }, { status: 500 });
  }
}

export async function PATCH(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const id = parseInt(body.id, 10);
  const status = String(body.status || "");
  if (!id || !(status in TRANSITIONS))
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 422 });

  try {
    const orders = await adminListOrders();
    const order = orders.find((o) => o.id === id);
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    const allowed = TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Status tidak dapat diubah dari "${order.status}" ke "${status}".` },
        { status: 422 }
      );
    }
    await setOrderStatus(id, status);
    const fresh = (await adminListOrders()).find((o) => o.id === id);
    return NextResponse.json({ order: fresh });
  } catch (e) {
    return NextResponse.json({ error: "Gagal mengubah status pesanan." }, { status: 500 });
  }
}
