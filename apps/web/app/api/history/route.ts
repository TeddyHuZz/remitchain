import { NextResponse } from "next/server.js";
import { isAddress } from "viem";
import { getDb } from "../../../lib/db.ts";

export async function GET(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ transactions: [], configured: false });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const rows = await db`
    SELECT id, tx_hash, from_address, to_address, amount_usdc, event_type, block_number, created_at
    FROM transactions
    WHERE from_address = ${address} OR to_address = ${address}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ transactions: rows, configured: true });
}
