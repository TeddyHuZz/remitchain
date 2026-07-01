import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';

interface AuthScreenProps {
  onStartSetup: (username: string) => void;
}

export default function AuthScreen({ onStartSetup }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleBiometricAuth = () => {
    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter a username or email to secure your account.");
      return;
    }
    // Initiate wallet setup
    onStartSetup(username.trim());
  };

  const handleGoogleAuth = () => {
    if (!username.trim()) {
      Alert.alert("Username/Email Required", "Please enter your email or username first.");
      return;
    }
    // Simulate/Initiate Google auth
    onStartSetup(username.trim());
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

            {/* Google Social Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleGoogleAuth}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

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
