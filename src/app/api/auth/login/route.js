import { NextResponse } from "next/server";
import { findUserByEmail } from "../../../../lib/db";
import { checkPassword, setSessionCookie } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  try {
    const user = await findUserByEmail(email);
    if (!user || !(await checkPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
    }
    await setSessionCookie(user);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    if (e.code === "NO_DB")
      return NextResponse.json(
        { error: "Login belum tersedia karena database belum dikonfigurasi di server." },
        { status: 503 }
      );
    return NextResponse.json({ error: "Gagal masuk. Coba lagi." }, { status: 500 });
  }
}
