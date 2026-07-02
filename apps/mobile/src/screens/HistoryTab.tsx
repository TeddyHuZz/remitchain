import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Linking,
  Platform,
  Clipboard,
} from 'react-native';

export interface TxItem {
  id: string;
  type: 'send' | 'receive' | 'faucet' | 'split' | 'yield_deposit' | 'yield_withdraw';
  amount: string;
  recipientOrSender: string;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
  hash: string;
  gasSaved?: string;
}

const DEFAULT_TX_HISTORY: TxItem[] = [];

interface HistoryTabProps {
  customTxs: TxItem[];
}

export default function HistoryTab({ customTxs }: HistoryTabProps) {
  const allTxs = [...customTxs, ...DEFAULT_TX_HISTORY];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const copyHash = (hash: string, id: string) => {
    Clipboard.setString(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const handleOpenExplorer = (hash: string) => {
    Linking.openURL(`https://amoy.polygonscan.com/tx/${hash}`);
  };

  const renderTx = ({ item }: { item: TxItem }) => {
    const isSend = item.type === 'send';
    const isSplit = item.type === 'split';
    const isFaucet = item.type === 'faucet';
    const isYieldDeposit = item.type === 'yield_deposit';
    const isYieldWithdraw = item.type === 'yield_withdraw';
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.rowContainer}>
        {/* Main transaction summary row */}
        <TouchableOpacity
          style={styles.summaryRow}
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.6}
        >
          <View style={styles.leftCol}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconArrow}>
                {isYieldDeposit ? '📈' : isYieldWithdraw ? '📤' : isSplit ? '⇆' : isSend ? '↓' : isFaucet ? '⚡' : '↑'}
              </Text>
            </View>
            <View>
              <Text style={styles.titleText}>
                {isYieldDeposit ? 'Yield Deposit' : isYieldWithdraw ? 'Yield Withdrawal' : isSplit ? 'Split Remittance' : isSend ? 'Remittance Sent' : isFaucet ? 'USDC Faucet Claim' : 'Funds Received'}
              </Text>
              <Text style={styles.dateText}>{item.timestamp}</Text>
            </View>
          </View>

          <View style={styles.rightCol}>
            <Text style={[styles.amountText, (isSend || isSplit || isYieldDeposit) ? styles.amountSend : styles.amountReceive]}>
              {(isSend || isSplit || isYieldDeposit) ? '-' : '+'}${item.amount}
            </Text>
            <Text style={styles.statusIndicator}>Success</Text>
          </View>
        </TouchableOpacity>

        {/* Collapsible details pane */}
        {isExpanded && (
          <View style={styles.detailsPane}>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>
                {isYieldDeposit ? 'Yield Vault' : isYieldWithdraw ? 'Yield Vault' : isSplit ? 'Distribution' : isSend ? 'Recipient Wallet' : 'Sender Wallet'}
              </Text>
              <Text style={styles.detailsValue} numberOfLines={2} ellipsizeMode="tail">
                {item.recipientOrSender}
              </Text>
            </View>

            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Transaction Hash</Text>
              <View style={styles.hashActionRow}>
                <Text style={styles.hashValue} numberOfLines={1} ellipsizeMode="middle">
                  {item.hash}
                </Text>
                <TouchableOpacity onPress={() => copyHash(item.hash, item.id)} activeOpacity={0.6}>
                  <Text style={styles.actionLink}>
                    {copiedHashId === item.id ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.detailsFooter}>
              {item.gasSaved && (
                <Text style={styles.gasSavedText}>
                  Gas Sponsored (Saved {item.gasSaved})
                </Text>
              )}
              <TouchableOpacity onPress={() => handleOpenExplorer(item.hash)} activeOpacity={0.6}>
                <Text style={styles.explorerLink}>View on Explorer ↗</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.description}>
        View all incoming and outgoing transaction feeds.
      </Text>

      <FlatList
        data={allTxs}
        keyExtractor={(item) => item.id}
        renderItem={renderTx}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transaction records</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '500',
  },
  list: {
    paddingBottom: 20,
  },
  rowContainer: {
    backgroundColor: '#0E1120',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#070913',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconArrow: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '800',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  amountSend: {
    color: '#FFFFFF',
  },
  amountReceive: {
    color: '#10B981',
  },
  statusIndicator: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  separator: {
    height: 8,
  },
  detailsPane: {
    backgroundColor: '#070913',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    padding: 12,
  },
  detailsRow: {
    marginBottom: 8,
  },
  detailsLabel: {
    fontSize: 9,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailsValue: {
    fontSize: 12,
    color: '#F1F5F9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  hashActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hashValue: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    marginRight: 10,
  },
  actionLink: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '700',
  },
  detailsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.5)',
  },
  gasSavedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  explorerLink: {
    fontSize: 11,
    color: '#818CF8',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
