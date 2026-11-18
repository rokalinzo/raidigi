import { NextResponse } from "next/server";
import { isAdmin } from "../../../../../lib/auth";
import { adminUpdateProduct, listProducts } from "../../../../../lib/db";
import { sanitizeProduct } from "../route";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (!pid) return NextResponse.json({ error: "ID produk tidak valid." }, { status: 422 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const p = sanitizeProduct(body, { requireSlug: false });
  if (!p._valid) return NextResponse.json({ error: "Nama produk wajib diisi dengan benar." }, { status: 422 });
  delete p._valid;

  try {
    const products = await listProducts({ includeInactive: true });
    if (!products.some((x) => x.id === pid))
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    const updated = await adminUpdateProduct(pid, p);
    return NextResponse.json({ product: updated });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    return NextResponse.json({ error: "Gagal menyimpan produk." }, { status: 500 });
  }
}
