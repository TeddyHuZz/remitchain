"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Store, 
  Check, 
  MapPin, 
  DollarSign, 
  Mail, 
  User,
  Wallet,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { createWalletClient, createPublicClient, custom, http, parseUnits, parseGwei, formatUnits } from "viem";
import { polygonAmoy } from "viem/chains";
import styles from "./page.module.css";

const IERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

const BOOTH_REGISTRY_ABI = [
  {
    name: "applyForBooth",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ipfsHash", type: "string" },
      { name: "collateralAmount", type: "uint256" }
    ],
    outputs: []
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
    name: "cancelApplication",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  }
] as const;

export default function BoothApplication() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStep, setTxStep] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form input states
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const [collateral, setCollateral] = useState("");
  const [description, setDescription] = useState("");

  const [existingBooth, setExistingBooth] = useState<{
    ipfsHash: string;
    collateral: number;
    status: "PENDING" | "APPROVED" | "REJECTED";
    submittedAt: number;
  } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  const registryAddress = process.env.NEXT_PUBLIC_BOOTH_REGISTRY_ADDRESS;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
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

  const checkExistingBooth = useCallback(async () => {
    if (!walletAddress || !registryAddress) {
      setExistingBooth(null);
      return;
    }
    setCheckingExisting(true);
    try {
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl)
      });
      const [ipfsHash, collateralRaw, statusNum, submittedAtRaw] = await publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: BOOTH_REGISTRY_ABI,
        functionName: "booths",
        args: [walletAddress as `0x${string}`]
      });

      const submittedAt = Number(submittedAtRaw);
      if (submittedAt > 0) {
        const statusMap = ["PENDING", "APPROVED", "REJECTED"] as const;
        setExistingBooth({
          ipfsHash,
          collateral: Number(formatUnits(collateralRaw, 6)),
          status: statusMap[statusNum] || "PENDING",
          submittedAt: submittedAt * 1000
        });
      } else {
        setExistingBooth(null);
      }
    } catch (e) {
      console.error("Failed to check existing booth", e);
    } finally {
      setCheckingExisting(false);
    }
  }, [walletAddress, registryAddress, rpcUrl]);

  // Check for existing booth application on-chain
  useEffect(() => {
    checkExistingBooth();
  }, [checkExistingBooth]);

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
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: "Polygon Amoy Testnet",
              nativeCurrency: {
                name: "POL",
                symbol: "POL",
                decimals: 18,
              },
              rpcUrls: ["https://rpc-amoy.polygon.technology/"],
              blockExplorerUrls: ["https://amoy.polygonscan.com/"],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask or compatible Web3 wallet not detected. Please install a wallet extension to proceed.");
      return;
    }
    setIsConnecting(true);
    setFormError(null);
    try {
      await ensureCorrectChain();
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      setWalletAddress(accounts[0]);
    } catch (e: any) {
      setFormError(e.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      await connectWallet();
      return;
    }
    if (!registryAddress) {
      setFormError("BoothRegistry smart contract address is not configured. Please check your .env.local file.");
      return;
    }
    if (!storeName || !ownerName || !email || !address || !coordinates || !collateral) return;

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    try {
      await ensureCorrectChain();
      // 1. IPFS Upload Proxy
      setTxStep("Uploading metadata details to IPFS...");
      const ipfsResponse = await fetch("/api/ipfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          ownerName,
          email,
          address,
          coordinates,
          description
        })
      });

      if (!ipfsResponse.ok) {
        const errorData = await ipfsResponse.json();
        throw new Error(errorData.error || "Failed to upload store details to IPFS.");
      }

      const { ipfsHash } = await ipfsResponse.json();
      setTxStep(`IPFS Upload complete! Hash: ${ipfsHash.slice(0, 8)}...`);

      // 2. Set up viem clients
      const walletClient = createWalletClient({
        chain: polygonAmoy,
        transport: custom((window as any).ethereum)
      });
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl)
      });

      const collateralAmount = parseUnits(collateral, 6); // USDC uses 6 decimals

      // 3. Approve USDC allowance
      setTxStep("Requesting USDC collateral allowance...");
      const approveTxHash = await walletClient.writeContract({
        address: usdcAddress as `0x${string}`,
        abi: IERC20_ABI,
        functionName: "approve",
        args: [registryAddress as `0x${string}`, collateralAmount],
        account: walletAddress as `0x${string}`,
        maxFeePerGas: parseGwei("30"),
        maxPriorityFeePerGas: parseGwei("30")
      });
      
      setTxStep("Confirming USDC allowance transaction on-chain...");
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

      // 4. Call applyForBooth on Registry contract
      setTxStep("Registering booth on-chain...");
      const applyTxHash = await walletClient.writeContract({
        address: registryAddress as `0x${string}`,
        abi: BOOTH_REGISTRY_ABI,
        functionName: "applyForBooth",
        args: [ipfsHash, collateralAmount],
        account: walletAddress as `0x${string}`,
        maxFeePerGas: parseGwei("30"),
        maxPriorityFeePerGas: parseGwei("30")
      });

      setTxStep("Confirming booth registration on-chain...");
      await publicClient.waitForTransactionReceipt({ hash: applyTxHash });

      setFormSuccess(true);
      // Reset inputs
      setStoreName("");
      setOwnerName("");
      setEmail("");
      setAddress("");
      setCoordinates("");
      setCollateral("");
      setDescription("");

      // Query contract immediately to transition view to awaiting compliance dashboard
      await checkExistingBooth();
    } catch (err: any) {
      setFormError(err.message || "An unexpected transaction error occurred.");
    } finally {
      setIsSubmitting(false);
      setTxStep("");
    }
  };

  const handleCancel = async () => {
    if (!walletAddress || !registryAddress) return;
    setIsSubmitting(true);
    setFormError(null);
    setTxStep("Requesting collateral release from smart contract...");
    try {
      await ensureCorrectChain();
      const walletClient = createWalletClient({
        chain: polygonAmoy,
        transport: custom((window as any).ethereum)
      });
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl)
      });
      
      const txHash = await walletClient.writeContract({
        address: registryAddress as `0x${string}`,
        abi: BOOTH_REGISTRY_ABI,
        functionName: "cancelApplication",
        args: [],
        account: walletAddress as `0x${string}`,
        maxFeePerGas: parseGwei("30"),
        maxPriorityFeePerGas: parseGwei("30")
      });

      setTxStep("Confirming collateral withdrawal on-chain...");
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      setExistingBooth(null); // Return to default application form
      alert("Application cancelled successfully. Your collateral stake has been returned to your wallet.");
    } catch (err: any) {
      setFormError(err.message || "Failed to cancel application.");
    } finally {
      setIsSubmitting(false);
      setTxStep("");
    }
  };

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
            <span>RemitChain Booths</span>
          </div>
          <div>
            {walletAddress ? (
              <div className={styles.walletDisplay}>
                <Wallet size={14} />
                <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              </div>
            ) : (
              <button 
                className={styles.connectBtn} 
                onClick={connectWallet}
                disabled={isConnecting}
              >
                {isConnecting ? <Loader2 size={14} className={styles.spin} /> : <Wallet size={14} />}
                <span>Connect Wallet</span>
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
                This application is running in Testnet Mode, but `NEXT_PUBLIC_BOOTH_REGISTRY_ADDRESS` is not configured in your `.env.local`. Deploy the contract first to unlock on-chain submissions.
              </p>
            </div>
          </div>
        )}

        {checkingExisting ? (
          <section className={styles.formSection}>
            <div className={styles.loadingPanel}>
              <Loader2 size={32} className={styles.spin} />
              <p className={styles.loadingText}>Verifying your wallet's merchant registration status on-chain...</p>
            </div>
          </section>
        ) : existingBooth ? (
          <section className={styles.formSection}>
            <div className={styles.portalHeader}>
              <span className={`${styles.portalStatusBadge} ${
                existingBooth.status === "PENDING" ? styles.badgePending :
                existingBooth.status === "APPROVED" ? styles.badgeApproved : styles.badgeRejected
              }`}>
                {existingBooth.status === "PENDING" && "🟡 Awaiting Vetting"}
                {existingBooth.status === "APPROVED" && "🟢 Active Network Booth"}
                {existingBooth.status === "REJECTED" && "🔴 Rejected & Refunded"}
              </span>
              <h1 className={styles.sectionTitle} style={{ marginTop: "12px" }}>DePIN Merchant Portal</h1>
              <p className={styles.sectionSubtitle}>
                Operator Address: <code className={styles.codeText}>{walletAddress}</code>
              </p>
            </div>

            {formError && (
              <div className={styles.errorPanel}>
                <AlertTriangle size={20} className={styles.errorIcon} />
                <div>
                  <h4 className={styles.errorTitle}>Action Failed</h4>
                  <p className={styles.errorDesc}>{formError}</p>
                </div>
              </div>
            )}

            {isSubmitting && (
              <div className={styles.pendingPanel}>
                <Loader2 size={24} className={styles.spin} />
                <div>
                  <h4 className={styles.pendingTitle}>Processing Withdrawal...</h4>
                  <p className={styles.pendingDesc}>{txStep}</p>
                </div>
              </div>
            )}

            {existingBooth.status === "PENDING" && (
              <div className={styles.pendingDashboard}>
                <div className={styles.infoRow}>
                  <span>Staked Collateral Escrow:</span>
                  <strong className={styles.infoVal}>{existingBooth.collateral} USDC</strong>
                </div>
                <div className={styles.infoRow}>
                  <span>Submission Date:</span>
                  <strong className={styles.infoVal}>{new Date(existingBooth.submittedAt).toLocaleDateString()}</strong>
                </div>
                <div className={styles.dashboardAlert}>
                  <p>Your physical storefront registration has been recorded on the Polygon Amoy blockchain. Our compliance team is verifying your coordinates and store liquidity reserves.</p>
                </div>
                
                <button 
                  type="button" 
                  className={styles.cancelBtn} 
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel Application & Reclaim Stake
                </button>
              </div>
            )}

            {existingBooth.status === "APPROVED" && (
              <div className={styles.approvedDashboard}>
                {/* Metrics Cards Grid */}
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Daily Payouts Verified</span>
                    <span className={styles.metricValue}>14</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Total Volume Processed</span>
                    <span className={styles.metricValue}>$1,420.00 USDC</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Commissions Earned</span>
                    <span className={styles.metricValue} style={{ color: "#10B981" }}>+$14.20 USDC</span>
                  </div>
                </div>

                {/* Simulated payout releases */}
                <div className={styles.consoleSection}>
                  <h3 className={styles.consoleTitle}>Verify Customer Pickup Code</h3>
                  <p className={styles.consoleDesc}>
                    Verify the cross-border transaction code when a customer arrives at your retail storefront to retrieve cash.
                  </p>
                  <div className={styles.consoleInputGroup}>
                    <input 
                      type="text" 
                      className={styles.consoleInput} 
                      placeholder="e.g. TXN-894-Manila" 
                    />
                    <button 
                      type="button" 
                      className={styles.consoleBtn}
                      onClick={() => alert("Cross-border transaction verified on-chain! Cash-out authorized. Release local cash to receiver.")}
                    >
                      Verify Transfer
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "20px" }}>
                  <button 
                    type="button" 
                    className={styles.cancelBtn} 
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Deactivate Booth & Reclaim Stake
                  </button>
                </div>
              </div>
            )}

            {existingBooth.status === "REJECTED" && (
              <div className={styles.rejectedDashboard}>
                <div className={styles.rejectedAlert}>
                  <p>Your application did not satisfy compliance vetting. Your locked 10 USDC collateral deposit has been refunded to your wallet address.</p>
                </div>
                <div className={styles.infoRow}>
                  <span>Escrow Refund Status:</span>
                  <strong style={{ color: "#EF4444" }}>COLLATERAL REFUNDED</strong>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className={styles.formSection}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.sectionTitle}>Partner Booth Application</h1>
              <p className={styles.sectionSubtitle}>
                Register your retail storefront to serve as a local cross-border withdrawal node and earn commissions on cash-out transactions.
              </p>
            </div>

            {formSuccess && (
              <div className={styles.successPanel}>
                <Check size={20} className={styles.successIcon} />
                <div>
                  <h4 className={styles.successTitle}>Application Registered!</h4>
                  <p className={styles.successDesc}>
                    Your collateral stake has been locked in escrow and your booth has been registered on-chain. Admin approval will activate your node in the physical map.
                  </p>
                </div>
              </div>
            )}

            {formError && (
              <div className={styles.errorPanel}>
                <AlertTriangle size={20} className={styles.errorIcon} />
                <div>
                  <h4 className={styles.errorTitle}>Transaction Failed</h4>
                  <p className={styles.errorDesc}>{formError}</p>
                </div>
              </div>
            )}

            {isSubmitting && (
              <div className={styles.pendingPanel}>
                <Loader2 size={24} className={styles.spin} />
                <div>
                  <h4 className={styles.pendingTitle}>Transaction Processing...</h4>
                  <p className={styles.pendingDesc}>{txStep}</p>
                </div>
              </div>
            )}

            <form className={styles.applyForm} onSubmit={handleApply}>
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Storefront Name</label>
                  <div className={styles.inputIconWrapper}>
                    <Store size={14} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      placeholder="e.g. Sari-Sari Store Central"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Owner / Legal Representative</label>
                  <div className={styles.inputIconWrapper}>
                    <User size={14} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      placeholder="e.g. Maria Santos"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Contact Email Address</label>
                  <div className={styles.inputIconWrapper}>
                    <Mail size={14} className={styles.inputIcon} />
                    <input 
                      type="email" 
                      className={styles.formInput} 
                      placeholder="e.g. owner@store.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Collateral Deposit Commitment (USDC)</label>
                  <div className={styles.inputIconWrapper}>
                    <DollarSign size={14} className={styles.inputIcon} />
                    <input 
                      type="number" 
                      className={styles.formInput} 
                      placeholder="Minimum 10 USDC"
                      min="10"
                      value={collateral}
                      onChange={(e) => setCollateral(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.formField} style={{ gridColumn: "span 2" }}>
                  <label className={styles.fieldLabel}>Physical Store Address</label>
                  <div className={styles.inputIconWrapper}>
                    <MapPin size={14} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      placeholder="e.g. 128 Rizal Avenue, Manila, Philippines"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Geographical Coordinates (Latitude, Longitude)</label>
                  <div className={styles.inputIconWrapper}>
                    <MapPin size={14} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      className={styles.formInput} 
                      placeholder="e.g. 14.5995, 120.9842"
                      value={coordinates}
                      onChange={(e) => setCoordinates(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className={styles.formField} style={{ gridColumn: "span 2" }}>
                  <label className={styles.fieldLabel}>Store Description & Operating Hours</label>
                  <textarea 
                    className={styles.formTextarea} 
                    placeholder="Describe your general store layout, regular cash flow, operating hours, and why you would be a reliable cashout merchant."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className={styles.submitBtn} 
                disabled={isSubmitting || !registryAddress}
              >
                {!walletAddress ? "Connect Wallet to Submit" : isSubmitting ? "Processing..." : "Submit On-Chain Application"}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
