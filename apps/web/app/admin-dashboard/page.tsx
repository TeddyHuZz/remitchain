"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Lock, 
  ShieldAlert, 
  Check, 
  X, 
  LogOut, 
  Store, 
  MapPin, 
  DollarSign, 
  Mail, 
  User,
  Wallet,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { createWalletClient, createPublicClient, custom, http, formatUnits, parseGwei } from "viem";
import { polygonAmoy } from "viem/chains";
import styles from "./page.module.css";

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
  },
  {
    name: "reviewBooth",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vendor", type: "address" },
      { name: "status", type: "uint8" }
    ],
    outputs: []
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const;

interface Applicant {
  address: string;
  ipfsHash: string;
  collateral: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: number;
  storeName?: string;
  ownerName?: string;
  email?: string;
  addressText?: string;
  coordinates?: string;
  description?: string;
}

export default function AdminDashboard() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState("");

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isContractOwner, setIsContractOwner] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [txPending, setTxPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  const registryAddress = process.env.NEXT_PUBLIC_BOOTH_REGISTRY_ADDRESS;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc-amoy.polygon.technology/";

  // Auto-connect wallet if already authorized
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        } catch (e) {
          console.error("Wallet check failed", e);
        }
      }
    };
    checkConnection();
  }, []);

  // Sync Contract Owner Assertion when wallet changes
  useEffect(() => {
    const checkOwner = async () => {
      if (!walletAddress || !registryAddress) return;
      try {
        const publicClient = createPublicClient({
          chain: polygonAmoy,
          transport: http(rpcUrl)
        });
        const ownerAddr = await publicClient.readContract({
          address: registryAddress as `0x${string}`,
          abi: BOOTH_REGISTRY_ABI,
          functionName: "owner"
        });
        setIsContractOwner(ownerAddr.toLowerCase() === walletAddress.toLowerCase());
      } catch (e) {
        console.error("Failed to check owner", e);
      }
    };
    checkOwner();
  }, [walletAddress, registryAddress]);

  // Load applicants from smart contract
  const loadApplicants = async () => {
    if (!registryAddress) return;
    setIsLoadingList(true);
    setActionError(null);
    try {
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl)
      });

      // 1. Get addresses registered on-chain
      const addresses = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: BOOTH_REGISTRY_ABI,
        functionName: "getBoothAddresses"
      });

      // 2. Fetch details for each booth address
      const loaded: Applicant[] = [];
      for (const addr of addresses) {
        const [ipfsHash, collateralRaw, statusNum, submittedAtRaw] = await publicClient.readContract({
          address: registryAddress as `0x${string}`,
          abi: BOOTH_REGISTRY_ABI,
          functionName: "booths",
          args: [addr]
        });

        const statusMap = ["PENDING", "APPROVED", "REJECTED"] as const;

        const applicant: Applicant = {
          address: addr,
          ipfsHash,
          collateral: Number(formatUnits(collateralRaw, 6)),
          status: statusMap[statusNum] || "PENDING",
          submittedAt: Number(submittedAtRaw) * 1000 // Convert to ms
        };

        // Fetch IPFS metadata payload
        if (ipfsHash) {
          try {
            const metaRes = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`, { signal: AbortSignal.timeout(3000) });
            if (metaRes.ok) {
              const meta = await metaRes.json();
              applicant.storeName = meta.storeName;
              applicant.ownerName = meta.ownerName;
              applicant.email = meta.email;
              applicant.addressText = meta.address;
              applicant.coordinates = meta.coordinates;
              applicant.description = meta.description;
            }
          } catch (e) {
            // Fallback gateway
            try {
              const metaRes = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`, { signal: AbortSignal.timeout(3000) });
              if (metaRes.ok) {
                const meta = await metaRes.json();
                applicant.storeName = meta.storeName;
                applicant.ownerName = meta.ownerName;
                applicant.email = meta.email;
                applicant.addressText = meta.address;
                applicant.coordinates = meta.coordinates;
                applicant.description = meta.description;
              }
            } catch (err) {
              console.warn("Failed to resolve IPFS hash for", addr, err);
            }
          }
        }

        loaded.push(applicant);
      }

      // Sort with newest submissions first
      setApplicants(loaded.reverse());
    } catch (e: any) {
      setActionError(e.message || "Failed to load booth list from contract.");
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isAuthorized && registryAddress) {
      loadApplicants();
    }
  }, [isAuthorized, registryAddress]);

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask or compatible Web3 wallet not detected. Please install a wallet extension to proceed.");
      return;
    }
    setIsConnecting(true);
    setActionError(null);
    try {
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      setWalletAddress(accounts[0]);
    } catch (e: any) {
      setActionError(e.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === "admin123") {
      setIsAuthorized(true);
      setLoginError("");
    } else {
      setLoginError("Invalid Administrator Passcode. Access Denied.");
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    setPasscode("");
  };

  const ensureCorrectChain = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const chainIdHex = "0x13882"; // 80002 in hex for Polygon Amoy
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: "Polygon Amoy Testnet",
                nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                rpcUrls: ["https://rpc-amoy.polygon.technology/"],
                blockExplorerUrls: ["https://amoy.polygonscan.com/"],
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add network", addError);
        }
      }
      console.error("Failed to switch network", switchError);
    }
  };

  const handleReview = async (vendor: string, newStatus: number) => {
    let currentWallet = walletAddress;

    // Auto-connect if wallet is disconnected
    if (!currentWallet) {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        alert("MetaMask or compatible Web3 wallet not detected. Please install a wallet extension to proceed.");
        return;
      }
      setIsConnecting(true);
      setActionError(null);
      try {
        const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
        currentWallet = accounts[0];
        setWalletAddress(currentWallet);
      } catch (e: any) {
        setActionError(e.message || "Failed to connect wallet.");
        setIsConnecting(false);
        return;
      }
      setIsConnecting(false);
    }

    if (!currentWallet || !registryAddress) return;

    setTxPending(newStatus === 1 ? "Approving booth..." : "Rejecting application...");
    setActionError(null);

    try {
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl)
      });

      // Verify contract owner status
      const ownerAddr = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: BOOTH_REGISTRY_ABI,
        functionName: "owner"
      });
      const isOwner = ownerAddr.toLowerCase() === currentWallet.toLowerCase();
      setIsContractOwner(isOwner);
      
      if (!isOwner) {
        throw new Error(`Access Denied: Connected wallet (${currentWallet.slice(0, 6)}...${currentWallet.slice(-4)}) is not the owner of the registry contract.`);
      }

      await ensureCorrectChain();

      const walletClient = createWalletClient({
        chain: polygonAmoy,
        transport: custom((window as any).ethereum)
      });

      const txHash = await walletClient.writeContract({
        address: registryAddress as `0x${string}`,
        abi: BOOTH_REGISTRY_ABI,
        functionName: "reviewBooth",
        args: [vendor as `0x${string}`, newStatus],
        account: currentWallet as `0x${string}`,
        maxFeePerGas: parseGwei("30"),
        maxPriorityFeePerGas: parseGwei("30")
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await loadApplicants(); // Reload
    } catch (e: any) {
      setActionError(e.message || "Smart contract transaction failed.");
    } finally {
      setTxPending(null);
    }
  };

  const totalCount = applicants.length;
  const pendingCount = applicants.filter(a => a.status === "PENDING").length;
  const approvedCount = applicants.filter(a => a.status === "APPROVED").length;
  const rejectedCount = applicants.filter(a => a.status === "REJECTED").length;

  const filteredApplicants = applicants.filter(app => {
    if (filterStatus === "ALL") return true;
    return app.status === filterStatus;
  });

  return (
    <div className={styles.container}>
      <div className="gridBackground" />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.backButton}>
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
          <div className={styles.logo}>
            <img src="/logo.png" alt="RemitChain Logo" className={styles.logoImage} />
            <span>RemitChain Admin</span>
          </div>
          <div className={styles.headerActions}>
            {walletAddress ? (
              <div className={styles.walletDisplay}>
                <Wallet size={14} />
                <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              </div>
            ) : (
              <button className={styles.connectBtn} onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? <Loader2 size={14} className={styles.spin} /> : <Wallet size={14} />}
                <span>Connect Wallet</span>
              </button>
            )}
            {isAuthorized && (
              <button className={styles.logoutButton} onClick={handleLogout}>
                <LogOut size={14} />
                <span>Lock Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={styles.mainContent}>
        {!registryAddress && (
          <div className={styles.warningPanel}>
            <AlertTriangle size={20} className={styles.warningIcon} />
            <div>
              <h4 className={styles.warningTitle}>Smart Contract Address Missing</h4>
              <p className={styles.warningDesc}>
                This application is running in Testnet Mode, but `NEXT_PUBLIC_BOOTH_REGISTRY_ADDRESS` is not configured in your `.env.local`. Deploy the contract first to unlock administrative reviews.
              </p>
            </div>
          </div>
        )}

        {walletAddress && !isContractOwner && registryAddress && (
          <div className={styles.warningPanel}>
            <ShieldAlert size={20} className={styles.warningIcon} style={{ color: "#EF4444" }} />
            <div>
              <h4 className={styles.warningTitle} style={{ color: "#EF4444" }}>Non-Owner Wallet Connected</h4>
              <p className={styles.warningDesc}>
                Your wallet is not the designated Owner of the registry contract. You can inspect submissions, but writing approval statuses will reject on-chain.
              </p>
            </div>
          </div>
        )}

        {actionError && (
          <div className={styles.errorPanel}>
            <AlertTriangle size={20} className={styles.errorIcon} />
            <div>
              <h4 className={styles.errorTitle}>Transaction Error</h4>
              <p className={styles.errorDesc}>{actionError}</p>
            </div>
          </div>
        )}

        {txPending && (
          <div className={styles.pendingPanel}>
            <Loader2 size={24} className={styles.spin} />
            <div>
              <h4 className={styles.pendingTitle}>Signing Smart Contract Write...</h4>
              <p className={styles.pendingDesc}>{txPending}</p>
            </div>
          </div>
        )}

        {/* LOGIN SCREEN */}
        {!isAuthorized ? (
          <section className={styles.loginCardSection}>
            <div className={styles.loginCard}>
              <div className={styles.lockIconCircle}>
                <Lock size={24} className={styles.lockIcon} />
              </div>
              <h2 className={styles.loginTitle}>Admin Authentication Required</h2>
              <p className={styles.loginDesc}>
                Access is restricted to authorized RemitChain foundation personnel. Please enter your terminal security passcode below.
              </p>

              {loginError && (
                <div className={styles.errorBanner}>
                  <ShieldAlert size={16} className={styles.errorIcon} />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className={styles.loginForm}>
                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Security Passcode</label>
                  <input 
                    type="password" 
                    className={styles.passcodeInput} 
                    placeholder="••••••••••••"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className={styles.loginBtn}>
                  Verify Credentials
                </button>
              </form>
            </div>
          </section>
        ) : (
          /* REVIEW PANEL */
          <section className={styles.adminSection}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.sectionTitle}>Booth Registry Dashboard</h1>
              <p className={styles.sectionSubtitle}>
                Review incoming registry applications, inspect collateral lock assertions, and approve stores into the geolocated map directory.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Applicants</span>
                <span className={styles.statVal}>{totalCount}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Pending Reviews</span>
                <span className={styles.statVal} style={{ color: "#F59E0B" }}>{pendingCount}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Active Booths</span>
                <span className={styles.statVal} style={{ color: "#10B981" }}>{approvedCount}</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className={styles.filterTabs}>
              <button 
                className={`${styles.tabBtn} ${filterStatus === "ALL" ? styles.tabBtnActive : ""}`}
                onClick={() => setFilterStatus("ALL")}
              >
                All Submissions ({totalCount})
              </button>
              <button 
                className={`${styles.tabBtn} ${filterStatus === "PENDING" ? styles.tabBtnActive : ""}`}
                onClick={() => setFilterStatus("PENDING")}
              >
                🟡 Pending Vetting ({pendingCount})
              </button>
              <button 
                className={`${styles.tabBtn} ${filterStatus === "APPROVED" ? styles.tabBtnActive : ""}`}
                onClick={() => setFilterStatus("APPROVED")}
              >
                🟢 Active Nodes ({approvedCount})
              </button>
              <button 
                className={`${styles.tabBtn} ${filterStatus === "REJECTED" ? styles.tabBtnActive : ""}`}
                onClick={() => setFilterStatus("REJECTED")}
              >
                🔴 Rejected & Refunded ({rejectedCount})
              </button>
            </div>

            <div className={styles.applicantsList}>
              {isLoadingList ? (
                <div className={styles.emptyCard}>
                  <Loader2 size={32} className={styles.spin} />
                  <span>Querying on-chain registry state and resolving IPFS schemas...</span>
                </div>
              ) : applicants.length === 0 ? (
                <div className={styles.emptyCard}>
                  <ShieldAlert size={24} className={styles.emptyIcon} />
                  <span>No applications found in the deployed smart contract.</span>
                </div>
              ) : filteredApplicants.length === 0 ? (
                <div className={styles.emptyCard}>
                  <ShieldAlert size={24} className={styles.emptyIcon} />
                  <span>No {filterStatus.toLowerCase()} applications found.</span>
                </div>
              ) : (
                filteredApplicants.map((app) => (
                  <div key={app.address} className={styles.applicantCard}>
                    <div className={styles.cardHeaderRow}>
                      <div>
                        <h3 className={styles.storeTitle}>{app.storeName || "Unknown Booth (Resolving Metadata)"}</h3>
                        <span className={styles.submittedDate}>
                          Account Address: <code className={styles.codeText}>{app.address}</code>
                        </span>
                      </div>
                      
                      {app.status === "PENDING" && (
                        <span className={`${styles.statusBadge} ${styles.badgePending}`}>Pending Review</span>
                      )}
                      {app.status === "APPROVED" && (
                        <span className={`${styles.statusBadge} ${styles.badgeApproved}`}>🟢 Active Booth</span>
                      )}
                      {app.status === "REJECTED" && (
                        <span className={`${styles.statusBadge} ${styles.badgeRejected}`}>🔴 Rejected</span>
                      )}
                    </div>

                    <div className={styles.detailsGrid}>
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>Owner</span>
                        <span className={styles.detailValue}>{app.ownerName || "Loading..."}</span>
                      </div>
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>Email</span>
                        <span className={styles.detailValue}>{app.email || "Loading..."}</span>
                      </div>
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>Address</span>
                        <span className={styles.detailValue}>{app.addressText || "Loading..."}</span>
                      </div>
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>Coordinates</span>
                        <span className={styles.detailValue}>{app.coordinates || "Loading..."}</span>
                      </div>
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>On-Chain Collateral</span>
                        <span className={styles.detailValue} style={{ color: "#10B981", fontWeight: 700 }}>
                          {app.collateral} USDC
                        </span>
                      </div>
                      <div className={styles.detailBlock}>
                        <span className={styles.detailLabel}>IPFS Metadata Hash</span>
                        <span className={styles.detailValue}>
                          <a 
                            href={`https://ipfs.io/ipfs/${app.ipfsHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.ipfsLink}
                          >
                            {app.ipfsHash.slice(0, 16)}...
                          </a>
                        </span>
                      </div>
                    </div>

                    {app.description && (
                      <div className={styles.descriptionBlock}>
                        <span className={styles.detailLabel}>Store Description</span>
                        <p className={styles.descriptionText}>{app.description}</p>
                      </div>
                    )}

                    {app.status === "PENDING" && (
                      <div className={styles.actionRow}>
                        <button 
                          className={`${styles.actionBtn} ${styles.btnApprove}`}
                          onClick={() => handleReview(app.address, 1)}
                          disabled={(walletAddress !== null && !isContractOwner) || !registryAddress || txPending !== null || isConnecting}
                        >
                          <Check size={14} />
                          <span>Approve & Add to Directory</span>
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.btnReject}`}
                          onClick={() => handleReview(app.address, 2)}
                          disabled={(walletAddress !== null && !isContractOwner) || !registryAddress || txPending !== null || isConnecting}
                        >
                          <X size={14} />
                          <span>Reject & Refund Stake</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
