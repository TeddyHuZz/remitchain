import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js';

const PBKDF2_ITERATIONS = 100_000;

export function encryptBackup(plaintext: string, passphrase: string): string {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = pbkdf2(sha256, utf8ToBytes(passphrase), salt, { c: PBKDF2_ITERATIONS, dkLen: 32 });
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return `v2:${bytesToHex(salt)}:${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
}

export function decryptBackup(payload: string, passphrase: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v2') {
    throw new Error('Unsupported backup cipher format');
  }
  const salt = hexToBytes(parts[1]!);
  const nonce = hexToBytes(parts[2]!);
  const ciphertext = hexToBytes(parts[3]!);
  const key = pbkdf2(sha256, utf8ToBytes(passphrase), salt, { c: PBKDF2_ITERATIONS, dkLen: 32 });
  const plaintextBytes = gcm(key, nonce).decrypt(ciphertext);
  return new TextDecoder().decode(plaintextBytes);
}
