"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { createPublicClient, http, formatUnits } from "viem";
import { polygonAmoy } from "viem/chains";
import { BOOTH_REGISTRY_ABI } from "@repo/contracts-sdk";
import { MapPin, DollarSign, X, ZoomIn, ZoomOut, Maximize, RotateCw } from "lucide-react";

const GlobeGL = dynamic(() => import("react-globe.gl"), { ssr: false });

interface BoothPoint {
  lat: number;
  lng: number;
  name: string;
  address: string;
  email: string;
  owner: string;
  collateral: number;
  coordinates: string;
  status: string;
}

interface CorridorArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
}

const SENDER_HUBS = [
  { lat: 1.3521, lng: 103.8198 },
  { lat: 25.2048, lng: 55.2708 },
  { lat: 37.7749, lng: -122.4194 },
  { lat: 51.5072, lng: -0.1276 }
];

export default function Globe() {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [booths, setBooths] = useState<BoothPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooth, setSelectedBooth] = useState<BoothPoint | null>(null);
  const [hoveredBooth, setHoveredBooth] = useState<BoothPoint | null>(null);
  const [filter, setFilter] = useState<"ALL" | "USDC">("ALL");
  const [autoRotate, setAutoRotate] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 720, height: 440 });

  const registryAddress = process.env.NEXT_PUBLIC_BOOTH_REGISTRY_ADDRESS || "0x7bCB577350e600c1372036094f7F7464e54E90b6";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology/";

  useEffect(() => {
    const container = globeContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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

        const boothResults = await publicClient.multicall({
          contracts: addresses.map((addr) => ({
            address: registryAddress as `0x${string}`,
            abi: BOOTH_REGISTRY_ABI,
            functionName: "booths" as const,
            args: [addr] as const
          }))
        });

        const approvedEntries = addresses
          .map((addr, idx) => ({ addr, res: boothResults[idx] }))
          .filter(
            (entry): entry is { addr: `0x${string}`; res: { status: "success"; result: readonly [string, bigint, number, bigint] } } =>
              entry.res?.status === "success" && entry.res.result[2] === 1 && Boolean(entry.res.result[0])
          );

        const fetchIpfsMeta = async (ipfsHash: string) => {
          const gateways = [`https://ipfs.io/ipfs/${ipfsHash}`, `https://gateway.pinata.cloud/ipfs/${ipfsHash}`];
          for (const url of gateways) {
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
              if (res.ok) return await res.json();
            } catch {
              continue;
            }
          }
          return null;
        };

        const settled = await Promise.allSettled(
          approvedEntries.map(async ({ addr, res }) => {
            const [ipfsHash, collateralRaw] = res.result;
            const meta = await fetchIpfsMeta(ipfsHash);
            if (!meta?.coordinates) return null;
            const coords = String(meta.coordinates).split(",");
            if (coords.length !== 2) return null;
            const lat = parseFloat(coords[0] ?? "");
            const lng = parseFloat(coords[1] ?? "");
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return {
              lat,
              lng,
              name: meta.storeName || `Booth ${addr.slice(0, 6)}`,
              address: meta.address || "No address provided",
              email: meta.email || "No email provided",
              owner: meta.ownerName || "Unknown",
              collateral: Number(formatUnits(collateralRaw, 6)),
              coordinates: meta.coordinates,
              status: "Active"
            } as BoothPoint;
          })
        );

        const points = settled
          .filter((r): r is PromiseFulfilledResult<BoothPoint | null> => r.status === "fulfilled" && r.value !== null)
          .map((r) => r.value!);
        setBooths(points);
      } catch (err) {
        console.error("Failed to load booths for globe", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBooths();
  }, [registryAddress, rpcUrl]);

  useEffect(() => {
    const controls = globeRef.current?.controls?.();
    if (!controls) return;
    controls.autoRotate = autoRotate && !hoveredBooth && !selectedBooth;
    controls.autoRotateSpeed = 0.65;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, [autoRotate, hoveredBooth, selectedBooth, loading]);

  const displayedBooths = useMemo(
    () =>
      booths.filter((b) => {
        if (filter === "ALL") return true;
        return b.collateral >= 10;
      }),
    [booths, filter]
  );

  const corridorArcs = useMemo<CorridorArc[]>(() => {
    return displayedBooths.flatMap((booth, idx) => {
      const hub = SENDER_HUBS[idx % SENDER_HUBS.length]!;
      return [
        {
          startLat: hub.lat,
          startLng: hub.lng,
          endLat: booth.lat,
          endLng: booth.lng,
          color: ["#9945FF", "#10B981"]
        }
      ];
    });
  }, [displayedBooths]);

  const adjustAltitude = (delta: number) => {
    const globe = globeRef.current;
    if (!globe) return;
    const current = globe.pointOfView();
    const nextAltitude = Math.min(4.0, Math.max(0.6, (current.altitude || 2.2) + delta));
    globe.pointOfView({ ...current, altitude: nextAltitude }, 450);
  };

  const resetView = () => {
    globeRef.current?.pointOfView({ lat: 15, lng: 100, altitude: 2.2 }, 800);
  };

  const handleBoothClick = (point: object) => {
    const booth = point as BoothPoint;
    setSelectedBooth(booth);
    globeRef.current?.pointOfView({ lat: booth.lat, lng: booth.lng, altitude: 1.35 }, 800);
  };

  const totalCollateral = booths.reduce((acc, curr) => acc + curr.collateral, 0);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "320px 1fr",
      gap: "24px",
      width: "100%",
      maxWidth: "1200px",
      background: "rgba(10, 15, 30, 0.4)",
      border: "1px solid rgba(255, 255, 255, 0.05)",
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
      backdropFilter: "blur(12px)",
      color: "#FFFFFF"
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#9945FF", borderBottom: "2px solid #9945FF", paddingBottom: "10px" }}>
            Verified Projects
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{
            backgroundColor: "rgba(153, 69, 255, 0.12)",
            border: "1px solid rgba(153, 69, 255, 0.25)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#B380FF", textTransform: "uppercase" }}>Total Active Nodes</span>
            <span style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF" }}>{loading ? "..." : booths.length}</span>
            <span style={{ fontSize: "10px", color: "#10B981" }}>Active Storefronts</span>
          </div>

          <div style={{
            backgroundColor: "rgba(30, 41, 59, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Staked Escrow Volume</span>
            <span style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF" }}>{loading ? "..." : `$${totalCollateral.toLocaleString()}.00 USDC`}</span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Locked Collateral Guarantee</span>
          </div>

          <div style={{
            backgroundColor: "rgba(30, 41, 59, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Registered Corridors</span>
            <span style={{ fontSize: "24px", fontWeight: 800, color: "#FFFFFF" }}>{loading ? "..." : booths.length > 0 ? "2" : "0"}</span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Cross-border corridors</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Map Explorer Filter
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => setFilter("ALL")}
              style={{
                background: "transparent",
                border: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                color: filter === "ALL" ? "#FFFFFF" : "var(--text-description)",
                backgroundColor: filter === "ALL" ? "rgba(255,255,255,0.05)" : "transparent",
                cursor: "pointer",
                width: "100%",
                textAlign: "left"
              }}
            >
              <span>● All Registered Nodes</span>
              <strong>{booths.length}</strong>
            </button>

            <button
              onClick={() => setFilter("USDC")}
              style={{
                background: "transparent",
                border: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                color: filter === "USDC" ? "#FFFFFF" : "var(--text-description)",
                backgroundColor: filter === "USDC" ? "rgba(255,255,255,0.05)" : "transparent",
                cursor: "pointer",
                width: "100%",
                textAlign: "left"
              }}
            >
              <span>● USDC Escrow (&ge;10 USDC)</span>
              <strong>{booths.filter(b => b.collateral >= 10).length}</strong>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", position: "relative", width: "100%", height: "100%" }}>
        <div style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          zIndex: 1000
        }}>
          <button
            onClick={() => setAutoRotate((prev) => !prev)}
            title={autoRotate ? "Pause rotation" : "Resume rotation"}
            style={{
              ...controlBtnStyle,
              borderColor: autoRotate ? "rgba(153, 69, 255, 0.5)" : "rgba(255, 255, 255, 0.08)",
              color: autoRotate ? "#B380FF" : "#FFFFFF"
            }}
          >
            <RotateCw size={14} />
          </button>
          <button onClick={resetView} title="Reset view" style={controlBtnStyle}><Maximize size={14} /></button>
          <button onClick={() => adjustAltitude(-0.45)} title="Zoom in" style={controlBtnStyle}><ZoomIn size={14} /></button>
          <button onClick={() => adjustAltitude(0.45)} title="Zoom out" style={controlBtnStyle}><ZoomOut size={14} /></button>
        </div>

        <div
          ref={globeContainerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minHeight: "440px",
            backgroundColor: "#05060b",
            backgroundImage: "radial-gradient(circle at 50% 50%, rgba(153, 69, 255, 0.08) 0%, rgba(5, 6, 11, 1) 75%)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: "12px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <GlobeGL
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            atmosphereColor="#9945FF"
            atmosphereAltitude={0.18}
            showAtmosphere
            pointsData={displayedBooths}
            pointLat="lat"
            pointLng="lng"
            pointColor={() => "#10B981"}
            pointAltitude={0.04}
            pointRadius={0.55}
            onPointHover={(point) => setHoveredBooth((point as BoothPoint) || null)}
            onPointClick={handleBoothClick}
            ringsData={displayedBooths}
            ringLat="lat"
            ringLng="lng"
            ringColor={() => (t: number) => `rgba(16, 185, 129, ${1 - t})`}
            ringMaxRadius={3.2}
            ringPropagationSpeed={1.6}
            ringRepeatPeriod={1200}
            arcsData={corridorArcs}
            arcColor="color"
            arcDashLength={0.45}
            arcDashGap={0.2}
            arcDashAnimateTime={2200}
            arcStroke={0.6}
            onGlobeReady={() => {
              const controls = globeRef.current?.controls?.();
              if (controls) {
                controls.autoRotate = autoRotate;
                controls.autoRotateSpeed = 0.65;
              }
              globeRef.current?.pointOfView({ lat: 15, lng: 100, altitude: 2.2 }, 0);
            }}
          />

          {hoveredBooth && !selectedBooth && (
            <div style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(14, 17, 32, 0.95)",
              border: "1px solid #9945FF",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              color: "#FFFFFF",
              boxShadow: "0 10px 20px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              zIndex: 1001,
              whiteSpace: "nowrap"
            }}>
              <strong>{hoveredBooth.name}</strong>
              <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>Click to view details</span>
            </div>
          )}

          {selectedBooth && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "rgba(14, 17, 32, 0.96)",
              border: "1px solid rgba(153, 69, 255, 0.4)",
              borderRadius: "16px",
              padding: "24px",
              width: "90%",
              maxWidth: "360px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.85), 0 0 20px rgba(153, 69, 255, 0.15)",
              backdropFilter: "blur(12px)",
              animation: "scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              zIndex: 1002
            }}>
              <button
                onClick={() => setSelectedBooth(null)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-description)",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                <X size={16} />
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.08)", padding: "2px 8px", borderRadius: "10px", textTransform: "uppercase" }}>Active DePIN Node</span>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#FFFFFF", marginTop: "8px" }}>{selectedBooth.name}</h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <MapPin size={16} style={{ color: "#9945FF", flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Address</span>
                      <span style={{ fontSize: "13px", color: "#FFFFFF", lineHeight: 1.4 }}>{selectedBooth.address}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <DollarSign size={16} style={{ color: "#10B981", flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Collateral Stake</span>
                      <span style={{ fontSize: "13px", color: "#FFFFFF", fontWeight: 700 }}>{selectedBooth.collateral} USDC</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "12px" }}>
                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Operator</span>
                      <span style={{ fontSize: "13px", color: "#FFFFFF", display: "block" }}>{selectedBooth.owner}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Coordinates</span>
                      <span style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "monospace", display: "block" }}>{selectedBooth.coordinates}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedBooth(null)}
                  style={{
                    backgroundColor: "#9945FF",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    marginTop: "8px",
                    transition: "background-color 0.2s"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#7A22CC")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#9945FF")}
                >
                  Close Inspection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}

const controlBtnStyle = {
  backgroundColor: "rgba(14, 17, 32, 0.85)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#FFFFFF",
  borderRadius: "8px",
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s",
  zIndex: 1000
};
