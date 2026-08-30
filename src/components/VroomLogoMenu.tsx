import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Users,
  User,
  FileUp,
  ChevronDown,
  Phone,
  Sparkles,
} from 'lucide-react';
import { AppSettings, UI_STRINGS } from '../i18n';
import { Participant } from '../types';

interface VroomLogoMenuProps {
  appSettings: AppSettings;
  activeRecipient: Participant | null;
  onOpenSettings: () => void;
  onSelectGroupChat: () => void;
  onOpenPrivateChat: () => void;
  onOpenFileTransfer: () => void;
}

export function VroomLogoMenu({
  appSettings,
  activeRecipient,
  onOpenSettings,
  onSelectGroupChat,
  onOpenPrivateChat,
  onOpenFileTransfer,
}: VroomLogoMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCallNotice, setShowCallNotice] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const t = UI_STRINGS[appSettings.language] || UI_STRINGS.en;

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleVoiceCallClick = () => {
    setShowCallNotice(true);
    setTimeout(() => setShowCallNotice(false), 2500);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Clickable Vroom Logo Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-2xl transition-all cursor-pointer border ${
          isOpen
            ? appSettings.theme === 'light'
              ? 'bg-neutral-200 border-neutral-300'
              : 'bg-white/15 border-white/20'
            : 'bg-transparent border-transparent hover:bg-white/5'
        }`}
        title="vroom Control Hub (Settings, Group Chat, Private Chat, File Transfer)"
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white rounded-full flex items-center justify-center shadow-xs flex-shrink-0">
          <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-[#050505] rotate-45" />
        </div>
        <span className="text-base sm:text-xl font-bold tracking-tighter text-white truncate">
          vroom
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-white/50 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Hub Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-2 w-64 rounded-3xl border shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl ${
            appSettings.theme === 'light'
              ? 'bg-neutral-50/95 border-neutral-200 text-neutral-900 shadow-neutral-500/10'
              : 'bg-[#111]/95 border-white/15 text-white shadow-black/80'
          }`}
        >
          {/* Menu Title */}
          <div className="px-3 py-2 border-b border-white/10 mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">
              vroom Hub
            </span>
            <span className="text-[9px] font-mono opacity-50">v2.5 E2EE</span>
          </div>

          <div className="space-y-1">
            {/* 1. Group Chat */}
            <button
              type="button"
              onClick={() => {
                onSelectGroupChat();
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-all ${
                activeRecipient === null
                  ? appSettings.theme === 'light'
                    ? 'bg-black text-white font-bold'
                    : 'bg-white text-black font-bold'
                  : 'hover:bg-white/10 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>{t.groupChat}</span>
              </div>
              {activeRecipient === null && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* 2. Private Chat (1-on-1) */}
            <button
              type="button"
              onClick={() => {
                onOpenPrivateChat();
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer transition-all ${
                activeRecipient !== null
                  ? appSettings.theme === 'light'
                    ? 'bg-black text-white font-bold'
                    : 'bg-white text-black font-bold'
                  : 'hover:bg-white/10 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  {activeRecipient ? `${t.privateRecipient} ${activeRecipient.alias}` : t.privateChat}
                </span>
              </div>
              {activeRecipient !== null && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              )}
            </button>

            {/* 3. Secure File Transfer */}
            <button
              type="button"
              onClick={() => {
                onOpenFileTransfer();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-semibold hover:bg-white/10 opacity-80 hover:opacity-100 cursor-pointer transition-all"
            >
              <FileUp className="w-4 h-4 text-emerald-400" />
              <span>{t.fileTransfer}</span>
            </button>

            {/* 4. Voice Call (Coming Soon) */}
            <button
              type="button"
              onClick={handleVoiceCallClick}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold hover:bg-white/10 opacity-70 hover:opacity-100 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-blue-400" />
                <span>{t.voiceCall}</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {t.comingSoon}
              </span>
            </button>

            {/* 5. Settings */}
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-semibold hover:bg-white/10 opacity-80 hover:opacity-100 cursor-pointer transition-all border-t border-white/5 mt-1 pt-2.5"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>{t.settings}</span>
            </button>
          </div>

          {/* Feedback notice when clicking Voice Call */}
          {showCallNotice && (
            <div className="mt-2 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 text-center animate-in fade-in">
              Voice Call is coming soon in the next zero-trace protocol upgrade.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
