import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { checkBalance, digiflazzConfigured, digiflazzTesting } from "../../../../lib/digiflazz";

export const dynamic = "force-dynamic";

/* Status koneksi Digiflazz untuk panel admin: terkonfigurasi atau belum,
   mode testing, dan sisa deposit (bila bisa dicek). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  const configured = digiflazzConfigured();
  let deposit = null;
  let balanceError = null;
  if (configured) {
    const r = await checkBalance();
    if (r.ok) deposit = r.deposit;
    else balanceError = r.message;
  }
  return NextResponse.json({ configured, testing: digiflazzTesting(), deposit, balanceError });
}
