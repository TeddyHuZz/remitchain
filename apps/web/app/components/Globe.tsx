"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { polygonAmoy } from "viem/chains";
import { Loader2, MapPin, DollarSign, X, ZoomIn, ZoomOut, Maximize } from "lucide-react";

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
  email: string;
  owner: string;
  collateral: number;
  coordinates: string;
  status: string;
}

export default function Globe() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [booths, setBooths] = useState<BoothPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooth, setSelectedBooth] = useState<BoothPoint | null>(null);
  const [hoveredBooth, setHoveredBooth] = useState<BoothPoint | null>(null);
  const [filter, setFilter] = useState<"ALL" | "USDC">("ALL");
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const registryAddress = process.env.NEXT_PUBLIC_BOOTH_REGISTRY_ADDRESS || "0x7bCB577350e600c1372036094f7F7464e54E90b6";
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology/";

  // Dynamically load Leaflet resources client-side only (avoid SSR window errors)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load Leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  // Load approved booths from smart contract
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
                    address: meta.address || "No address provided",
                    email: meta.email || "No email provided",
                    owner: meta.ownerName || "Unknown",
                    collateral: Number(formatUnits(collateralRaw, 6)),
                    coordinates: meta.coordinates,
                    status: "Active"
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
                      address: meta.address || "No address provided",
                      email: meta.email || "No email provided",
                      owner: meta.ownerName || "Unknown",
                      collateral: Number(formatUnits(collateralRaw, 6)),
                      coordinates: meta.coordinates,
                      status: "Active"
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

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || loading || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapInstance.current) {
      // Create map
      const map = L.map(mapContainerRef.current, {
        center: [20, 10], // Centered globally
        zoom: 2,
        zoomControl: false,
        attributionControl: false
      });

      // Add CartoDB Dark Matter base layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        minZoom: 1
      }).addTo(map);

      mapInstance.current = map;
    }

    const map = mapInstance.current;

    // Clear existing markers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Apply filters
    const displayedBooths = booths.filter(b => {
      if (filter === "ALL") return true;
      return b.collateral >= 10;
    });

    // Add markers
    displayedBooths.forEach((booth) => {
      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; left: -4px; top: -4px; width: 18px; height: 18px; border-radius: 50%; background-color: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); animation: pulseRing 2s infinite ease-in-out;"></div>
            <div style="position: absolute; left: 1px; top: 1px; width: 8px; height: 8px; border-radius: 50%; background-color: #10B981; box-shadow: 0 0 8px #10B981, 0 0 16px #10B981; border: 1.5px solid #FFFFFF;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([booth.lat, booth.lng], { icon: customIcon }).addTo(map);

      marker.on("mouseover", () => {
        setHoveredBooth(booth);
      });
      marker.on("mouseout", () => {
        setHoveredBooth(null);
      });
      marker.on("click", () => {
        setSelectedBooth(booth);
      });
    });

  }, [leafletLoaded, loading, booths, filter]);

  // Custom controller triggers
  const zoomIn = () => {
    mapInstance.current?.zoomIn();
  };

  const zoomOut = () => {
    mapInstance.current?.zoomOut();
  };

  const resetView = () => {
    mapInstance.current?.setView([20, 10], 2);
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
      
      {/* SIDEBAR METRICS PANEL */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Header tabs */}
        <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#9945FF", borderBottom: "2px solid #9945FF", paddingBottom: "10px" }}>
            Verified Projects
          </span>
        </div>

        {/* Stats Cards */}
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

        {/* Directory Filters */}
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

      {/* MAP EXPLORER DISPLAY AREA */}
      <div style={{ display: "flex", flexDirection: "column", position: "relative", width: "100%", height: "100%" }}>
        
        {/* Floating Controls Overlay */}
        <div style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          zIndex: 1000
        }}>
          <button onClick={resetView} style={controlBtnStyle}><Maximize size={14} /></button>
          <button onClick={zoomIn} style={controlBtnStyle}><ZoomIn size={14} /></button>
          <button onClick={zoomOut} style={controlBtnStyle}><ZoomOut size={14} /></button>
        </div>

        {/* Map Container */}
        <div style={{
          position: "relative",
          width: "100%",
          height: "100%",
          minHeight: "410px",
          backgroundColor: "#05060b",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: "12px",
          overflow: "hidden"
        }}>
          {/* Leaflet container hook */}
          <div 
            ref={mapContainerRef} 
            style={{ width: "100%", height: "100%", minHeight: "410px", background: "#05060b" }} 
          />

          {/* Hover Tooltip Overlay */}
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

          {/* Detail modal for selected pin */}
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

      {/* Embedded Animations & Leaflet styling overrides */}
      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(0.65); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .leaflet-grab {
          cursor: grab !important;
        }
        .leaflet-dragging .leaflet-grab {
          cursor: grabbing !important;
        }
        .leaflet-tile {
          filter: brightness(1.1) contrast(1.1) hue-rotate(220deg) saturate(0.8) !important;
        }
      `}</style>

    </div>
  );
}

// Button styles
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
