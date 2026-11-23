import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Clipboard,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { createPublicClient, http, formatUnits } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { BOOTH_REGISTRY_ABI } from '@repo/contracts-sdk';
import { WEB3_CONFIG } from '../config/env';

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

interface BoothsTabProps {
  onSelectBooth: (boothAddress: string) => void;
}

export default function BoothsTab({ onSelectBooth }: BoothsTabProps) {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [booths, setBooths] = useState<BoothInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBooths = async () => {
    setLoading(true);
    try {
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(WEB3_CONFIG.PUBLIC_RPC_URL)
      });

      const addresses = await publicClient.readContract({
        address: WEB3_CONFIG.BOOTH_REGISTRY_ADDRESS as `0x${string}`,
        abi: BOOTH_REGISTRY_ABI,
        functionName: "getBoothAddresses"
      });

      const boothResults = await publicClient.multicall({
        contracts: addresses.map((addr) => ({
          address: WEB3_CONFIG.BOOTH_REGISTRY_ADDRESS as `0x${string}`,
          abi: BOOTH_REGISTRY_ABI,
          functionName: "booths" as const,
          args: [addr] as const
        }))
      });

      const fetchWithTimeout = async (url: string, timeoutMs = 3000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      };

      const fetchIpfsMeta = async (ipfsHash: string) => {
        const customGateway = WEB3_CONFIG.PINATA_GATEWAY.replace(/\/$/, "");
        const gateways = [
          ...(customGateway ? [`${customGateway}/ipfs/${ipfsHash}`] : []),
          `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
          `https://ipfs.io/ipfs/${ipfsHash}`
        ];
        for (const url of gateways) {
          try {
            const res = await fetchWithTimeout(url, 3000);
            if (res.ok) return await res.json();
          } catch {
            continue;
          }
        }
        return null;
      };

      const approvedEntries = addresses
        .map((addr, idx) => ({ addr, res: boothResults[idx] }))
        .filter(
          (entry): entry is { addr: `0x${string}`; res: { status: "success"; result: readonly [string, bigint, number, bigint] } } =>
            entry.res?.status === "success" && entry.res.result[2] === 1
        );

      const settled = await Promise.allSettled(
        approvedEntries.map(async ({ addr, res }): Promise<BoothInfo> => {
          const [ipfsHash, collateralRaw] = res.result;
          let name = `Booth ${addr.slice(0, 6)}...${addr.slice(-4)}`;
          let location = "Location unavailable";
          let hours = "9 AM - 6 PM";

          if (ipfsHash) {
            const meta = await fetchIpfsMeta(ipfsHash);
            if (meta) {
              name = meta.storeName || name;
              location = meta.address || location;
              hours = meta.description || hours;
            }
          }

          return {
            id: addr,
            name,
            location,
            address: addr,
            liquidity: Number(formatUnits(collateralRaw, 6)).toString(),
            status: 'open' as const,
            hours,
            phone: ''
          };
        })
      );

      const list = settled
        .filter((r): r is PromiseFulfilledResult<BoothInfo> => r.status === "fulfilled")
        .map((r) => r.value);
      setBooths(list);
    } catch (e) {
      console.error("Failed to load booths from contract in mobile app", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooths();
  }, []);

  const filteredBooths = booths.filter(
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
            {loading ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text style={styles.emptyText}>No active booths found</Text>
            )}
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
    backgroundColor: '#0D131F',
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
    backgroundColor: '#0D131F',
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
    backgroundColor: '#06090F',
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
    color: '#3B82F6',
    fontWeight: '700',
  },
  sendButton: {
    backgroundColor: '#2563EB',
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
