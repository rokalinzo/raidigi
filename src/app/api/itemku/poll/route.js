import { NextResponse } from "next/server";
import { pollItemkuOrders } from "../../../../lib/itemku-fulfill";

export const dynamic = "force-dynamic";

/* /api/itemku/poll — satu putaran polling order Itemku (cadangan
 * callback, yang verifikasi domainnya butuh DNS TXT dan tidak diulang
 * Itemku bila gagal). Dilindungi ITEMKU_POLL_SECRET lewat header
 * x-poll-secret; tanpa secret di env, endpoint ini nonaktif.
 * Dipanggil penjadwal eksternal (cron) tiap beberapa menit. */
async function run(req) {
  const secret = process.env.ITEMKU_POLL_SECRET || "";
  if (!secret) return NextResponse.json({ error: "nonaktif" }, { status: 404 });
  if ((req.headers.get("x-poll-secret") || "") !== secret) {
    return NextResponse.json({ error: "tidak berwenang" }, { status: 401 });
  }
  try {
    const summary = await pollItemkuOrders();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e && e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  return run(req);
}

export async function GET(req) {
  return run(req);
}
