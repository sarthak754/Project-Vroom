import React, { useState, useRef } from 'react';
import {
  FileUp,
  X,
  Lock,
  UploadCloud,
  CheckCircle,
  FileText,
  Users,
  User,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Participant } from '../types';
import { AppSettings, UI_STRINGS } from '../i18n';

interface FileTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  currentParticipant: Participant | null;
  onSendFile: (
    dataUrl: string,
    meta: {
      fileName: string;
      fileSize: number;
      fileMime: string;
      recipientId?: string;
      recipientAlias?: string;
    }
  ) => Promise<boolean>;
  settings: AppSettings;
}

export function FileTransferModal({
  isOpen,
  onClose,
  participants,
  currentParticipant,
  onSendFile,
  settings,
}: FileTransferModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetRecipientId, setTargetRecipientId] = useState<string>('all'); // 'all' or participant ID
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const t = UI_STRINGS[settings.language] || UI_STRINGS.en;
  const otherParticipants = participants.filter((p) => p.id !== currentParticipant?.id);

  const handleFileSelect = (file: File) => {
    // 25MB safety threshold for zero-knowledge direct buffer transfers
    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25MB limit for direct E2EE memory buffer stream.');
      return;
    }
    setSelectedFile(file);
    setTransferSuccess(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSend = async () => {
    if (!selectedFile) return;

    setIsTransmitting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) return;

        const recipient = targetRecipientId === 'all'
          ? undefined
          : otherParticipants.find((p) => p.id === targetRecipientId);

        await onSendFile(dataUrl, {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileMime: selectedFile.type || 'application/octet-stream',
          recipientId: recipient?.id,
          recipientAlias: recipient?.alias,
        });

        setIsTransmitting(false);
        setTransferSuccess(true);
        setTimeout(() => {
          setSelectedFile(null);
          setTransferSuccess(false);
          onClose();
        }, 1200);
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      console.error('File transmission failed:', err);
      setIsTransmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 relative overflow-hidden transition-colors ${
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
              <FileUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{t.fileTransfer}</h2>
              <p className="text-[11px] opacity-60">Any File Format (APK, ZIP, PDF, Video, Docs)</p>
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

        <div className="space-y-4">
          {/* Target Recipient Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 block">
              {t.selectRecipient}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetRecipientId('all')}
                className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-medium cursor-pointer transition-all ${
                  targetRecipientId === 'all'
                    ? settings.theme === 'light'
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-white text-black border-white shadow-sm'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100'
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t.allParticipants}</span>
              </button>

              {otherParticipants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTargetRecipientId(p.id)}
                  className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-medium cursor-pointer transition-all ${
                    targetRecipientId === p.id
                      ? settings.theme === 'light'
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-black border-white shadow-sm'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.avatarColor }}
                  />
                  <span className="truncate font-semibold">{p.alias} (1-on-1)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : selectedFile
                ? 'border-white/30 bg-white/5'
                : 'border-white/10 hover:border-white/30 bg-white/5'
            }`}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className={`p-3 rounded-2xl ${
                  settings.theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'
                }`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold truncate max-w-xs">{selectedFile.name}</p>
                  <p className="text-xs opacity-60 font-mono">
                    {formatFileSize(selectedFile.size)} · AES-256 Encrypted
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs font-bold">{t.sendEncryptedFile}</p>
                <p className="text-[11px] opacity-60">
                  {t.transferAnyFile}
                </p>
              </div>
            )}
          </div>

          {/* Security Guarantee */}
          <div className="flex items-center gap-2 text-[11px] opacity-60 px-1 font-mono">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted via in-memory AES-GCM 256. Zero traces on server.</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-white/10 hover:bg-white/10 text-xs font-semibold cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!selectedFile || isTransmitting}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
                transferSuccess
                  ? 'bg-emerald-500 text-black'
                  : settings.theme === 'light'
                  ? 'bg-black text-white hover:bg-neutral-800 disabled:opacity-30'
                  : 'bg-white text-black hover:bg-white/90 disabled:opacity-30'
              }`}
            >
              {isTransmitting ? (
                <span>Encrypting & Sending...</span>
              ) : transferSuccess ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Transmitted!</span>
                </>
              ) : (
                <>
                  <span>Send Encrypted File</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
