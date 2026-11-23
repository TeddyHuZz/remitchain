import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hex } from 'viem';
import { THEME } from '../config/theme';
import { backupService } from '../services/backupService';
import { walletService, WalletState } from '../services/walletService';

interface AuthScreenProps {
  onStartSetup: (username: string, loginMethod: 'passkey' | 'google') => void;
  onRestoreSuccess?: (wallet: WalletState) => void;
}

export default function AuthScreen({ onStartSetup, onRestoreSuccess }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestoreFromDrive = async () => {
    if (!restorePassphrase.trim()) {
      Alert.alert('Passphrase Required', 'Enter your backup recovery passphrase.');
      return;
    }
    setIsRestoring(true);
    try {
      const label = username.trim() || 'user';
      const session = await backupService.authenticateGoogle(label);
      const encrypted = await backupService.downloadBackup(session);
      if (!encrypted) {
        throw new Error('No RemitChain backup found in Google Drive.');
      }
      const decryptedKey = backupService.decrypt(encrypted, restorePassphrase.trim());
      if (!decryptedKey.startsWith('0x')) {
        throw new Error('Decrypted key format is invalid.');
      }
      const restoredName = username.trim() || session.email.split('@')[0] || 'User';
      const walletState = await walletService.restoreWalletFromKey(restoredName, decryptedKey as Hex);
      setShowRestoreModal(false);
      setRestorePassphrase('');
      onRestoreSuccess?.(walletState);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to restore backup.';
      Alert.alert('Restore Failed', msg);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBiometricAuth = () => {
    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter a username or email to secure your account.");
      return;
    }
    // Initiate wallet setup
    onStartSetup(username.trim(), 'passkey');
  };

  const handleGoogleAuth = () => {
    if (!username.trim()) {
      Alert.alert("Username/Email Required", "Please enter your email or username first.");
      return;
    }
    // Simulate/Initiate Google auth
    onStartSetup(username.trim(), 'google');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo / Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>RemitChain</Text>
            <Text style={styles.subtitle}>Micro-remittances optimized on Polygon</Text>
          </View>

          {/* Form Container */}
          <View style={styles.formCard}>
            <Text style={styles.label}>Get Started</Text>
            <Text style={styles.description}>
              Enter a username or email. We will secure your account using device biometrics.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor="#8F9CAE"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            {/* Passkey Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleBiometricAuth}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Continue with FaceID / Passkey</Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleGoogleAuth}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }}
              onPress={() => setShowRestoreModal(true)}
              activeOpacity={0.7}
            >
              <Text style={{ color: THEME.accentPrimaryHover, fontSize: 13, fontWeight: '600' }}>
                Restore Encrypted Backup from Google Drive
              </Text>
            </TouchableOpacity>
          </View>

          <Modal visible={showRestoreModal} transparent animationType="fade" onRequestClose={() => setShowRestoreModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
              <View style={{ backgroundColor: THEME.bgSurface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: THEME.borderActive }}>
                <Text style={{ color: THEME.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                  Restore Wallet Backup
                </Text>
                <Text style={{ color: THEME.textSecondary, fontSize: 13, marginBottom: 14 }}>
                  Sign in with Google Drive and enter your recovery passphrase to decrypt your wallet.
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
                  value={restorePassphrase}
                  onChangeText={setRestorePassphrase}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: THEME.bgElevated, alignItems: 'center' }}
                    onPress={() => setShowRestoreModal(false)}
                    disabled={isRestoring}
                  >
                    <Text style={{ color: THEME.textSecondary, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: THEME.accentPrimary, alignItems: 'center' }}
                    onPress={handleRestoreFromDrive}
                    disabled={isRestoring}
                  >
                    {isRestoring ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Restore</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Info footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Security Powered by Account Abstraction (ERC-4337).
            </Text>
            <Text style={styles.footerText}>
              No seed phrases. Gasless transactions.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F121D', // Sleek dark slate
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  header: {
    marginTop: 40,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8F9CAE',
    marginTop: 8,
  },
  formCard: {
    backgroundColor: '#161A2A',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  label: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#8F9CAE',
    lineHeight: 18,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#0F121D',
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#242D45',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#3B82F6', // Trustworthy blue
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#242D45',
  },
  dividerText: {
    color: '#8F9CAE',
    paddingHorizontal: 12,
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242D45',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 11,
    color: '#55657E',
    textAlign: 'center',
    lineHeight: 16,
  },
});
