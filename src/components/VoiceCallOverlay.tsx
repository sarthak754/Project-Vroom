import React from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  Volume2,
  Lock,
} from 'lucide-react';

interface VoiceCallOverlayProps {
  isInCall: boolean;
  isCalling: boolean;
  incomingCallFrom: { senderId: string; senderAlias: string } | null;
  isMuted: boolean;
  audioLevel: number;
  callDuration: number;
  onAcceptCall: () => void;
  onRejectCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
}

export function VoiceCallOverlay({
  isInCall,
  isCalling,
  incomingCallFrom,
  isMuted,
  audioLevel,
  callDuration,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onToggleMute,
}: VoiceCallOverlayProps) {
  // Format call duration (e.g. 02:45)
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // INCOMING CALL PROMPT
  if (incomingCallFrom) {
    return (
      <div className="fixed top-16 sm:top-20 right-3 sm:right-4 left-3 sm:left-auto z-40 bg-[#0a0a0a] border border-white/20 shadow-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 max-w-sm ml-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
            <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">
              Incoming Encrypted Call
            </h4>
            <p className="text-xs text-white/60 truncate mt-0.5">
              {incomingCallFrom.senderAlias} is calling...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3.5">
          <button
            type="button"
            onClick={onRejectCall}
            className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-rose-400 text-xs font-semibold uppercase tracking-wider cursor-pointer"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAcceptCall}
            className="py-2 px-3 rounded-xl bg-white hover:bg-white/90 text-[#050505] text-xs font-bold uppercase tracking-wider shadow-md cursor-pointer"
          >
            Answer
          </button>
        </div>
      </div>
    );
  }

  // OUTGOING CALLING INDICATOR
  if (isCalling) {
    return (
      <div className="bg-white/5 border-b border-white/10 px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between z-10 text-xs">
        <div className="flex items-center gap-2 text-white/80 min-w-0">
          <span className="w-2 h-2 rounded-full bg-white animate-ping flex-shrink-0" />
          <span className="truncate">Connecting encrypted audio tunnel...</span>
        </div>
        <button
          onClick={onEndCall}
          className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer flex-shrink-0 ml-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ACTIVE IN-CALL BAR
  if (isInCall) {
    return (
      <div className="bg-[#0a0a0a] border-b border-white/10 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between z-10 shadow-lg gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-wider truncate">
              Encrypted Call
            </span>
          </div>

          <span className="text-[10px] sm:text-xs font-mono text-white/70 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 flex-shrink-0">
            {formatDuration(callDuration)}
          </span>

          {/* Equalizer Visualizer Bars */}
          <div className="hidden xs:flex items-center gap-0.5 h-3.5 flex-shrink-0">
            {[40, 70, 30, 90, 60, 80].map((h, i) => (
              <span
                key={i}
                className="w-0.5 sm:w-1 bg-white rounded-full transition-all duration-75"
                style={{
                  height: isMuted ? '2px' : `${Math.max(2, (audioLevel / 100) * (h / 100) * 14)}px`,
                  opacity: isMuted ? 0.2 : 0.9,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {/* Mute Button */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold'
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Mute'}</span>
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={onEndCall}
            className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-md cursor-pointer"
            title="End Audio Call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">End Call</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
