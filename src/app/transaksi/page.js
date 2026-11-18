import Link from "next/link";
import { getSessionUser } from "../../lib/auth";
import { getOrdersByUser } from "../../lib/db";
import { Icon } from "../../components/icons";
import { fmtDate, fmtIDR, statusInfo } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function TransaksiPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="wrap">
        <h1 className="page-title">Transaksi</h1>
        <p className="page-sub">Riwayat pesananmu di RaiDigi.</p>
        <div className="empty-state" style={{ marginTop: 14 }}>
          <Icon name="i-user" />
          <b>Masuk untuk melihat transaksimu</b>
          <p>Riwayat pesanan terhubung ke akunmu.</p>
          <Link className="btn btn-gold" href="/akun?next=/transaksi">
            Masuk / Daftar
          </Link>
        </div>
      </div>
    );
  }

  let orders = [];
  let dbError = false;
  try {
    orders = await getOrdersByUser(user.id);
  } catch {
    dbError = true;
  }

  return (
    <div className="wrap">
      <h1 className="page-title">Transaksi</h1>
      <p className="page-sub">Riwayat pesananmu di RaiDigi.</p>

      {dbError ? (
        <div className="alert error" style={{ marginTop: 14 }}>
          <Icon name="i-info" />
          <span>Riwayat transaksi belum dapat dimuat karena database belum terhubung.</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <Icon name="i-receipt" />
          <b>Belum ada transaksi</b>
          <p>Pesanan yang kamu buat akan muncul di sini.</p>
          <Link className="btn btn-gold" href="/kategori">
            Mulai Belanja
          </Link>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          {orders.map((o) => {
            const st = statusInfo(o.status);
            const unexpired =
              o.status === "menunggu_pembayaran" &&
              (!o.expires_at || new Date(o.expires_at).getTime() > Date.now());
            const names = o.items.map((it) => `${it.product_name} — ${it.variant_label}`).join("; ");
            const card = (
              <>
                <div className="t-ico">
                  <Icon name="i-receipt" />
                </div>
                <div className="t-body">
                  <b>{names || o.code}</b>
                  <div className="t-meta">
                    {o.code} · {fmtDate(o.created_at)}
                  </div>
                  {o.items.map((it, i) => (
                    <div className="txn-items" key={i}>
                      {it.product_name} — {it.variant_label} × {it.qty}
                      {Object.keys(it.form_data || {}).length > 0 && (
                        <>
                          {" · "}
                          {Object.entries(it.form_data)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ")}
                        </>
                      )}
                    </div>
                  ))}
                  {unexpired && (
                    <div className="txn-items" style={{ color: "var(--warn)", fontWeight: 700 }}>
                      Ketuk untuk melanjutkan pembayaran →
                    </div>
                  )}
                </div>
                <div className="t-right">
                  <div className="t-total">{fmtIDR(o.total)}</div>
                  <span className={"status " + st.cls}>{st.label}</span>
                </div>
              </>
            );
            return unexpired ? (
              <Link className="txn txn-link" key={o.code} href={`/pembayaran/${o.code}`}>
                {card}
              </Link>
            ) : (
              <div className="txn" key={o.code}>
                {card}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
