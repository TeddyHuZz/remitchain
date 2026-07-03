"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Shield, Cpu, Network, Percent, ChevronRight } from "lucide-react";
import styles from "./page.module.css";

export default function Whitepaper() {
  const [activeSection, setActiveSection] = useState("abstract");

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["abstract", "introduction", "erc4337", "depin", "yield", "security", "conclusion"];
      const scrollPosition = window.scrollY + 200;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
            <span>RemitChain Labs</span>
          </div>
        </div>
      </header>

      <div className={styles.contentWrapper}>
        {/* Sidebar Table of Contents */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Table of Contents</div>
          <nav className={styles.nav}>
            <a
              href="#abstract"
              className={`${styles.navLink} ${activeSection === "abstract" ? styles.active : ""}`}
            >
              <BookOpen size={14} />
              <span>Abstract</span>
            </a>
            <a
              href="#introduction"
              className={`${styles.navLink} ${activeSection === "introduction" ? styles.active : ""}`}
            >
              <Network size={14} />
              <span>1. Introduction</span>
            </a>
            <a
              href="#erc4337"
              className={`${styles.navLink} ${activeSection === "erc4337" ? styles.active : ""}`}
            >
              <Cpu size={14} />
              <span>2. ERC-4337 Integration</span>
            </a>
            <a
              href="#depin"
              className={`${styles.navLink} ${activeSection === "depin" ? styles.active : ""}`}
            >
              <Network size={14} />
              <span>3. DePIN Liquidity Booths</span>
            </a>
            <a
              href="#yield"
              className={`${styles.navLink} ${activeSection === "yield" ? styles.active : ""}`}
            >
              <Percent size={14} />
              <span>4. Real-time Yield Vault</span>
            </a>
            <a
              href="#security"
              className={`${styles.navLink} ${activeSection === "security" ? styles.active : ""}`}
            >
              <Shield size={14} />
              <span>5. Security & Cryptography</span>
            </a>
            <a
              href="#conclusion"
              className={`${styles.navLink} ${activeSection === "conclusion" ? styles.active : ""}`}
            >
              <Clock size={14} />
              <span>6. Conclusion & Roadmap</span>
            </a>
          </nav>
        </aside>

        {/* Main Document Content */}
        <main className={styles.mainContent}>
          <article className={styles.paper}>
            {/* Academic Header */}
            <div className={styles.paperHeader}>
              <div className={styles.paperCategory}>Protocol Whitepaper • v1.0.4</div>
              <h1 className={styles.paperTitle}>
                RemitChain: A Gasless Account-Abstracted Protocol for Decentralized Physical Cash-Out Networks
              </h1>
              <div className={styles.authors}>
                <div className={styles.author}>
                  <strong>RemitChain Core Engineering Group</strong>
                  <span>labs@remitchain.network</span>
                </div>
              </div>
              <div className={styles.paperMetadata}>
                <span>Published: July 2026</span>
                <span>•</span>
                <span>DOI: 10.48550/remitchain.depin.4337</span>
              </div>
            </div>

            {/* Abstract */}
            <section id="abstract" className={styles.section}>
              <h2 className={styles.sectionHeading}>Abstract</h2>
              <div className={styles.abstractBlock}>
                <p>
                  Traditional cross-border remittance corridors remain plagued by high transaction fees (averaging 6.2%), operational delays (2–5 business days), and extensive physical agent dependencies. While public blockchain ledgers offer instantaneous transfer speeds, direct consumer adoption is hindered by cryptographic key management overhead, native token gas fees, and volatile exchange rates.
                </p>
                <p>
                  This paper introduces <strong>RemitChain</strong>, a non-custodial decentralized physical infrastructure network (DePIN) that bypasses traditional banking intermediaries to deliver instant, gasless digital stablecoin transfers directly connected to local retail cash-out gateways. By combining ERC-4337 Account Abstraction with a decentralized directory of incentivized physical storefronts ("Booths"), RemitChain creates a trustless, frictionless cash-in/cash-out layer. Furthermore, we outline the linear mathematical framework governing the on-chain real-time interest accumulation protocol that enables users to hedge inflation while funds are in transit.
                </p>
              </div>
            </section>

            {/* 1. Introduction */}
            <section id="introduction" className={styles.section}>
              <h2 className={styles.sectionHeading}>1. Introduction & Background</h2>
              <p>
                Global remittances represent a critical financial lifeline for developing nations, exceeding $800 billion annually. However, the capital flow remains inefficient, captured by centralized networks like Western Union or SWIFT. Users face double-taxation through flat transaction service charges and hidden exchange rate spreads.
              </p>
              <p>
                Public blockchains (e.g., Ethereum, Polygon, Arbitrum) offer programmatic solutions for transferring digital dollar equivalents (USDC/USDT) peer-to-peer. Yet, the UX gap to cross this chasm remains insurmountable for average remitters:
              </p>
              <ul className={styles.bullets}>
                <li><strong>Gas Friction:</strong> The necessity of acquiring native network utility tokens (e.g., POL, ETH) to initiate transfers.</li>
                <li><strong>Seed Phrase Management:</strong> Extreme vulnerability to data loss; a single misplaced recovery key results in absolute capital loss.</li>
                <li><strong>The Cash-out Chasm:</strong> Digital tokens are unusable for daily physical micro-transactions in cash-dependent economies. Direct banking wire integrations are restricted by local regulatory frameworks and low banking penetration.</li>
              </ul>
              <p>
                RemitChain addresses these hurdles by providing a unified protocol stack: a gas-sponsored mobile application acting as a smart wallet client, backed by an autonomous directory of peer-to-peer liquidity merchants.
              </p>
            </section>

            {/* 2. ERC-4337 */}
            <section id="erc4337" className={styles.section}>
              <h2 className={styles.sectionHeading}>2. ERC-4337 Account Abstraction Architecture</h2>
              <p>
                To eliminate the concept of seed phrases and external utility tokens, RemitChain leverages ERC-4337 Account Abstraction. The core user wallet is not an Externally Owned Account (EOA), but an autonomous smart contract deployed on-chain.
              </p>

              <div className={styles.diagramContainer}>
                <div className={styles.diagramBox}>
                  <h4>UserOperation Lifecycle</h4>
                  <div className={styles.diagramFlow}>
                    <div className={styles.flowNode}>Mobile Client (EOA Signer)</div>
                    <div className={styles.flowArrow}><ChevronRight size={14} /></div>
                    <div className={styles.flowNode}>Bundler Mempool</div>
                    <div className={styles.flowArrow}><ChevronRight size={14} /></div>
                    <div className={styles.flowNode}>EntryPoint Contract</div>
                    <div className={styles.flowArrow}><ChevronRight size={14} /></div>
                    <div className={styles.flowNode}>Paymaster (Gas Sponsor)</div>
                    <div className={styles.flowArrow}><ChevronRight size={14} /></div>
                    <div className={styles.flowNode}>User Smart Wallet</div>
                  </div>
                </div>
              </div>

              <h3>2.1 UserOperation Dispatch</h3>
              <p>
                When a user initiates a remittance transfer, the client wallet signs a <code>UserOperation</code> structure rather than a raw transaction. The <code>UserOperation</code> contains:
              </p>
              <div className={styles.codeSnippet}>
                {`struct UserOperation {
  address sender;
  uint256 nonce;
  bytes initCode;
  bytes callData;
  uint256 callGasLimit;
  uint256 verificationGasLimit;
  uint256 preVerificationGas;
  uint256 maxFeePerGas;
  uint256 maxPriorityFeePerGas;
  bytes paymasterAndData;
  bytes signature;
}`}
              </div>

              <h3>2.2 Gas Sponsorship via Paymaster</h3>
              <p>
                The <code>paymasterAndData</code> parameter specifies the address of our verified on-chain Paymaster contract. During the verification loop, the EntryPoint contract queries the Paymaster:
              </p>
              <div className={styles.formulaBox}>
                <code>Paymaster.validatePaymasterUserOp(userOp, userOpHash, maxCost) → (context, validationLimit)</code>
              </div>
              <p>
                If validated, the Paymaster contract covers the gas fees in native tokens from its pre-deposited reserve. The bundler aggregates these validated operations and publishes them to the blockchain. The user sees a "Gasless" transaction interface, completely bypassing the native token barrier.
              </p>
            </section>

            {/* 3. DePIN Liquidity Booths */}
            <section id="depin" className={styles.section}>
              <h2 className={styles.sectionHeading}>3. DePIN Retail Liquidity Networks</h2>
              <p>
                The ultimate bottleneck of digital currency is physical conversion. RemitChain introduces the **Decentralized Physical Infrastructure Network (DePIN) of local store cash-out booths**.
              </p>
              <p>
                Any local merchant—whether a convenience store, a pharmacy, or a corner shop—can download the RemitChain Merchant client, lock a collateral balance of USDC in the protocol, and register as a cash-out gateway. This model replaces specialized branch offices with existing neighborhood infrastructure.
              </p>

              <h3>3.1 Atomic Escrow Exchange Protocol</h3>
              <p>
                To eliminate counterparty risk during physical cash withdrawals, the exchange is performed via an atomic escrow contract mechanism:
              </p>
              <ol className={styles.listNumbered}>
                <li>
                  <strong>Commitment:</strong> The recipient visits a Booth and requests a withdrawal. The recipient initiates a transfer of USDC to the escrow contract, targeting the merchant's identifier.
                </li>
                <li>
                  <strong>Verification:</strong> The recipient's mobile client generates a cryptographically signed QR code containing the transaction signature, amount, and timestamp.
                </li>
                <li>
                  <strong>Handover & Release:</strong> The merchant scans the QR code. The merchant validates the signature against the escrow smart contract, handshakes the physical fiat cash equivalent to the recipient, and submits the release request to the blockchain to instantly sweep the escrowed USDC into their store wallet.
                </li>
              </ol>
              <p>
                This ensures that at no point can the merchant abscond with the funds without rendering physical cash, and the recipient cannot double-spend the USDC.
              </p>
            </section>

            {/* 4. Real-time Yield Vault */}
            <section id="yield" className={styles.section}>
              <h2 className={styles.sectionHeading}>4. Linear Yield Vault Mechanics</h2>
              <p>
                Remittance funds frequently sit idle in wallets prior to cash-out. To maintain purchasing power, RemitChain incorporates a decentralized **Yield Vault** that computes interest dynamically on a second-by-second basis.
              </p>
              <h3>4.1 Mathematical Formulation</h3>
              <p>
                To minimize gas costs during regular transactions, interest is not computed using resource-intensive recurrent cron loops. Instead, we implement a linear calculation based on block timestamp updates:
              </p>
              <div className={styles.formulaBox}>
                <p style={{ fontWeight: 600, color: "#FFFFFF", marginBottom: "8px" }}>Linear Interest Accrual Formula:</p>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", margin: "12px 0", color: "#A5B4FC" }}>
                  I = ( P × R × Δt ) / ( 10,000 × Y_sec )
                </div>
                <div style={{ textAlign: "left", fontSize: "12px", color: "var(--text-description)" }}>
                  Where:<br />
                  • <strong>I</strong> = Cumulative accrued interest (USDC)<br />
                  • <strong>P</strong> = Principal amount deposited<br />
                  • <strong>R</strong> = APY in basis points (e.g., 450 bps for 4.5% APY)<br />
                  • <strong>Δt</strong> = Time elapsed since last state change (in seconds)<br />
                  • <strong>Y_sec</strong> = Number of seconds in a standard calendar year (31,536,000s)
                </div>
              </div>
              <h3>4.2 Real-time client rendering</h3>
              <p>
                The client application reads the latest state from the blockchain (the deposited principal and last modification block timestamp). The UI runs a high-frequency ticker recalculating the formula locally using the client's system clock, rendering a fluidly ticking balance that updates in real time to the millionth of a dollar.
              </p>
            </section>

            {/* 5. Security & Cryptography */}
            <section id="security" className={styles.section}>
              <h2 className={styles.sectionHeading}>5. Security Architecture & Threat Model</h2>
              <p>
                RemitChain operates on a zero-trust model, maintaining user sovereignty over their private keys at all times.
              </p>
              <ul className={styles.bullets}>
                <li>
                  <strong>Decentralized Backups:</strong> The device key (EOA) is generated locally inside the hardware security module (Secure Enclave). The private key shares are encrypted using AES-GCM-256 and backed up to the user's personal Google Drive folder. RemitChain's servers never access or store these key packages.
                </li>
                <li>
                  <strong>Biometric Validation:</strong> Transaction signing is tied to native FaceID/Fingerprint authentication, preventing unauthorized transfers in case of device theft.
                </li>
                <li>
                  <strong>Escrow Security:</strong> Funds locked in escrow utilize strict timeouts. If a merchant fails to confirm physical cash delivery, the recipient can trigger a refund after 2 hours, preventing capital lockup.
                </li>
              </ul>
            </section>

            {/* 6. Conclusion */}
            <section id="conclusion" className={styles.section}>
              <h2 className={styles.sectionHeading}>6. Conclusion & Future Roadmap</h2>
              <p>
                By bridging ERC-4337 Account Abstraction and localized cash-out networks, RemitChain removes the technical barriers preventing mass Web3 adoption. The protocol operates in a non-custodial manner, returning sovereignty and yield directly to global consumers.
              </p>
              <p>
                Our roadmap includes mapping standard liquidity vaults directly into Aave V3 pools on Mainnet, integrating zero-knowledge proof verification for booth coordinates, and expanding support to off-grid networks via localized Bluetooth mesh transaction relayers.
              </p>
            </section>
          </article>
        </main>
      </div>
    </div>
  );
}
