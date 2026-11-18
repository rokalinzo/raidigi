import { Icon } from "./icons";
import { discPct, fmtIDR } from "../lib/format";

/* Thumbnail produk: gambar asli bila ada, selain itu tile berwarna solid
   (pola yang sama dengan situs statis). */
export function Thumb({ product }) {
  if (product.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.image} alt={product.image_alt || product.name} loading="lazy" />;
  }
  const t = product.tile || { icon: "i-gem", word: "", c1: "#1D1230", fg: "#FFA600" };
  return (
    <div className="tile" style={{ background: t.c1 }}>
      <span style={{ color: t.fg }}>
        <Icon name={t.icon} />
      </span>
      <span className="tile-word" style={{ color: t.fg }}>
        {t.word}
      </span>
    </div>
  );
}

export function stockInfo(p) {
  if (p.stock === null || p.stock === undefined)
    return { cls: "ok", text: "Tersedia" };
  if (p.stock <= 0) return { cls: "out", text: "Stok Habis" };
  if (p.stock <= 5) return { cls: "low", text: `Sisa ${p.stock} — stok terbatas` };
  return { cls: "ok", text: `Stok ${p.stock}` };
}

export function StockLine({ product }) {
  const s = stockInfo(product);
  return (
    <span className={"p-stock " + s.cls}>
      <span className="sdot" />
      {s.text}
    </span>
  );
}
