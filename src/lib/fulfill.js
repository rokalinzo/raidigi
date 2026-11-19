import {
  getFulfillmentItems,
  claimItemSupplierRef,
  setItemSupplierResult,
  setOrderStatusIf,
} from "./db";
import { digiflazzConfigured, createTransaction } from "./digiflazz";

/* Pengiriman otomatis via Digiflazz.
   Dipanggil tepat setelah pesanan bertransisi menjadi "dibayar".
   Prinsip aman:
   - Hanya item yang produknya punya supplier_sku yang dikirim; sisanya
     tetap diproses manual oleh admin seperti biasa.
   - Setiap item diklaim dulu (supplier_ref diisi bersyarat), jadi webhook
     dan polling yang balapan tidak akan mengirim dua kali.
   - Kegagalan apa pun di sini TIDAK melempar error ke pemanggil — status
     pembayaran tidak boleh terganggu oleh urusan pengiriman. Item yang
     gagal ditandai "Error"/"Gagal" agar admin bisa memproses manual.
   Catatan: satu item = satu transaksi Digiflazz (SKU prabayar umumnya
   satuan); jumlah (qty) > 1 pada item topup belum dikalikan otomatis. */

export function buildCustomerNo(formData) {
  const entries = Object.entries(formData || {});
  const findRaw = (re) => {
    const e = entries.find(([k]) => re.test(k));
    return e ? String(e[1]).trim() : "";
  };
  const userId = findRaw(/user\s?id/i).replace(/\D/g, "");
  const zoneId = findRaw(/zone/i).replace(/\D/g, "");
  if (userId && zoneId) return userId + zoneId; // Mobile Legends: ID + Zone digabung
  if (userId) return userId;
  const playerId = findRaw(/player\s?id/i).replace(/\D/g, "");
  if (playerId) return playerId;
  const any = entries.find(([, v]) => String(v).trim());
  return any ? String(any[1]).trim() : "";
}

export async function fulfillOrder(order) {
  if (!order || !digiflazzConfigured()) return { skipped: "not_configured" };
  const items = await getFulfillmentItems(order.id);
  let claimed = 0;
  for (const it of items) {
    if (!it.supplier_sku || it.supplier_ref) continue;
    const ref = `${order.code}-${it.item_id}`;
    if (!(await claimItemSupplierRef(it.item_id, ref))) continue;
    claimed++;
    const customerNo = buildCustomerNo(it.form_data);
    const r = await createTransaction({ sku: it.supplier_sku, customerNo, refId: ref });
    if (r.ok) {
      await setItemSupplierResult(it.item_id, { status: r.status, sn: r.sn });
    } else {
      await setItemSupplierResult(it.item_id, { status: "Error", sn: null });
    }
  }
  if (claimed > 0) {
    await setOrderStatusIf(order.id, "dibayar", "diproses");
    await maybeCompleteOrder(order.id);
  }
  return { claimed };
}

/* Cek ulang / kirim ulang item yang menggantung (Pending, Mengirim,
   atau Error) dengan ref_id yang sama persis. Aman diulang: Digiflazz
   memperlakukan ref_id sebagai kunci idempotensi, jadi transaksi tidak
   akan terbuat dua kali. Dipakai tombol "Kirim Otomatis" di panel admin. */
export async function recheckOrder(order) {
  if (!order || !digiflazzConfigured()) return { skipped: "not_configured" };
  const items = await getFulfillmentItems(order.id);
  let touched = 0;
  for (const it of items) {
    if (!it.supplier_ref) continue;
    if (!["Pending", "Mengirim", "Error"].includes(it.supplier_status || "")) continue;
    const r = await createTransaction({
      sku: it.supplier_sku,
      customerNo: buildCustomerNo(it.form_data),
      refId: it.supplier_ref,
    });
    if (r.ok) {
      await setItemSupplierResult(it.item_id, { status: r.status, sn: r.sn || it.supplier_sn });
      touched++;
    }
  }
  if (touched > 0) await maybeCompleteOrder(order.id);
  return { touched };
}

/* Pesanan selesai otomatis hanya bila SEMUA itemnya terkirim otomatis
   dan berstatus Sukses. Pesanan campuran (ada item manual) tetap
   diselesaikan admin dari panel. */
export async function maybeCompleteOrder(orderId) {
  const items = await getFulfillmentItems(orderId);
  if (!items.length) return;
  const allAuto = items.every((i) => i.supplier_ref);
  const allSuccess = items.every((i) => i.supplier_status === "Sukses");
  if (allAuto && allSuccess) {
    await setOrderStatusIf(orderId, "diproses", "selesai");
    await setOrderStatusIf(orderId, "dibayar", "selesai");
  }
}
