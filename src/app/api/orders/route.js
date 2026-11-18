import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { attachInvoice, createOrderWithItems, getOrderByCode, getProductBySlug } from "../../../lib/db";
import { createPayment } from "../../../lib/bayar";
import { fmtIDR, QRIS_MAX, QRIS_MIN, SERVICE_FEE } from "../../../lib/format";

export const dynamic = "force-dynamic";

/* POST /api/orders — checkout.
   Wajib login. Harga selalu diambil dari database (tidak percaya klien).
   Membuat pesanan (menunggu_pembayaran) lalu invoice QRIS Bayar.gg. */
export async function POST(req) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu untuk checkout." }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const buyer = {
    name: String(body.buyer?.name || "").trim(),
    email: String(body.buyer?.email || "").trim().toLowerCase(),
    phone: String(body.buyer?.phone || "").trim(),
  };
  if (!buyer.name) return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email))
    return NextResponse.json({ error: "Masukkan alamat email yang valid." }, { status: 422 });
  const phoneDigits = buyer.phone.replace(/\D/g, "");
  if (phoneDigits.length < 9 || phoneDigits.length > 15)
    return NextResponse.json({ error: "Masukkan nomor WhatsApp yang valid (9–15 digit)." }, { status: 422 });

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length)
    return NextResponse.json({ error: "Keranjang kosong — tidak ada yang bisa di-checkout." }, { status: 422 });

  try {
    const items = [];
    let subtotal = 0;
    for (const raw of rawItems) {
      const product = await getProductBySlug(String(raw.slug || ""));
      if (!product || !product.active)
        return NextResponse.json({ error: `Produk "${raw.slug}" tidak ditemukan atau tidak aktif.` }, { status: 422 });

      const denoms = product.denoms && product.denoms.length ? product.denoms : [{ label: product.name, price: product.price }];
      const denom = raw.variant ? denoms.find((d) => d.label === raw.variant) : denoms[0];
      if (!denom)
        return NextResponse.json({ error: `Varian "${raw.variant}" tidak tersedia untuk ${product.name}.` }, { status: 422 });

      const qty = Math.max(1, Math.min(99, parseInt(raw.qty, 10) || 1));
      if (product.stock !== null && qty > product.stock)
        return NextResponse.json(
          { error: `Stok ${product.name} tidak mencukupi (tersisa ${product.stock}).` },
          { status: 422 }
        );

      const formData = {};
      if (raw.formData && typeof raw.formData === "object") {
        for (const [k, v] of Object.entries(raw.formData)) {
          if (typeof v === "string" && v.trim()) formData[String(k).slice(0, 80)] = v.trim().slice(0, 200);
        }
      }
      for (const f of product.form_fields || []) {
        if (f.required && !formData[f.label])
          return NextResponse.json(
            { error: `Kolom "${f.label}" wajib diisi untuk ${product.name}.` },
            { status: 422 }
          );
      }

      subtotal += denom.price * qty;
      items.push({
        product_id: product.id,
        product_name: product.name,
        variant_label: denom.label,
        unit_price: denom.price,
        qty,
        form_data: formData,
      });
    }

    const total = subtotal + SERVICE_FEE;

    /* Batas QRIS Admin Bayar.gg — pembayaran tidak dibuat di luar rentang ini. */
    if (total < QRIS_MIN || total > QRIS_MAX) {
      return NextResponse.json(
        {
          error:
            `Total pesananmu ${fmtIDR(total)} berada di luar batas pembayaran QRIS ` +
            `(${fmtIDR(QRIS_MIN)} – ${fmtIDR(QRIS_MAX)} per transaksi), jadi pembayaran belum bisa dibuat. ` +
            `Sesuaikan isi keranjangmu agar totalnya berada dalam batas tersebut.`,
        },
        { status: 422 }
      );
    }

    const order = await createOrderWithItems(
      {
        user_id: user.id,
        buyer_name: buyer.name,
        buyer_email: buyer.email,
        buyer_phone: buyer.phone,
        subtotal,
        service_fee: SERVICE_FEE,
        total,
      },
      items
    );

    const payment = await createPayment({
      amount: total,
      description: `Pesanan ${order.code} — RaiDigi`,
      customer: buyer,
    });

    if (payment.ok) {
      await attachInvoice(order.id, {
        invoiceId: payment.invoiceId,
        qrisString: payment.qrisString,
        finalAmount: payment.finalAmount,
        expiresAt: payment.expiresAt,
      });
      const fresh = await getOrderByCode(order.code);
      return NextResponse.json({ order: fresh, payment: { invoiceId: payment.invoiceId } }, { status: 201 });
    }

    // Pesanan tetap tersimpan; pembayaran gagal dimulai secara anggun.
    return NextResponse.json({ order, paymentError: payment.message }, { status: 201 });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json(
        { error: "Checkout belum tersedia karena database belum dikonfigurasi di server." },
        { status: 503 }
      );
    return NextResponse.json({ error: "Gagal membuat pesanan. Coba lagi." }, { status: 500 });
  }
}
