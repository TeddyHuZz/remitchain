import { NextResponse } from "next/server.js";
import { isAddress } from "viem";
import { getDb } from "../../../lib/db.ts";

export async function POST(request: Request) {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ saved: false, configured: false });
    }

    const body = await request.json();
    const { walletAddress, expoPushToken } = body ?? {};
    if (!isAddress(walletAddress) || typeof expoPushToken !== "string" || !expoPushToken.startsWith("ExponentPushToken[")) {
      return NextResponse.json({ error: "Invalid push token payload" }, { status: 400 });
    }

    await db`
      INSERT INTO push_tokens (wallet_address, expo_push_token, updated_at)
      VALUES (${walletAddress.toLowerCase()}, ${expoPushToken}, NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET
        expo_push_token = EXCLUDED.expo_push_token,
        updated_at = NOW()
    `;

    return NextResponse.json({ saved: true, configured: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save push token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
