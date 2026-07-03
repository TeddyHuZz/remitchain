"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";

export default function Home() {
  // Mobile Screen Yield Ticker
  const [phoneYield, setPhoneYield] = useState(15.000342);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickerRef.current = setInterval(() => {
      setPhoneYield((prev) => prev + 0.000002);
    }, 1000);

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  return (
    <div className={styles.page}>
      <div className="gridBackground" />

      {/* Navigation Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoDot} />
            RemitChain
          </div>
          <nav className={styles.nav}>
            <a href="#features" className={styles.navLink}>Core Concepts</a>
            <a href="#depin" className={styles.navLink}>DePIN Network</a>
            <a href="#architecture" className={styles.navLink}>Architecture</a>
            <a href="#technology" className={styles.navLink}>Technology</a>
            <a href="#architecture" className={styles.headerCta}>View System Specs</a>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.badge}>Web3 Cash-out Gateways</div>
            <h1 className={styles.heroTitle}>
              The DePIN Network for <br />
              <span className={styles.gradientText}>Global Remittances</span>
            </h1>
            <p className={styles.heroDescription}>
              RemitChain combines gasless mobile smart wallets with local brick-and-mortar stores to build a decentralized physical cash-out network. Bypassing traditional payment systems to deliver money instantly with zero gas friction.
            </p>
            <div className={styles.heroCtas}>
              <a href="#architecture" className={styles.btnPrimary}>View Architecture</a>
              <a href="#features" className={styles.btnSecondary}>Read Tech Specs</a>
            </div>
          </div>

          <div className={styles.deviceContainer}>
            {/* CSS Smartphone Mockup */}
            <div className={styles.phone}>
              <div className={styles.phoneScreen}>
                <div className={styles.phoneHeader}>
                  <TextLogo />
                  <div className={styles.apyBadge} style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6 }}>
                    <span style={{ color: '#10B981', fontSize: 10, fontWeight: '700' }}>4.5% APY</span>
                  </div>
                </div>

                <div className={styles.phoneCard} style={{ borderColor: 'rgba(16, 185, 129, 0.25)', borderStyle: 'solid', borderWidth: 1 }}>
                  <div className={styles.phoneCardTitle}>Yield Vault Balance</div>
                  <div className={styles.phoneBalance}>
                    ${phoneYield.toFixed(6)}
                  </div>
                  <div className={styles.phoneBalanceSub}>USDC Accruing Real-time</div>
                </div>

                <div className={styles.phoneCard}>
                  <div className={styles.phoneCardTitle}>Remittance Transfer</div>
                  <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 12 }}>Send Gasless USDC directly to a family member's phone.</div>
                  <div style={{ backgroundColor: '#070913', borderRadius: 8, height: 36, display: 'flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10, color: '#64748B', fontSize: 11, borderWidth: 1, borderColor: '#1E293B' }}>
                    Recipient Smart Address
                  </div>
                </div>

                <div className={styles.phoneButton}>
                  <span className={styles.phoneButtonText}>Send Gasless USDC</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Concepts */}
        <section id="features" className={styles.infoSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Core Concepts</h2>
            <p className={styles.sectionSubtitle}>A look at how RemitChain is structured to serve remitters and recipients globally.</p>
          </div>

          <div className={styles.grid3}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Gasless Transfers</h3>
              <p className={styles.cardDescription}>
                Users execute transactions using account abstraction. Gas fees are sponsored, removing the friction of purchasing and holding native blockchain tokens.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>DePIN Booths</h3>
              <p className={styles.cardDescription}>
                Local shops serve as physical cash-out gateways. Users scan the store's QR code to withdraw digital funds as local physical fiat currency.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Yield Savings</h3>
              <p className={styles.cardDescription}>
                Deposited funds earn interest on-chain at 4.5% APY. The vault yields accumulate in real-time based on smart contract block timestamps.
              </p>
            </div>
          </div>
        </section>

        {/* DePIN Protocol */}
        <section id="depin" className={styles.infoSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Decentralized Physical Infrastructure</h2>
            <p className={styles.sectionSubtitle}>How physical storefronts integrate into a trustless digital ledger to replace traditional banking offices.</p>
          </div>

          <div className={styles.grid3}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Store Incentives</h3>
              <p className={styles.cardDescription}>
                Booths earn a 1.5% commission on cash-out volume they settle. This creates an organic market of liquid cash gateways without centralized operations.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Physical Foot Traffic</h3>
              <p className={styles.cardDescription}>
                RemitChain routes users to physical locations indicated on a store directory map, driving retail customer traffic and general trade to partners.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Contract Guarantee</h3>
              <p className={styles.cardDescription}>
                Liquidity is locked in smart escrow accounts. When physical cash is handed over, the equivalent digital currency swaps to the store wallet instantly.
              </p>
            </div>
          </div>
        </section>

        {/* Technical Architecture */}
        <section id="architecture" className={styles.infoSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>System Architecture</h2>
            <p className={styles.sectionSubtitle}>The technical blueprint behind gasless transactions, wallet derivation, and on-chain interest accumulation.</p>
          </div>

          <div className={styles.grid3}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Account Abstraction</h3>
              <p className={styles.cardDescription}>
                RemitChain leverages ERC-4337 to separate keys from ownership. The user owns a smart account contract initialized via a device key pair (EOA). This enables multi-call transaction batching, account recovery, and alternative signing options.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Paymaster Gas Sponsorship</h3>
              <p className={styles.cardDescription}>
                Instead of users paying gas fees in native network tokens (POL), transaction requests are packaged as UserOperations. These are routed through a bundler to a pre-funded Paymaster contract, which sponsors the gas fee on behalf of the user.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Yield Vault Contract</h3>
              <p className={styles.cardDescription}>
                USDC is deposited into an on-chain vault. The vault contract computes interest linearly using block timestamps. Accumulated yield is settled dynamically during user interactions (deposits and withdrawals) and distributed from liquidity reserves.
              </p>
            </div>
          </div>
        </section>

        {/* White Paper Details */}
        <section id="technology" className={styles.infoSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Technology & Specifications</h2>
            <p className={styles.sectionSubtitle}>Details on the protocol layers, smart contract standards, and client services powering the ecosystem.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className={styles.card} style={{ width: "100%" }}>
              <h3 className={styles.cardTitle} style={{ borderBottom: "1px solid var(--card-border)", paddingBottom: "16px", marginBottom: "16px" }}>
                ERC-4337 UserOperation Lifecycle
              </h3>
              <p className={styles.cardDescription} style={{ marginBottom: "16px", lineHeight: "1.7" }}>
                Every action (such as sending money or depositing into the yield vault) starts as a UserOperation. This object contains metadata specifying the sender, nonce, validation gas, payment parameters, and call target data.
              </p>
              <p className={styles.cardDescription} style={{ marginBottom: "16px", lineHeight: "1.7" }}>
                The UserOperation is signed using the validator contract (Kernel ECDSA plugin) and dispatched to an alternate mempool monitored by a bundler. The bundler compiles multiple operations into a single standard Ethereum transaction, which is submitted to the EntryPoint contract for execution.
              </p>
              <p className={styles.cardDescription} style={{ lineHeight: "1.7" }}>
                During verification, the EntryPoint queries the Paymaster contract to confirm gas fee sponsorship before running the contract calls on the target smart account.
              </p>
            </div>

            <div className={styles.card} style={{ width: "100%" }}>
              <h3 className={styles.cardTitle} style={{ borderBottom: "1px solid var(--card-border)", paddingBottom: "16px", marginBottom: "16px" }}>
                Smart Contract Implementation (Amoy Testnet)
              </h3>
              <p className={styles.cardDescription} style={{ marginBottom: "16px", lineHeight: "1.7" }}>
                The core ledger transactions run on Polygon Amoy, utilizing Circle's official USDC contract address for stable transfer operations. 
              </p>
              <p className={styles.cardDescription} style={{ marginBottom: "16px", lineHeight: "1.7" }}>
                The yield savings feature is powered by the YieldVault contract deployed on-chain. It maintains a secure reserve of USDC tokens. Yield accrues based on the formula:
              </p>
              <div style={{ backgroundColor: "#070913", border: "1px solid var(--card-border)", borderRadius: "8px", padding: "16px", margin: "16px 0", fontFamily: "var(--font-mono)", fontSize: "13px", color: "#A5B4FC", textAlign: "center" }}>
                Pending Interest = (Principal × APY Basis Points × Elapsed Time) ÷ (10000 × 31,536,000 Seconds)
              </div>
              <p className={styles.cardDescription} style={{ lineHeight: "1.7" }}>
                On production deployment, the mobile client maps directly to the Aave V3 Pool contracts, converting deposited USDC into standard yield-bearing aUSDC tokens.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerText}>&copy; 2026 RemitChain Foundation. All rights reserved.</p>
          <div className={styles.footerLinks}>
            <a href="#features" className={styles.footerLink}>Features</a>
            <a href="#depin" className={styles.footerLink}>DePIN Network</a>
            <a href="#architecture" className={styles.footerLink}>Architecture</a>
            <a href="#technology" className={styles.footerLink}>Technology</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TextLogo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1', marginRight: 4 }} />
      <span style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>RemitChain</span>
    </View>
  );
}

function View({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', ...style }}>{children}</div>;
}
