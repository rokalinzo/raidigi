"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { IMG_429B7EA37F, IMG_628374C1AB } from "../lib/assets-data";

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

export default function PromoCarousel() {
  const router = useRouter();
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track || document.hidden) return;
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % SLIDES.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div
        className="promo-track"
        ref={trackRef}
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {SLIDES.map((s) => (
          <button
            className={"promo-slide" + (s.flip ? " flip" : "")}
            key={s.slug}
            onClick={() => router.push(`/produk/${s.slug}`)}
            style={s.img ? undefined : { background: "#1D1230" }}
          >
            {s.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="bg" src={s.img} alt={s.alt} />
            )}
            {s.img && <span className="shade" />}
            <span className="p-copy" style={s.img ? undefined : { width: "100%", padding: "18px 20px" }}>
              <span className="promo-tag">{s.tag}</span>
              <h3>{s.title}</h3>
              <span className="p-cta">
                {s.cta} <Icon name="i-arrow-r" />
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="promo-dots">
        {SLIDES.map((s, i) => (
          <button
            key={s.slug}
            aria-label={"Promo " + (i + 1)}
            className={i === idx ? "on" : ""}
            onClick={() => trackRef.current?.scrollTo({ left: i * trackRef.current.clientWidth, behavior: "smooth" })}
          />
        ))}
      </div>
    </>
  );
}
