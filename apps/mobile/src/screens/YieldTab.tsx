import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Modal,
} from 'react-native';
import { walletService, WalletState } from '../services/walletService';
import { TxItem } from './HistoryTab';

interface YieldTabProps {
  wallet: WalletState;
  walletBalance: string;
  onTransactionComplete: (tx: TxItem) => void;
  onRefreshBalance: () => void;
}

export default function YieldTab({ wallet, walletBalance, onTransactionComplete, onRefreshBalance }: YieldTabProps) {
  // Yield data from on-chain
  const [yieldTotal, setYieldTotal] = useState('0.00');
  const [yieldPrincipal, setYieldPrincipal] = useState('0.00');
  const [yieldInterest, setYieldInterest] = useState('0.000000');
  const [apyBps, setApyBps] = useState(450);
  const [isLoadingYield, setIsLoadingYield] = useState(false);

  // Form inputs
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txProgress, setTxProgress] = useState('');

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTxHash, setLastTxHash] = useState('');
  const [lastTxType, setLastTxType] = useState<'deposit' | 'withdraw'>('deposit');
  const [lastTxAmount, setLastTxAmount] = useState('');

  // Real-time ticking display
  const [displayBalance, setDisplayBalance] = useState('0.00');
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch yield balance on mount and when address changes
  useEffect(() => {
    fetchYieldBalance();
  }, [wallet.smartAccountAddress]);

  // Real-time yield ticker — updates every second to show interest accruing
  useEffect(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
    }

    const principal = parseFloat(yieldPrincipal);
    const baseTotal = parseFloat(yieldTotal);
    if (principal <= 0 || baseTotal <= 0) {
      setDisplayBalance(yieldTotal);
      return;
    }

    // Calculate the per-second yield increment
    const apyDecimal = apyBps / 10000;
    const perSecondYield = (principal * apyDecimal) / 31_536_000;
    let tickedBalance = baseTotal;

    setDisplayBalance(tickedBalance.toFixed(6));

    tickIntervalRef.current = setInterval(() => {
      tickedBalance += perSecondYield;
      setDisplayBalance(tickedBalance.toFixed(6));
    }, 1000);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [yieldTotal, yieldPrincipal, apyBps]);

  const fetchYieldBalance = async () => {
    setIsLoadingYield(true);
    try {
      const data = await walletService.getYieldBalance(wallet.smartAccountAddress, wallet.isSimulated);
      setYieldTotal(data.total);
      setYieldPrincipal(data.principal);
      setYieldInterest(data.interest);
      setApyBps(data.apyBps);
    } catch (e) {
      console.warn("Failed to fetch yield balance:", e);
    } finally {
      setIsLoadingYield(false);
    }
  };

  const handleDeposit = async () => {
    if (!amount.trim() || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid USDC amount.");
      return;
    }
    if (parseFloat(amount) > parseFloat(walletBalance)) {
      Alert.alert("Insufficient Balance", `You only have $${walletBalance} USDC available.`);
      return;
    }

    setIsProcessing(true);
    try {
      const result = await walletService.depositToYield(
        amount.trim(),
        (status) => setTxProgress(status)
      );

      const tx: TxItem = {
        id: Date.now().toString(),
        type: 'yield_deposit',
        amount: amount.trim(),
        recipientOrSender: 'Yield Vault (4.5% APY)',
        timestamp: new Date().toLocaleString([], {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        status: 'success',
        hash: result.txHash,
        gasSaved: result.gasSaved,
      };
      onTransactionComplete(tx);

      setLastTxHash(result.txHash);
      setLastTxType('deposit');
      setLastTxAmount(amount.trim());
      setShowSuccessModal(true);
      setAmount('');

      // Refresh both balances
      await Promise.all([fetchYieldBalance(), onRefreshBalance()]);
    } catch (e: any) {
      Alert.alert("Deposit Failed", e.message || "Failed to deposit to yield vault.");
    } finally {
      setIsProcessing(false);
      setTxProgress('');
    }
  };

  const handleWithdraw = async () => {
    const withdrawAmount = amount.trim();
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid USDC amount.");
      return;
    }
    if (parseFloat(withdrawAmount) > parseFloat(yieldTotal)) {
      Alert.alert("Insufficient Yield Balance", `You only have $${yieldTotal} USDC in the vault.`);
      return;
    }

    setIsProcessing(true);
    try {
      const result = await walletService.withdrawFromYield(
        withdrawAmount,
        (status) => setTxProgress(status)
      );

      const tx: TxItem = {
        id: Date.now().toString(),
        type: 'yield_withdraw',
        amount: withdrawAmount,
        recipientOrSender: 'Yield Vault → Wallet',
        timestamp: new Date().toLocaleString([], {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        status: 'success',
        hash: result.txHash,
        gasSaved: result.gasSaved,
      };
      onTransactionComplete(tx);

      setLastTxHash(result.txHash);
      setLastTxType('withdraw');
      setLastTxAmount(withdrawAmount);
      setShowSuccessModal(true);
      setAmount('');

      // Refresh both balances
      await Promise.all([fetchYieldBalance(), onRefreshBalance()]);
    } catch (e: any) {
      Alert.alert("Withdrawal Failed", e.message || "Failed to withdraw from yield vault.");
    } finally {
      setIsProcessing(false);
      setTxProgress('');
    }
  };

  const apyPercent = (apyBps / 100).toFixed(1);
  const principalNum = parseFloat(yieldPrincipal);
  const dailyEarning = ((principalNum * apyBps) / (10000 * 365)).toFixed(6);
  const monthlyEarning = ((principalNum * apyBps) / (10000 * 12)).toFixed(4);
  const yearlyEarning = ((principalNum * apyBps) / 10000).toFixed(2);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Yield Balance Card */}
      <View style={styles.yieldCard}>
        <View style={styles.yieldCardHeader}>
          <Text style={styles.yieldCardTitle}>Yield Vault Balance</Text>
          <View style={styles.apyBadge}>
            <Text style={styles.apyBadgeText}>{apyPercent}% APY</Text>
          </View>
        </View>

        <View style={styles.yieldBalanceRow}>
          {isLoadingYield ? (
            <ActivityIndicator size="small" color="#10B981" />
          ) : (
            <Text style={styles.yieldBalanceAmount}>
              ${displayBalance}
            </Text>
          )}
          <Text style={styles.yieldBalanceCurrency}>USDC</Text>
        </View>

        <View style={styles.yieldBreakdown}>
          <View style={styles.yieldBreakdownItem}>
            <Text style={styles.yieldBreakdownLabel}>Principal</Text>
            <Text style={styles.yieldBreakdownValue}>${yieldPrincipal}</Text>
          </View>
          <View style={styles.yieldBreakdownDivider} />
          <View style={styles.yieldBreakdownItem}>
            <Text style={styles.yieldBreakdownLabel}>Interest Earned</Text>
            <Text style={[styles.yieldBreakdownValue, styles.interestColor]}>
              +${yieldInterest}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={fetchYieldBalance} style={styles.refreshRow} activeOpacity={0.7}>
          <Text style={styles.refreshText}>↻ Refresh from chain</Text>
        </TouchableOpacity>
      </View>

      {/* Estimated Earnings Card */}
      {principalNum > 0 && (
        <View style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>Estimated Earnings</Text>
          <View style={styles.earningsGrid}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Daily</Text>
              <Text style={styles.earningsValue}>+${dailyEarning}</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Monthly</Text>
              <Text style={styles.earningsValue}>+${monthlyEarning}</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Yearly</Text>
              <Text style={styles.earningsValue}>+${yearlyEarning}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Deposit / Withdraw Toggle + Form */}
      <View style={styles.actionCard}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeAction === 'deposit' && styles.toggleBtnActive]}
            onPress={() => setActiveAction('deposit')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleBtnText, activeAction === 'deposit' && styles.toggleBtnTextActive]}>
              Deposit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeAction === 'withdraw' && styles.toggleBtnActiveWithdraw]}
            onPress={() => setActiveAction('withdraw')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleBtnText, activeAction === 'withdraw' && styles.toggleBtnTextActive]}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>

        {/* Available balance hint */}
        <Text style={styles.availableText}>
          {activeAction === 'deposit'
            ? `Available: $${walletBalance} USDC`
            : `In Vault: $${yieldTotal} USDC`}
        </Text>

        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.processingText}>{txProgress}</Text>
          </View>
        ) : (
          <>
            <View style={styles.amountInputContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder={activeAction === 'deposit' ? 'USDC Amount to Deposit' : 'USDC Amount to Withdraw'}
                placeholderTextColor="#64748B"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.maxButton}
                onPress={() => {
                  setAmount(activeAction === 'deposit' ? walletBalance : yieldTotal);
                }}
                activeOpacity={0.6}
              >
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, activeAction === 'withdraw' && styles.actionButtonWithdraw]}
              onPress={activeAction === 'deposit' ? handleDeposit : handleWithdraw}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>
                {activeAction === 'deposit' ? 'Deposit to Yield Vault' : 'Withdraw to Wallet'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Info note */}
        <Text style={styles.infoNote}>
          {activeAction === 'deposit'
            ? 'Gasless: Approve + Deposit batched in a single sponsored transaction.'
            : 'Gasless: Withdrawal is sponsored — zero gas fees.'}
        </Text>
      </View>

      {/* How It Works Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>How It Works</Text>
        <View style={styles.infoStep}>
          <Text style={styles.infoStepNum}>1</Text>
          <Text style={styles.infoStepText}>Deposit USDC into the on-chain Yield Vault smart contract.</Text>
        </View>
        <View style={styles.infoStep}>
          <Text style={styles.infoStepNum}>2</Text>
          <Text style={styles.infoStepText}>Your balance accrues yield at {apyPercent}% APY, computed on-chain using block timestamps.</Text>
        </View>
        <View style={styles.infoStep}>
          <Text style={styles.infoStepNum}>3</Text>
          <Text style={styles.infoStepText}>Withdraw anytime — principal + earned interest returned to your wallet.</Text>
        </View>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>
              {lastTxType === 'deposit' ? 'Yield Deposit Successful!' : 'Withdrawal Successful!'}
            </Text>
            <Text style={styles.modalAmount}>${lastTxAmount} USDC</Text>

            <View style={styles.modalDetailRow}>
              <Text style={styles.modalLabel}>Type</Text>
              <Text style={styles.modalValue}>
                {lastTxType === 'deposit' ? '📈 Deposited to Vault' : '📤 Withdrawn to Wallet'}
              </Text>
            </View>
            <View style={styles.modalDetailRow}>
              <Text style={styles.modalLabel}>Gas Fee</Text>
              <Text style={styles.modalGasSaved}>⚡ Sponsored (Free)</Text>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => Linking.openURL(`https://amoy.polygonscan.com/tx/${lastTxHash}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalPrimaryBtnText}>View on Explorer ↗</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => setShowSuccessModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalSecondaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },

  // ─── Yield Balance Card ────────────────────────────────────────────
  yieldCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  yieldCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yieldCardTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  apyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  apyBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  yieldBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  yieldBalanceAmount: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  yieldBalanceCurrency: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  yieldBreakdown: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 12,
  },
  yieldBreakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  yieldBreakdownDivider: {
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  yieldBreakdownLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  yieldBreakdownValue: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  interestColor: {
    color: '#10B981',
  },
  refreshRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  refreshText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },

  // ─── Estimated Earnings Card ───────────────────────────────────────
  earningsCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.12)',
  },
  earningsTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  earningsValue: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Action Card (Deposit/Withdraw) ────────────────────────────────
  actionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  toggleBtnActiveWithdraw: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  toggleBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#E2E8F0',
  },
  availableText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  processingText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '500',
  },
  amountInputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  amountInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 60,
    color: '#E2E8F0',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  maxButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  maxButtonText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  actionButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonWithdraw: {
    backgroundColor: '#6366F1',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoNote: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ─── How It Works Card ─────────────────────────────────────────────
  infoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.06)',
  },
  infoCardTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  infoStepNum: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 10,
  },
  infoStepText: {
    color: '#94A3B8',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },

  // ─── Success Modal ─────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successCheck: {
    color: '#10B981',
    fontSize: 28,
    fontWeight: '700',
  },
  modalTitle: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalAmount: {
    color: '#10B981',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  modalLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  modalValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  modalGasSaved: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    height: 44,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
