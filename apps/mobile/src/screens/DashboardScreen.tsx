import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  Linking,
  ScrollView,
  Modal, // Added for transaction complete success overlay
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import {
  House,
  Storefront,
  ClockCounterClockwise,
  ChartLineUp,
  UserCircle,
  Copy,
  CheckCircle,
  Lightning,
} from 'phosphor-react-native';
import { isAddress } from 'viem';
import { THEME } from '../config/theme';
import { walletService, WalletState } from '../services/walletService';
import BoothsTab, { BoothInfo } from './BoothsTab';
import HistoryTab, { TxItem } from './HistoryTab';
import ProfileTab from './ProfileTab';
import YieldTab from './YieldTab';

interface DashboardScreenProps {
  wallet: WalletState;
  onLogout: () => void;
}

type TabType = 'dashboard' | 'booths' | 'history' | 'yield' | 'profile';

export default function DashboardScreen({ wallet, onLogout }: DashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [copied, setCopied] = useState(false);
  
  // Send transaction inputs
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [txProgress, setTxProgress] = useState('');
  
  const [isSplit, setIsSplit] = useState(false);
  const [isCashOut, setIsCashOut] = useState(false);
  const [pickupCode, setPickupCode] = useState('');
  const [savingsRecipient, setSavingsRecipient] = useState('');
  const [splitRatio, setSplitRatio] = useState(80);

  const [recentTx, setRecentTx] = useState<{
    hash: string;
    saved: string;
    amount: string;
    recipient: string;
    isSplit?: boolean;
    splitRatio?: number;
    pickupCode?: string;
    recipientSavings?: string;
    amountFamily?: string;
    amountSavings?: string;
  } | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Custom transactions submitted in this session
  const [customTxs, setCustomTxs] = useState<TxItem[]>([]);



  // Real USDC balance state
  const [balance, setBalance] = useState('0.00');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load stored data on mount
  useEffect(() => {
    loadStoredData();
  }, []);

  // Fetch balance when address updates
  useEffect(() => {
    fetchBalance();
  }, [wallet.smartAccountAddress]);

  const loadStoredData = async () => {
    try {

      const storedTxs = await SecureStore.getItemAsync('remitchain_custom_txs');
      if (storedTxs) {
        setCustomTxs(JSON.parse(storedTxs));
      }
    } catch (e) {
      console.warn("Failed to load stored session data:", e);
    }
  };

  const fetchBalance = async () => {
    setIsRefreshing(true);
    try {
      const bal = await walletService.getUSDCBalance(wallet.smartAccountAddress, wallet.isSimulated);
      setBalance(bal);
    } catch (e) {
      console.warn("Failed to fetch balance:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyAddress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      Clipboard.setString(wallet.smartAccountAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };



  const handleSelectBooth = (boothAddress: string) => {
    const generatedCode = `REMIT-${Math.floor(1000 + Math.random() * 9000)}`;
    setRecipient(boothAddress);
    setIsSplit(false);
    setIsCashOut(true);
    setPickupCode(generatedCode);
    setActiveTab('dashboard');
    Alert.alert("Booth Selected", `Cash-out mode enabled with pickup code ${generatedCode}.`);
  };

  const handleClaimFaucet = async () => {
    setIsRefreshing(true);
    try {
      const res = await walletService.claimMockUsdcFaucet();
      const faucetTx: TxItem = {
        id: Date.now().toString(),
        type: 'faucet',
        amount: '1000.00',
        recipientOrSender: wallet.smartAccountAddress,
        timestamp: new Date().toLocaleString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'success',
        hash: res.txHash,
        gasSaved: res.gasSaved,
      };
      const updatedTxs = [faucetTx, ...customTxs];
      setCustomTxs(updatedTxs);
      await SecureStore.setItemAsync('remitchain_custom_txs', JSON.stringify(updatedTxs)).catch(() => {});
      await fetchBalance();
      Alert.alert("Faucet Claimed", "1,000 MockUSDC minted to your Smart Account.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Faucet claim failed.";
      Alert.alert("Error", msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSendTransfer = async () => {
    const parsedAmount = parseFloat(amount.trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid positive USDC amount.");
      return;
    }
    if (!isAddress(recipient.trim())) {
      Alert.alert("Error", "Please enter a valid 0x recipient address.");
      return;
    }
    if (isSplit && !isAddress(savingsRecipient.trim())) {
      Alert.alert("Error", "Please enter a valid 0x savings address.");
      return;
    }
    if (isCashOut && !pickupCode.trim()) {
      Alert.alert("Error", "Please enter a pickup code for the merchant cash-out.");
      return;
    }

    setIsSending(true);
    setRecentTx(null);

    try {
      let result;
      let savedTx: TxItem;

      if (isSplit) {
        const pctFamily = splitRatio;
        const pctSavings = 100 - splitRatio;
        const amountFamily = ((parseFloat(amount) * pctFamily) / 100).toFixed(2);
        const amountSavings = ((parseFloat(amount) * pctSavings) / 100).toFixed(2);

        result = await walletService.simulateGaslessSplitTransfer(
          recipient.trim(),
          savingsRecipient.trim(),
          amount.trim(),
          pctFamily,
          pctSavings,
          (status) => setTxProgress(status)
        );

        savedTx = {
          id: Date.now().toString(),
          type: 'split',
          amount: amount.trim(),
          recipientOrSender: `Split: $${amountFamily} to Family, $${amountSavings} to Savings`,
          timestamp: new Date().toLocaleString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'success',
          hash: result.txHash,
          gasSaved: result.gasSaved,
        };

        setRecentTx({
          hash: result.txHash,
          saved: result.gasSaved,
          amount: amount.trim(),
          recipient: recipient.trim(),
          isSplit: true,
          splitRatio: pctFamily,
          recipientSavings: savingsRecipient.trim(),
          amountFamily,
          amountSavings,
        });

      } else if (isCashOut) {
        result = await walletService.createCashOutOrder(
          recipient.trim(),
          amount.trim(),
          pickupCode.trim(),
          86400,
          (status) => setTxProgress(status)
        );

        savedTx = {
          id: Date.now().toString(),
          type: 'send',
          amount: amount.trim(),
          recipientOrSender: `Booth Escrow (${pickupCode.trim()})`,
          timestamp: new Date().toLocaleString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'success',
          hash: result.txHash,
          gasSaved: result.gasSaved,
        };

        setRecentTx({
          hash: result.txHash,
          saved: result.gasSaved,
          amount: amount.trim(),
          recipient: recipient.trim(),
          isSplit: false,
          pickupCode: pickupCode.trim(),
        });
      } else {
        result = await walletService.simulateGaslessTransfer(
          recipient.trim(),
          amount.trim(),
          (status) => setTxProgress(status)
        );

        savedTx = {
          id: Date.now().toString(),
          type: 'send',
          amount: amount.trim(),
          recipientOrSender: recipient.trim(),
          timestamp: new Date().toLocaleString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'success',
          hash: result.txHash,
          gasSaved: result.gasSaved,
        };

        setRecentTx({
          hash: result.txHash,
          saved: result.gasSaved,
          amount: amount.trim(),
          recipient: recipient.trim(),
          isSplit: false,
        });
      }

      const updatedTxs = [savedTx, ...customTxs];
      setCustomTxs(updatedTxs);
      try {
        await SecureStore.setItemAsync('remitchain_custom_txs', JSON.stringify(updatedTxs));
      } catch (e) {
        console.warn("Failed to persist custom transaction:", e);
      }

      setShowReceiptModal(true);
      setRecipient('');
      setSavingsRecipient('');
      setAmount('');
      await fetchBalance();
    } catch (e: any) {
      Alert.alert("Transaction Failed", e.message || "Failed to submit transaction.");
    } finally {
      setIsSending(false);
    }
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'booths':
        return (
          <BoothsTab
            onSelectBooth={handleSelectBooth}
          />
        );
      case 'history':
        return (
          <HistoryTab
            customTxs={customTxs}
            smartAccountAddress={wallet.smartAccountAddress}
            isSimulated={wallet.isSimulated}
          />
        );
      case 'yield':
        return (
          <YieldTab
            wallet={wallet}
            walletBalance={balance}
            onTransactionComplete={(tx: TxItem) => {
              const updatedTxs = [tx, ...customTxs];
              setCustomTxs(updatedTxs);
              SecureStore.setItemAsync('remitchain_custom_txs', JSON.stringify(updatedTxs)).catch(() => {});
            }}
            onRefreshBalance={fetchBalance}
          />
        );
      case 'profile':
        return <ProfileTab wallet={wallet} onLogout={onLogout} />;
      case 'dashboard':
      default:
        return (
          <ScrollView 
            style={styles.tabContent} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Smart Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Smart Wallet Address</Text>
                <View style={[styles.badge, wallet.isSimulated ? styles.badgeMock : styles.badgeLive]}>
                  <Text style={styles.badgeText}>
                    {wallet.isSimulated ? 'Simulation (Amoy)' : 'Live Amoy'}
                  </Text>
                </View>
              </View>

              {/* Address Pill */}
              <TouchableOpacity style={styles.addressPill} onPress={copyAddress} activeOpacity={0.7}>
                <Text style={styles.addressPillText} numberOfLines={1} ellipsizeMode="middle">
                  {wallet.smartAccountAddress}
                </Text>
                {copied ? (
                  <CheckCircle size={16} weight="fill" color={THEME.accentMint} />
                ) : (
                  <Copy size={16} weight="regular" color={THEME.textSecondary} />
                )}
              </TouchableOpacity>

              <View style={styles.cardFooter}>
                <View style={styles.gasBadge}>
                  <Text style={styles.gasBadgeText}>Gas Sponsored</Text>
                </View>
                {wallet.isCloudSynced && (
                  <Text style={styles.cloudBackupText}>☁️ Cloud Synced</Text>
                )}
              </View>
            </View>

            {/* Balance Card */}
            <View style={styles.balanceContainer}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceLabel}>Account Balance</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={handleClaimFaucet} disabled={isRefreshing} style={styles.refreshButton} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Lightning size={13} weight="fill" color={THEME.accentMint} />
                      <Text style={styles.refreshButtonText}>Faucet</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={fetchBalance} disabled={isRefreshing} style={styles.refreshButton} activeOpacity={0.7}>
                    {isRefreshing ? (
                      <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                      <Text style={styles.refreshButtonText}>↻ Refresh</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.balanceBody}>
                <Text style={styles.balanceAmount}>
                  ${balance} <Text style={styles.currency}>USDC</Text>
                </Text>
                <Text style={styles.usdEquivalent}>≈ ${balance} USD</Text>
              </View>
            </View>

            {/* Quick Action Tabs */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionTab} onPress={copyAddress} activeOpacity={0.7}>
                <Text style={styles.actionTabIcon}>📋</Text>
                <Text style={styles.actionTabText}>{copied ? 'Copied' : 'Copy Address'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionTab} 
                onPress={() => Linking.openURL(`https://amoy.polygonscan.com/address/${wallet.smartAccountAddress}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionTabIcon}>🔍</Text>
                <Text style={styles.actionTabText}>Explorer</Text>
              </TouchableOpacity>
            </View>

            {/* Send Section */}
            <View style={styles.sendCard}>
              <Text style={styles.sendTitle}>Gasless Remittance Transfer</Text>
              <Text style={styles.sendDescription}>
                Send USDC to a family member or booth. Zero gas fees will be charged to you.
              </Text>

              <View style={styles.splitToggleContainer}>
                <TouchableOpacity 
                  style={[styles.splitToggleButton, !isSplit && !isCashOut && styles.splitToggleButtonActive]}
                  onPress={() => { setIsSplit(false); setIsCashOut(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.splitToggleText, !isSplit && !isCashOut && styles.splitToggleTextActive]}>
                    Single
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.splitToggleButton, isSplit && styles.splitToggleButtonActive]}
                  onPress={() => { setIsSplit(true); setIsCashOut(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.splitToggleText, isSplit && styles.splitToggleTextActive]}>
                    Split
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.splitToggleButton, isCashOut && styles.splitToggleButtonActive]}
                  onPress={() => {
                    setIsSplit(false);
                    setIsCashOut(true);
                    if (!pickupCode) setPickupCode(`REMIT-${Math.floor(1000 + Math.random() * 9000)}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.splitToggleText, isCashOut && styles.splitToggleTextActive]}>
                    Cash-Out
                  </Text>
                </TouchableOpacity>
              </View>

              {isSending ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.progressText}>{txProgress}</Text>
                </View>
              ) : (
                <View>
                  {!isSplit ? (
                    <View>
                      <TextInput
                        style={styles.input}
                        placeholder={isCashOut ? "Approved Booth Address (0x...)" : "Recipient Smart Wallet Address"}
                        placeholderTextColor="#64748B"
                        value={recipient}
                        onChangeText={setRecipient}
                        autoCapitalize="none"
                      />
                      {isCashOut && (
                        <TextInput
                          style={styles.input}
                          placeholder="Pickup Code (e.g. REMIT-8821)"
                          placeholderTextColor="#64748B"
                          value={pickupCode}
                          onChangeText={setPickupCode}
                          autoCapitalize="characters"
                        />
                      )}
                    </View>
                  ) : (
                    <View style={styles.splitInputGroup}>
                      <TextInput
                        style={styles.input}
                        placeholder="Family Recipient Address (starts with 0x...)"
                        placeholderTextColor="#64748B"
                        value={recipient}
                        onChangeText={setRecipient}
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Savings Recipient Address (e.g. your MetaMask)"
                        placeholderTextColor="#64748B"
                        value={savingsRecipient}
                        onChangeText={setSavingsRecipient}
                        autoCapitalize="none"
                      />

                      {/* Split ratio selector */}
                      <Text style={styles.ratioSectionLabel}>Choose Split Ratio</Text>
                      <View style={styles.ratioContainer}>
                        <TouchableOpacity 
                          style={[styles.ratioButton, splitRatio === 80 && styles.ratioButtonActive]}
                          onPress={() => setSplitRatio(80)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.ratioText, splitRatio === 80 && styles.ratioTextActive]}>
                            80/20 Split
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.ratioButton, splitRatio === 70 && styles.ratioButtonActive]}
                          onPress={() => setSplitRatio(70)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.ratioText, splitRatio === 70 && styles.ratioTextActive]}>
                            70/30 Split
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.ratioButton, splitRatio === 50 && styles.ratioButtonActive]}
                          onPress={() => setSplitRatio(50)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.ratioText, splitRatio === 50 && styles.ratioTextActive]}>
                            50/50 Split
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {['10', '50', '100'].map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setAmount(preset);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: amount === preset ? THEME.accentPrimary : THEME.bgElevated,
                          borderWidth: 1,
                          borderColor: amount === preset ? THEME.accentPrimaryHover : THEME.borderSubtle,
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: THEME.textPrimary, fontSize: 12, fontWeight: '600' }}>${preset}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.amountInputContainer}>
                    <TextInput
                      style={styles.amountInput}
                      placeholder={isSplit ? "Total USDC Amount to Split" : "USDC Amount"}
                      placeholderTextColor="#64748B"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity style={styles.maxButton} onPress={() => setAmount(balance)} activeOpacity={0.6}>
                      <Text style={styles.maxButtonText}>MAX</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dynamic split breakdown info text */}
                  {isSplit && amount.trim() !== '' && !isNaN(parseFloat(amount)) && (
                    <Text style={styles.breakdownText}>
                      This sends ${(parseFloat(amount) * splitRatio / 100).toFixed(2)} USDC to Family and ${(parseFloat(amount) * (100 - splitRatio) / 100).toFixed(2)} USDC to Savings in a single atomic transaction.
                    </Text>
                  )}

                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: THEME.accentMintTint,
                    marginBottom: 12,
                  }}>
                    <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>Traditional Wire: ~$6.50</Text>
                    <Text style={{ color: THEME.accentMint, fontSize: 12, fontWeight: '700' }}>RemitChain: $0.00 Gas</Text>
                  </View>

                  <TouchableOpacity style={styles.sendButton} onPress={handleSendTransfer} activeOpacity={0.8}>
                    <Text style={styles.sendButtonText}>
                      {isSplit ? "Send Split Remittance" : isCashOut ? "Lock USDC in Booth Escrow" : "Send Gasless USDC"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header (Shows only when on dashboard tab) */}
        {activeTab === 'dashboard' && (
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Welcome, {wallet.username}</Text>
              <Text style={styles.headerSubtitle}>Polygon Smart Account Active</Text>
            </View>
          </View>
        )}

        <View style={styles.mainContainer}>
          {renderActiveTabContent()}
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('dashboard');
            }}
            activeOpacity={0.7}
          >
            <House size={22} weight={activeTab === 'dashboard' ? 'fill' : 'regular'} color={activeTab === 'dashboard' ? THEME.accentPrimaryHover : THEME.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabActiveText]}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('booths');
            }}
            activeOpacity={0.7}
          >
            <Storefront size={22} weight={activeTab === 'booths' ? 'fill' : 'regular'} color={activeTab === 'booths' ? THEME.accentPrimaryHover : THEME.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'booths' && styles.tabActiveText]}>Booths</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('history');
            }}
            activeOpacity={0.7}
          >
            <ClockCounterClockwise size={22} weight={activeTab === 'history' ? 'fill' : 'regular'} color={activeTab === 'history' ? THEME.accentPrimaryHover : THEME.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabActiveText]}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('yield');
            }}
            activeOpacity={0.7}
          >
            <ChartLineUp size={22} weight={activeTab === 'yield' ? 'fill' : 'regular'} color={activeTab === 'yield' ? THEME.accentPrimaryHover : THEME.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'yield' && styles.tabActiveText]}>Yield</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('profile');
            }}
            activeOpacity={0.7}
          >
            <UserCircle size={22} weight={activeTab === 'profile' ? 'fill' : 'regular'} color={activeTab === 'profile' ? THEME.accentPrimaryHover : THEME.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabActiveText]}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* High-Fidelity Transaction Success Modal */}
      {recentTx && (
        <Modal
          visible={showReceiptModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowReceiptModal(false);
            setRecentTx(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.successIconCircle}>
                <Text style={styles.successIconCheck}>✓</Text>
              </View>

              <Text style={styles.modalTitle}>Remittance Sent!</Text>
              <Text style={styles.modalAmount}>${recentTx.amount} USDC</Text>

              {recentTx.isSplit ? (
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>To Family ({recentTx.splitRatio ?? splitRatio}%)</Text>
                    <Text style={styles.modalDetailValue} numberOfLines={1} ellipsizeMode="middle">
                      {recentTx.recipient}
                    </Text>
                  </View>
                  <Text style={styles.modalSplitSubText}>Amount: ${recentTx.amountFamily} USDC</Text>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>To Savings ({100 - (recentTx.splitRatio ?? splitRatio)}%)</Text>
                    <Text style={styles.modalDetailValue} numberOfLines={1} ellipsizeMode="middle">
                      {recentTx.recipientSavings}
                    </Text>
                  </View>
                  <Text style={styles.modalSplitSubText}>Amount: ${recentTx.amountSavings} USDC</Text>

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Status</Text>
                    <Text style={styles.modalDetailStatus}>🟢 Completed (Batch)</Text>
                  </View>

                  {recentTx.saved && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Gas Fee</Text>
                      <Text style={styles.modalDetailSavings}>Sponsored ({recentTx.saved})</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Recipient</Text>
                    <Text style={styles.modalDetailValue} numberOfLines={1} ellipsizeMode="middle">
                      {recentTx.recipient}
                    </Text>
                  </View>

                  {recentTx.pickupCode && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Pickup Code</Text>
                      <Text style={styles.modalDetailValue}>{recentTx.pickupCode}</Text>
                    </View>
                  )}

                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Status</Text>
                    <Text style={styles.modalDetailStatus}>🟢 Completed</Text>
                  </View>

                  {recentTx.saved && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Gas Fee</Text>
                      <Text style={styles.modalDetailSavings}>Sponsored ({recentTx.saved})</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  Linking.openURL(`https://amoy.polygonscan.com/tx/${recentTx.hash}`);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalPrimaryBtnText}>View on Explorer ↗</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  setShowReceiptModal(false);
                  setRecentTx(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalSecondaryBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06090F',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabContent: {
    flex: 1,
  },
  card: {
    backgroundColor: '#0D131F',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeMock: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  badgeLive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  badgeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  addressPill: {
    backgroundColor: '#06090F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addressPillText: {
    fontSize: 14,
    color: '#F1F5F9',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    marginRight: 10,
  },
  addressPillIcon: {
    fontSize: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gasBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  gasBadgeText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
  },
  cloudBackupText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  balanceContainer: {
    backgroundColor: '#0D131F',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  refreshButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  refreshButtonText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
  },
  balanceBody: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  currency: {
    fontSize: 20,
    color: '#3B82F6',
    fontWeight: '700',
  },
  usdEquivalent: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  actionTab: {
    flex: 1,
    backgroundColor: '#0D131F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTabIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  actionTabText: {
    fontSize: 10,
    color: '#F1F5F9',
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  sendCard: {
    backgroundColor: '#0D131F',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  sendTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sendDescription: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#06090F',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
    fontWeight: '500',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06090F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
    height: 48,
    paddingRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  maxButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  maxButtonText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '800',
  },
  sendButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
  },
  receiptContainer: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#06090F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  receiptHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  receiptLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '600',
  },
  receiptHash: {
    fontSize: 12,
    color: '#F1F5F9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
    textDecorationLine: 'underline',
  },
  receiptSavings: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#0D131F',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingBottom: Platform.OS === 'ios' ? 12 : 6,
    paddingTop: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabIcon: {
    fontSize: 18,
    color: '#64748B',
  },
  tabLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  tabActiveText: {
    color: '#3B82F6',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 19, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0D131F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  successIconCheck: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  modalDetails: {
    backgroundColor: '#06090F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    width: '100%',
    marginBottom: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalDetailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalDetailValue: {
    fontSize: 12,
    color: '#F1F5F9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    maxWidth: '60%',
  },
  modalDetailStatus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
  },
  modalDetailSavings: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  modalSplitSubText: {
    fontSize: 11,
    color: '#94A3B8',
    alignSelf: 'flex-start',
    paddingLeft: 12,
    marginBottom: 8,
    marginTop: -4,
    fontWeight: '500',
  },
  splitToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#06090F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 3,
    marginBottom: 12,
  },
  splitToggleButton: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  splitToggleButtonActive: {
    backgroundColor: '#2563EB',
  },
  splitToggleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  splitToggleTextActive: {
    color: '#FFFFFF',
  },
  splitInputGroup: {
    gap: 0,
  },
  ratioSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
    marginTop: 4,
  },
  ratioContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  ratioButton: {
    flex: 1,
    height: 34,
    backgroundColor: '#06090F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratioButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  ratioText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  ratioTextActive: {
    color: '#3B82F6',
  },
  breakdownText: {
    fontSize: 11,
    color: '#10B981',
    lineHeight: 16,
    marginBottom: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  modalPrimaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    height: 44,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    height: 40,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
