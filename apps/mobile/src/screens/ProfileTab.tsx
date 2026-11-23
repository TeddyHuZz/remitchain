import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Clipboard,
  Platform,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { THEME } from '../config/theme';
import { backupService } from '../services/backupService';
import { walletService, WalletState } from '../services/walletService';

interface ProfileTabProps {
  wallet: WalletState;
  onLogout: () => void;
}

export default function ProfileTab({ wallet, onLogout }: ProfileTabProps) {
  const [copiedKey, setCopiedKey] = useState<'smart' | 'eoa' | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleBackupToDrive = async () => {
    if (backupPassphrase.trim().length < 8) {
      Alert.alert('Passphrase Required', 'Enter at least 8 characters to encrypt your backup.');
      return;
    }
    setIsBackingUp(true);
    try {
      const privKey = await walletService.exportPrivateKeyForBackup();
      const encrypted = backupService.encrypt(privKey, backupPassphrase.trim());
      const session = await backupService.authenticateGoogle(wallet.username);
      const ok = await backupService.uploadBackup(session, encrypted);
      if (!ok) throw new Error('Drive upload failed.');
      setShowBackupModal(false);
      setBackupPassphrase('');
      Alert.alert('Backup Complete', 'Your AES-256-GCM encrypted wallet backup is saved to Google Drive.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Backup failed.';
      Alert.alert('Backup Error', msg);
    } finally {
      setIsBackingUp(false);
    }
  };

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
            <Text style={styles.settingStatus}>{wallet.isCloudSynced ? 'Active' : 'Disabled'}</Text>
          </View>

          <View style={styles.settingsDivider} />

          <View style={styles.settingsRow}>
            <View>
              <Text style={styles.settingName}>Biometric Authentication</Text>
              <Text style={styles.settingDesc}>Face ID / Fingerprint protection</Text>
            </View>
            <Text style={styles.settingStatus}>Active</Text>
          </View>

          <View style={styles.settingsDivider} />

          <View style={styles.settingsRow}>
            <View>
              <Text style={styles.settingName}>Network Connection</Text>
              <Text style={styles.settingDesc}>
                {wallet.isSimulated ? 'Polygon Amoy (Simulation)' : 'Polygon Amoy (Live Network)'}
              </Text>
            </View>
            <Text style={styles.settingStatus}>Connected</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: THEME.bgElevated,
          borderColor: THEME.borderActive,
          borderWidth: 1,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          marginBottom: 12,
        }}
        onPress={() => setShowBackupModal(true)}
        activeOpacity={0.8}
      >
        <Text style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: '600' }}>
          Back Up Wallet to Google Drive
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>Sign Out of RemitChain</Text>
      </TouchableOpacity>

      <Modal visible={showBackupModal} transparent animationType="fade" onRequestClose={() => setShowBackupModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: THEME.bgSurface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: THEME.borderActive }}>
            <Text style={{ color: THEME.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
              Encrypt Wallet Backup
            </Text>
            <Text style={{ color: THEME.textSecondary, fontSize: 13, marginBottom: 14 }}>
              Choose a recovery passphrase (min 8 chars). Your key is encrypted with AES-256-GCM before uploading to Google Drive.
            </Text>
            <TextInput
              style={{
                backgroundColor: THEME.bgCanvas,
                borderColor: THEME.borderSubtle,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                color: THEME.textPrimary,
                marginBottom: 16,
              }}
              placeholder="Recovery passphrase"
              placeholderTextColor={THEME.textMuted}
              secureTextEntry
              value={backupPassphrase}
              onChangeText={setBackupPassphrase}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: THEME.bgElevated, alignItems: 'center' }}
                onPress={() => setShowBackupModal(false)}
                disabled={isBackingUp}
              >
                <Text style={{ color: THEME.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: THEME.accentPrimary, alignItems: 'center' }}
                onPress={handleBackupToDrive}
                disabled={isBackingUp}
              >
                {isBackingUp ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Encrypt & Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#0D131F',
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
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#2563EB',
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
    backgroundColor: '#0D131F',
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
    color: '#3B82F6',
    fontWeight: '700',
  },
  monospaceValue: {
    fontSize: 12,
    color: '#F1F5F9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  settingsCard: {
    backgroundColor: '#0D131F',
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
