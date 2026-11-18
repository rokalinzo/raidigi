import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "../../../lib/db";
import { Icon } from "../../../components/icons";
import DetailClient from "./DetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Produk tidak ditemukan — RaiDigi" };
  return { title: `${p.name} — RaiDigi`, description: p.description };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.active) notFound();

  return (
    <div className="wrap">
      <Link className="back-btn" href="/kategori">
        <Icon name="i-chev-l" /> Kembali
      </Link>
      <DetailClient product={product} />
    </div>
  );
}
