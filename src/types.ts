/**
 * vroom - Shared Types & Interfaces
 * Zero-knowledge ephemeral messaging protocol types
 */

export interface Participant {
  id: string;
  alias: string;
  avatarColor: string;
  avatarIcon: string;
  joinedAt: number;
  isHost?: boolean;
}

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'system';

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded AES-GCM ciphertext
  iv: string;         // Base64 encoded 12-byte IV
  salt?: string;      // Base64 salt if derived
}

export interface DecryptedMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderAlias: string;
  senderColor: string;
  recipientId?: string; // Optional: null/undefined = Broadcast/Group, string = Private 1-on-1
  recipientAlias?: string;
  type: MessageType;
  content: string; // Plaintext text or dataUrl for media/voice
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  audioDuration?: number;
  timestamp: number;
  burnTimerSec: number; // 0 = no burn, > 0 = self-destruct seconds after render
  burnExpiresAt?: number;
  reactions?: Record<string, string[]>; // emoji -> array of participant aliases
  isSender: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface WireMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderAlias: string;
  senderColor: string;
  recipientId?: string;
  recipientAlias?: string;
  encrypted: EncryptedPayload;
  timestamp: number;
  burnTimerSec: number;
}

export interface RoomSettings {
  burnTimerSec: number; // 0 (off), 10, 30, 60, 300
  isPrivate: boolean;
  maxParticipants: number;
  allowVoiceNotes: boolean;
  allowVoiceCall: boolean;
}

export interface RoomState {
  id: string;
  createdAt: number;
  settings: RoomSettings;
  participants: Participant[];
}

export interface TypingEvent {
  roomId: string;
  senderId: string;
  senderAlias: string;
  isTyping: boolean;
}

export interface ReactionEvent {
  roomId: string;
  messageId: string;
  senderId: string;
  senderAlias: string;
  emoji: string;
}

export interface WebRTCSignal {
  roomId: string;
  senderId: string;
  targetId?: string;
  type: 'offer' | 'answer' | 'candidate' | 'call-request' | 'call-ended' | 'call-rejected';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface SecurityFingerprint {
  fingerprintHex: string;
  fingerprintEmojis: string[];
  algorithm: string;
  keyLength: number;
}
