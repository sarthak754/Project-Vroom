import React from 'react';
import {
  Flame,
  Share2,
  Users,
  ArrowLeft,
  Settings,
  Lock,
  User,
} from 'lucide-react';
import { Participant, RoomSettings } from '../types';
import { AppSettings, UI_STRINGS } from '../i18n';
import { VroomLogoMenu } from './VroomLogoMenu';

interface NavbarProps {
  roomId: string;
  isConnected: boolean;
  participants: Participant[];
  currentParticipant: Participant;
  roomSettings: RoomSettings;
  isCurtainActive: boolean;
  onToggleCurtain: () => void;
  onOpenShareModal: () => void;
  onOpenSecurityModal: () => void;
  onBurnRoom: () => void;
  onLeaveToLobby?: () => void;
  appSettings: AppSettings;
  activeRecipient: Participant | null;
  onOpenSettings: () => void;
  onSelectGroupChat: () => void;
  onOpenPrivateChat: () => void;
  onOpenFileTransfer: () => void;
}

export function Navbar({
  roomId,
  isConnected,
  participants,
  currentParticipant,
  roomSettings,
  isCurtainActive,
  onToggleCurtain,
  onOpenShareModal,
  onOpenSecurityModal,
  onBurnRoom,
  onLeaveToLobby,
  appSettings,
  activeRecipient,
  onOpenSettings,
  onSelectGroupChat,
  onOpenPrivateChat,
  onOpenFileTransfer,
}: NavbarProps) {
  const t = UI_STRINGS[appSettings.language] || UI_STRINGS.en;
  const isLight = appSettings.theme === 'light';

  return (
    <header className={`min-h-[3.5rem] sm:min-h-[4rem] lg:min-h-[4.5rem] border-b px-2.5 sm:px-6 lg:px-8 pt-[env(safe-area-inset-top,0px)] flex items-center justify-between z-20 select-none gap-1 sm:gap-4 overflow-x-hidden transition-colors ${
      isLight ? 'bg-neutral-100 border-neutral-300 text-neutral-900' : 'bg-[#050505] border-white/10 text-[#e0e0e0]'
    }`}>
      {/* Left: Interactive Vroom Logo Hub & Room Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink">
        {onLeaveToLobby && (
          <button
            type="button"
            onClick={onLeaveToLobby}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-all cursor-pointer flex-shrink-0 ${
              isLight
                ? 'bg-neutral-200 hover:bg-neutral-300 border-neutral-300 text-neutral-800'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white'
            }`}
            title="Return to Lobby"
          >
            <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden md:inline">{t.lobby}</span>
          </button>
        )}

        {/* Interactive Vroom Logo Hub */}
        <VroomLogoMenu
          appSettings={appSettings}
          activeRecipient={activeRecipient}
          onOpenSettings={onOpenSettings}
          onSelectGroupChat={onSelectGroupChat}
          onOpenPrivateChat={onOpenPrivateChat}
          onOpenFileTransfer={onOpenFileTransfer}
        />

        {/* Active Channel Indicator */}
        {activeRecipient ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full flex-shrink-0">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: activeRecipient.avatarColor }}
            />
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider truncate max-w-[100px] sm:max-w-[140px]">
              {activeRecipient.alias}
            </span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-medium font-mono">
              Group E2EE
            </span>
          </div>
        )}
      </div>

      {/* Right Controls: Action Icons & Burn Button */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Quick Settings Icon Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-all cursor-pointer flex-shrink-0 ${
            isLight
              ? 'bg-neutral-200 hover:bg-neutral-300 border-neutral-300 text-neutral-800'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
          }`}
          title="App Settings & Privacy Curtain"
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{t.settings}</span>
        </button>

        {/* Share Room Invite / QR Code */}
        <button
          type="button"
          onClick={onOpenShareModal}
          className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1 transition-all cursor-pointer flex-shrink-0 ${
            isLight
              ? 'bg-neutral-200 hover:bg-neutral-300 border-neutral-300 text-neutral-800'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
          }`}
          title="Share Room Invite & QR Code"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{t.invite}</span>
        </button>

        {/* Participants Pill & Security Fingerprint Link */}
        <button
          type="button"
          onClick={onOpenSecurityModal}
          className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors flex-shrink-0 ${
            isLight
              ? 'bg-neutral-200 hover:bg-neutral-300 border-neutral-300 text-neutral-800'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
          }`}
          title="Active Participants & Cryptographic Fingerprint"
        >
          <Users className="w-3.5 h-3.5 opacity-60" />
          <span className="font-mono text-xs">{participants.length}</span>
        </button>

        {/* EMERGENCY BURN & EXIT (Panic Button) - ALWAYS VISIBLE */}
        <button
          type="button"
          onClick={onBurnRoom}
          className="px-2 sm:px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer flex-shrink-0 shadow-xs active:scale-95"
          title="Instantly incinerate room and wipe all session memory"
        >
          <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-500/20" />
          <span className="text-xs font-bold">{t.burnRoom}</span>
        </button>
      </div>
    </header>
  );
}
