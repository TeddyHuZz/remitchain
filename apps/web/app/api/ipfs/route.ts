import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json(
        { error: "Pinata credentials are not configured on the server. Please check PINATA_JWT in .env.local." },
        { status: 500 }
      );
    }

    const payload = await request.json();

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: JSON.stringify({
        pinataContent: payload,
        pinataMetadata: {
          name: `booth_registry_${payload.storeName || "unknown"}_${Date.now()}`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Pinata API error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ ipfsHash: data.IpfsHash });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to pin metadata to IPFS" }, { status: 500 });
  }
}
