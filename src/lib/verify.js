import { getOrderByCode, markOrderPaidIfPending, expireOrderIfPending } from "./db";
import { checkPayment } from "./bayar";

/* Sinkronkan status satu pesanan dengan Bayar.gg.
   Webhook dan polling TIDAK pernah dipercaya langsung — status hanya berubah
   setelah check-payment.php mengonfirmasi dari server Bayar.gg. */
export async function syncOrderPayment(order) {
  if (!order || order.status !== "menunggu_pembayaran") return order;

  if (!order.bayar_invoice_id) {
    if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
      await expireOrderIfPending(order.id);
      return getOrderByCode(order.code);
    }
    return order;
  }

  const check = await checkPayment(order.bayar_invoice_id);
  if (check.ok) {
    if (check.status === "paid") {
      await markOrderPaidIfPending(order.id);
    } else if (["expired", "cancelled", "canceled", "failed"].includes(check.status)) {
      await expireOrderIfPending(order.id);
    } else if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
      await expireOrderIfPending(order.id);
    }
  }
  return getOrderByCode(order.code);
}
