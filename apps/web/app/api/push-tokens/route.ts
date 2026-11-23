import { NextResponse } from "next/server.js";
import { createPublicClient, http, isAddress } from "viem";
import { polygonAmoy } from "viem/chains";
import { AMOY_PUBLIC_RPC } from "@repo/contracts-sdk";
import { getDb } from "../../../lib/db.ts";

export async function POST(request: Request) {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ saved: false, configured: false });
    }

    const body = await request.json();
    const { walletAddress, expoPushToken, signature, timestamp } = body ?? {};
    if (
      !isAddress(walletAddress) ||
      typeof expoPushToken !== "string" ||
      !expoPushToken.startsWith("ExponentPushToken[")
    ) {
      return NextResponse.json({ error: "Invalid push token payload" }, { status: 400 });
    }

    if (typeof signature !== "string" || typeof timestamp !== "number") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return NextResponse.json({ error: "Expired signature" }, { status: 401 });
    }

    const publicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || AMOY_PUBLIC_RPC),
    });

    const valid = await publicClient.verifyMessage({
      address: walletAddress as `0x${string}`,
      message: `RemitChain Push:${walletAddress.toLowerCase()}:${timestamp}`,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
