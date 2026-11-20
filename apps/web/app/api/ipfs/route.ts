import { NextResponse } from "next/server.js";
import { verifyMessage, isAddress } from "viem";

export async function POST(request: Request) {
  try {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: "Pinata credentials missing" }, { status: 500 });
    }

    const body = await request.json();
    const { address, signature, timestamp, metadata } = body ?? {};

    if (!isAddress(address) || typeof signature !== "string" || typeof timestamp !== "number") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return NextResponse.json({ error: "Expired signature" }, { status: 401 });
    }

    const message = `RemitChain Booth Pin:${address.toLowerCase()}:${timestamp}`;
    const valid = await verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const safePayload = {
      storeName: String(metadata?.storeName ?? "").slice(0, 120),
      address: String(metadata?.address ?? "").slice(0, 240),
      coordinates: String(metadata?.coordinates ?? "").slice(0, 64),
      description: String(metadata?.description ?? "").slice(0, 500),
    };

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: JSON.stringify({
        pinataContent: safePayload,
        pinataMetadata: {
          name: `booth_registry_${safePayload.storeName || "unknown"}_${Date.now()}`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ ipfsHash: data.IpfsHash });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to pin metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
