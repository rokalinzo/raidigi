"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../../../components/icons";
import { fmtIDR, statusInfo } from "../../../lib/format";

function useCountdown(expiresAt, active) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!expiresAt || !active) return;
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, active]);
  return left;
}

function fmtCountdown(ms) {
  if (ms === null) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function PaymentClient({ initialOrder, qrDataUrl }) {
  const [order, setOrder] = useState(initialOrder);
  const [checking, setChecking] = useState(false);
  const timer = useRef(null);
  const pending = order.status === "menunggu_pembayaran";
  const left = useCountdown(order.expiresAt, pending);

  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${order.code}/status`, { cache: "no-store" });
        const data = await res.json();
        if (!stopped && data.order) {
          setOrder((o) => ({ ...o, status: data.order.status, finalAmount: data.order.final_amount ?? o.finalAmount }));
          if (data.order.status !== "menunggu_pembayaran") clearInterval(timer.current);
        }
      } catch { /* abaikan, coba lagi siklus berikutnya */ }
    };
    timer.current = setInterval(poll, 4000);
    poll();
    return () => {
      stopped = true;
      clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, order.code]);

  async function manualCheck() {
    setChecking(true);
    try {
      const res = await fetch(`/api/orders/${order.code}/status`, { cache: "no-store" });
      const data = await res.json();
      if (data.order) setOrder((o) => ({ ...o, status: data.order.status, finalAmount: data.order.final_amount ?? o.finalAmount }));
    } catch { /* abaikan */ }
    setChecking(false);
  }

  const st = statusInfo(order.status);
  const payable = order.finalAmount ?? order.total;

  return (
    <div className="pay-wrap">
      {order.status === "dibayar" || order.status === "diproses" || order.status === "selesai" ? (
        <>
          <div className="success-hero">
            <div className="ok-ring">
              <Icon name="i-check" />
            </div>
            <h1>Pembayaran Berhasil!</h1>
            <p>
              Pesanan <b>{order.code}</b> sudah lunas dan berstatus <b>{st.label}</b>. Admin akan memproses pesananmu —
              pantau perkembangannya di halaman Transaksi.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
            <Link className="btn btn-gold" href="/transaksi">
              Lihat Transaksi
            </Link>
            <Link className="btn btn-ghost" href="/kategori">
              Belanja Lagi
            </Link>
          </div>
        </>
      ) : order.status === "kedaluwarsa" ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <Icon name="i-clock" />
          <b>Waktu pembayaran habis</b>
          <p>Invoice pesanan {order.code} sudah kedaluwarsa. Silakan buat pesanan baru dari keranjangmu.</p>
          <Link className="btn btn-gold" href="/kategori">
            Kembali Belanja
          </Link>
        </div>
      ) : order.status === "batal" ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <Icon name="i-x" />
          <b>Pesanan dibatalkan</b>
          <p>Pesanan {order.code} telah dibatalkan. Hubungi admin bila kamu merasa ini keliru.</p>
          <Link className="btn btn-gold" href="/transaksi">
            Lihat Transaksi
          </Link>
        </div>
      ) : (
        <>
          <div className="qr-card">
            <span className={"status " + st.cls}>{st.label}</span>
            <div className="pay-amount" style={{ marginTop: 12 }}>
              <small>Jumlah yang harus dibayar persis</small>
              {fmtIDR(payable)}
            </div>
            {payable !== order.total && (
              <p style={{ color: "var(--muted)", fontSize: ".8rem", margin: "6px 0 0", lineHeight: 1.55 }}>
                Termasuk kode unik dari gateway pembayaran — bayar sampai digit terakhir agar pembayaranmu terdeteksi
                otomatis. Total pesananmu {fmtIDR(order.total)}.
              </p>
            )}
            {qrDataUrl ? (
              <>
                <div className="qr-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Kode QRIS untuk pembayaran pesanan ini" />
                </div>
                <p style={{ color: "var(--muted)", fontSize: ".85rem", lineHeight: 1.6, margin: 0 }}>
                  Pindai dengan GoPay, DANA, OVO, ShopeePay, atau mobile banking apa pun.
                </p>
              </>
            ) : (
              <div className="alert warn" style={{ marginTop: 14, textAlign: "left" }}>
                <Icon name="i-info" />
                <span>
                  {order.hasInvoice
                    ? "Kode QRIS tidak dapat ditampilkan. Coba muat ulang halaman ini."
                    : "Invoice pembayaran untuk pesanan ini belum dibuat oleh server (gateway belum dikonfigurasi). Pesananmu tersimpan — hubungi admin untuk menyelesaikan pembayaran."}
                </span>
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <span className={"countdown" + (left !== null && left < 5 * 60 * 1000 ? " urgent" : "")}>
                <Icon name="i-clock" />
                Sisa waktu {fmtCountdown(left)}
              </span>
            </div>
            <div className="poll-note">
              <Icon name="i-zap" cls={checking ? "" : "spin"} />
              Status dicek otomatis setiap beberapa detik…
            </div>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={manualCheck} disabled={checking}>
              {checking ? "Memeriksa…" : "Saya Sudah Bayar — Cek Status"}
            </button>
          </div>

          <div className="panel" style={{ marginTop: 14 }}>
            <h3>Rincian Pesanan {order.code}</h3>
            <div>
              {order.items.map((it, i) => (
                <div className="sum-row" key={i}>
                  <span>
                    {it.name} — {it.variant} × {it.qty}
                  </span>
                  <span>{fmtIDR(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="sum-row total">
                <span>Total Pesanan</span>
                <span>{fmtIDR(order.total)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
