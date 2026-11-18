import { NextResponse } from "next/server";
import { listProducts } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await listProducts();
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json({ products: [], error: "Katalog belum dapat dimuat." }, { status: 500 });
  }
}
