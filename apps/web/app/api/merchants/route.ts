import { NextResponse } from "next/server.js";
import { isAddress, verifyMessage } from "viem";
import { getDb } from "../../../lib/db.ts";

export async function GET(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ merchants: [], configured: false });
  }
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet")?.toLowerCase();

  if (wallet && isAddress(wallet)) {
    const rows = await db`
      SELECT wallet_address, store_name, owner_name, email, physical_address, coordinates, ipfs_hash, status, updated_at
      FROM merchants
      WHERE wallet_address = ${wallet}
      LIMIT 1
    `;
    return NextResponse.json({ merchant: rows[0] ?? null, configured: true });
  }

  const rows = await db`
    SELECT wallet_address, store_name, owner_name, email, physical_address, coordinates, ipfs_hash, status, updated_at
    FROM merchants
    ORDER BY updated_at DESC
  `;
  return NextResponse.json({ merchants: rows, configured: true });
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ saved: false, configured: false });
    }

    const body = await request.json();
    const { address, signature, timestamp, merchant } = body ?? {};

    if (!isAddress(address) || typeof signature !== "string" || typeof timestamp !== "number") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return NextResponse.json({ error: "Expired signature" }, { status: 401 });
    }

    const valid = await verifyMessage({
      address,
      message: `RemitChain Booth Pin:${address.toLowerCase()}:${timestamp}`,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const normalized = address.toLowerCase();
    await db`
      INSERT INTO merchants (
        wallet_address, store_name, owner_name, email, physical_address, coordinates, ipfs_hash, status, updated_at
      ) VALUES (
        ${normalized},
        ${String(merchant?.storeName ?? "").slice(0, 120)},
        ${String(merchant?.ownerName ?? "").slice(0, 120)},
        ${String(merchant?.email ?? "").slice(0, 160)},
        ${String(merchant?.address ?? "").slice(0, 240)},
        ${String(merchant?.coordinates ?? "").slice(0, 64)},
        ${merchant?.ipfsHash ? String(merchant.ipfsHash) : null},
        'PENDING',
        NOW()
      )
      ON CONFLICT (wallet_address) DO UPDATE SET
        store_name = EXCLUDED.store_name,
        owner_name = EXCLUDED.owner_name,
        email = EXCLUDED.email,
        physical_address = EXCLUDED.physical_address,
        coordinates = EXCLUDED.coordinates,
        ipfs_hash = COALESCE(EXCLUDED.ipfs_hash, merchants.ipfs_hash),
        status = 'PENDING',
        updated_at = NOW()
    `;

    return NextResponse.json({ saved: true, configured: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save merchant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
