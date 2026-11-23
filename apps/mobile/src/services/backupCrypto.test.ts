import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptBackup, encryptBackup } from './backupCrypto.ts';

test('encryptBackup and decryptBackup roundtrip with AES-256-GCM', () => {
  const secretKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const encrypted = encryptBackup(secretKey, 'strong-passphrase-2026');
  assert.ok(encrypted.startsWith('v2:'));
  assert.equal(decryptBackup(encrypted, 'strong-passphrase-2026'), secretKey);
});

test('decryptBackup rejects wrong passphrase and malformed payload', () => {
  const encrypted = encryptBackup('0x1234', 'correct-pass');
  assert.throws(() => decryptBackup(encrypted, 'wrong-pass'));
  assert.throws(() => decryptBackup('v1:bad:format', 'correct-pass'), /Unsupported backup cipher format/);
});
