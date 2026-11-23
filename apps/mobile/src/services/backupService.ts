import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { WEB3_CONFIG } from '../config/env';
import { decryptBackup, encryptBackup } from './backupCrypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const BACKUP_FILENAME = 'remitchain_wallet_backup.json';
const SIMULATED_CLOUD_KEY = 'REMITECHAIN_SIMULATED_CLOUD_BACKUP';

export interface GoogleUserSession {
  accessToken: string;
  email: string;
}

class BackupService {
  encrypt(plaintext: string, passphrase: string): string {
    return encryptBackup(plaintext, passphrase);
  }

  decrypt(payload: string, passphrase: string): string {
    return decryptBackup(payload, passphrase);
  }

  async authenticateGoogle(username: string): Promise<GoogleUserSession> {
    const clientId = WEB3_CONFIG.GOOGLE_CLIENT_ID || '';

    if (!clientId) {
      await new Promise((r) => setTimeout(r, 1000));
      return {
        accessToken: 'mock-access-token-12345',
        email: username.includes('@') ? username : `${username}@gmail.com`,
      };
    }

    const clientHash = clientId.split('.')[0];
    const redirectUri = Platform.select({
      ios: `com.googleusercontent.apps.${clientHash}:/oauth2redirect`,
      android: `com.googleusercontent.apps.${clientHash}:/oauth2redirect`,
      default: 'remitchain://auth',
    }) || 'remitchain://auth';

    const authUrl = `${GOOGLE_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(
      'https://www.googleapis.com/auth/drive.appdata email'
    )}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      const codeMatch = result.url.match(/[?&]code=([^&]+)/);
      const code = codeMatch ? codeMatch[1] : null;
      if (code) {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `code=${code}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&grant_type=authorization_code`,
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          throw new Error(`Google token exchange failed: ${errText}`);
        }

        const tokenData = await tokenResponse.json();
        if (tokenData.access_token) {
          return {
            accessToken: tokenData.access_token,
            email: username.includes('@') ? username : `${username}@gmail.com`,
          };
        }
      }
    }

    throw new Error('Google authentication was cancelled or failed.');
  }

  async uploadBackup(session: GoogleUserSession, encryptedKey: string): Promise<boolean> {
    if (session.accessToken === 'mock-access-token-12345') {
      await SecureStore.setItemAsync(`${SIMULATED_CLOUD_KEY}_${session.email}`, encryptedKey);
      return true;
    }

    const searchUrl = `${GOOGLE_DRIVE_API}?q=name='${BACKUP_FILENAME}' and 'appDataFolder' in parents&spaces=appDataFolder`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const searchResult = await searchResponse.json();
    const existingFile = searchResult.files && searchResult.files[0];

    const metadata = { name: BACKUP_FILENAME, parents: ['appDataFolder'] };
    const fileData = JSON.stringify({
      email: session.email,
      encryptedWalletKey: encryptedKey,
      updatedAt: new Date().toISOString(),
    });

    const boundary = 'remitchain_drive_boundary';
    const multipartBody =
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${fileData}` +
      `\r\n--${boundary}--`;

    const uploadUrl = existingFile
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const method = existingFile ? 'PATCH' : 'POST';

    const response = await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    return response.ok;
  }

  async downloadBackup(session: GoogleUserSession): Promise<string | null> {
    if (session.accessToken === 'mock-access-token-12345') {
      return await SecureStore.getItemAsync(`${SIMULATED_CLOUD_KEY}_${session.email}`);
    }

    const searchUrl = `${GOOGLE_DRIVE_API}?q=name='${BACKUP_FILENAME}' and 'appDataFolder' in parents&spaces=appDataFolder&fields=files(id)`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const searchResult = await searchResponse.json();
    const file = searchResult.files && searchResult.files[0];
    if (!file) return null;

    const downloadResponse = await fetch(`${GOOGLE_DRIVE_API}/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!downloadResponse.ok) return null;

    const data = await downloadResponse.json();
    return data.encryptedWalletKey || null;
  }
}

export const backupService = new BackupService();
