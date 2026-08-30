import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  Clock,
  Square,
  Trash2,
  Lock,
  User,
  X,
} from 'lucide-react';
import { RoomSettings, Participant } from '../types';
import { AppSettings, UI_STRINGS } from '../i18n';

interface MessageInputProps {
  onSendMessage: (
    content: string,
    type: 'text' | 'image' | 'file' | 'audio',
    extraMeta?: {
      fileName?: string;
      fileSize?: number;
      fileMime?: string;
      audioDuration?: number;
      recipientId?: string;
      recipientAlias?: string;
    }
  ) => Promise<boolean>;
  onSendTyping: (isTyping: boolean) => void;
  roomSettings: RoomSettings;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  appSettings: AppSettings;
  activeRecipient: Participant | null;
  onClearActiveRecipient: () => void;
  disabled?: boolean;
}

const EMOJI_LIST = ['👍', '❤️', '🔥', '🔒', '😂', '✨', '⚡', '🚀', '👋', '👀', '🎉', '🛡️', '💯', '🔑'];

export function MessageInput({
  onSendMessage,
  onSendTyping,
  roomSettings,
  onUpdateSettings,
  appSettings,
  activeRecipient,
  onClearActiveRecipient,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const t = UI_STRINGS[appSettings.language] || UI_STRINGS.en;
  const isLight = appSettings.theme === 'light';

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Handle standard typing
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawVal = e.target.value;
    setText(rawVal);

    onSendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 2000);
  };

  // Submit Text Message
  const handleSend = async () => {
    if (!text.trim() || disabled) return;
    const content = text.trim();
    setText('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSendTyping(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(content, 'text', {
      recipientId: activeRecipient?.id,
      recipientAlias: activeRecipient?.alias,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File & Document Attachment (Supports Any File Format)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25MB buffer limit for direct zero-trace transport.');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        const isImg = file.type.startsWith('image/');
        const messageType = isImg ? 'image' : 'file';

        await onSendMessage(dataUrl, messageType, {
          fileName: file.name,
          fileSize: file.size,
          fileMime: file.type || 'application/octet-stream',
          recipientId: activeRecipient?.id,
          recipientAlias: activeRecipient?.alias,
        });
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File reading failed:', err);
      setIsUploading(false);
    }
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        if (recordDuration > 0.5) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await onSendMessage(base64Audio, 'audio', {
              audioDuration: recordDuration,
              recipientId: activeRecipient?.id,
              recipientAlias: activeRecipient?.alias,
            });
          };
          reader.readAsDataURL(audioBlob);
        }

        setRecordDuration(0);
        setIsRecordingVoice(false);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Microphone permission required for voice notes.');
    }
  };

  const stopAndSendRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    setIsRecordingVoice(false);
    setRecordDuration(0);
  };

  return (
    <div className="w-full">
      {/* Hidden File Input supporting any file type */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept="*/*"
      />

      {/* Private Recipient Active Banner */}
      {activeRecipient && (
        <div className={`mb-2 px-3 py-1.5 rounded-2xl flex items-center justify-between text-xs border ${
          isLight
            ? 'bg-amber-100/90 border-amber-300 text-amber-900'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: activeRecipient.avatarColor }}
            />
            <span className="font-bold truncate">
              {t.privateRecipient} {activeRecipient.alias} (1-on-1 Encrypted Channel)
            </span>
          </div>
          <button
            type="button"
            onClick={onClearActiveRecipient}
            className="p-1 rounded-full hover:bg-black/10 transition-colors cursor-pointer flex-shrink-0"
            title="Switch back to Room Group Chat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Controls Bar: Self-Destruct Timer & Live Translator Status */}
      <div className="flex items-center justify-between mb-2.5 px-2">
        {/* Disappearing Timer Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTimerMenu(!showTimerMenu)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium border transition-all cursor-pointer ${
              roomSettings.burnTimerSec > 0
                ? isLight
                  ? 'bg-black text-white border-black font-bold'
                  : 'bg-white text-[#050505] border-white font-bold'
                : isLight
                ? 'bg-neutral-200 border-neutral-300 text-neutral-600 hover:bg-neutral-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>
              {roomSettings.burnTimerSec === 0 ? 'Disappearing: Off' : `Auto-Destruct: ${roomSettings.burnTimerSec}s`}
            </span>
          </button>

          {showTimerMenu && (
            <div className={`absolute bottom-full mb-2 left-0 p-2 rounded-2xl shadow-2xl z-30 min-w-[160px] max-w-[calc(100vw-2rem)] space-y-1 border ${
              isLight ? 'bg-white border-neutral-200 text-neutral-900' : 'bg-[#111] border-white/10 text-white'
            }`}>
              <span className="text-[10px] uppercase font-bold opacity-40 px-2 block mb-1">
                Disappearing Messages
              </span>
              {[
                { label: 'Off (Default)', sec: 0 },
                { label: '10 Seconds', sec: 10 },
                { label: '30 Seconds', sec: 30 },
                { label: '1 Minute', sec: 60 },
                { label: '5 Minutes', sec: 300 },
              ].map((item) => (
                <button
                  key={item.sec}
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ burnTimerSec: item.sec });
                    setShowTimerMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    roomSettings.burnTimerSec === item.sec
                      ? isLight ? 'bg-black text-white font-bold' : 'bg-white text-black font-bold'
                      : 'hover:bg-black/5 opacity-80 hover:opacity-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* E2EE Info Tag */}
        <div className="text-[10px] sm:text-[11px] font-mono opacity-40 flex items-center gap-1.5 ml-auto">
          <Lock className="w-3 h-3" />
          <span>AES-256-GCM Direct Tunnel</span>
        </div>
      </div>

      {/* VOICE RECORDING ACTIVE MODE */}
      {isRecordingVoice ? (
        <div className="flex items-center justify-between p-2.5 sm:p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 animate-pulse">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
            <span className="text-xs font-mono text-rose-400 font-medium truncate">
              Voice Note: {recordDuration}s
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-rose-400 transition-colors cursor-pointer"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer hover:bg-rose-600"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{t.send}</span>
            </button>
          </div>
        </div>
      ) : (
        /* STANDARD MINIMALIST INPUT BAR */
        <div className={`border rounded-2xl sm:rounded-3xl p-1.5 sm:p-3 flex items-center gap-1 sm:gap-2 transition-colors ${
          isLight
            ? 'bg-white border-neutral-300 focus-within:border-black'
            : 'bg-white/5 border-white/10 focus-within:border-white/30'
        }`}>
          {/* Attachment Button (Upload Any File) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
              isLight ? 'text-neutral-500 hover:text-black' : 'text-white/40 hover:text-white'
            }`}
            title="Attach Any File (APK, ZIP, Document, Media) Encrypted"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Emoji Picker Button */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
                isLight ? 'text-neutral-500 hover:text-black' : 'text-white/40 hover:text-white'
              }`}
              title="Insert Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmojiPicker && (
              <div className={`absolute bottom-full mb-3 left-0 p-2 sm:p-2.5 rounded-2xl shadow-2xl grid grid-cols-7 gap-1 z-30 w-60 max-w-[calc(100vw-2rem)] border ${
                isLight ? 'bg-white border-neutral-200' : 'bg-[#111] border-white/10'
              }`}>
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setText((prev) => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1.5 text-base hover:scale-125 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Area / Input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={t.typeMessage}
            className={`flex-1 bg-transparent border-none outline-none text-xs sm:text-sm resize-none max-h-32 min-h-[34px] sm:min-h-[36px] py-1.5 px-1 leading-relaxed ${
              isLight ? 'text-neutral-900 placeholder-neutral-400' : 'text-white placeholder-white/20'
            }`}
          />

          {/* Voice Memo Button */}
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
              isLight ? 'text-neutral-500 hover:text-black' : 'text-white/40 hover:text-white'
            }`}
            title="Record Encrypted Voice Note"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className={`px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 ${
              isLight
                ? 'bg-black text-white hover:bg-neutral-800'
                : 'bg-white text-[#050505] hover:bg-white/90'
            }`}
            title="Send Message"
          >
            <Send className="w-3.5 h-3.5 sm:hidden" />
            <span className="hidden sm:inline">{t.send}</span>
          </button>
        </div>
      )}
    </div>
  );
}
