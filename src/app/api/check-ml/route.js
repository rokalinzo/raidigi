import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/* Cek nickname Mobile Legends dari User ID + Zone ID.
   Memakai layanan cek ID pihak ketiga (tidak resmi — Moonton tidak
   menyediakan API publik). Hasilnya hanya alat bantu konfirmasi untuk
   pembeli: bila layanan ini mati, endpoint menjawab success:false dan
   checkout TIDAK boleh ikut diblokir. */
const UPSTREAM = "https://mlbb-api.isan.eu.org/find";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = String(searchParams.get("userId") || "").trim();
  const zoneId = String(searchParams.get("zoneId") || "").trim();

  if (!/^\d{5,15}$/.test(userId) || !/^\d{3,8}$/.test(zoneId)) {
    return NextResponse.json(
      { success: false, error: "Format User ID / Zone ID tidak valid. Isi hanya angka." },
      { status: 422 }
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${UPSTREAM}?id=${userId}&zone=${zoneId}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "RaiDigi/1.0 (+https://raidigi.vercel.app)" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.success && data.name) {
      return NextResponse.json({
        success: true,
        nickname: String(data.name),
        country: data.countryName ? String(data.countryName) : null,
      });
    }
    if (res.status === 404 || (data && data.success === false)) {
      return NextResponse.json({
        success: false,
        error: "Nickname tidak ditemukan. Periksa lagi User ID dan Zone ID kamu.",
      });
    }
    return NextResponse.json(
      { success: false, error: "Layanan cek nickname sedang tidak tersedia." },
      { status: 502 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Layanan cek nickname sedang tidak tersedia." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
