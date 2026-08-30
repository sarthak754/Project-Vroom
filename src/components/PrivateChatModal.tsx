import React, { useState } from 'react';
import {
  User,
  Users,
  MessageSquare,
  Lock,
  X,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { Participant } from '../types';
import { AppSettings, UI_STRINGS } from '../i18n';

interface PrivateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  currentParticipant: Participant | null;
  activeRecipient: Participant | null;
  onSelectRecipient: (recipient: Participant | null) => void;
  settings: AppSettings;
}

export function PrivateChatModal({
  isOpen,
  onClose,
  participants,
  currentParticipant,
  activeRecipient,
  onSelectRecipient,
  settings,
}: PrivateChatModalProps) {
  if (!isOpen) return null;

  const t = UI_STRINGS[settings.language] || UI_STRINGS.en;
  const otherParticipants = participants.filter((p) => p.id !== currentParticipant?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 relative overflow-hidden transition-colors ${
        settings.theme === 'light'
          ? 'bg-neutral-50 border-neutral-200 text-neutral-900'
          : 'bg-[#111] border-white/10 text-white'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              settings.theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'
            }`}>
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{t.privateChat}</h2>
              <p className="text-[11px] opacity-60">Direct Encrypted 1-on-1 Channel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channels List */}
        <div className="space-y-3">
          {/* Main Group Chat Option */}
          <button
            type="button"
            onClick={() => {
              onSelectRecipient(null);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
              activeRecipient === null
                ? settings.theme === 'light'
                  ? 'bg-black text-white border-black shadow-sm'
                  : 'bg-white text-black border-white shadow-sm'
                : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                activeRecipient === null
                  ? settings.theme === 'light' ? 'bg-white text-black' : 'bg-black text-white'
                  : 'bg-white/10 text-white'
              }`}>
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold">{t.groupChat} (Main Room)</p>
                <p className="text-[10px] opacity-60">Broadcast to all room members</p>
              </div>
            </div>
            {activeRecipient === null && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-current">
                Active
              </span>
            )}
          </button>

          <div className="pt-2">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-50 block mb-2 px-1">
              Select a peer for private 1-on-1 chat:
            </span>

            {otherParticipants.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <p className="text-xs opacity-60">No other peers currently in this room.</p>
                <p className="text-[11px] opacity-40 mt-1">Share the invite link to start chatting 1-on-1!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {otherParticipants.map((p) => {
                  const isSelected = activeRecipient?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectRecipient(p);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? settings.theme === 'light'
                            ? 'bg-black text-white border-black shadow-sm'
                            : 'bg-white text-black border-white shadow-sm'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                          style={{ backgroundColor: p.avatarColor }}
                        >
                          {p.alias.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{p.alias}</p>
                          <p className="text-[10px] opacity-60 font-mono">
                            {p.isHost ? 'Host · ' : ''}Encrypted 1-on-1
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 opacity-60" />
                        {isSelected && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-current">
                            Active
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
