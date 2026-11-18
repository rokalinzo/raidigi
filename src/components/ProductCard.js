"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Thumb, StockLine } from "./thumb";
import { useStore } from "./store";
import { discPct, fmtIDR } from "../lib/format";

export default function ProductCard({ product: p }) {
  const { wishlist, toggleWish, toast } = useStore();
  const router = useRouter();
  const d = discPct(p.price, p.compare_at_price);
  const wished = wishlist.includes(p.slug);

  return (
    <article
      className="pcard"
      tabIndex={0}
      role="button"
      aria-label={p.name}
      onClick={() => router.push(`/produk/${p.slug}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/produk/${p.slug}`);
      }}
    >
      <div className="thumb">
        <Thumb product={p} />
        <span className={"badge" + (p.is_sample ? " sample" : "")}>
          {p.is_sample ? "Contoh" : p.category_label}
        </span>
        {d > 0 && <span className="disc">−{d}%</span>}
        <button
          className={"wish-btn" + (wished ? " on" : "")}
          aria-label="Simpan ke wishlist"
          onClick={(e) => {
            e.stopPropagation();
            toggleWish(p.slug);
            toast(wished ? "Dihapus dari wishlist" : "Disimpan ke wishlist", "i-heart");
          }}
        >
          <Icon name="i-heart" />
        </button>
      </div>
      <div className="p-body">
        <span className="p-cat">
          {p.category_label}
          {p.is_sample ? " · Contoh" : ""}
        </span>
        <span className="p-name">{p.name}</span>
        <span className="p-game">{p.game}</span>
        <StockLine product={p} />
        <div className="p-price">
          <small>Mulai dari</small>
          <b>{fmtIDR(p.price)}</b>
          {p.compare_at_price > p.price && <s>{fmtIDR(p.compare_at_price)}</s>}
        </div>
        <button
          className="buy-btn"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/produk/${p.slug}`);
          }}
        >
          <Icon name="i-cart" />
          Beli
        </button>
      </div>
    </article>
  );
}

export { Link };
