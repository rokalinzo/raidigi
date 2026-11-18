import { redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getSessionUser } from "../../../lib/auth";
import { getOrderByCode } from "../../../lib/db";
import { syncOrderPayment } from "../../../lib/verify";
import { Icon } from "../../../components/icons";
import PaymentClient from "./PaymentClient";

export const dynamic = "force-dynamic";

export default async function PembayaranPage({ params }) {
  const { code } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/akun?next=/pembayaran/${code}`);

  let order = null;
  try {
    order = await getOrderByCode(code);
  } catch {
    order = null;
  }
  if (!order || order.user_id !== user.id) {
    return (
      <div className="wrap">
        <div className="empty-state" style={{ marginTop: 20 }}>
          <Icon name="i-receipt" />
          <b>Pesanan tidak ditemukan</b>
          <p>Periksa kembali tautan pembayaranmu, atau lihat daftar pesanan di halaman Transaksi.</p>
          <Link className="btn btn-gold" href="/transaksi">
            Lihat Transaksi
          </Link>
        </div>
      </div>
    );
  }

  // Sinkronkan sekali saat halaman dibuka (verifikasi server ke Bayar.gg).
  order = await syncOrderPayment(order);

  let qrDataUrl = null;
  if (order.status === "menunggu_pembayaran" && order.qris_string) {
    try {
      qrDataUrl = await QRCode.toDataURL(order.qris_string, {
        width: 560,
        margin: 1,
        color: { dark: "#14042A", light: "#FFFFFF" },
      });
    } catch {
      qrDataUrl = null;
    }
  }

  return (
    <div className="wrap">
      <h1 className="page-title">Pembayaran</h1>
      <p className="page-sub">Selesaikan pembayaran pesanan {order.code} dengan QRIS.</p>
      <PaymentClient
        initialOrder={{
          code: order.code,
          status: order.status,
          total: order.total,
          finalAmount: order.final_amount,
          expiresAt: order.expires_at ? new Date(order.expires_at).toISOString() : null,
          hasInvoice: !!order.bayar_invoice_id,
          items: order.items.map((it) => ({
            name: it.product_name,
            variant: it.variant_label,
            qty: it.qty,
            price: it.unit_price,
          })),
        }}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}
