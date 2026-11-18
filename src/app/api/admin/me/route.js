import { NextResponse } from "next/server";
import { adminConfigured, isAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ admin: await isAdmin(), configured: adminConfigured() });
}
