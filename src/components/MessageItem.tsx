import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Play,
  Pause,
  Download,
  FileText,
  Clock,
  Check,
  CheckCheck,
  Flame,
  Smile,
  Eye,
  EyeOff,
  Maximize2,
  X,
} from 'lucide-react';
import { DecryptedMessage } from '../types';

interface MessageItemProps {
  key?: React.Key;
  message: DecryptedMessage;
  isCurtainActive: boolean;
  onAddReaction: (messageId: string, emoji: string) => void;
  onExpire?: (messageId: string) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🔒', '👀', '⚡', '🚀'];

export function MessageItem({
  message,
  isCurtainActive,
  onAddReaction,
  onExpire,
}: MessageItemProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [burnSecondsRemaining, setBurnSecondsRemaining] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Handle self-destruct burn countdown
  useEffect(() => {
    if (!message.burnExpiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remainingMs = message.burnExpiresAt! - now;
      if (remainingMs <= 0) {
        setBurnSecondsRemaining(0);
        if (onExpire) {
          onExpire(message.id);
        }
        return;
      }
      setBurnSecondsRemaining(Math.ceil(remainingMs / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 300);
    return () => clearInterval(interval);
  }, [message.burnExpiresAt, message.id, onExpire]);

  // Audio Playback
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setAudioProgress(0);
  };

  // Format timestamp (e.g. 10:45 PM)
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // System notification messages
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-3">
        <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/40 flex items-center gap-2">
          <Lock className="w-3 h-3 text-white/60" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  const isSender = message.isSender;
  const isBlurred = isCurtainActive && !isRevealed;

  return (
    <div
      className={`flex flex-col my-3 max-w-[88%] sm:max-w-[75%] md:max-w-[65%] group ${
        isSender ? 'ml-auto items-end' : 'mr-auto items-start'
      }`}
    >
      {/* Sender Alias & Time */}
      <div className="flex items-center gap-2 px-1 mb-1 text-[11px] text-white/40 font-mono">
        {!isSender && (
          <span
            className="font-bold flex items-center gap-1.5 text-white/80 font-sans"
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: message.senderColor }}
            />
            {message.senderAlias}
          </span>
        )}
        <span className="text-[10px] text-white/30">{formatTime(message.timestamp)}</span>
        {message.burnTimerSec > 0 && burnSecondsRemaining !== null && (
          <span className="flex items-center gap-0.5 text-rose-400 font-mono text-[10px] bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            <Flame className="w-2.5 h-2.5 animate-pulse" />
            {burnSecondsRemaining}s
          </span>
        )}
      </div>

      {/* Message Bubble Container */}
      <div className="relative">
        <div
          onMouseEnter={() => isCurtainActive && setIsRevealed(true)}
          onMouseLeave={() => isCurtainActive && setIsRevealed(false)}
          onClick={() => isCurtainActive && setIsRevealed(!isRevealed)}
          className={`relative rounded-2xl px-5 py-3.5 transition-all duration-200 ${
            isSender
              ? 'bg-white text-[#050505] rounded-br-none font-medium'
              : 'bg-white/5 border border-white/10 text-[#e0e0e0] rounded-bl-none'
          } ${isBlurred ? 'filter blur-[6px] select-none cursor-pointer' : ''}`}
        >
          {/* Burn Timer Progress Bar on Top */}
          {message.burnTimerSec > 0 && burnSecondsRemaining !== null && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-black/20 rounded-t-2xl overflow-hidden">
              <div
                className={`h-full ${isSender ? 'bg-[#050505]' : 'bg-rose-400'} transition-all duration-500`}
                style={{
                  width: `${Math.max(0, (burnSecondsRemaining / message.burnTimerSec) * 100)}%`,
                }}
              />
            </div>
          )}

          {/* TEXT MESSAGE */}
          {message.type === 'text' && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </div>
          )}

          {/* IMAGE MESSAGE */}
          {message.type === 'image' && (
            <div className="space-y-2">
              <div className="relative group/img overflow-hidden rounded-xl bg-black border border-white/10 max-w-sm cursor-pointer">
                <img
                  src={message.content}
                  alt={message.fileName || 'Encrypted Photo'}
                  className="max-h-72 w-full object-cover rounded-xl transition-transform duration-200 hover:scale-102"
                  onClick={() => setIsImageZoomed(true)}
                />
                <button
                  type="button"
                  onClick={() => setIsImageZoomed(true)}
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/80 text-white hover:bg-black transition-opacity"
                  title="Expand image"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {message.fileName && (
                <div className={`text-[11px] flex items-center justify-between ${isSender ? 'text-black/60' : 'text-white/40'}`}>
                  <span className="truncate max-w-[200px]">{message.fileName}</span>
                  <span>{formatSize(message.fileSize)}</span>
                </div>
              )}
            </div>
          )}

          {/* FILE / DOCUMENT MESSAGE */}
          {message.type === 'file' && (
            <div className={`flex items-center gap-3 p-2.5 rounded-xl min-w-[220px] ${
              isSender ? 'bg-black/5 border border-black/10' : 'bg-white/5 border border-white/10'
            }`}>
              <div className={`p-2 rounded-lg ${isSender ? 'bg-black text-white' : 'bg-white text-black'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${isSender ? 'text-black' : 'text-white'}`}>
                  {message.fileName || 'Encrypted Document'}
                </p>
                <p className={`text-[10px] font-mono ${isSender ? 'text-black/50' : 'text-white/40'}`}>
                  {formatSize(message.fileSize)} · E2EE Blob
                </p>
              </div>
              <a
                href={message.content}
                download={message.fileName || 'vroom-file'}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  isSender
                    ? 'bg-black text-white hover:bg-black/80'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
                title="Save Decrypted File"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* VOICE NOTE AUDIO MESSAGE */}
          {message.type === 'audio' && (
            <div className="flex items-center gap-3 min-w-[220px] sm:min-w-[260px] py-1">
              <audio
                ref={audioRef}
                src={message.content}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
              />
              <button
                type="button"
                onClick={togglePlayAudio}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-sm flex-shrink-0 cursor-pointer ${
                  isSender ? 'bg-[#050505] text-white' : 'bg-white text-[#050505]'
                }`}
              >
                {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Waveform / Progress */}
              <div className="flex-1 space-y-1">
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${
                  isSender ? 'bg-black/10' : 'bg-white/10'
                }`}>
                  <div
                    className={`h-full transition-all ${isSender ? 'bg-black' : 'bg-white'}`}
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
                <div className={`flex justify-between text-[10px] font-mono ${
                  isSender ? 'text-black/60' : 'text-white/40'
                }`}>
                  <span>Voice Memo</span>
                  <span>{message.audioDuration ? `${Math.round(message.audioDuration)}s` : 'E2EE'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Receipts for Sender */}
          {isSender && (
            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-black/50">
              <span title={message.status}>
                {message.status === 'read' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-black inline" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-black/60 inline" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-black/40 inline" />
                )}
              </span>
            </div>
          )}
        </div>

        {/* Reaction Trigger Button (Shown on hover) */}
        <div
          className={`absolute -top-3 ${
            isSender ? '-left-2' : '-right-2'
          } opacity-0 group-hover:opacity-100 transition-opacity z-10`}
        >
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 rounded-full bg-[#111] hover:bg-[#222] border border-white/10 text-white/70 text-xs shadow-md flex items-center justify-center cursor-pointer"
            title="Add Reaction"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {/* Quick Reaction Popup */}
          {showEmojiPicker && (
            <div
              className={`absolute bottom-full mb-1 ${
                isSender ? 'right-0' : 'left-0'
              } p-1.5 bg-[#111] border border-white/10 rounded-xl shadow-xl flex items-center gap-1 z-30`}
            >
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onAddReaction(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1.5 text-sm hover:scale-125 transition-transform cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rendered Reaction Badges */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 px-1">
          {Object.entries(message.reactions).map(([emoji, users]) => {
            if (!users || users.length === 0) return null;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onAddReaction(message.id, emoji)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 hover:border-white/30 text-xs text-white/80 transition-colors"
                title={`Reacted by: ${users.join(', ')}`}
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-mono text-white/40">{users.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Image Zoom Lightbox Modal */}
      {isImageZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setIsImageZoomed(false)}
        >
          <button
            onClick={() => setIsImageZoomed(false)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={message.content}
            alt="Zoomed Encrypted Photo"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
