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
  Linking, // Used to open Explorer & Faucet links in browser
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { walletService, WalletState } from '../services/walletService';

interface DashboardScreenProps {
  wallet: WalletState;
  onLogout: () => void;
}

export default function DashboardScreen({ wallet, onLogout }: DashboardScreenProps) {
  const [copied, setCopied] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [txProgress, setTxProgress] = useState('');
  const [recentTx, setRecentTx] = useState<{ hash: string; saved: string } | null>(null);

  // Real USDC balance state
  const [balance, setBalance] = useState('0.00');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch balance on load
  useEffect(() => {
    fetchBalance();
  }, [wallet.smartAccountAddress]);

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
    try {
      Clipboard.setString(wallet.smartAccountAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendTransfer = async () => {
    if (!recipient.trim() || !amount.trim()) {
      Alert.alert("Error", "Please fill in recipient address and USDC amount.");
      return;
    }

    setIsSending(true);
    setRecentTx(null);

    try {
      const result = await walletService.simulateGaslessTransfer(
        recipient.trim(),
        amount.trim(),
        (status) => setTxProgress(status)
      );

      setRecentTx({
        hash: result.txHash,
        saved: result.gasSaved,
      });

      Alert.alert("Success", "Gasless transaction completed successfully!");
      setRecipient('');
      setAmount('');
      // Update balance automatically
      await fetchBalance();
    } catch (e: any) {
      Alert.alert("Transaction Failed", e.message || "Failed to submit transaction.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Welcome, {wallet.username}</Text>
            <Text style={styles.headerSubtitle}>Polygon Smart Account Active</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

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
            <Text style={styles.addressPillIcon}>{copied ? '✅' : '📋'}</Text>
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
            <TouchableOpacity onPress={fetchBalance} disabled={isRefreshing} style={styles.refreshButton} activeOpacity={0.7}>
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#818CF8" />
              ) : (
                <Text style={styles.refreshButtonText}>↻ Refresh</Text>
              )}
            </TouchableOpacity>
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

          {isSending ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.progressText}>{txProgress}</Text>
            </View>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Recipient Smart Wallet Address"
                placeholderTextColor="#64748B"
                value={recipient}
                onChangeText={setRecipient}
                autoCapitalize="none"
              />
              
              {/* Amount Input with MAX Button overlay */}
              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="USDC Amount"
                  placeholderTextColor="#64748B"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.maxButton} onPress={() => setAmount(balance)} activeOpacity={0.6}>
                  <Text style={styles.maxButtonText}>MAX</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.sendButton} onPress={handleSendTransfer} activeOpacity={0.8}>
                <Text style={styles.sendButtonText}>Send Gasless USDC</Text>
              </TouchableOpacity>
            </View>
          )}

          {recentTx && (
            <View style={styles.receiptContainer}>
              <Text style={styles.receiptHeader}>Transaction Complete</Text>
              <Text style={styles.receiptLabel}>Transaction Hash:</Text>
              <TouchableOpacity onPress={() => Linking.openURL(`https://amoy.polygonscan.com/tx/${recentTx.hash}`)} activeOpacity={0.7}>
                <Text style={styles.receiptHash} numberOfLines={1} ellipsizeMode="middle">
                  {recentTx.hash} 🔗
                </Text>
              </TouchableOpacity>
              <Text style={styles.receiptSavings}>
                Saved: {recentTx.saved}
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070913',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
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
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  logoutText: {
    color: '#F43F5E',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0E1120',
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
    backgroundColor: '#070913',
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
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  cloudBackupText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  balanceContainer: {
    backgroundColor: '#0E1120',
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
    color: '#818CF8',
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
    color: '#818CF8',
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
    backgroundColor: '#0E1120',
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
    backgroundColor: '#0E1120',
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
    backgroundColor: '#070913',
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
    backgroundColor: '#070913',
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
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '800',
  },
  sendButton: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
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
    backgroundColor: '#070913',
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
});
