import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { adminCreatePromo, listPromos } from "../../../../lib/db";

export const dynamic = "force-dynamic";

/* Gambar promo boleh URL (http/https) atau data URI hasil unggahan dari
   panel admin — makanya batas panjangnya besar, tidak seperti gambar
   produk yang berupa URL pendek. */
const MAX_IMAGE_CHARS = 2_800_000;

export function sanitizePromo(body) {
  const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);
  const int = (v) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const image = String(body.image ?? "").trim().slice(0, MAX_IMAGE_CHARS);
  const imageOk =
    image.startsWith("data:image/") || image.startsWith("https://") || image.startsWith("http://");
  const productSlug = str(body.product_slug, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    title: str(body.title, 160),
    tag: str(body.tag, 60),
    image: imageOk ? image : null,
    product_slug: productSlug,
    cta: str(body.cta, 60) || "Lihat Promo",
    active: body.active !== false,
    sort_order: int(body.sort_order),
    _valid: imageOk && productSlug.length >= 2,
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  try {
    const promos = await listPromos({ includeInactive: true });
    return NextResponse.json({ promos });
  } catch (e) {
    return NextResponse.json({ error: "Gagal memuat promo." }, { status: 500 });
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
  const p = sanitizePromo(body);
  if (!p._valid)
    return NextResponse.json(
      { error: "Gambar promo (unggahan atau URL) dan produk tujuan wajib diisi dengan benar." },
      { status: 422 }
    );
  delete p._valid;
  try {
    const created = await adminCreatePromo(p);
    return NextResponse.json({ promo: created }, { status: 201 });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    return NextResponse.json({ error: "Gagal membuat promo." }, { status: 500 });
  }
}
