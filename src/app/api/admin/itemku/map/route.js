import { NextResponse } from "next/server";
import { isAdmin } from "../../../../../lib/auth";
import { listItemkuMap, upsertItemkuMap } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

/* Pemetaan produk Itemku → produk/denominasi RaiDigi + SKU Digiflazz.
   GET: daftar pemetaan. POST: buat/ubah satu pemetaan
   { itemku_product_id, itemku_product_name?, product_id?,
     variant_label?, sku?, active? } — sku kosong berarti turunkan dari
   produk RaiDigi tertaut (SKU denominasi / SKU produk). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  try {
    const map = await listItemkuMap();
    return NextResponse.json({ map });
  } catch {
    return NextResponse.json({ error: "Gagal memuat pemetaan." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const itemkuId = Number(body.itemku_product_id);
  if (!Number.isFinite(itemkuId) || itemkuId <= 0) {
    return NextResponse.json({ error: "itemku_product_id wajib angka positif." }, { status: 422 });
  }
  try {
    const row = await upsertItemkuMap({
      itemku_product_id: itemkuId,
      itemku_product_name: String(body.itemku_product_name || "").slice(0, 200),
      product_id: body.product_id ? Number(body.product_id) : null,
      variant_label: String(body.variant_label || "").slice(0, 120),
      sku: String(body.sku || "").slice(0, 60),
      active: body.active !== false,
    });
    return NextResponse.json({ map: row });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    return NextResponse.json({ error: "Gagal menyimpan pemetaan." }, { status: 500 });
  }
}
