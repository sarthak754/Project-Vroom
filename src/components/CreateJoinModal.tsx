import React, { useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  Lock,
  Flame,
  KeyRound,
  QrCode,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Shuffle,
  EyeOff,
  CheckCircle2,
  Clock,
  Radio,
  Copy,
  Check,
  MessageSquare,
} from 'lucide-react';
import {
  generateAESKey,
  exportKeyToBase64,
  generateRoomId,
  generateRandomAlias,
  deriveKeyFromPassphrase,
  importKeyFromBase64,
} from '../crypto';
import { Participant, RoomSettings } from '../types';

interface CreateJoinModalProps {
  onJoinRoom: (
    roomId: string,
    key: CryptoKey,
    keyBase64: string,
    participant: Participant,
    settings?: RoomSettings
  ) => void;
  initialRoomId?: string;
  initialKeyBase64?: string;
  activeSession?: {
    roomId: string;
    alias: string;
    messageCount: number;
    participantsCount: number;
  } | null;
  onReturnToActiveChat?: () => void;
}

export function CreateJoinModal({
  onJoinRoom,
  initialRoomId = '',
  initialKeyBase64 = '',
  activeSession,
  onReturnToActiveChat,
}: CreateJoinModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Participant identity
  const [alias, setAlias] = useState('');
  const [avatarColor, setAvatarColor] = useState('#06b6d4');
  const [avatarIcon, setAvatarIcon] = useState('Shield');

  // Create room state
  const [newRoomId, setNewRoomId] = useState('');
  const [burnTimer, setBurnTimer] = useState<number>(0); // 0 = off, 10, 30, 60, 300
  const [customPassphrase, setCustomPassphrase] = useState('');
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Join room state
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId);
  const [joinKeyInput, setJoinKeyInput] = useState(initialKeyBase64);
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Initialize random codename and room id
  useEffect(() => {
    const randomized = generateRandomAlias();
    setAlias(randomized.alias);
    setAvatarColor(randomized.color);
    setAvatarIcon(randomized.icon);
    setNewRoomId(generateRoomId());

    if (initialRoomId || initialKeyBase64) {
      setActiveTab('join');
      if (initialRoomId) setJoinRoomId(initialRoomId);
      if (initialKeyBase64) setJoinKeyInput(initialKeyBase64);
    }
  }, [initialRoomId, initialKeyBase64]);

  const handleRandomizeIdentity = () => {
    const randomized = generateRandomAlias();
    setAlias(randomized.alias);
    setAvatarColor(randomized.color);
    setAvatarIcon(randomized.icon);
  };

  const handleRandomizeRoomId = () => {
    setNewRoomId(generateRoomId());
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomId.trim() || !alias.trim()) return;

    setIsCreating(true);
    try {
      let key: CryptoKey;
      let keyBase64: string;

      if (usePassphrase && customPassphrase.trim()) {
        const derived = await deriveKeyFromPassphrase(customPassphrase.trim());
        key = derived.key;
        keyBase64 = await exportKeyToBase64(key);
      } else {
        key = await generateAESKey();
        keyBase64 = await exportKeyToBase64(key);
      }

      const participant: Participant = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        alias: alias.trim(),
        avatarColor,
        avatarIcon,
        joinedAt: Date.now(),
        isHost: true,
      };

      const settings: RoomSettings = {
        burnTimerSec: burnTimer,
        isPrivate: true,
        maxParticipants: 12,
        allowVoiceNotes: true,
        allowVoiceCall: true,
      };

      onJoinRoom(newRoomId.trim().toLowerCase(), key, keyBase64, participant, settings);
    } catch (err) {
      console.error('Failed to create room:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinRoomId.trim()) {
      setJoinError('Please enter a Room ID or invite code');
      return;
    }
    if (!joinKeyInput.trim()) {
      setJoinError('Please provide the encryption key or passphrase for this room');
      return;
    }

    setIsJoining(true);
    try {
      let key: CryptoKey;
      const rawInput = joinKeyInput.trim();

      // Check if input is a raw base64 AES key or a user passphrase
      if (rawInput.length >= 32 && /^[A-Za-z0-9_-]+={0,2}$/.test(rawInput)) {
        try {
          key = await importKeyFromBase64(rawInput);
        } catch {
          // If base64 import fails, fallback to passphrase derivation
          const derived = await deriveKeyFromPassphrase(rawInput);
          key = derived.key;
        }
      } else {
        const derived = await deriveKeyFromPassphrase(rawInput);
        key = derived.key;
      }

      const keyBase64 = await exportKeyToBase64(key);

      const participant: Participant = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        alias: alias.trim() || 'Anonymous',
        avatarColor,
        avatarIcon,
        joinedAt: Date.now(),
        isHost: false,
      };

      onJoinRoom(joinRoomId.trim().toLowerCase(), key, keyBase64, participant);
    } catch (err) {
      console.error('Failed to join room:', err);
      setJoinError('Invalid key or unable to derive cryptographic key.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-[100dvh] max-h-[100dvh] w-full bg-[#050505] text-[#e0e0e0] flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 relative overflow-y-auto select-none pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      
      {/* Main Container Card */}
      <div className="w-full max-w-xl bg-[#0a0a0a] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 lg:p-10 relative z-10 my-auto">
        
        {/* App Logo & Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center shadow-md">
              <div className="w-4 h-4 sm:w-5 sm:h-5 bg-[#050505] rotate-45"></div>
            </div>
            <span className="text-2xl sm:text-3xl font-bold tracking-tighter text-white">vroom</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-medium">
              Zero-Trace E2EE Messaging
            </span>
          </div>

          <p className="text-white/50 text-xs sm:text-sm mt-1 max-w-md mx-auto leading-relaxed">
            Disposable, end-to-end encrypted rooms. No phone numbers, zero database logs, and instant client-side self-destruction.
          </p>
        </div>

        {/* Active Encrypted Session Quick-Return Card */}
        {activeSession && onReturnToActiveChat && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Active Session Open
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-[11px] text-emerald-300/80 font-mono truncate mt-0.5">
                  Room: <span className="text-white font-semibold">{activeSession.roomId}</span> ({activeSession.participantsCount} peer{activeSession.participantsCount === 1 ? '' : 's'})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onReturnToActiveChat}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-white/90 text-[#050505] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Chat</span>
            </button>
          </div>
        )}

        {/* Identity Selector (Anonymous Alias) */}
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              Anonymous Identity
            </label>
            <button
              type="button"
              onClick={handleRandomizeIdentity}
              className="text-xs text-white/60 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              title="Generate new random codename"
            >
              <Shuffle className="w-3 h-3" />
              Reroll
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {alias.slice(0, 2).toUpperCase()}
            </div>

            <div className="flex-1">
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Enter anonymous alias"
                maxLength={24}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/40 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2.5 text-xs font-semibold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-[#050505] shadow-sm font-bold'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Create Secure Room
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`py-2.5 text-xs font-semibold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'join'
                ? 'bg-white text-[#050505] shadow-sm font-bold'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Join Room
          </button>
        </div>

        {/* CREATE TAB */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateRoom} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                  Room Identifier
                </label>
                <button
                  type="button"
                  onClick={handleRandomizeRoomId}
                  className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Shuffle className="w-3 h-3" />
                  Regenerate
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  placeholder="e.g. quantum-pulse-8492"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-white/40"
                />
              </div>
            </div>

            {/* Disappearing Messages Setting */}
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5" />
                Disappearing Messages (Self-Destruct)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Off', sec: 0 },
                  { label: '10s', sec: 10 },
                  { label: '30s', sec: 30 },
                  { label: '1m', sec: 60 },
                  { label: '5m', sec: 300 },
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => setBurnTimer(item.sec)}
                    className={`py-2 px-1 text-xs rounded-xl border transition-all text-center cursor-pointer ${
                      burnTimer === item.sec
                        ? 'bg-white text-[#050505] border-white font-bold'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Passphrase Toggle */}
            <div className="pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/50 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePassphrase}
                    onChange={(e) => setUsePassphrase(e.target.checked)}
                    className="rounded bg-white/10 border-white/20 text-white focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  Use custom secret passphrase instead of random key
                </label>
              </div>

              {usePassphrase && (
                <div className="mt-2">
                  <input
                    type="password"
                    value={customPassphrase}
                    onChange={(e) => setCustomPassphrase(e.target.value)}
                    placeholder="Enter strong shared secret passphrase"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/40"
                  />
                  <p className="text-[11px] text-white/40 mt-1">
                    All participants must enter this passphrase to decrypt messages.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isCreating || !newRoomId.trim() || !alias.trim()}
              className="w-full mt-6 py-3.5 px-6 rounded-xl bg-white hover:bg-white/90 text-[#050505] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
            >
              {isCreating ? (
                <>Generating AES-256 Key...</>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Launch Encrypted Room
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        )}

        {/* JOIN TAB */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoinRoom} className="space-y-5">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
                Room ID or Invite Code
              </label>
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="e.g. quantum-pulse-8492"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-white/40"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">
                Encryption Key or Passphrase
              </label>
              <input
                type="password"
                value={joinKeyInput}
                onChange={(e) => setJoinKeyInput(e.target.value)}
                placeholder="Paste AES key or custom passphrase"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/40 font-mono"
              />
              <p className="text-[11px] text-white/40 mt-1">
                If you opened an invite link with #key, this is auto-filled.
              </p>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining || !joinRoomId.trim() || !joinKeyInput.trim() || !alias.trim()}
              className="w-full mt-6 py-3.5 px-6 rounded-xl bg-white hover:bg-white/90 text-[#050505] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
            >
              {isJoining ? (
                <>Verifying & Decrypting...</>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Connect & Decrypt Room
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Privacy Guarantees Footer */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="text-white font-bold text-xs">0% Storage</div>
            <div className="text-[10px] text-white/40 mt-0.5">Zero disk / DB writes</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="text-white font-bold text-xs">AES-256-GCM</div>
            <div className="text-[10px] text-white/40 mt-0.5">End-to-End Encrypted</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="text-rose-400 font-bold text-xs">Instant Burn</div>
            <div className="text-[10px] text-white/40 mt-0.5">Wiped on departure</div>
          </div>
        </div>

      </div>
    </div>
  );
}
