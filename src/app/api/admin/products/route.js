import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { adminCreateProduct, listProducts } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export function sanitizeProduct(body, { requireSlug }) {
  const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);
  const int = (v) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  };
  const slug = str(body.slug, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const specs = Array.isArray(body.specs)
    ? body.specs.map((s) => String(s).slice(0, 300)).filter(Boolean)
    : String(body.specs || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
  const denoms = (Array.isArray(body.denoms) ? body.denoms : [])
    .map((d) => ({
      label: String(d.label || "").slice(0, 120),
      price: Math.max(0, int(d.price)),
      ...(d.note ? { note: String(d.note).slice(0, 200) } : {}),
      ...(d.sku ? { sku: String(d.sku).slice(0, 60) } : {}),
    }))
    .filter((d) => d.label);
  const formFields = (Array.isArray(body.form_fields) ? body.form_fields : []).map((f) => ({
    key: String(f.key || "").slice(0, 40),
    label: String(f.label || "").slice(0, 80),
    ph: String(f.ph || "").slice(0, 120),
    hint: String(f.hint || "").slice(0, 200),
    required: !!f.required,
  }));
  const price = Math.max(0, int(body.price));
  return {
    slug,
    name: str(body.name, 160),
    game: str(body.game, 80),
    category: str(body.category, 40) || "topup",
    category_label: str(body.category_label, 60),
    type: str(body.type, 30) || "topup",
    price: denoms.length ? Math.min(...denoms.map((d) => d.price)) : price,
    compare_at_price: Math.max(0, int(body.compare_at_price)),
    stock: body.stock === null || body.stock === "" || body.stock === undefined ? null : Math.max(0, int(body.stock)),
    image: str(body.image, 300) || null,
    image_alt: str(body.image_alt, 200),
    description: str(body.description, 2000),
    specs,
    denoms: denoms.length ? denoms : [{ label: str(body.name, 120), price }],
    form_fields: formFields,
    tile: body.tile && typeof body.tile === "object" ? body.tile : null,
    popular: !!body.popular,
    qty_allowed: !!body.qty_allowed,
    is_sample: !!body.is_sample,
    active: body.active !== false,
    sort_order: int(body.sort_order),
    supplier_sku: str(body.supplier_sku, 60),
    _valid: (!requireSlug || slug.length >= 2) && str(body.name, 160).length >= 2,
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  try {
    const products = await listProducts({ includeInactive: true });
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ error: "Gagal memuat produk." }, { status: 500 });
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
  const p = sanitizeProduct(body, { requireSlug: true });
  if (!p._valid)
    return NextResponse.json({ error: "Slug dan nama produk wajib diisi dengan benar." }, { status: 422 });
  delete p._valid;
  try {
    const created = await adminCreateProduct(p);
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json({ error: "Database belum dikonfigurasi di server." }, { status: 503 });
    if (e.code === "23505")
      return NextResponse.json({ error: "Slug produk sudah dipakai produk lain." }, { status: 409 });
    return NextResponse.json({ error: "Gagal membuat produk." }, { status: 500 });
  }
}
