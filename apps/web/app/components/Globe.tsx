"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { polygonAmoy } from "viem/chains";
import { Loader2, Globe as GlobeIcon } from "lucide-react";

const BOOTH_REGISTRY_ABI = [
  {
    name: "getBoothAddresses",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }]
  },
  {
    name: "booths",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "ipfsHash", type: "string" },
      { name: "collateral", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "submittedAt", type: "uint256" }
    ]
  }
] as const;

interface BoothPoint {
  lat: number;
  lng: number;
  name: string;
  address: string;
  collateral: number;
}

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [booths, setBooths] = useState<BoothPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const registryAddress = process.env.NEXT_PUBLIC_BOOTH_REGISTRY_ADDRESS || "0x1B3231F79Cb57C4B219399cFEcde642C60eF657d";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology/";

  // Load booths from smart contract
  useEffect(() => {
    const fetchBooths = async () => {
      try {
        const publicClient = createPublicClient({
          chain: polygonAmoy,
          transport: http(rpcUrl)
        });

        const addresses = await publicClient.readContract({
          address: registryAddress as `0x${string}`,
          abi: BOOTH_REGISTRY_ABI,
          functionName: "getBoothAddresses"
        });

        const points: BoothPoint[] = [];
        for (const addr of addresses) {
          const [ipfsHash, collateralRaw, statusNum] = await publicClient.readContract({
            address: registryAddress as `0x${string}`,
            abi: BOOTH_REGISTRY_ABI,
            functionName: "booths",
            args: [addr]
          });

          // 1 = Approved
          if (statusNum === 1 && ipfsHash) {
            try {
              const res = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`, { signal: AbortSignal.timeout(2500) });
              if (res.ok) {
                const meta = await res.json();
                const coords = meta.coordinates ? meta.coordinates.split(",") : [];
                if (coords.length === 2) {
                  points.push({
                    lat: parseFloat(coords[0]),
                    lng: parseFloat(coords[1]),
                    name: meta.storeName || `Booth ${addr.slice(0, 6)}`,
                    address: meta.address || "",
                    collateral: Number(formatUnits(collateralRaw, 6))
                  });
                }
              }
            } catch {
              try {
                const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, { signal: AbortSignal.timeout(2500) });
                if (res.ok) {
                  const meta = await res.json();
                  const coords = meta.coordinates ? meta.coordinates.split(",") : [];
                  if (coords.length === 2) {
                    points.push({
                      lat: parseFloat(coords[0]),
                      lng: parseFloat(coords[1]),
                      name: meta.storeName || `Booth ${addr.slice(0, 6)}`,
                      address: meta.address || "",
                      collateral: Number(formatUnits(collateralRaw, 6))
                    });
                  }
                }
              } catch (e2) {
                console.warn("Failed to fetch coordinates for globe", ipfsHash, e2);
              }
            }
          }
        }
        setBooths(points);
      } catch (err) {
        console.error("Failed to load booths for globe", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooths();
  }, [registryAddress, rpcUrl]);

  // Render rotating globe inside HTML5 Canvas
  useEffect(() => {
    if (loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let localRotationY = 0;

    const radius = Math.min(canvas.width, canvas.height) / 2.6;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Map 3D spherical coordinates to 2D screen coordinates
    const project = (lat: number, lng: number) => {
      const radLat = (lat * Math.PI) / 180;
      const radLng = ((lng + localRotationY) * Math.PI) / 180;

      // 3D coordinates of a sphere
      const x3d = Math.cos(radLat) * Math.sin(radLng);
      const y3d = Math.sin(radLat);
      const z3d = Math.cos(radLat) * Math.cos(radLng);

      // Project onto screen coordinates
      const screenX = centerX + x3d * radius;
      const screenY = centerY - y3d * radius;

      return { x: screenX, y: screenY, visible: z3d > 0 };
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      localRotationY += 0.3; // rotation speed

      // 1. Draw glowing space atmosphere backdrop
      const spaceGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.8, centerX, centerY, radius * 1.5);
      spaceGrad.addColorStop(0, "rgba(99, 102, 241, 0.04)");
      spaceGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw sphere outline & glass back reflection
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      const ballGrad = ctx.createRadialGradient(centerX - radius / 3, centerY - radius / 3, radius * 0.1, centerX, centerY, radius);
      ballGrad.addColorStop(0, "rgba(30, 41, 59, 0.2)");
      ballGrad.addColorStop(1, "rgba(10, 15, 30, 0.95)");
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Sphere border stroke
      ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. Draw grid lines (Latitudes & Longitudes) to simulate 3D rotation
      ctx.lineWidth = 0.5;
      
      // Longitudes
      for (let offset = 0; offset < 360; offset += 30) {
        ctx.beginPath();
        for (let lat = -90; lat <= 90; lat += 5) {
          const pt = project(lat, offset);
          if (pt.visible) {
            ctx.lineTo(pt.x, pt.y);
          } else {
            ctx.moveTo(pt.x, pt.y);
          }
        }
        ctx.strokeStyle = "rgba(99, 102, 241, 0.04)";
        ctx.stroke();
      }

      // Latitudes
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        for (let lng = 0; lng <= 360; lng += 5) {
          const pt = project(lat, lng);
          if (pt.visible) {
            ctx.lineTo(pt.x, pt.y);
          } else {
            ctx.moveTo(pt.x, pt.y);
          }
        }
        ctx.strokeStyle = "rgba(99, 102, 241, 0.04)";
        ctx.stroke();
      }

      // 4. Draw active booths pins on top of the sphere
      booths.forEach((booth) => {
        const pt = project(booth.lat, booth.lng);
        if (pt.visible) {
          // Draw outer glowing neon halo pulse
          const pulse = 1 + Math.sin(Date.now() / 200) * 0.15;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8 * pulse, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
          ctx.fill();

          // Draw inner solid dot
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = "#10B981";
          ctx.fill();

          // Draw small white core dot
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [loading, booths]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", width: "100%" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px", gap: "12px", color: "var(--text-description)" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--primary-hover)" }} />
          <span>Syncing global DePIN cashier directory on-chain...</span>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: booths.length > 0 ? "1.2fr 0.8fr" : "1fr", width: "100%", maxWidth: "1100px", alignItems: "center", gap: "40px" }}>
          
          {/* Globe Canvas */}
          <div style={{ display: "flex", justifyContent: "center", position: "relative", width: "100%" }}>
            <canvas 
              ref={canvasRef} 
              width={500} 
              height={500} 
              style={{ maxWidth: "100%", height: "auto" }}
            />
            {booths.length === 0 && (
              <div style={{ position: "absolute", bottom: "40px", textAlign: "center", color: "var(--text-description)", fontSize: "13px" }}>
                <span>No active booths registered. Apply to list your storefront!</span>
              </div>
            )}
          </div>

          {/* Directory Panel */}
          {booths.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "400px", overflowY: "auto", paddingRight: "10px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
                <GlobeIcon size={18} style={{ color: "#10B981" }} />
                <h4 style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>Live Node Directory</h4>
              </div>
              
              {booths.map((booth, i) => (
                <div 
                  key={i} 
                  style={{
                    backgroundColor: "rgba(14, 17, 32, 0.4)",
                    border: "1px solid rgba(30, 41, 59, 0.4)",
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    backdropFilter: "blur(8px)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{booth.name}</span>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.08)", padding: "2px 8px", borderRadius: "10px" }}>Active</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-description)" }}>{booth.address}</span>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "8px", marginTop: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Collateral Staked</span>
                    <strong style={{ color: "#FFFFFF" }}>{booth.collateral} USDC</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
