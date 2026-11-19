import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Camera,
  Cloud,
  Loader2,
  LogIn,
  ShieldCheck,
  Sprout,
  Square,
  Volume2,
} from 'lucide-react';
import type { LanguageMode } from '../types.ts';
import { LANGUAGE_OPTIONS } from '../constants/sectors.ts';
import { AgronLogo5D } from './AgronLogo5D.tsx';
import { FarmerAssistant4D } from './FarmerAssistant4D.tsx';
import { speakMaleBrowserFallback } from '../utils/speakFallback.ts';

interface LoginPageProps {
  language: LanguageMode;
  onChangeLanguage: (lang: LanguageMode) => void;
  onGoogleLogin: () => Promise<void>;
  onContinueGuest: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  language,
  onChangeLanguage,
  onGoogleLogin,
  onContinueGuest,
}) => {
  const isEn = language === 'en';
  const prefersReduced = useReducedMotion();
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [playingGuide, setPlayingGuide] = useState(false);
  const guideAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (guideAudioRef.current) {
        guideAudioRef.current.pause();
        guideAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleVoiceGuide = async () => {
    if (playingGuide) {
      if (guideAudioRef.current) {
        guideAudioRef.current.pause();
        guideAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingGuide(false);
      return;
    }

    const guideText = isEn
      ? 'Welcome to Agron Farmer Friend. Even if you cannot read or type, you can easily use this app by speaking or taking a crop photo. Tap the light green Quick Enter button to start immediately.'
      : 'ನಮಸ್ಕಾರ ರೈತ ಬಂಧುಗಳೇ, ರೈತ ಮಿತ್ರ ಆ್ಯಪ್‌ಗೆ ಸ್ವಾಗತ. ನಿಮಗೆ ಓದಲು ಅಥವಾ ಟೈಪ್ ಮಾಡಲು ಬರದಿದ್ದರೂ ಪರವಾಗಿಲ್ಲ. ಒಳಗೆ ಬರಲು ಕೆಳಗಿನ ಹಸಿರು ಬಟನ್ ಒತ್ತಿ. ನಂತರ ನೀವು ಮಾತನಾಡಿ ಅಥವಾ ಬೆಳೆ ಫೋಟೋ ತೆಗೆದು ಎಲ್ಲಾ ಮಾಹಿತಿ ಕೇಳಬಹುದು.';

    setPlayingGuide(true);
    let fallbackText = guideText;
    try {
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: guideText, language }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          audioDataUrl?: string;
          spokenScript?: string;
        };
        if (data.spokenScript) {
          fallbackText = data.spokenScript;
        }
        if (data.audioDataUrl) {
          const audio = new Audio(data.audioDataUrl);
          guideAudioRef.current = audio;
          audio.onended = () => setPlayingGuide(false);
          audio.onerror = () => setPlayingGuide(false);
          await audio.play();
          return;
        }
      }
    } catch {
      // Fallback to browser SpeechSynthesis below
    }

    const started = speakMaleBrowserFallback(fallbackText, isEn, {
      onEnd: () => setPlayingGuide(false),
      onError: () => setPlayingGuide(false),
    });
    if (!started) {
      setPlayingGuide(false);
    }
  };

  const handleLoginClick = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setLoginError(null);
    try {
      await onGoogleLogin();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In was cancelled.';
      setLoginError(
        msg.includes('popup-closed-by-user')
          ? isEn
            ? 'Login window was closed. Please tap Sign in with Google again.'
            : 'ಲಾಗಿನ್ ವಿಂಡೋ ಮುಚ್ಚಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಲಾಗಿನ್ ಒತ್ತಿ.'
          : msg
      );
    } finally {
      setSigningIn(false);
    }
  };

  const features = isEn
    ? [
        {
          icon: <Cloud className="w-4 h-4 text-[#166534]" />,
          title: 'Free Cloud Sync',
          desc: 'Access your AI chats & crop scans from any phone or computer.',
        },
        {
          icon: <Camera className="w-4 h-4 text-[#166534]" />,
          title: 'Live Crop Scanner',
          desc: 'Scan daily photos to identify stage, disease, solution & harvest days.',
        },
        {
          icon: <Volume2 className="w-4 h-4 text-[#166534]" />,
          title: 'Village Voice AI',
          desc: 'Speak in Kannada or English and listen clearly even on slow networks.',
        },
      ]
    : [
        {
          icon: <Cloud className="w-4 h-4 text-[#166534]" />,
          title: 'ಉಚಿತ ಕ್ಲೌಡ್ ಸೇವ್',
          desc: 'ನಿಮ್ಮ ಚಾಟ್ ಮತ್ತು ಬೆಳೆ ಮಾಹಿತಿ ಯಾವುದೇ ಫೋನ್‌ನಲ್ಲೂ ಸುರಕ್ಷಿತವಾಗಿ ಸಿಗುತ್ತದೆ.',
        },
        {
          icon: <Camera className="w-4 h-4 text-[#166534]" />,
          title: 'ಲೈವ್ ಬೆಳೆ ಸ್ಕ್ಯಾನರ್',
          desc: 'ದಿನದ ಫೋಟೋ ತೆಗೆದು ಬೆಳೆ ಹಂತ, ರೋಗ, ಪರಿಹಾರ & ಕಟಾವು ದಿನ ತಿಳಿಯಿರಿ.',
        },
        {
          icon: <Volume2 className="w-4 h-4 text-[#166534]" />,
          title: 'ಕನ್ನಡ ಧ್ವನಿ ಸಹಾಯಕ',
          desc: 'ನಿಮ್ಮದೇ ಹಳ್ಳಿ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ ಮತ್ತು ಸ್ಪಷ್ಟ ಉತ್ತರ ಕೇಳಿ.',
        },
      ];

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#141A16] flex flex-col">
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-[#E2E5E0] px-5 flex items-center justify-between gap-4 shrink-0">
        <div className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#111814]">
          <AgronLogo5D size={34} mood="idle" />
          <span>Agron · ರೈತ ಮಿತ್ರ</span>
        </div>

        <div className="flex items-center gap-1.5">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeLanguage(opt.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                language === opt.id
                  ? 'bg-[#166534] text-white'
                  : 'text-[#5E6A62] hover:bg-[#F2F5F1]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Two-Column Login Layout */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Visual & Features Panel */}
          <motion.section
            initial={prefersReduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 bg-[#13221A] text-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-6 border border-[#243B2E]"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="shrink-0">
                  <FarmerAssistant4D
                    language={language}
                    mood="idle"
                    micLevel={0}
                    compact
                  />
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86EFAC]">
                    <Sprout className="w-3.5 h-3.5" />
                    <span>
                      {isEn ? 'Smart Farming Companion' : 'ರೈತರ ಡಿಜಿಟಲ್ ಮಿತ್ರ'}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                    {isEn
                      ? 'Your Field, Crops & Market in One Place'
                      : 'ನಿಮ್ಮ ಹೊಲ, ಬೆಳೆ ಆರೈಕೆ & ಮಾರುಕಟ್ಟೆ ಒಂದೇ ಕಡೆ'}
                  </h1>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                {features.map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EEF4EE] flex items-center justify-center shrink-0">
                      {f.icon}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {f.title}
                      </div>
                      <div className="text-[11px] text-[#C6DCC6] mt-0.5 leading-relaxed">
                        {f.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#A8C6B0] border-t border-white/10 pt-4">
              <ShieldCheck className="w-4 h-4 text-[#86EFAC] shrink-0" />
              <span>
                {isEn
                  ? 'Secured by free Google Sign-In & Firebase Cloud Database.'
                  : 'ಉಚಿತ Google ಲಾಗಿನ್ ಮತ್ತು Firebase ಕ್ಲೌಡ್ ಸುರಕ್ಷತೆಯೊಂದಿಗೆ.'}
              </span>
            </div>
          </motion.section>

          {/* Right Login Card */}
          <motion.section
            initial={prefersReduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.28,
              delay: 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="lg:col-span-6 bg-white border border-[#E2E5E0] rounded-2xl p-6 sm:p-8 flex flex-col justify-center gap-6"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="w-11 h-11 rounded-xl bg-[#EEF4EE] border border-[#C6DCC6] flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-[#166534]" />
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleVoiceGuide()}
                  className={`h-10 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                    playingGuide
                      ? 'bg-[#B91C1C] border-[#B91C1C] text-white'
                      : 'bg-[#EEF4EE] border-[#86EFAC] hover:bg-[#DCFCE7] text-[#166534]'
                  }`}
                >
                  {playingGuide ? (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>
                    {playingGuide
                      ? isEn
                        ? 'Stop Guide'
                        : 'ಧ್ವನಿ ನಿಲ್ಲಿಸಿ'
                      : isEn
                      ? 'Listen Voice Guide'
                      : 'ಕೇಳಿ (ಧ್ವನಿ ಮಾರ್ಗದರ್ಶಿ)'}
                  </span>
                </button>
              </div>
              <h2 className="text-xl font-bold text-[#111814]">
                {isEn ? 'Farmer Login' : 'ರೈತ ಲಾಗಿನ್ (Login)'}
              </h2>
              <p className="text-xs sm:text-sm text-[#4F5B53] leading-relaxed">
                {isEn
                  ? 'Sign in with Google for cloud backup, OR tap Quick Enter below — no reading or typing needed inside (just Speak or take Photo).'
                  : 'ಕ್ಲೌಡ್ ಸೇವ್‌ಗಾಗಿ Google ಲಾಗಿನ್ ಒತ್ತಿ, ಅಥವಾ ಓದಲು-ಬರೆಯಲು ಬರದಿದ್ದರೆ ಕೆಳಗಿನ ಸುಲಭ ಪ್ರವೇಶ ಒತ್ತಿ — ಒಳಗೆ ಮಾತನಾಡಿ ಅಥವಾ ಫೋಟೋ ತೆಗೆದು ಬಳಸಬಹುದು.'}
              </p>
            </div>

            {loginError && (
              <div className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-3.5 py-2.5">
                {loginError}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                disabled={signingIn}
                onClick={() => void handleLoginClick()}
                className="w-full h-12 px-5 rounded-xl bg-[#166534] hover:bg-[#14532D] disabled:bg-[#9CA69F] text-white text-sm font-semibold inline-flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer"
              >
                {signingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-white text-[#166534] font-bold text-xs inline-flex items-center justify-center">
                    G
                  </span>
                )}
                <span>
                  {signingIn
                    ? isEn
                      ? 'Signing in...'
                      : 'ಲಾಗಿನ್ ಆಗುತ್ತಿದೆ...'
                    : isEn
                    ? 'Sign in with Google'
                    : 'Google ಮೂಲಕ ಲಾಗಿನ್ ಆಗಿ'}
                </span>
              </button>

              <button
                type="button"
                onClick={onContinueGuest}
                className="w-full h-12 px-4 rounded-xl border-2 border-[#86EFAC] bg-[#EEF4EE] hover:bg-[#DCFCE7] text-sm font-bold text-[#14532D] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Sprout className="w-4 h-4 text-[#166534]" />
                <span>
                  {isEn
                    ? 'Quick Enter (No Email / Typing Needed)'
                    : 'ಒಳಗೆ ಬನ್ನಿ (ಇಮೇಲ್ / ಟೈಪಿಂಗ್ ಬೇಡ)'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-[#647068] leading-relaxed">
              {isEn
                ? '100% free Firebase backend: your farm data is private and accessible only with your verified Google account.'
                : '100% ಉಚಿತ Firebase ಬ್ಯಾಕ್‌ಎಂಡ್: ನಿಮ್ಮ ಬೆಳೆ ಮತ್ತು ಚಾಟ್ ಮಾಹಿತಿ ನಿಮ್ಮ ಖಾತೆಗೆ ಮಾತ್ರ ಖಾಸಗಿಯಾಗಿರುತ್ತದೆ.'}
            </p>
          </motion.section>
        </div>
      </main>
    </div>
  );
};
