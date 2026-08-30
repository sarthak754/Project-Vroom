import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Flame,
  ShieldAlert,
  Trash2,
  Lock,
  CheckCircle2,
  RefreshCw,
  Users,
  Smartphone,
} from 'lucide-react';

interface BurnAnimationProps {
  reason?: string;
  onReset: () => void;
}

export function BurnAnimation({ reason, onReset }: BurnAnimationProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // 1. Android Haptic Feedback Vibration Pattern
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 60, 200, 60, 300, 80, 500]);
      }
    } catch {}

    // 2. Synthesized Incineration / Thermal Purge Sound (Web Audio API)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const bufferSize = ctx.sampleRate * 1.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.4));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1.2);
        noise.connect(filter);
        filter.connect(ctx.destination);
        noise.start();
      }
    } catch {}

    // 3. Launch fiery red/orange particles
    try {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.55 },
        colors: ['#ef4444', '#f97316', '#eab308', '#dc2626', '#000000'],
      });
    } catch {}

    const t1 = setTimeout(() => setStep(1), 500);
    const t2 = setTimeout(() => setStep(2), 1200);
    const t3 = setTimeout(() => setStep(3), 2000);
    const t4 = setTimeout(() => setStep(4), 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#0a0a0a] border border-rose-500/40 rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 text-center relative">
        
        {/* Animated Fire / Disintegrate Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-2xl sm:rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 relative">
          <Flame className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce" />
          <div className="absolute inset-0 rounded-2xl sm:rounded-3xl border border-rose-500/40 animate-ping pointer-events-none" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Session Incinerated
        </h2>

        <p className="text-xs text-rose-400 font-mono mt-1 mb-4 sm:mb-6">
          {reason || 'Emergency Burn Protocol Activated by Host'}
        </p>

        {/* Destruction Steps Checklist */}
        <div className="space-y-2 text-left bg-white/5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10 mb-5 font-mono text-[11px] sm:text-xs">
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${step >= 0 ? 'text-rose-400' : 'text-white/20'}`} />
            <span>All connected users disconnected</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${step >= 1 ? 'text-rose-400' : 'text-white/20'}`} />
            <span>Socket and audio tunnels terminated</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${step >= 2 ? 'text-rose-400' : 'text-white/20'}`} />
            <span>AES-256 keys wiped from all devices RAM</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${step >= 3 ? 'text-rose-400' : 'text-white/20'}`} />
            <span>Server relay buffers purged</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${step >= 4 ? 'text-emerald-400' : 'text-white/20'}`} />
            <span className={step >= 4 ? 'text-white font-bold' : ''}>
              Zero Trace: 0 bytes retained anywhere
            </span>
          </div>
        </div>

        {/* Return to launchpad */}
        <button
          type="button"
          onClick={onReset}
          className="w-full py-3 sm:py-3.5 px-5 rounded-xl bg-white hover:bg-white/90 text-[#050505] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Create / Join New Room</span>
        </button>

      </div>
    </div>
  );
}
