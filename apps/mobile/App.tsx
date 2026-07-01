import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import AuthScreen from './src/screens/AuthScreen';
import WalletSetupScreen from './src/screens/WalletSetupScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import { walletService, WalletState } from './src/services/walletService';

type AppScreen = 'loading' | 'auth' | 'setup' | 'dashboard';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [username, setUsername] = useState('');
  const [loginMethod, setLoginMethod] = useState<'passkey' | 'google'>('passkey');
  const [wallet, setWallet] = useState<WalletState | null>(null);

  // Check for existing session on startup
  useEffect(() => {
    const checkSession = async () => {
      const storedWallet = await walletService.getStoredSession();
      if (storedWallet) {
        setWallet(storedWallet);
        setScreen('dashboard');
      } else {
        setScreen('auth');
      }
    };
    checkSession();
  }, []);

  const handleStartSetup = (name: string, method: 'passkey' | 'google') => {
    setUsername(name);
    setLoginMethod(method);
    setScreen('setup');
  };

  const handleSetupSuccess = (walletState: WalletState) => {
    setWallet(walletState);
    setScreen('dashboard');
  };

  const handleSetupError = () => {
    setScreen('auth');
  };

  const handleLogout = async () => {
    await walletService.clearWallet();
    setWallet(null);
    setScreen('auth');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {screen === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}

      {screen === 'auth' && (
        <AuthScreen onStartSetup={handleStartSetup} />
      )}

      {screen === 'setup' && (
        <WalletSetupScreen
          username={username}
          loginMethod={loginMethod}
          onSetupSuccess={handleSetupSuccess}
          onSetupError={handleSetupError}
        />
      )}

      {screen === 'dashboard' && (
        <DashboardScreen
          wallet={wallet!}
          onLogout={handleLogout}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F121D',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
