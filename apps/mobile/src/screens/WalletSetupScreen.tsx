import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { walletService, WalletState } from '../services/walletService';

interface WalletSetupScreenProps {
  username: string;
  loginMethod: 'passkey' | 'google';
  onSetupSuccess: (walletState: WalletState) => void;
  onSetupError: (error: string) => void;
}

export default function WalletSetupScreen({
  username,
  loginMethod,
  onSetupSuccess,
  onSetupError,
}: WalletSetupScreenProps) {
  const [status, setStatus] = React.useState('Initializing setup...');

  useEffect(() => {
    let active = true;

    const runSetup = async () => {
      try {
        const wallet = await walletService.initializeWallet(username, loginMethod, (msg: string) => {
          if (active) setStatus(msg);
        });
        if (active) onSetupSuccess(wallet);
      } catch (err: any) {
        if (active) onSetupError(err?.message || 'Wallet setup failed.');
      }
    };

    runSetup();

    return () => {
      active = false;
    };
  }, [username, loginMethod]);

  const isGoogleAuthPhase =
    loginMethod === 'google' &&
    (status.includes('Web3Auth') || status.includes('Google') || status.includes('Initializing setup'));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#3B82F6" style={styles.spinner} />
        
        <Text style={styles.title}>
          {isGoogleAuthPhase ? 'Google Sign-In' : 'Securing Account'}
        </Text>
        <Text style={styles.subtitle}>
          {isGoogleAuthPhase 
            ? 'Launching secure login browser window...' 
            : 'Creating your smart wallet on Polygon...'}
        </Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {isGoogleAuthPhase
              ? 'Your private key will be generated securely inside a Web3Auth MPC node and linked to your social login.'
              : 'This uses Account Abstraction to generate a smart contract-based wallet. You won\'t have to write down or manage a seed phrase.'}
          </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  spinner: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8F9CAE',
    marginBottom: 32,
    textAlign: 'center',
  },
  statusBox: {
    backgroundColor: '#161A2A',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#242D45',
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  statusText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#55657E',
    textAlign: 'center',
    lineHeight: 18,
  },
});
