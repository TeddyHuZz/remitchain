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
  const [displayInterest, setDisplayInterest] = useState('0.000000');
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
      setDisplayInterest(yieldInterest);
      return;
    }

    // Calculate the per-second yield increment
    const apyDecimal = apyBps / 10000;
    const perSecondYield = (principal * apyDecimal) / 31_536_000;
    let tickedBalance = baseTotal;

    setDisplayBalance(tickedBalance.toFixed(6));
    setDisplayInterest((tickedBalance - principal).toFixed(6));

    tickIntervalRef.current = setInterval(() => {
      tickedBalance += perSecondYield;
      setDisplayBalance(tickedBalance.toFixed(6));
      setDisplayInterest((tickedBalance - principal).toFixed(6));
    }, 1000);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [yieldTotal, yieldPrincipal, apyBps, yieldInterest]);

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
              +${displayInterest}
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
              <Text style={styles.modalGasSaved}> Sponsored (Free)</Text>
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
    paddingHorizontal: 0,
    paddingBottom: 24,
    paddingTop: 10,
  },

  // ─── Yield Balance Card ────────────────────────────────────────────
  yieldCard: {
    backgroundColor: '#0E1120',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  yieldCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  yieldCardTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  apyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  apyBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  yieldBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  yieldBalanceAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  yieldBalanceCurrency: {
    color: '#10B981',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  yieldBreakdown: {
    flexDirection: 'row',
    backgroundColor: '#070913',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
  },
  yieldBreakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  yieldBreakdownDivider: {
    width: 1,
    backgroundColor: '#1E293B',
  },
  yieldBreakdownLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  yieldBreakdownValue: {
    color: '#F1F5F9',
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
    fontSize: 11,
    fontWeight: '700',
  },

  // ─── Estimated Earnings Card ───────────────────────────────────────
  earningsCard: {
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
  earningsTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#070913',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  earningsValue: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Action Card (Deposit/Withdraw) ────────────────────────────────
  actionCard: {
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#070913',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 3,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#6366F1',
  },
  toggleBtnActiveWithdraw: {
    backgroundColor: '#6366F1',
  },
  toggleBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  availableText: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  processingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 10,
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
  actionButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 10,
  },
  actionButtonWithdraw: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  infoNote: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },

  // ─── How It Works Card ─────────────────────────────────────────────
  infoCard: {
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
  infoCardTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoStepNum: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    textAlign: 'center',
    lineHeight: 18,
    marginRight: 10,
  },
  infoStepText: {
    color: '#94A3B8',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },

  // ─── Success Modal ─────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 19, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0E1120',
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
  successCircle: {
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
  successCheck: {
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
    color: '#10B981',
    marginBottom: 20,
    letterSpacing: -0.5,
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
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalValue: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  modalGasSaved: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  modalPrimaryBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
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
