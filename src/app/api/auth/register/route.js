import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "../../../../lib/db";
import { hashPassword, setSessionCookie } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name) return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Masukkan alamat email yang valid." }, { status: 422 });
  if (password.length < 6)
    return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 422 });

  try {
    const existing = await findUserByEmail(email);
    if (existing)
      return NextResponse.json({ error: "Email ini sudah terdaftar. Silakan masuk." }, { status: 409 });
    const passwordHash = await hashPassword(password);
    const user = await createUser({ name, email, passwordHash });
    await setSessionCookie(user);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json(
        { error: "Pendaftaran belum tersedia karena database belum dikonfigurasi di server." },
        { status: 503 }
      );
    return NextResponse.json({ error: "Gagal mendaftar. Coba lagi." }, { status: 500 });
  }
}
