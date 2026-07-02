import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Clipboard,
  Platform,
} from 'react-native';

export interface BoothInfo {
  id: string;
  name: string;
  location: string;
  address: string;
  liquidity: string;
  status: 'open' | 'closed';
  hours: string;
  phone: string;
}

const APPROVED_DEPIN_BOOTHS: BoothInfo[] = [];

interface BoothsTabProps {
  onSelectBooth: (boothAddress: string) => void;
}

export default function BoothsTab({ onSelectBooth }: BoothsTabProps) {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredBooths = APPROVED_DEPIN_BOOTHS.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.location.toLowerCase().includes(search.toLowerCase())
  );

  const copyAddress = (address: string, id: string) => {
    Clipboard.setString(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderBooth = ({ item }: { item: BoothInfo }) => {
    const isOpen = item.status === 'open';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.statusDot, isOpen ? styles.dotOpen : styles.dotClosed]} />
            <Text style={styles.statusLabel}>{isOpen ? 'Open' : 'Closed'}</Text>
          </View>
        </View>

        <Text style={styles.location}>{item.location}</Text>
        <Text style={styles.metadataText}>
          Reserve: ${item.liquidity} USDC  •  {item.hours}
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.addressPill}
            onPress={() => copyAddress(item.address, item.id)}
            activeOpacity={0.6}
          >
            <Text style={styles.addressPillText} numberOfLines={1} ellipsizeMode="middle">
              {item.address}
            </Text>
            <Text style={styles.copyIcon}>
              {copiedId === item.id ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, !isOpen && styles.sendButtonDisabled]}
            onPress={() => onSelectBooth(item.address)}
            disabled={!isOpen}
            activeOpacity={0.8}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DePIN Booths</Text>
      <Text style={styles.description}>
        Select a local physical agent to send funds to for cash pickup.
      </Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search by name or location..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filteredBooths}
        keyExtractor={(item) => item.id}
        renderItem={renderBooth}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No booths found</Text>
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
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    backgroundColor: '#0E1120',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1E293B',
    fontWeight: '500',
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#0E1120',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  dotOpen: {
    backgroundColor: '#10B981',
  },
  dotClosed: {
    backgroundColor: '#F43F5E',
  },
  statusLabel: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: '600',
  },
  location: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
  },
  metadataText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressPill: {
    flex: 1,
    backgroundColor: '#070913',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    height: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressPillText: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
    marginRight: 6,
  },
  copyIcon: {
    fontSize: 10,
    color: '#818CF8',
    fontWeight: '700',
  },
  sendButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
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
