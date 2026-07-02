import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Clipboard,
  Platform,
} from 'react-native';
import { WalletState } from '../services/walletService';

interface ProfileTabProps {
  wallet: WalletState;
  onLogout: () => void;
}

export default function ProfileTab({ wallet, onLogout }: ProfileTabProps) {
  const [copiedKey, setCopiedKey] = useState<'smart' | 'eoa' | null>(null);

  const copyText = (text: string, keyType: 'smart' | 'eoa') => {
    Clipboard.setString(text);
    setCopiedKey(keyType);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Profile</Text>
      <Text style={styles.description}>
        Manage your secure smart account credentials, cloud backups, and biometric setup.
      </Text>

      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{wallet.username.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>@{wallet.username}</Text>
      </View>

      {/* Account Info Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Smart Account Details</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Smart Wallet Address</Text>
            <TouchableOpacity onPress={() => copyText(wallet.smartAccountAddress, 'smart')} activeOpacity={0.7}>
              <Text style={styles.copyIndicator}>
                {copiedKey === 'smart' ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.monospaceValue} numberOfLines={1} ellipsizeMode="middle">
            {wallet.smartAccountAddress}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device Owner Key (EOA)</Text>
            <TouchableOpacity onPress={() => copyText(wallet.eoaAddress, 'eoa')} activeOpacity={0.7}>
              <Text style={styles.copyIndicator}>
                {copiedKey === 'eoa' ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.monospaceValue} numberOfLines={1} ellipsizeMode="middle">
            {wallet.eoaAddress}
          </Text>
        </View>
      </View>

      {/* Security & Config */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security Settings</Text>
        
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <View>
              <Text style={styles.settingName}>Google Drive Cloud Backup</Text>
              <Text style={styles.settingDesc}>
                {wallet.isCloudSynced ? 'Synced & Encrypted on Drive' : 'Local device storage only'}
              </Text>
            </View>
            <Text style={styles.settingStatus}>{wallet.isCloudSynced ? '🟢 Active' : '⚪ Disabled'}</Text>
          </View>

          <View style={styles.settingsDivider} />

          <View style={styles.settingsRow}>
            <View>
              <Text style={styles.settingName}>Biometric Authentication</Text>
              <Text style={styles.settingDesc}>Face ID / Fingerprint protection</Text>
            </View>
            <Text style={styles.settingStatus}>🟢 Active</Text>
          </View>

          <View style={styles.settingsDivider} />

          <View style={styles.settingsRow}>
            <View>
              <Text style={styles.settingName}>Network Connection</Text>
              <Text style={styles.settingDesc}>
                {wallet.isSimulated ? 'Polygon Amoy (Simulation)' : 'Polygon Amoy (Live Network)'}
              </Text>
            </View>
            <Text style={styles.settingStatus}>🟢 Connected</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>Sign Out of RemitChain</Text>
      </TouchableOpacity>
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
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
    fontWeight: '500',
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#0E1120',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  role: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: '#0E1120',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  copyIndicator: {
    fontSize: 10,
    color: '#818CF8',
    fontWeight: '700',
  },
  monospaceValue: {
    fontSize: 12,
    color: '#F1F5F9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  settingsCard: {
    backgroundColor: '#0E1120',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#1E293B',
  },
  settingName: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  settingStatus: {
    fontSize: 12,
    color: '#F1F5F9',
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)',
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#F43F5E',
    fontSize: 14,
    fontWeight: '700',
  },
});
