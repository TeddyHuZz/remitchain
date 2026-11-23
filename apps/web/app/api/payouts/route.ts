import { NextResponse } from "next/server.js";
import { isAddress } from "viem";
import { getDb } from "../../../lib/db.ts";

export async function GET(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ payouts: 0, volume: 0, commissions: 0, configured: false });
  }

  const { searchParams } = new URL(request.url);
  const booth = searchParams.get("booth")?.toLowerCase();
  if (!booth || !isAddress(booth)) {
    return NextResponse.json({ error: "Invalid booth address" }, { status: 400 });
  }

  const rows = await db`
    SELECT
      COUNT(*)::int AS payouts,
      COALESCE(SUM(amount_usdc), 0)::float AS volume,
      COALESCE(SUM(commission_usdc), 0)::float AS commissions
    FROM payouts
    WHERE booth_address = ${booth}
  `;

  return NextResponse.json({
    payouts: rows[0]?.payouts ?? 0,
    volume: rows[0]?.volume ?? 0,
    commissions: rows[0]?.commissions ?? 0,
    configured: true,
  });
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ saved: false, configured: false });
    }

    const body = await request.json();
    const { boothAddress, orderId, amountUsdc, txHash } = body ?? {};
    if (!isAddress(boothAddress) || typeof txHash !== "string" || typeof amountUsdc !== "number" || amountUsdc <= 0) {
      return NextResponse.json({ error: "Invalid payout payload" }, { status: 400 });
    }

    const commissionUsdc = Number((amountUsdc * 0.01).toFixed(6));
    await db`
      INSERT INTO payouts (booth_address, order_id, amount_usdc, commission_usdc, tx_hash)
      VALUES (${boothAddress.toLowerCase()}, ${Number(orderId ?? 0)}, ${amountUsdc}, ${commissionUsdc}, ${txHash})
      ON CONFLICT (tx_hash) DO NOTHING
    `;

    return NextResponse.json({ saved: true, configured: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save payout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
