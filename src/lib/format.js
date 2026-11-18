export const SERVICE_FEE = 1500;

/* Batas QRIS Admin Bayar.gg (terverifikasi dari API get-payment-methods) */
export const QRIS_MIN = 5000;
export const QRIS_MAX = 500000;

export function fmtIDR(n) {
  const v = Number(n) || 0;
  return "Rp" + v.toLocaleString("id-ID");
}

export function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return (
    dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
    " " +
    dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}

export const ORDER_STATUS = {
  menunggu_pembayaran: { label: "Menunggu Pembayaran", cls: "wait" },
  dibayar: { label: "Dibayar", cls: "paid" },
  diproses: { label: "Diproses", cls: "proc" },
  selesai: { label: "Selesai", cls: "done" },
  batal: { label: "Batal", cls: "cancel" },
  kedaluwarsa: { label: "Kedaluwarsa", cls: "cancel" },
};

export function statusInfo(status) {
  return ORDER_STATUS[status] || { label: status, cls: "wait" };
}

export function discPct(price, compareAt) {
  return compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;
}
