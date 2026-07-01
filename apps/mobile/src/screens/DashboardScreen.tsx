import React, { useState } from 'react';
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
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
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

          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
            {wallet.smartAccountAddress}
          </Text>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.cardActionButton} onPress={copyAddress}>
              <Text style={styles.cardActionText}>
                {copied ? 'Copied!' : 'Copy Wallet Address'}
              </Text>
            </TouchableOpacity>
            <View style={styles.gasBadge}>
              <Text style={styles.gasBadgeText}>⚡ Gas Sponsored</Text>
            </View>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Account Balance</Text>
          <Text style={styles.balanceAmount}>$250.00 <Text style={styles.currency}>USDC</Text></Text>
        </View>

        {/* Send Section */}
        <View style={styles.sendCard}>
          <Text style={styles.sendTitle}>Gasless Remittance Transfer</Text>
          <Text style={styles.sendDescription}>
            Send USDC to a Booth Agent or family member. Zero gas fees will be charged to you.
          </Text>

          {isSending ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.progressText}>{txProgress}</Text>
            </View>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Recipient Smart Wallet Address"
                placeholderTextColor="#8F9CAE"
                value={recipient}
                onChangeText={setRecipient}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="USDC Amount"
                placeholderTextColor="#8F9CAE"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendTransfer}>
                <Text style={styles.sendButtonText}>Send Gasless USDC</Text>
              </TouchableOpacity>
            </View>
          )}

          {recentTx && (
            <View style={styles.receiptContainer}>
              <Text style={styles.receiptHeader}>Transaction Complete</Text>
              <Text style={styles.receiptLabel}>Transaction Hash:</Text>
              <Text style={styles.receiptHash} numberOfLines={1} ellipsizeMode="middle">
                {recentTx.hash}
              </Text>
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
    backgroundColor: '#0F121D',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8F9CAE',
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#242D45',
  },
  logoutText: {
    color: '#FF4D4D',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#161A2A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242D45',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    color: '#8F9CAE',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeMock: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  badgeLive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  badgeText: {
    fontSize: 10,
    color: '#8F9CAE',
    fontWeight: '600',
  },
  addressText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActionButton: {
    paddingVertical: 6,
  },
  cardActionText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
  gasBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  gasBadgeText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '600',
  },
  balanceContainer: {
    backgroundColor: '#161A2A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#242D45',
    marginBottom: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#8F9CAE',
    marginBottom: 8,
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  currency: {
    fontSize: 20,
    color: '#8F9CAE',
    fontWeight: '500',
  },
  sendCard: {
    backgroundColor: '#161A2A',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#242D45',
  },
  sendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  sendDescription: {
    fontSize: 12,
    color: '#8F9CAE',
    lineHeight: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0F121D',
    borderRadius: 6,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#242D45',
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressText: {
    color: '#8F9CAE',
    fontSize: 13,
    marginTop: 10,
  },
  receiptContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#0F121D',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#242D45',
  },
  receiptHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#22C55E',
    marginBottom: 8,
  },
  receiptLabel: {
    fontSize: 11,
    color: '#8F9CAE',
  },
  receiptHash: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
  },
  receiptSavings: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  },
});
