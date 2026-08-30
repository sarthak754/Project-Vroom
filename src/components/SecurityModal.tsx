import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  X,
  Lock,
  Flame,
  CheckCircle,
  EyeOff,
  ServerOff,
  Cpu,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { computeSecurityFingerprint } from '../crypto';
import { Participant, SecurityFingerprint } from '../types';

interface SecurityModalProps {
  encryptionKey: CryptoKey | null;
  participants: Participant[];
  currentParticipant: Participant;
  onClose: () => void;
}

export function SecurityModal({
  encryptionKey,
  participants,
  currentParticipant,
  onClose,
}: SecurityModalProps) {
  const [fingerprint, setFingerprint] = useState<SecurityFingerprint | null>(null);

  useEffect(() => {
    if (encryptionKey) {
      computeSecurityFingerprint(encryptionKey).then(setFingerprint);
    }
  }, [encryptionKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 relative overflow-y-auto max-h-[92dvh]">
        
        {/* Top Header Controls: Back to Chat on Left, Close on Right */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Chat</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-[10px] uppercase tracking-widest font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            Security & E2EE Verification
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Channel Cryptography</h2>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            Compare this safety fingerprint out-of-band with peers to confirm zero eavesdropping.
          </p>
        </div>

        {/* Visual Emoji & Hex Fingerprint Box */}
        {fingerprint && (
          <div className="p-5 bg-white/5 rounded-2xl border border-white/10 mb-6 text-center relative overflow-hidden">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40 block mb-3">
              Visual Safety Number
            </span>

            {/* 4 Emojis */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 text-3xl my-3 select-all">
              {fingerprint.fingerprintEmojis.map((emoji, idx) => (
                <span
                  key={idx}
                  className="p-3 rounded-2xl bg-white/5 border border-white/10 shadow-sm"
                >
                  {emoji}
                </span>
              ))}
            </div>

            {/* Hex Checksum */}
            <div className="font-mono text-xs font-bold text-white mt-4 tracking-widest bg-white/5 py-2 px-4 rounded-xl inline-block border border-white/10 select-all">
              {fingerprint.fingerprintHex}
            </div>
            
            <p className="text-[10px] text-white/30 font-mono mt-3">
              Cipher: {fingerprint.algorithm} · {fingerprint.keyLength}-Bit Ephemeral IV
            </p>
          </div>
        )}

        {/* Connected Participants */}
        <div className="mb-6">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
            Verified Peers in Channel ({participants.length})
          </h3>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {participants.map((p) => {
              const isMe = p.id === currentParticipant.id;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.alias.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-white/90">
                      {p.alias} {isMe && <span className="text-[10px] text-white/40 font-mono">(You)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>E2EE Active</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 Pillars of vroom Zero-Trace Security */}
        <div className="grid grid-cols-2 gap-2.5 text-left mb-6">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-1.5 text-white text-xs font-bold mb-1">
              <ServerOff className="w-3.5 h-3.5 text-white/70" />
              Zero Storage
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Relayed strictly in RAM. Zero database, zero server disk logs.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-1.5 text-white text-xs font-bold mb-1">
              <Cpu className="w-3.5 h-3.5 text-white/70" />
              WebCrypto E2EE
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Native AES-GCM 256 encryption executes directly in your browser.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-1">
              <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
              Anti-Capture Shield
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Screenshots & screen recordings prohibited. Content auto-obscured on app switch.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold mb-1">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              Creator Burn Protocol
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              When Host burns the room, all connected devices disconnect immediately and all memory is expunged.
            </p>
          </div>
        </div>

        {/* Dismiss / Back to Chat button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Chat</span>
          </button>
        </div>

      </div>
    </div>
  );
}
