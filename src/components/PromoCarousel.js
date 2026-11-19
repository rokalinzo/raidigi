"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { IMG_429B7EA37F, IMG_628374C1AB } from "../lib/assets-data";

/* Promo bawaan — hanya tampil selama admin belum menambahkan promo
   aktif apa pun lewat panel admin (tab Promo). */
const SLIDES = [
  {
    slug: "ml-diamond",
    img: IMG_429B7EA37F,
    alt: "Ilustrasi karakter anime berambut perak untuk promo topup game",
    tag: "Topup Game",
    flip: false,
    title: (
      <>
        Diskon Spesial
        <br />
        s/d <b>20%</b>
      </>
    ),
    cta: "Topup Sekarang",
  },
  {
    slug: "robux-800",
    img: IMG_628374C1AB,
    alt: "Koin Robux emas di atas pedestal kaca",
    tag: "Roblox",
    flip: true,
    title: (
      <>
        Robux 800
        <br />
        Hemat <b>Rp26rb</b>
      </>
    ),
    cta: "Beli Sekarang",
  },
  {
    slug: "netflix-premium",
    img: null,
    alt: "",
    tag: "Akun Premium",
    flip: false,
    title: (
      <>
        Netflix &amp; Spotify Premium
        <br />
        mulai <b>Rp25rb</b>
      </>
    ),
    cta: "Lihat Paket",
  },
];

export default function PromoCarousel({ promos }) {
  const router = useRouter();
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);

  // Promo dari panel admin (tabel promos) menggantikan promo bawaan
  // begitu ada minimal satu promo aktif bergambar + bertujuan produk.
  const dbSlides = (Array.isArray(promos) ? promos : [])
    .filter((p) => p && p.image && p.product_slug)
    .map((p) => ({
      key: "promo-" + p.id,
      slug: p.product_slug,
      img: p.image,
      alt: p.title || "Promo RaiDigi",
      tag: p.tag || "",
      flip: false,
      title: p.title || null,
      cta: p.cta || "Lihat Promo",
    }));
  const slides = dbSlides.length > 0 ? dbSlides : SLIDES.map((s) => ({ ...s, key: s.slug }));
  const count = slides.length;

  useEffect(() => {
    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track || document.hidden || count < 2) return;
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % count;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(timer);
  }, [count]);

  return (
    <>
      <div
        className="promo-track"
        ref={trackRef}
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {slides.map((s) => (
          <button
            className={"promo-slide" + (s.flip ? " flip" : "")}
            key={s.key}
            onClick={() => router.push(`/produk/${s.slug}`)}
            style={s.img ? undefined : { background: "#1D1230" }}
          >
            {s.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bg" src={s.img} alt={s.alt} />
            )}
            {s.img && <span className="shade" />}
            <span className="p-copy" style={s.img ? undefined : { width: "100%", padding: "18px 20px" }}>
              {s.tag && <span className="promo-tag">{s.tag}</span>}
              {s.title && <h3>{s.title}</h3>}
              <span className="p-cta">
                {s.cta} <Icon name="i-arrow-r" />
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="promo-dots">
        {slides.map((s, i) => (
          <button
            key={s.key}
            aria-label={"Promo " + (i + 1)}
            className={i === idx ? "on" : ""}
            onClick={() => trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: "smooth" })}
          />
        ))}
      </div>
    </>
  );
}
