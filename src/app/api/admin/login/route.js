import { NextResponse } from "next/server";
import { adminConfigured, checkAdminCredentials, setAdminCookie } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Login admin belum dikonfigurasi (ADMIN_EMAIL / ADMIN_PASSWORD kosong di server)." },
      { status: 503 }
    );
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  if (!checkAdminCredentials(body.email, body.password)) {
    return NextResponse.json({ error: "Email atau kata sandi admin salah." }, { status: 401 });
  }
  await setAdminCookie();
  return NextResponse.json({ ok: true });
}
