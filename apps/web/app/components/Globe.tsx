"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { createPublicClient, http, formatUnits } from "viem";
import { polygonAmoy } from "viem/chains";
import { BOOTH_REGISTRY_ABI } from "@repo/contracts-sdk";
import {
  MapPin,
  CurrencyDollar,
  X,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOut,
  ArrowsClockwise,
  Storefront
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import styles from "./Globe.module.css";

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
  const [dimensions, setDimensions] = useState({ width: 720, height: 460 });

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
          const customGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY?.replace(/\/$/, "");
          const gateways = [
            ...(customGateway ? [`${customGateway}/ipfs/${ipfsHash}`] : []),
            `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            `https://ipfs.io/ipfs/${ipfsHash}`
          ];
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
          color: ["#2563EB", "#10B981"]
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

  const focusBooth = (booth: BoothPoint) => {
    setSelectedBooth(booth);
    globeRef.current?.pointOfView({ lat: booth.lat, lng: booth.lng, altitude: 1.35 }, 800);
  };

  const totalCollateral = booths.reduce((acc, curr) => acc + curr.collateral, 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.sidebar}>
        <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#3B82F6", borderBottom: "2px solid #2563EB", paddingBottom: "10px" }}>
            Verified Nodes
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{
            backgroundColor: "rgba(37, 99, 235, 0.12)",
            border: "1px solid rgba(37, 99, 235, 0.28)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#93C5FD", textTransform: "uppercase" }}>Total Active Nodes</span>
            <span className="tabular-nums" style={{ fontSize: "24px", fontWeight: 800, color: "#F8FAFC" }}>{loading ? "..." : booths.length}</span>
            <span style={{ fontSize: "11px", color: "#10B981" }}>Active Storefronts</span>
          </div>

          <div style={{
            backgroundColor: "#161F30",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Staked Escrow Volume</span>
            <span className="tabular-nums" style={{ fontSize: "22px", fontWeight: 800, color: "#F8FAFC" }}>{loading ? "..." : `$${totalCollateral.toLocaleString()}.00`}</span>
            <span style={{ fontSize: "11px", color: "#64748B" }}>USDC Collateral Guarantee</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Filter Nodes
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setFilter("ALL")}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.08)",
                color: filter === "ALL" ? "#F8FAFC" : "#94A3B8",
                backgroundColor: filter === "ALL" ? "#2563EB" : "#161F30",
                cursor: "pointer"
              }}
            >
              All ({booths.length})
            </button>
            <button
              onClick={() => setFilter("USDC")}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.08)",
                color: filter === "USDC" ? "#F8FAFC" : "#94A3B8",
                backgroundColor: filter === "USDC" ? "#2563EB" : "#161F30",
                cursor: "pointer"
              }}
            >
              ≥10 USDC ({booths.filter(b => b.collateral >= 10).length})
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Booth Directory
          </span>
          <div className={styles.boothList}>
            {displayedBooths.length === 0 ? (
              <span style={{ fontSize: "12px", color: "#64748B" }}>{loading ? "Syncing booths..." : "No active booths found."}</span>
            ) : (
              displayedBooths.map((b) => (
                <button key={`${b.name}-${b.coordinates}`} className={styles.boothListItem} onClick={() => focusBooth(b)}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Storefront size={14} weight="duotone" color="#10B981" />
                    {b.name}
                  </span>
                  <span className="tabular-nums" style={{ color: "#10B981", fontWeight: 600 }}>${b.collateral}</span>
                </button>
              ))
            )}
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
              borderColor: autoRotate ? "rgba(37, 99, 235, 0.55)" : "rgba(255, 255, 255, 0.08)",
              color: autoRotate ? "#3B82F6" : "#F8FAFC"
            }}
          >
            <ArrowsClockwise size={15} weight="bold" />
          </button>
          <button onClick={resetView} title="Reset view" style={controlBtnStyle}><ArrowsOut size={15} /></button>
          <button onClick={() => adjustAltitude(-0.45)} title="Zoom in" style={controlBtnStyle}><MagnifyingGlassPlus size={15} /></button>
          <button onClick={() => adjustAltitude(0.45)} title="Zoom out" style={controlBtnStyle}><MagnifyingGlassMinus size={15} /></button>
        </div>

        <div
          ref={globeContainerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minHeight: "460px",
            backgroundColor: "#06090F",
            backgroundImage: "radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.1) 0%, rgba(6, 9, 15, 1) 75%)",
            border: "1px solid rgba(255,255,255,0.08)",
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
            globeImageUrl="/textures/earth-night.jpg"
            bumpImageUrl="/textures/earth-topology.png"
            atmosphereColor="#2563EB"
            atmosphereAltitude={0.16}
            showAtmosphere
            pointsData={displayedBooths}
            pointLat="lat"
            pointLng="lng"
            pointColor={() => "#10B981"}
            pointAltitude={0.04}
            pointRadius={0.55}
            onPointHover={(point) => setHoveredBooth((point as BoothPoint) || null)}
            onPointClick={(point) => focusBooth(point as BoothPoint)}
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

          <AnimatePresence>
            {hoveredBooth && !selectedBooth && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "rgba(13, 19, 31, 0.95)",
                  border: "1px solid rgba(37, 99, 235, 0.5)",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  color: "#F8FAFC",
                  pointerEvents: "none",
                  zIndex: 1001,
                  whiteSpace: "nowrap"
                }}
              >
                <strong>{hoveredBooth.name}</strong>
                <span style={{ color: "#94A3B8", marginLeft: "8px" }}>Click to inspect</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedBooth && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  backgroundColor: "rgba(13, 19, 31, 0.96)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  borderRadius: "16px",
                  padding: "24px",
                  width: "90%",
                  maxWidth: "360px",
                  backdropFilter: "blur(12px)",
                  zIndex: 1002
                }}
              >
                <button
                  onClick={() => setSelectedBooth(null)}
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "transparent",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  <X size={16} />
                </button>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.12)", padding: "3px 8px", borderRadius: "10px", textTransform: "uppercase" }}>Active DePIN Node</span>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#F8FAFC", marginTop: "8px" }}>{selectedBooth.name}</h3>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px" }}>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <MapPin size={18} weight="duotone" style={{ color: "#3B82F6", flexShrink: 0, marginTop: "2px" }} />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase" }}>Address</span>
                        <span style={{ fontSize: "13px", color: "#F8FAFC", lineHeight: 1.4 }}>{selectedBooth.address}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <CurrencyDollar size={18} weight="duotone" style={{ color: "#10B981", flexShrink: 0 }} />
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase" }}>Collateral Stake</span>
                        <span className="tabular-nums" style={{ fontSize: "13px", color: "#F8FAFC", fontWeight: 700 }}>{selectedBooth.collateral} USDC</span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                      <div>
                        <span style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase" }}>Operator</span>
                        <span style={{ fontSize: "13px", color: "#F8FAFC", display: "block" }}>{selectedBooth.owner}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "10px", color: "#64748B", textTransform: "uppercase" }}>Coordinates</span>
                        <span className="tabular-nums" style={{ fontSize: "11px", color: "#94A3B8", display: "block" }}>{selectedBooth.coordinates}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedBooth(null)}
                    style={{
                      backgroundColor: "#2563EB",
                      color: "#F8FAFC",
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      marginTop: "4px"
                    }}
                  >
                    Close Inspection
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const controlBtnStyle = {
  backgroundColor: "rgba(13, 19, 31, 0.88)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#F8FAFC",
  borderRadius: "8px",
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: 1000
};
