import * as Notifications from 'expo-notifications';
import { WEB3_CONFIG } from '../config/env';

export async function registerPushToken(
  walletAddress: string,
  signMessage: (message: string) => Promise<string>
): Promise<string | null> {
  if (!WEB3_CONFIG.API_URL || !walletAddress) return null;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expoPushToken = tokenData.data;
    const timestamp = Date.now();
    const signature = await signMessage(`RemitChain Push:${walletAddress.toLowerCase()}:${timestamp}`);

    await fetch(`${WEB3_CONFIG.API_URL.replace(/\/$/, '')}/api/push-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, expoPushToken, signature, timestamp }),
    });

    return expoPushToken;
  } catch {
    return null;
  }
}
