import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  QrCode,
  KeyRound,
  ShieldCheck,
  ExternalLink,
  Lock,
  ArrowLeft,
} from 'lucide-react';

interface ShareRoomModalProps {
  roomId: string;
  keyBase64: string;
  onClose: () => void;
}

export function ShareRoomModal({ roomId, keyBase64, onClose }: ShareRoomModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Construct full shareable invite URL with key in hash fragment
  // E.g. https://.../#room=quantum-pulse-8492&key=abcdefg
  const origin = window.location.origin;
  const inviteUrl = `${origin}/#room=${encodeURIComponent(roomId)}&key=${encodeURIComponent(keyBase64)}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        inviteUrl,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('QR code generation error:', err);
        }
      );
    }
  }, [inviteUrl]);

  const copyToClipboard = async (text: string, type: 'link' | 'code' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 relative">
        
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

        {/* Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-[10px] uppercase tracking-widest font-semibold mb-3">
            <QrCode className="w-3 h-3 text-white" />
            Share Encrypted Channel
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Invite Participant</h2>
          <p className="text-xs text-white/50 mt-1 max-w-xs mx-auto leading-relaxed">
            Scan with a phone camera or copy the secure link. The decryption key is embedded in the hash fragment and never touches any server.
          </p>
        </div>

        {/* QR Code Canvas */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="p-4 bg-white rounded-2xl shadow-xl">
            <canvas ref={canvasRef} className="rounded-lg" />
          </div>
          <span className="text-[11px] text-white/40 mt-3 font-mono flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-white/60" />
            E2EE Decryption Key Embedded
          </span>
        </div>

        {/* One-Click Copy Full Invite Link */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-semibold text-white/40 block mb-1.5">
              Secure One-Click URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white/80 truncate select-all focus:outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(inviteUrl, 'link')}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-white/90 text-[#050505] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors flex-shrink-0 cursor-pointer shadow-md"
              >
                {copiedLink ? <Check className="w-4 h-4 text-[#050505]" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Separate Credentials */}
          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Room Code:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white font-semibold">{roomId}</span>
                <button
                  onClick={() => copyToClipboard(roomId, 'code')}
                  className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                  title="Copy Room ID"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
              <span className="text-white/40">Secret Key:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white/70 truncate max-w-[150px]">
                  {keyBase64.slice(0, 16)}...
                </span>
                <button
                  onClick={() => copyToClipboard(keyBase64, 'key')}
                  className="text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                  title="Copy Raw Key"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dismiss / Back to Chat */}
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
