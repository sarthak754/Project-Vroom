/**
 * vroom - Cryptography Engine (Client-Side Only)
 * Uses native Web Crypto API (SubtleCrypto)
 * Standard: AES-256-GCM with fresh 96-bit (12-byte) IV per operation
 * Zero server-side knowledge: Keys never leave the browser client.
 */

import { EncryptedPayload, SecurityFingerprint } from './types';

// Emoji dictionary for security fingerprint verification
const EMOJI_SECURITY_SET = [
  '🛡️', '🔑', '💎', '⚡', '🔒', '🚀', '🔮', '🛰️',
  '🌟', '⚓', '🌊', '🔥', '🦅', '🦁', '🐺', '🦊',
  '🌌', '🍀', '🧩', '🎯', '🪐', '💡', '🏆', '🌈',
  '⚡', '🎲', '🛸', '🧭', '🗝️', '🔔', '✨', '🌪️'
];

/**
 * Convert ArrayBuffer to Base64
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a new cryptographically secure 256-bit AES-GCM CryptoKey
 */
export async function generateAESKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable so we can share via URL hash #key=...
    ['encrypt', 'decrypt']
  );
}

/**
 * Export CryptoKey to URL-safe Base64 string
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const rawKey = await window.crypto.subtle.exportKey('raw', key);
  const base64 = bufferToBase64(rawKey);
  // URL safe replacement
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import CryptoKey from Base64 string
 */
export async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  // Convert URL safe back to standard base64
  let b64 = base64Key.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const rawBuffer = base64ToBuffer(b64);
  return await window.crypto.subtle.importKey(
    'raw',
    rawBuffer,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive an AES-256-GCM key from a custom user passphrase
 */
export async function deriveKeyFromPassphrase(passphrase: string, saltStr?: string): Promise<{ key: CryptoKey; salt: string }> {
  const enc = new TextEncoder();
  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  let saltBuffer: Uint8Array;
  if (saltStr) {
    saltBuffer = new Uint8Array(base64ToBuffer(saltStr));
  } else {
    saltBuffer = window.crypto.getRandomValues(new Uint8Array(16));
  }

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return {
    key: derivedKey,
    salt: bufferToBase64(saltBuffer),
  };
}

/**
 * Encrypt arbitrary string or JSON data using AES-256-GCM
 */
export async function encryptData(key: CryptoKey, plainData: string): Promise<EncryptedPayload> {
  const enc = new TextEncoder();
  const encoded = enc.encode(plainData);
  
  // 12 bytes IV is standard and recommended for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encoded
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt ciphertext payload using AES-256-GCM
 */
export async function decryptData(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const cipherBuffer = base64ToBuffer(payload.ciphertext);
  const ivBuffer = base64ToBuffer(payload.iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    key,
    cipherBuffer
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

/**
 * Compute Security Verification Fingerprint (SHA-256 of Key)
 * Generates visually verifiable security emojis + formatted Hex checksum
 */
export async function computeSecurityFingerprint(key: CryptoKey): Promise<SecurityFingerprint> {
  const rawKey = await window.crypto.subtle.exportKey('raw', key);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', rawKey);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // Formatted Hex (e.g. 84AF-29C3-48DE-9A10)
  const hexParts: string[] = [];
  for (let i = 0; i < 8; i += 2) {
    const chunk = (hashArray[i].toString(16).padStart(2, '0') + hashArray[i + 1].toString(16).padStart(2, '0')).toUpperCase();
    hexParts.push(chunk);
  }
  const fingerprintHex = hexParts.join(' · ');

  // 4 verifiable emojis based on 4 hash bytes
  const emojis: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = hashArray[i] % EMOJI_SECURITY_SET.length;
    emojis.push(EMOJI_SECURITY_SET[idx]);
  }

  return {
    fingerprintHex,
    fingerprintEmojis: emojis,
    algorithm: 'AES-256-GCM',
    keyLength: 256,
  };
}

/**
 * Generate a friendly human-readable Room Code (e.g. "vrm-8392-7410" or "crypto-falcon-94")
 */
export function generateRoomId(): string {
  const adjectives = ['swift', 'silent', 'quantum', 'cipher', 'shadow', 'stellar', 'neon', 'iron', 'vortex', 'ghost'];
  const nouns = ['haven', 'node', 'vault', 'pulse', 'relay', 'nexus', 'core', 'orbit', 'shield', 'echo'];
  const randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `${randAdj}-${randNoun}-${randNum}`;
}

/**
 * Generate a random anonymous alias
 */
export function generateRandomAlias(): { alias: string; color: string; icon: string } {
  const codenames = [
    'NightHawk', 'CipherOne', 'Phantom', 'GhostFox',
    'QuantumZen', 'Vortex9', 'EchoRider', 'NeonPulse',
    'ShadowStrike', 'IronShield', 'SilverWolf', 'ZeroTrace',
    'Spectre', 'AeroBlade', 'CyberHawk', 'NovaRunner'
  ];
  const colors = [
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ec4899', // pink
    '#3b82f6', // blue
    '#14b8a6', // teal
    '#f43f5e', // rose
  ];
  const icons = ['Shield', 'Zap', 'Flame', 'Sparkles', 'Compass', 'Orbit', 'Ghost', 'Lock'];

  const alias = codenames[Math.floor(Math.random() * codenames.length)] + '-' + Math.floor(10 + Math.random() * 90);
  const color = colors[Math.floor(Math.random() * colors.length)];
  const icon = icons[Math.floor(Math.random() * icons.length)];

  return { alias, color, icon };
}
