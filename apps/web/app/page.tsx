"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Smartphone, 
  History as HistoryIcon, 
  User, 
  TrendingUp, 
  Shield, 
  MapPin, 
  HelpCircle, 
  ArrowRight, 
  Mail, 
  ChevronDown, 
  Zap, 
  DollarSign, 
  Clock, 
  Users,
  Check
} from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  const [activeMockupTab, setActiveMockupTab] = useState("dashboard");
  const [activeStep, setActiveStep] = useState(1);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const toggleFaq = (id: number) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    setIsSubscribed(true);
    setTimeout(() => {
      setEmailInput("");
      setIsSubscribed(false);
    }, 4000);
  };

  const steps = [
    {
      id: 1,
      title: "1. Send Gasless USDC",
      desc: "Derive a secure smart account client-side using device credentials. Enter a family member's phone number or smart address and tap send. Paymaster contracts sponsor the transaction gas fees instantly.",
      stat: "Gas Fee: $0.00 Sponsored",
      icon: <Zap size={20} className={styles.stepIconColor} />
    },
    {
      id: 2,
      title: "2. Earn Real-time Yield",
      desc: "While funds are in transit or held inside the non-custodial smart wallet, stable USDC is automatically routed to audited interest vaults, accumulating 4.5% APY linear interest on-chain second-by-second.",
      stat: "Yield Rate: 4.5% APY",
      icon: <TrendingUp size={20} className={styles.stepIconColor} />
    },
    {
      id: 3,
      title: "3. Cash Out Locally",
      desc: "The recipient checks the nearby storefront directory map on their phone, visits a local partner retail shop, scans the booth QR code, handshakes physical fiat currency, and releases the digital escrow atomically.",
      stat: "Merchant Commission: 1.5%",
      icon: <MapPin size={20} className={styles.stepIconColor} />
    }
  ];

  const currentStep = (steps.find((s) => s.id === activeStep) || steps[0]) as typeof steps[0];

  const faqs = [
    {
      id: 1,
      q: "How can transfers be completely gasless?",
      a: "RemitChain utilizes the ERC-4337 Account Abstraction standard. Instead of users needing native blockchain tokens (like POL or ETH) to validate transactions, transactions are packaged as UserOperations. These operations are routed to a verified Paymaster contract, which sponsors the native gas fees on behalf of the user."
    },
    {
      id: 2,
      q: "What is a DePIN cash-out booth?",
      a: "A DePIN (Decentralized Physical Infrastructure Network) cash-out booth is a local neighborhood retail storefront (like a convenience store, pharmacy, or sari-sari shop) registered on the RemitChain network. Storeowners lock a collateral balance of USDC in the smart contract and earn commissions by settling digital withdrawals for local cash."
    },
    {
      id: 3,
      q: "Are my funds secure?",
      a: "Yes. RemitChain is entirely non-custodial. Your keys are generated in the hardware Secure Enclave of your mobile device. They are backed up using AES-GCM-256 client-side encryption and synced to your personal Google Drive account. RemitChain servers never have access to your private credentials."
    },
    {
      id: 4,
      q: "How does the yield vault generate interest?",
      a: "Deposited stable USDC is locked in verified liquidity reserves. The smart contract calculates accrued yield linearly using block timestamps. When you withdraw or deposit, the interest is dynamically calculated and updated on-chain down to the millionth of a dollar."
    }
  ];

  return (
    <div className={styles.page}>
      <div className="gridBackground" />

      {/* Navigation Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <img src="/logo.png" alt="RemitChain Logo" className={styles.logoImage} />
            RemitChain
          </div>
          <nav className={styles.nav}>
            <a href="#workflow" className={styles.navLink}>How it Works</a>
            <a href="#features" className={styles.navLink}>Concepts</a>
            <a href="#faq" className={styles.navLink}>FAQs</a>
            <Link href="/whitepaper" className={styles.navLink}>Whitepaper</Link>
            <Link href="/whitepaper" className={styles.headerCta}>Read Whitepaper</Link>
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
              Global Remittances
            </h1>
            <p className={styles.heroDescription}>
              RemitChain combines gasless mobile smart wallets with local brick-and-mortar stores to build a decentralized physical cash-out network. Bypassing traditional payment systems to deliver money instantly with zero gas friction.
            </p>
            
            {/* Store Download Badges */}
            <div className={styles.storeBadges}>
              <div className={styles.storeBadge}>
                <img src="/apple.png" alt="Apple Store" className={styles.badgeImage} />
                <div>
                  <div className={styles.badgeTextSmall}>Download on the</div>
                  <div className={styles.badgeTextLarge}>App Store</div>
                </div>
              </div>
              <div className={styles.storeBadge}>
                <img src="/android.png" alt="Google Play" className={styles.badgeImage} />
                <div>
                  <div className={styles.badgeTextSmall}>Get it on</div>
                  <div className={styles.badgeTextLarge}>Google Play</div>
                </div>
              </div>
            </div>

            <div className={styles.heroCtas} style={{ marginTop: "24px" }}>
              <Link href="/whitepaper" className={styles.btnPrimary}>Read Technical Whitepaper</Link>
              <a href="#workflow" className={styles.btnSecondary}>Watch Demo Flow</a>
            </div>
            
            {/* Tour selectors panel */}
            <div className={styles.tourPanel}>
              <span className={styles.tourTitle}>Select App Screen to View</span>
              <div className={styles.tourButtons}>
                <button 
                  onClick={() => setActiveMockupTab("dashboard")}
                  className={`${styles.tourBtn} ${activeMockupTab === "dashboard" ? styles.tourBtnActive : ""}`}
                >
                  <Smartphone size={14} />
                  <span>Smart Dashboard</span>
                </button>
                <button 
                  onClick={() => setActiveMockupTab("yield")}
                  className={`${styles.tourBtn} ${activeMockupTab === "yield" ? styles.tourBtnActive : ""}`}
                >
                  <TrendingUp size={14} />
                  <span>Linear Yield Vault</span>
                </button>
                <button 
                  onClick={() => setActiveMockupTab("history")}
                  className={`${styles.tourBtn} ${activeMockupTab === "history" ? styles.tourBtnActive : ""}`}
                >
                  <HistoryIcon size={14} />
                  <span>Transaction Feed</span>
                </button>
                <button 
                  onClick={() => setActiveMockupTab("profile")}
                  className={`${styles.tourBtn} ${activeMockupTab === "profile" ? styles.tourBtnActive : ""}`}
                >
                  <User size={14} />
                  <span>Profile & Security</span>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.deviceContainer}>
            {/* Screenshot Display */}
            <div className={styles.phoneWrapper}>
              <img 
                src={`/screenshots/${activeMockupTab}.png`} 
                alt={`RemitChain App ${activeMockupTab} Screen`} 
                className={styles.screenshotImage}
              />
            </div>
          </div>
        </section>

        {/* Live Metrics Dashboard Banner */}
        <section className={styles.metricsSection}>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <DollarSign className={styles.metricIcon} size={20} />
              <div className={styles.metricValue}>$142,500+</div>
              <div className={styles.metricLabel}>USDC Transferred</div>
            </div>
            <div className={styles.metricCard}>
              <Users className={styles.metricIcon} size={20} />
              <div className={styles.metricValue}>48 Stores</div>
              <div className={styles.metricLabel}>Active Merchant Booths</div>
            </div>
            <div className={styles.metricCard}>
              <Clock className={styles.metricIcon} size={20} />
              <div className={styles.metricValue}>1.8s</div>
              <div className={styles.metricLabel}>Average Settlement Time</div>
            </div>
            <div className={styles.metricCard}>
              <Zap className={styles.metricIcon} size={20} />
              <div className={styles.metricValue}>$1,840.15</div>
              <div className={styles.metricLabel}>Gas Fees Sponsored</div>
            </div>
          </div>
        </section>

        {/* Step-by-step How it Works Section */}
        <section id="workflow" className={styles.infoSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>How RemitChain Works</h2>
            <p className={styles.sectionSubtitle}>A look at how we combine account abstraction with neighborhood retail gateways.</p>
          </div>

          <div className={styles.workflowContainer}>
            <div className={styles.stepSelectors}>
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`${styles.stepSelectorBtn} ${activeStep === step.id ? styles.stepSelectorBtnActive : ""}`}
                >
                  {step.title}
                </button>
              ))}
            </div>

            <div className={styles.stepDisplayCard}>
              <div className={styles.stepDisplayHeader}>
                {currentStep.icon}
                <h4 className={styles.stepDisplayTitle}>{currentStep.title}</h4>
                <span className={styles.stepDisplayStat}>{currentStep.stat}</span>
              </div>
              <p className={styles.stepDisplayDesc}>{currentStep.desc}</p>
            </div>
          </div>
        </section>

        {/* Core Concepts */}
        <section id="features" className={styles.infoSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Protocol Concepts</h2>
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

        {/* FAQ Accordion Section */}
        <section id="faq" className={styles.infoSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
            <p className={styles.sectionSubtitle}>Find answers to the most common questions about the RemitChain protocol.</p>
          </div>

          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <div key={faq.id} className={styles.faqItem}>
                <button className={styles.faqQuestion} onClick={() => toggleFaq(faq.id)}>
                  <span>{faq.q}</span>
                  <ChevronDown 
                    size={16} 
                    className={`${styles.faqChevron} ${openFaqId === faq.id ? styles.faqChevronOpen : ""}`} 
                  />
                </button>
                <div className={`${styles.faqAnswer} ${openFaqId === faq.id ? styles.faqAnswerOpen : ""}`}>
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter Signup & Community Panel */}
        <section className={styles.newsletterSection}>
          <div className={styles.newsletterCard}>
            <h3 className={styles.newsletterTitle}>Stay Connected to the Protocol</h3>
            <p className={styles.newsletterDesc}>
              Subscribe to get updates on mainnet deployments, new retail cash-out booth locations, and technical research updates.
            </p>
            {isSubscribed ? (
              <div className={styles.newsletterSuccess}>
                <Check size={18} />
                <span>Thank you for subscribing! We'll keep you in the loop.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className={styles.newsletterForm}>
                <input 
                  type="email" 
                  className={styles.newsletterInput} 
                  placeholder="Enter your developer email address"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                />
                <button type="submit" className={styles.newsletterBtn}>
                  <Mail size={16} />
                  <span>Subscribe</span>
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerText}>&copy; 2026 RemitChain Foundation. All rights reserved.</p>
          <div className={styles.footerLinks}>
            <a href="#features" className={styles.footerLink}>Features</a>
            <a href="#workflow" className={styles.footerLink}>Workflow</a>
            <a href="#faq" className={styles.footerLink}>FAQs</a>
            <Link href="/whitepaper" className={styles.footerLink}>Whitepaper</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
