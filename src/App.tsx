import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Flame,
  Clock,
  Sparkles,
  Users,
  EyeOff,
  AlertTriangle,
  QrCode,
  CheckCircle,
  User,
} from 'lucide-react';
import { Participant, RoomSettings, DecryptedMessage } from './types';
import { AppSettings, LanguageCode, UI_STRINGS } from './i18n';
import { exportKeyToBase64, importKeyFromBase64, deriveKeyFromPassphrase } from './crypto';
import { useWebSocket } from './hooks/useWebsocket';
import { CreateJoinModal } from './components/CreateJoinModal';
import { Navbar } from './components/Navbar';
import { MessageItem } from './components/MessageItem';
import { MessageInput } from './components/MessageInput';
import { ShareRoomModal } from './components/ShareRoomModal';
import { SecurityModal } from './components/SecurityModal';
import { SettingsModal } from './components/SettingsModal';
import { FileTransferModal } from './components/FileTransferModal';
import { PrivateChatModal } from './components/PrivateChatModal';
import { BurnAnimation } from './components/BurnAnimation';
import { AntiScreenshotGuard } from './components/AntiScreenshotGuard';

export default function App() {
  // Global App Customization Settings (Stored locally or defaults)
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('vroom_app_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      theme: 'dark',
      language: 'en',
      liveTranslatorEnabled: false,
    };
  });

  // Save settings on changes
  const handleUpdateAppSettings = (newSettings: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('vroom_app_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Clear all local data handler
  const handleClearAllData = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    setAppSettings({
      theme: 'dark',
      language: 'en',
      liveTranslatorEnabled: false,
    });
  };

  // Room session state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [keyBase64, setKeyBase64] = useState<string>('');
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [initialSettings, setInitialSettings] = useState<RoomSettings | undefined>(undefined);

  // Active View & Filter: Group Chat vs 1-on-1 Private Chat
  const [currentView, setCurrentView] = useState<'chat' | 'lobby'>('chat');
  const [activeRecipient, setActiveRecipient] = useState<Participant | null>(null);

  // UI Modals & Settings
  const [isCurtainActive, setIsCurtainActive] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isFileTransferModalOpen, setIsFileTransferModalOpen] = useState(false);
  const [isPrivateChatModalOpen, setIsPrivateChatModalOpen] = useState(false);
  const [isBurnConfirmOpen, setIsBurnConfirmOpen] = useState(false);
  const [isBurnAnimationActive, setIsBurnAnimationActive] = useState(false);
  const [burnReason, setBurnReason] = useState<string>('');

  // Initial link parameters detection from URL hash
  const [initialUrlRoomId, setInitialUrlRoomId] = useState('');
  const [initialUrlKeyBase64, setInitialUrlKeyBase64] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastEscPressTime = useRef<number>(0);

  // Parse URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const params = new URLSearchParams(hash);
      const rId = params.get('room');
      const kVal = params.get('key');
      if (rId) setInitialUrlRoomId(rId);
      if (kVal) setInitialUrlKeyBase64(kVal);
    }
  }, []);

  // Initialize WebSocket manager
  const {
    isConnected,
    participants,
    messages,
    roomSettings,
    typingUsers,
    sendMessage,
    deleteMessage,
    sendTyping,
    addReaction,
    updateSettings,
    burnRoom,
  } = useWebSocket({
    roomId,
    encryptionKey,
    currentParticipant,
    initialSettings,
    onRoomDestroyed: (reason) => {
      // 1. Android Haptic Feedback Vibration
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([150, 60, 200, 60, 300, 80, 500]);
        }
      } catch {}

      setBurnReason(
        reason ||
          'Emergency Burn Protocol Activated by Room Host. All messages and encryption keys deleted.'
      );
      setIsBurnAnimationActive(true);

      // 2. Clean up session and crypto keys from RAM
      setRoomId(null);
      setEncryptionKey(null);
      setKeyBase64('');
      setCurrentParticipant(null);
      setActiveRecipient(null);
      window.history.replaceState(null, '', window.location.pathname);
    },
  });

  // Auto-scroll messages list on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Global Keyboard Shortcuts (Esc x 2 for Panic Burn, Alt+C for Curtain)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && roomId) {
        const now = Date.now();
        if (now - lastEscPressTime.current < 500) {
          executeBurn();
        } else {
          lastEscPressTime.current = now;
        }
      }
      if (e.altKey && e.code === 'KeyC') {
        setIsCurtainActive((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roomId]);

  // Join or Create Room Callback from Launchpad
  const handleJoinOrCreate = (
    newRoomId: string,
    key: CryptoKey,
    keyB64: string,
    participant: Participant,
    settings?: RoomSettings
  ) => {
    setRoomId(newRoomId);
    setEncryptionKey(key);
    setKeyBase64(keyB64);
    setCurrentParticipant(participant);
    setCurrentView('chat');
    setActiveRecipient(null);
    if (settings) setInitialSettings(settings);

    // Update URL hash without reload
    window.history.replaceState(
      null,
      '',
      `#room=${encodeURIComponent(newRoomId)}&key=${encodeURIComponent(keyB64)}`
    );
  };

  // Trigger Burn Protocol
  const executeBurn = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 60, 200, 60, 300, 80, 500]);
      }
    } catch {}

    burnRoom();
    setIsBurnConfirmOpen(false);
    setBurnReason(
      currentParticipant?.isHost
        ? 'Emergency Burn Protocol Activated by Room Creator. All messages and encryption keys deleted.'
        : 'Emergency Burn Protocol Activated. All messages and encryption keys deleted.'
    );
    setIsBurnAnimationActive(true);
    setRoomId(null);
    setEncryptionKey(null);
    setKeyBase64('');
    setCurrentParticipant(null);
    setActiveRecipient(null);
    setCurrentView('chat');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleResetToLaunchpad = () => {
    setIsBurnAnimationActive(false);
    setBurnReason('');
    setCurrentView('chat');
  };

  // If not inside a room or viewing lobby, display Launchpad
  if (!roomId || !currentParticipant || !encryptionKey || currentView === 'lobby') {
    if (isBurnAnimationActive) {
      return <BurnAnimation reason={burnReason} onReset={handleResetToLaunchpad} />;
    }

    const hasActiveSession = Boolean(roomId && currentParticipant && encryptionKey);

    return (
      <CreateJoinModal
        onJoinRoom={handleJoinOrCreate}
        initialRoomId={initialUrlRoomId}
        initialKeyBase64={initialUrlKeyBase64}
        activeSession={
          hasActiveSession && roomId && currentParticipant
            ? {
                roomId,
                alias: currentParticipant.alias,
                messageCount: messages.length,
                participantsCount: participants.length,
              }
            : null
        }
        onReturnToActiveChat={hasActiveSession ? () => setCurrentView('chat') : undefined}
      />
    );
  }

  // Active typing user list
  const activeTypingAliases: string[] = Object.values(typingUsers).map(
    (u: { alias: string; expiresAt: number }) => u.alias
  );

  // Filter messages based on active channel (Group vs Private 1-on-1)
  const filteredMessages = messages.filter((msg) => {
    if (activeRecipient) {
      // In 1-on-1 private view, show only messages exchanged directly with activeRecipient
      const isDirectToRecipient =
        msg.recipientId === activeRecipient.id && msg.senderId === currentParticipant.id;
      const isDirectFromRecipient =
        msg.senderId === activeRecipient.id && msg.recipientId === currentParticipant.id;
      return isDirectToRecipient || isDirectFromRecipient;
    }
    // In main group chat, show broadcast messages (or messages where recipient is not specified)
    return !msg.recipientId;
  });

  const t = UI_STRINGS[appSettings.language] || UI_STRINGS.en;
  const isLight = appSettings.theme === 'light';

  return (
    <AntiScreenshotGuard
      isActive={true}
      userAlias={currentParticipant?.alias || 'ANON'}
      roomId={roomId || 'E2EE'}
    >
      <div
        className={`flex flex-col h-[100dvh] max-h-[100dvh] w-full font-sans relative overflow-hidden select-none transition-colors ${
          isLight ? 'bg-neutral-100 text-neutral-900' : 'bg-[#050505] text-[#e0e0e0]'
        }`}
      >
        {/* Top Navbar with Vroom Logo Hub */}
        <Navbar
          roomId={roomId}
          isConnected={isConnected}
          participants={participants}
          currentParticipant={currentParticipant}
          roomSettings={roomSettings}
          isCurtainActive={isCurtainActive}
          onToggleCurtain={() => setIsCurtainActive(!isCurtainActive)}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          onBurnRoom={() => setIsBurnConfirmOpen(true)}
          onLeaveToLobby={() => setCurrentView('lobby')}
          appSettings={appSettings}
          activeRecipient={activeRecipient}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onSelectGroupChat={() => setActiveRecipient(null)}
          onOpenPrivateChat={() => setIsPrivateChatModalOpen(true)}
          onOpenFileTransfer={() => setIsFileTransferModalOpen(true)}
        />

        {/* Main Container with Clean Minimalism Sidebar + Chat Stream */}
        <main className="flex-1 flex overflow-hidden min-h-0 w-full">
          {/* Left Sidebar: Privacy Shield & Session Guard */}
          <aside
            className={`w-72 border-r p-6 lg:p-8 hidden lg:flex flex-col justify-between select-none flex-shrink-0 transition-colors ${
              isLight ? 'bg-white border-neutral-200' : 'bg-[#050505] border-white/10'
            }`}
          >
            <div className="space-y-8">
              <section>
                <h3
                  className={`text-[10px] uppercase tracking-[0.2em] mb-4 font-semibold ${
                    isLight ? 'text-neutral-400' : 'text-white/30'
                  }`}
                >
                  Privacy Shield
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className={`text-xs mb-0.5 ${isLight ? 'text-neutral-500' : 'text-white/60'}`}>
                      Tunnel Routing
                    </span>
                    <span className={`text-sm font-medium ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                      Active • E2EE Tunnel
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs mb-0.5 ${isLight ? 'text-neutral-500' : 'text-white/60'}`}>
                      Channel Mode
                    </span>
                    <span className="text-sm text-emerald-500 font-bold">
                      {activeRecipient ? `Private (${activeRecipient.alias})` : t.groupChat}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs mb-0.5 ${isLight ? 'text-neutral-500' : 'text-white/60'}`}>
                      Data Persistence
                    </span>
                    <span className="text-sm text-rose-500 font-medium">Zero (Volatile RAM)</span>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs mb-0.5 ${isLight ? 'text-neutral-500' : 'text-white/60'}`}>
                      Voice Call & Translator
                    </span>
                    <span className="text-xs font-mono text-amber-400">
                      Coming Soon (v2.6)
                    </span>
                  </div>
                </div>
              </section>

              {/* Active Verified Peers */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${
                      isLight ? 'text-neutral-400' : 'text-white/30'
                    }`}
                  >
                    Verified Peers
                  </h3>
                  <span className="text-xs font-mono opacity-50">{participants.length}</span>
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {participants.map((p) => {
                    const isDirect = activeRecipient?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (p.id !== currentParticipant.id) {
                            setActiveRecipient(isDirect ? null : p);
                          }
                        }}
                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isDirect
                            ? isLight
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-black border-white'
                            : isLight
                            ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-200 text-neutral-800'
                            : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/80'
                        }`}
                        title={
                          p.id !== currentParticipant.id
                            ? isDirect
                              ? 'Switch back to Group Chat'
                              : `Start 1-on-1 Private Chat with ${p.alias}`
                            : 'You'
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs flex-shrink-0"
                            style={{ backgroundColor: p.avatarColor }}
                          >
                            {p.alias.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium truncate max-w-[120px]">{p.alias}</span>
                        </div>
                        {p.id === currentParticipant.id ? (
                          <span className="text-[10px] opacity-50 font-mono">You</span>
                        ) : isDirect ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500 text-black">
                            1-on-1
                          </span>
                        ) : (
                          <Lock className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Auto-Destruct / Ephemeral Timer Card */}
            <section>
              <div
                className={`p-4 rounded-2xl border ${
                  isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2 font-medium">
                  Auto-Destruct
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-light font-mono leading-none">
                    {roomSettings.burnTimerSec > 0 ? `${roomSettings.burnTimerSec}s` : 'Off'}
                  </span>
                  <span className="text-xs opacity-50 mb-0.5">
                    {roomSettings.burnTimerSec > 0 ? 'per message' : 'manual burn'}
                  </span>
                </div>
              </div>
            </section>
          </aside>

          {/* Center Chat Viewport */}
          <section
            className={`flex-1 flex flex-col relative overflow-hidden select-text min-h-0 w-full transition-colors ${
              isLight ? 'bg-neutral-50' : 'bg-[#050505]'
            }`}
          >
            {/* Privacy Curtain Active Status Notification Bar */}
            {isCurtainActive && (
              <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-400 font-medium">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
                  <span>Privacy Curtain is Active • Tap or hover on any message to reveal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCurtainActive(false)}
                  className="text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer ml-2"
                >
                  Turn Off
                </button>
              </div>
            )}

            {/* Main Chat Stream Container */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 relative min-h-0">
              {/* Minimalist Zero-Knowledge Privacy Guarantee Banner */}
              <div
                className={`max-w-md mx-auto my-1 p-3.5 sm:p-5 rounded-2xl border text-center backdrop-blur-sm ${
                  isLight
                    ? 'bg-white border-neutral-200 shadow-xs'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mx-auto mb-2 font-bold ${
                    isLight ? 'bg-black text-white' : 'bg-white text-[#050505]'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest">
                  {activeRecipient
                    ? `${t.privateMode}: ${activeRecipient.alias}`
                    : 'Ephemeral Encrypted Session'}
                </h3>
                <p className="text-[11px] sm:text-xs opacity-60 mt-1 leading-relaxed">
                  {activeRecipient
                    ? `Encrypted 1-on-1 channel directly with ${activeRecipient.alias}. Only you two can view these messages.`
                    : 'Messages and files are encrypted end-to-end via WebCrypto AES-256-GCM. Zero records are stored.'}
                </p>
                <div className="flex items-center justify-center gap-3 mt-2.5">
                  <button
                    type="button"
                    onClick={() => setIsSecurityModalOpen(true)}
                    className="text-[11px] sm:text-xs font-medium underline underline-offset-4 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    Verify Cryptographic Fingerprint →
                  </button>
                </div>
              </div>

              {/* Render Filtered Messages */}
              {filteredMessages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  isCurtainActive={isCurtainActive}
                  onAddReaction={addReaction}
                  onExpire={deleteMessage}
                />
              ))}

              {/* Active Typing Indicator */}
              {activeTypingAliases.length > 0 && (
                <div className="flex items-center gap-2 text-xs opacity-60 font-mono my-2 px-2 animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                  <span>
                    {activeTypingAliases.join(', ')} {activeTypingAliases.length === 1 ? 'is' : 'are'} {t.typing}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Minimalist Message Input Bar with Safe Area Bottom */}
            <div className="p-2.5 sm:p-4 lg:p-6 pt-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex-shrink-0 w-full">
              <MessageInput
                onSendMessage={sendMessage}
                onSendTyping={sendTyping}
                roomSettings={roomSettings}
                onUpdateSettings={updateSettings}
                appSettings={appSettings}
                activeRecipient={activeRecipient}
                onClearActiveRecipient={() => setActiveRecipient(null)}
                disabled={!isConnected}
              />
            </div>
          </section>
        </main>

        {/* 1. App Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={appSettings}
          onUpdateSettings={handleUpdateAppSettings}
          onClearAllData={handleClearAllData}
          isCurtainActive={isCurtainActive}
          onToggleCurtain={() => setIsCurtainActive(!isCurtainActive)}
        />

        {/* 2. File Transfer Modal (Any file format) */}
        <FileTransferModal
          isOpen={isFileTransferModalOpen}
          onClose={() => setIsFileTransferModalOpen(false)}
          participants={participants}
          currentParticipant={currentParticipant}
          onSendFile={async (dataUrl, meta) => {
            return await sendMessage(dataUrl, meta.fileMime.startsWith('image/') ? 'image' : 'file', meta);
          }}
          settings={appSettings}
        />

        {/* 3. Private Chat Modal */}
        <PrivateChatModal
          isOpen={isPrivateChatModalOpen}
          onClose={() => setIsPrivateChatModalOpen(false)}
          participants={participants}
          currentParticipant={currentParticipant}
          activeRecipient={activeRecipient}
          onSelectRecipient={(recipient) => setActiveRecipient(recipient)}
          settings={appSettings}
        />

        {/* 4. Share / Invite QR Modal */}
        {isShareModalOpen && (
          <ShareRoomModal
            roomId={roomId}
            keyBase64={keyBase64}
            onClose={() => setIsShareModalOpen(false)}
          />
        )}

        {/* 5. Security & Cryptographic Fingerprint Verification Modal */}
        {isSecurityModalOpen && (
          <SecurityModal
            encryptionKey={encryptionKey}
            participants={participants}
            currentParticipant={currentParticipant}
            onClose={() => setIsSecurityModalOpen(false)}
          />
        )}

        {/* 6. Burn Room Confirmation Dialog */}
        {isBurnConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-[#0a0a0a] border border-rose-500/30 rounded-2xl shadow-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Emergency Burn Session?</h3>
              <p className="text-xs text-white/50 mt-2 mb-6 leading-relaxed">
                This will permanently destroy cryptographic keys and wipe all active session memory for all participants immediately.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsBurnConfirmOpen(false)}
                  className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Back to Chat
                </button>
                <button
                  type="button"
                  onClick={executeBurn}
                  className="py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg cursor-pointer"
                >
                  Incinerate Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Burn Animation Overlay */}
        {isBurnAnimationActive && (
          <BurnAnimation reason={burnReason} onReset={handleResetToLaunchpad} />
        )}
      </div>
    </AntiScreenshotGuard>
  );
}
