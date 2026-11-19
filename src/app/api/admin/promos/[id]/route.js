import { NextResponse } from "next/server";
import { isAdmin } from "../../../../../lib/auth";
import { adminDeletePromo, adminUpdatePromo } from "../../../../../lib/db";
import { sanitizePromo } from "../route";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (!pid) return NextResponse.json({ error: "ID promo tidak valid." }, { status: 422 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const p = sanitizePromo(body);
  if (!p._valid)
    return NextResponse.json(
      { error: "Gambar promo (unggahan atau URL) dan produk tujuan wajib diisi dengan benar." },
      { status: 422 }
    );
  delete p._valid;

  try {
    const updated = await adminUpdatePromo(pid, p);
    if (!updated) return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ promo: updated });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    return NextResponse.json({ error: "Gagal menyimpan promo." }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (!pid) return NextResponse.json({ error: "ID promo tidak valid." }, { status: 422 });

  try {
    const deleted = await adminDeletePromo(pid);
    if (!deleted) return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: { id: deleted.id, title: deleted.title } });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    return NextResponse.json({ error: "Gagal menghapus promo." }, { status: 500 });
  }
}
