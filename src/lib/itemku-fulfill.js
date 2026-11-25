import {
  claimItemkuOrder,
  getItemkuOrder,
  updateItemkuOrder,
  resolveItemkuSku,
  listItemkuOrdersByStatus,
} from "./db";
import { itemkuConfigured, listOrders, getOrder, orderAction } from "./itemku";
import { digiflazzConfigured, createTransaction } from "./digiflazz";

/* Jembatan Itemku → Digiflazz.
   Order lunas di Itemku (status REQUIRE_PROCESS) diteruskan ke
   Digiflazz memakai SKU dari pemetaan produk (itemku_product_map);
   begitu Digiflazz menjawab Sukses, order dilaporkan DELIVER ke
   Itemku. Prinsip aman, meniru fulfill.js:
   - Setiap order diklaim dulu di itemku_orders (unik per order_id),
     jadi callback + polling tidak memproses dua kali.
   - Transaksi Digiflazz idempoten lewat ref "IK-<order_id>" (qty > 1:
     "IK-<order_id>-<ke>"), jadi pengulangan aman.
   - Kegagalan tidak melempar error ke pemanggil; order ditandai
     'gagal'/'pending' untuk dicek ulang oleh polling berikutnya.
     REJECT otomatis hanya setelah 2x cek ulang tetap Gagal.
   Produk non-topup (using_delivery_info=true: voucher/akun) TIDAK
   diproses otomatis — ditandai 'perlu_manual' untuk admin. */

export function parseRequiredInfo(order) {
  const ri = order && order.required_information;
  if (!ri) return {};
  if (typeof ri === "object") return ri;
  try {
    return JSON.parse(ri);
  } catch {
    return {};
  }
}

/* Nomor tujuan Digiflazz dari required_information Itemku:
   ML = player_id + zone_id digabung (praktik yang sama dengan
   buildCustomerNo di fulfill.js); selain itu nilai identitas pertama
   yang tersedia. */
export function buildItemkuCustomerNo(info) {
  const get = (re) => {
    const k = Object.keys(info || {}).find((key) => re.test(key));
    return k ? String(info[k]).trim() : "";
  };
  const playerId = get(/player\s?id/i).replace(/\D/g, "");
  const zoneId = get(/zone/i).replace(/\D/g, "");
  if (playerId && zoneId) return playerId + zoneId;
  if (playerId) return playerId;
  const userId = get(/user\s?id/i);
  if (userId) return userId;
  const phone = get(/phone|hp|nomor/i);
  if (phone) return phone;
  const any = Object.values(info || {}).find((v) => String(v).trim());
  return any ? String(any).trim() : "";
}

function refFor(orderId, idx, qty) {
  return qty > 1 ? `IK-${orderId}-${idx + 1}` : `IK-${orderId}`;
}

async function deliverToItemku(row, sn) {
  const r = await orderAction({ orderId: row.itemku_order_id, action: "DELIVER" });
  if (r.ok) {
    await updateItemkuOrder(row.id, { status: "delivered", supplier_sn: sn || row.supplier_sn });
    return true;
  }
  await updateItemkuOrder(row.id, {
    status: "terkirim",
    supplier_sn: sn || row.supplier_sn,
    last_error: `DELIVER ke Itemku gagal (HTTP ${r.httpStatus || "?"}): ${String(r.raw || r.message || "").slice(0, 300)}`,
  });
  return false;
}

/* Proses satu order Itemku mentah (bentuk respons /api/order/list).
   Mengembalikan ringkasan tindakan yang diambil. */
export async function processItemkuOrder(rawOrder) {
  if (!rawOrder || !rawOrder.order_id) return { skipped: "bad_order" };
  if (!itemkuConfigured() || !digiflazzConfigured()) return { skipped: "not_configured" };

  const info = parseRequiredInfo(rawOrder);
  let row = await claimItemkuOrder({ ...rawOrder, required_information: info, raw: rawOrder });
  if (!row) {
    row = await getItemkuOrder(rawOrder.order_id);
    if (!row) return { skipped: "claim_failed" };
    if (["delivered", "rejected", "perlu_manual"].includes(row.status)) {
      return { skipped: "already_done", status: row.status };
    }
    // Order lama berstatus pending/gagal/terkirim ditangani recheck.
    return recheckItemkuOrder(row);
  }

  if (rawOrder.using_delivery_info) {
    await updateItemkuOrder(row.id, {
      status: "perlu_manual",
      last_error: "Produk voucher/akun (using_delivery_info) — proses manual oleh admin.",
    });
    return { action: "perlu_manual" };
  }

  const sku = await resolveItemkuSku(rawOrder.product_id);
  if (!sku) {
    await updateItemkuOrder(row.id, {
      status: "tak_terpetakan",
      last_error: `product_id Itemku ${rawOrder.product_id} belum dipetakan ke SKU Digiflazz.`,
    });
    return { action: "tak_terpetakan" };
  }

  const customerNo = buildItemkuCustomerNo(info);
  await updateItemkuOrder(row.id, { sku, customer_no: customerNo });
  return sendToDigiflazz({ ...row, sku, customer_no: customerNo });
}

async function sendToDigiflazz(row) {
  const qty = Math.max(1, Number(row.qty || 1));
  let lastStatus = "";
  let lastSn = null;
  let lastMessage = "";
  for (let i = 0; i < qty; i++) {
    const ref = refFor(row.itemku_order_id, i, qty);
    const r = await createTransaction({ sku: row.sku, customerNo: row.customer_no, refId: ref });
    if (!r.ok) {
      await updateItemkuOrder(row.id, {
        status: "gagal",
        supplier_ref: refFor(row.itemku_order_id, 0, qty),
        last_error: `Digiflazz: ${r.message || r.reason || "gagal"}`,
      });
      return { action: "gagal", message: r.message };
    }
    lastStatus = r.status;
    lastSn = r.sn || lastSn;
    lastMessage = r.message || "";
    if (r.status === "Gagal") break;
    if (r.status === "Pending") break;
  }
  await updateItemkuOrder(row.id, {
    supplier_ref: refFor(row.itemku_order_id, 0, qty),
    supplier_status: lastStatus,
    supplier_sn: lastSn,
  });
  if (lastStatus === "Sukses") {
    const ok = await deliverToItemku(row, lastSn);
    return { action: ok ? "delivered" : "terkirim" };
  }
  if (lastStatus === "Pending") {
    await updateItemkuOrder(row.id, { status: "pending" });
    return { action: "pending" };
  }
  await updateItemkuOrder(row.id, {
    status: "gagal",
    last_error: `Digiflazz: ${lastMessage || "transaksi gagal"}`,
  });
  return { action: "gagal", message: lastMessage };
}

/* Cek ulang order yang menggantung: transaksi Digiflazz diulang dengan
   ref yang sama (idempoten — mengembalikan status terakhir, tidak
   membuat transaksi baru). Setelah 2x cek ulang tetap Gagal, order
   di-REJECT ke Itemku agar dana pembeli kembali. */
export async function recheckItemkuOrder(row) {
  if (!row.sku) {
    const sku = await resolveItemkuSku(row.itemku_product_id);
    if (!sku) {
      await updateItemkuOrder(row.id, { status: "tak_terpetakan", last_error: "SKU Digiflazz belum dipetakan." });
      return { action: "tak_terpetakan" };
    }
    const customerNo = row.customer_no || buildItemkuCustomerNo(row.required_information || {});
    await updateItemkuOrder(row.id, { sku, customer_no: customerNo });
    row = { ...row, sku, customer_no: customerNo };
  }
  if (!row.supplier_ref) return sendToDigiflazz(row);
  const qty = Math.max(1, Number(row.qty || 1));
  let status = "";
  let sn = row.supplier_sn;
  let message = "";
  for (let i = 0; i < qty; i++) {
    const r = await createTransaction({
      sku: row.sku,
      customerNo: row.customer_no,
      refId: refFor(row.itemku_order_id, i, qty),
    });
    if (!r.ok) {
      await updateItemkuOrder(row.id, { attempts: Number(row.attempts || 0) + 1, last_error: `Digiflazz: ${r.message || r.reason || "gagal"}` });
      return { action: "recheck_failed" };
    }
    status = r.status;
    sn = r.sn || sn;
    message = r.message || "";
    if (status !== "Sukses") break;
  }
  const attempts = Number(row.attempts || 0) + 1;
  await updateItemkuOrder(row.id, { supplier_status: status, supplier_sn: sn, attempts });
  if (status === "Sukses") {
    const ok = await deliverToItemku({ ...row, supplier_sn: sn }, sn);
    return { action: ok ? "delivered" : "terkirim" };
  }
  if (status === "Pending") {
    await updateItemkuOrder(row.id, { status: "pending" });
    return { action: "pending" };
  }
  // Gagal
  if (attempts >= 2) {
    const reason = /nomor|id|zone|tujuan/i.test(message) ? "WRONG_BUYER_INFORMATION" : "SERVER_ERROR";
    const r = await orderAction({ orderId: row.itemku_order_id, action: "REJECT", refundReason: reason });
    await updateItemkuOrder(row.id, {
      status: r.ok ? "rejected" : "gagal",
      last_error: `Digiflazz gagal: ${message}. REJECT ${r.ok ? "terkirim" : "gagal (HTTP " + (r.httpStatus || "?") + ")"}.`,
    });
    return { action: r.ok ? "rejected" : "gagal" };
  }
  await updateItemkuOrder(row.id, { status: "gagal", last_error: `Digiflazz: ${message}` });
  return { action: "gagal" };
}

/* Satu putaran polling: ambil order REQUIRE_PROCESS terbaru (maks 60
   hari, kami pakai 3 hari terakhir) lalu proses; setelah itu cek ulang
   order pending/gagal/terkirim yang belum tuntas. Dipakai endpoint
   /api/itemku/poll dan sebagai cadangan callback. */
export async function pollItemkuOrders() {
  if (!itemkuConfigured()) return { skipped: "not_configured" };
  const fmt = (d) => d.toISOString().slice(0, 10);
  const since = fmt(new Date(Date.now() - 3 * 24 * 3600 * 1000));
  const summary = { fetched: 0, processed: 0, rechecked: 0, results: [] };

  const r = await listOrders({ dateStart: since, orderStatus: "REQUIRE_PROCESS", limit: 30 });
  if (r.ok) {
    summary.fetched = r.orders.length;
    for (const o of r.orders) {
      const res = await processItemkuOrder(o);
      summary.processed++;
      summary.results.push({ order_id: o.order_id, ...res });
    }
  }
  const hanging = await listItemkuOrdersByStatus(["pending", "terkirim"]);
  for (const row of hanging) {
    if (row.status === "terkirim") {
      const ok = await deliverToItemku(row, row.supplier_sn);
      summary.rechecked++;
      summary.results.push({ order_id: row.itemku_order_id, action: ok ? "delivered" : "terkirim" });
    } else {
      const res = await recheckItemkuOrder(row);
      summary.rechecked++;
      summary.results.push({ order_id: row.itemku_order_id, ...res });
    }
  }
  return summary;
}

/* Verifikasi + proses satu order dari callback: payload callback tidak
   dipercaya — status resmi dicek ulang lewat API seperti anjuran
   dokumentasi Itemku. */
export async function handleItemkuCallbackOrder(orderId) {
  const fresh = await getOrder(orderId);
  if (!fresh) return { skipped: "order_not_found" };
  if (fresh.status !== "REQUIRE_PROCESS") return { skipped: "not_require_process", status: fresh.status };
  return processItemkuOrder(fresh);
}
