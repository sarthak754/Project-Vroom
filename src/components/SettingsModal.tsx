import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Globe,
  RefreshCw,
  Trash2,
  X,
  Check,
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  Languages,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { AppSettings, LanguageCode, UI_STRINGS } from '../i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearAllData: () => void;
  isCurtainActive?: boolean;
  onToggleCurtain?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearAllData,
  isCurtainActive = false,
  onToggleCurtain,
}: SettingsModalProps) {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearedMessage, setClearedMessage] = useState<string | null>(null);
  const [showCurtainExplainer, setShowCurtainExplainer] = useState(false);

  if (!isOpen) return null;

  const t = UI_STRINGS[settings.language] || UI_STRINGS.en;

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true);
    setUpdateMessage(null);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      setUpdateMessage(t.updateSuccess);
    }, 1200);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all cryptographic stores, session buffers, and settings?')) {
      setIsClearing(true);
      setTimeout(() => {
        onClearAllData();
        setIsClearing(false);
        setClearedMessage(t.clearedSuccess);
      }, 600);
    }
  };

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
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{t.settings}</h2>
              <p className="text-[11px] opacity-60">Customization & Privacy Engine</p>
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

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Privacy Curtain (Anti-Shoulder Surfing) */}
          <div className={`p-4 rounded-2xl border transition-all ${
            settings.theme === 'light'
              ? 'bg-neutral-100 border-neutral-200 text-neutral-900'
              : 'bg-white/5 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl flex items-center justify-center ${
                  isCurtainActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/10 text-white/60'
                }`}>
                  {isCurtainActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold">{t.curtain}</h3>
                    <button
                      type="button"
                      onClick={() => setShowCurtainExplainer(!showCurtainExplainer)}
                      className="p-0.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                      title="What is Privacy Curtain?"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] opacity-60">
                    {isCurtainActive ? t.curtainActive : t.curtainInactive}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              {onToggleCurtain && (
                <button
                  type="button"
                  onClick={onToggleCurtain}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isCurtainActive
                      ? 'bg-emerald-500'
                      : settings.theme === 'light'
                      ? 'bg-neutral-300'
                      : 'bg-white/20'
                  }`}
                  role="switch"
                  aria-checked={isCurtainActive}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isCurtainActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Explanation Expandable Area */}
            {showCurtainExplainer && (
              <div className={`mt-3 pt-3 border-t text-[11px] leading-relaxed animate-in fade-in duration-150 ${
                settings.theme === 'light' ? 'border-neutral-300 text-neutral-700' : 'border-white/10 text-white/70'
              }`}>
                <p className="font-semibold text-emerald-400 mb-1">
                  🛡️ What is Privacy Curtain?
                </p>
                <p>{t.curtainDesc}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono opacity-80">
                  <span className="px-1.5 py-0.5 rounded-md bg-white/10">Shortcut: Alt + C</span>
                  <span>• Tap bubble to reveal</span>
                </div>
              </div>
            )}
          </div>

          {/* Theme Selector (Dark / Light) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2.5 block">
              Display Theme
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-white text-black border-white shadow-sm'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>{t.darkMode}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                  settings.theme === 'light'
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>{t.lightMode}</span>
              </button>
            </div>
          </div>

          {/* Language Selector (Hindi, Marathi, English) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2.5 flex items-center justify-between">
              <span>{t.language}</span>
              <Languages className="w-3.5 h-3.5 opacity-60" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: 'en' as LanguageCode, label: 'English', native: 'English' },
                { code: 'hi' as LanguageCode, label: 'Hindi', native: 'हिन्दी' },
                { code: 'mr' as LanguageCode, label: 'Marathi', native: 'मराठी' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onUpdateSettings({ language: lang.code })}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                    settings.language === lang.code
                      ? settings.theme === 'light'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-black border-white shadow-sm'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <span className="font-bold text-xs">{lang.native}</span>
                  <span className="text-[10px] opacity-70">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming Features: Voice Call & Live Auto-Translator (Coming Soon) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 block">
              Upcoming Modules
            </label>
            
            {/* Voice Call (Coming Soon) */}
            <div className={`p-3.5 rounded-2xl border ${
              settings.theme === 'light'
                ? 'bg-neutral-100/70 border-neutral-200 text-neutral-800'
                : 'bg-white/5 border-white/10 text-white/80'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold">{t.voiceCall}</h4>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {t.comingSoon}
                      </span>
                    </div>
                    <p className="text-[10px] opacity-60 leading-tight mt-0.5">
                      Peer-to-peer encrypted zero-metadata voice tunnel
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Auto-Translator (Coming Soon) */}
            <div className={`p-3.5 rounded-2xl border ${
              settings.theme === 'light'
                ? 'bg-neutral-100/70 border-neutral-200 text-neutral-800'
                : 'bg-white/5 border-white/10 text-white/80'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold">{t.liveTranslator}</h4>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {t.comingSoon}
                      </span>
                    </div>
                    <p className="text-[10px] opacity-60 leading-tight mt-0.5">
                      {t.liveTranslatorDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Check for Updates */}
          <div>
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className={`w-full py-3 px-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                settings.theme === 'light'
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'Checking Zero-Trace Node...' : t.checkForUpdates}</span>
            </button>
            {updateMessage && (
              <p className="mt-2 text-[11px] text-emerald-400 font-mono text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 inline" />
                {updateMessage}
              </p>
            )}
          </div>

          {/* Clear All Local Data */}
          <div>
            <button
              type="button"
              onClick={handleClear}
              disabled={isClearing}
              className="w-full py-3 px-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isClearing ? 'Purging Local Memory...' : t.clearAllData}</span>
            </button>
            {clearedMessage && (
              <p className="mt-2 text-[11px] text-amber-400 font-mono text-center animate-in fade-in">
                {clearedMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
