import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Mic, Volume2, VolumeX } from 'lucide-react';
import type { LanguageMode } from '../types.ts';
import { FARMER_ASSISTANT_AVATAR } from '../constants/sectorMedia.ts';
import { AgronLogo5D } from './AgronLogo5D.tsx';

export type AssistantMood = 'idle' | 'listening' | 'thinking' | 'speaking';

interface FarmerAssistant4DProps {
  language: LanguageMode;
  mood: AssistantMood;
  micLevel?: number;
  compact?: boolean;
  onStopSpeaking?: () => void;
  onStartVoice?: () => void;
}

const EQUALIZER_PHASES = [0, 0.14, 0.28, 0.42, 0.2];

export const FarmerAssistant4D: React.FC<FarmerAssistant4DProps> = ({
  language,
  mood,
  micLevel = 0,
  compact = false,
  onStopSpeaking,
  onStartVoice,
}) => {
  const isEn = language === 'en';
  const prefersReduced = useReducedMotion();
  const [tilt, setTilt] = useState<{ rx: number; ry: number; px: number; py: number }>({
    rx: 0,
    ry: 0,
    px: 0,
    py: 0,
  });
  const [pulseCount, setPulseCount] = useState(0);
  const [imgError, setImgError] = useState(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-py * 16).toFixed(2)),
      ry: Number((px * 18).toFixed(2)),
      px: Number((px * 12).toFixed(2)),
      py: Number((py * 12).toFixed(2)),
    });
  };

  const resetTilt = () => setTilt({ rx: 0, ry: 0, px: 0, py: 0 });

  const normalizedMic = Math.min(1, Math.max(0, micLevel / 100));
  const reactiveScale =
    mood === 'listening'
      ? 1 + normalizedMic * 0.16
      : mood === 'speaking'
      ? 1.04
      : 1;

  const moodText = (() => {
    if (mood === 'listening') {
      return isEn
        ? 'Listening with 3.2x boost — speak naturally...'
        : 'ಮೈಕ್ ಆನ್ ಇದೆ ಅಣ್ಣ — ಧೈರ್ಯವಾಗಿ ಮಾತಾಡಿ, ಕೇಳಿಸ್ಕೊತಿದ್ದೀನಿ...';
    }
    if (mood === 'thinking') {
      return isEn
        ? 'Checking solution & preparing clear voice...'
        : 'ಹಳ್ಳಿ ಮಾತಲ್ಲಿ ಉತ್ತರ ಮತ್ತೆ ಧ್ವನಿ ರೆಡಿ ಮಾಡ್ತಿದ್ದೀನಿ...';
    }
    if (mood === 'speaking') {
      return isEn
        ? 'Speaking full guidance clearly...'
        : 'ನೋಡಣ್ಣ, ಹಳ್ಳಿ ಮಾತಲ್ಲೇ ಪೂರ್ತಿ ವಿಷ್ಯ ಹೇಳ್ತಿದ್ದೀನಿ ಕೇಳಿ...';
    }
    return isEn
      ? 'Namaskara! I am Raitha Mithra, your 4D interactive farming companion.'
      : 'ನಮಸ್ಕಾರ ಅಣ್ಣ! ನಾನು ನಿಮ್ಮ ಹೊಲದ ಗೆಳೆಯ — ಬೆಳೆ, ಹುಳ-ರೋಗ, ಮಳೆ, ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಏನೇ ಇದ್ರೂ ಮಾತಾಡಿ ಕೇಳಿ.';
  })();

  if (compact) {
    return (
      <div
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
        className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#FAFBF9] border-b border-[#E2E5E0]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="relative shrink-0 w-12 h-12 flex items-center justify-center"
            style={{ perspective: '800px' }}
          >
            {/* 4D Tilted Orbital Ring */}
            {!prefersReduced && (
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-[#166534]/35 pointer-events-none"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{
                  rotateX: 62,
                  rotateZ: 360,
                  scale:
                    mood === 'listening'
                      ? 1.05 + normalizedMic * 0.25
                      : mood === 'speaking'
                      ? [1.05, 1.2, 1.05]
                      : 1.05,
                }}
                transition={{
                  rotateZ: {
                    duration: mood === 'thinking' ? 2.4 : 7,
                    repeat: Infinity,
                    ease: 'linear',
                  },
                  scale: {
                    duration: 1.1,
                    repeat: mood === 'speaking' ? Infinity : 0,
                  },
                }}
              />
            )}

            {/* 3D Depth Avatar */}
            <motion.div
              animate={
                prefersReduced
                  ? {}
                  : {
                      rotateX: tilt.rx,
                      rotateY: tilt.ry,
                      scale: reactiveScale,
                    }
              }
              transition={{
                rotateX: { type: 'spring', stiffness: 240, damping: 20 },
                rotateY: { type: 'spring', stiffness: 240, damping: 20 },
                scale: { duration: 0.14 },
              }}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#166534] bg-[#E8EFE8] shadow-sm"
            >
              {!imgError ? (
                <img
                  src={FARMER_ASSISTANT_AVATAR}
                  alt={isEn ? 'Raitha Mithra Farmer Assistant' : 'ರೈತ ಮಿತ್ರ ಸ್ನೇಹಿತ'}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#166534]">
                  RM
                </div>
              )}
            </motion.div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#111814]">
              <span className="truncate">
                {isEn ? 'Raitha Mithra · Farm Friend' : 'ರೈತ ಮಿತ್ರ · ನಿಮ್ಮ ಕೃಷಿ ಸ್ನೇಹಿತ'}
              </span>
              {(mood === 'speaking' || mood === 'listening' || mood === 'thinking') &&
                !prefersReduced && (
                  <span
                    className="inline-flex items-center gap-0.5 h-3.5"
                    aria-hidden="true"
                  >
                    {EQUALIZER_PHASES.map((delay, i) => (
                      <motion.span
                        key={i}
                        className="w-0.5 h-3 bg-[#166534] rounded-full origin-bottom"
                        animate={
                          mood === 'listening'
                            ? {
                                scaleY:
                                  0.28 +
                                  normalizedMic *
                                    (0.55 + ((i % 3) * 0.22)),
                              }
                            : { scaleY: [0.3, 1, 0.35] }
                        }
                        transition={
                          mood === 'listening'
                            ? { duration: 0.08 }
                            : {
                                duration: mood === 'thinking' ? 0.45 : 0.65,
                                delay,
                                repeat: Infinity,
                              }
                        }
                      />
                    ))}
                  </span>
                )}
            </div>
            <p className="text-xs text-[#4F5B53] truncate">{moodText}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mood === 'speaking' && onStopSpeaking && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="px-2.5 py-1.5 rounded-lg border border-[#D4DAD4] bg-white hover:bg-[#FEF2F2] text-xs font-medium text-[#7A3030] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>{isEn ? 'Stop Voice' : 'ಧ್ವನಿ ನಿಲ್ಲಿಸಿ'}</span>
            </button>
          )}
          {onStartVoice && mood !== 'listening' && (
            <button
              type="button"
              onClick={onStartVoice}
              className="px-2.5 py-1.5 rounded-lg bg-[#EEF4EE] hover:bg-[#DFECE0] text-xs font-medium text-[#166534] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isEn ? 'Talk' : 'ಮಾತನಾಡಿ'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full Hero 4D Spatial-Temporal Companion Stage
  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onClick={() => setPulseCount((c) => c + 1)}
      className="relative overflow-hidden rounded-xl border border-[#DCE2DC] bg-gradient-to-br from-[#F7FAF7] via-[#FFFFFF] to-[#EEF4EE] p-5"
    >
      {/* 4D Temporal Ambient Light Sweep (Background Depth Plane) */}
      {!prefersReduced && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-y-10 -left-1/3 w-2/3 bg-gradient-to-r from-transparent via-[#166534]/[0.05] to-transparent skew-x-12"
          animate={{ x: ['0%', '220%'] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative grid grid-cols-1 md:grid-cols-[196px_1fr] gap-5 items-center">
        {/* 4D Multi-Plane Interactive Stage */}
        <div
          className="relative mx-auto w-44 h-44 flex items-center justify-center select-none"
          style={{ perspective: '1100px' }}
        >
          {/* Depth Plane 1: Tilted 3D Gyroscopic Ring A */}
          {!prefersReduced && (
            <motion.div
              aria-hidden="true"
              className="absolute inset-1 rounded-full border border-dashed border-[#166534]/35 pointer-events-none"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{
                rotateX: 66 + tilt.rx * 0.4,
                rotateY: -18 + tilt.ry * 0.4,
                rotateZ: 360,
                scale:
                  mood === 'listening'
                    ? 1 + normalizedMic * 0.18
                    : 1,
              }}
              transition={{
                rotateZ: {
                  duration: mood === 'thinking' ? 5 : 16,
                  repeat: Infinity,
                  ease: 'linear',
                },
                scale: { duration: 0.12 },
              }}
            />
          )}

          {/* Depth Plane 2: Counter-Tilted 3D Gyroscopic Ring B */}
          {!prefersReduced && (
            <motion.div
              aria-hidden="true"
              className="absolute inset-2 rounded-full border border-[#166534]/20 pointer-events-none"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{
                rotateX: -58 - tilt.rx * 0.3,
                rotateY: 24 + tilt.ry * 0.3,
                rotateZ: -360,
              }}
              transition={{
                rotateZ: {
                  duration: mood === 'thinking' ? 7 : 22,
                  repeat: Infinity,
                  ease: 'linear',
                },
              }}
            />
          )}

          {/* Depth Plane 3: Reactive Sound / Presence Halo */}
          {!prefersReduced && (
            <motion.div
              aria-hidden="true"
              className="absolute inset-4 rounded-full bg-[#166534]/10 pointer-events-none"
              animate={{
                scale:
                  mood === 'listening'
                    ? 1 + normalizedMic * 0.25
                    : mood === 'speaking'
                    ? [1, 1.16, 1]
                    : [1, 1.06, 1],
                opacity:
                  mood === 'listening'
                    ? 0.25 + normalizedMic * 0.5
                    : mood === 'speaking'
                    ? [0.45, 0.16, 0.45]
                    : [0.22, 0.38, 0.22],
                x: -tilt.px * 0.6,
                y: -tilt.py * 0.6,
              }}
              transition={{
                scale:
                  mood === 'listening'
                    ? { duration: 0.1 }
                    : {
                        duration: mood === 'speaking' ? 1.0 : 3.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                opacity: {
                  duration: mood === 'speaking' ? 1.0 : 3.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
            />
          )}

          {/* Depth Plane 4: Foreground 3D Parallax Farmer Avatar Body */}
          <motion.div
            key={pulseCount}
            animate={
              prefersReduced
                ? {}
                : {
                    rotateX: tilt.rx,
                    rotateY: tilt.ry,
                    x: tilt.px * 0.45,
                    y: [0, -5, 0],
                    scale: reactiveScale,
                  }
            }
            initial={prefersReduced ? undefined : { scale: 0.96 }}
            transition={{
              rotateX: { type: 'spring', stiffness: 210, damping: 18 },
              rotateY: { type: 'spring', stiffness: 210, damping: 18 },
              x: { type: 'spring', stiffness: 210, damping: 18 },
              scale: { type: 'spring', stiffness: 260, damping: 16 },
              y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-[#166534] shadow-lg bg-[#E8EFE8]"
          >
            {!imgError ? (
              <img
                src={FARMER_ASSISTANT_AVATAR}
                alt={isEn ? 'Raitha Mithra 4D Farming Friend' : 'ರೈತ ಮಿತ್ರ 4D ಕೃಷಿ ಸ್ನೇಹಿತ'}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[#166534]">
                ರೈತ ಮಿತ್ರ
              </div>
            )}

            {/* Glass Specular Sheen across 3D Portrait */}
            {!prefersReduced && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/25 to-transparent"
                animate={{
                  opacity: [0.15, 0.45, 0.15],
                  x: ['-40%', '40%', '-40%'],
                }}
                transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </motion.div>
        </div>

        {/* Friendly Companion Dialogue + Live 4D Voice Bars + 5D Showcase Emblem */}
        <div
          className="space-y-2.5 text-center md:text-left"
          style={{
            transform: prefersReduced
              ? undefined
              : `translate3d(${(tilt.px * 0.25).toFixed(1)}px, ${(tilt.py * 0.25).toFixed(1)}px, 0)`,
            transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="flex items-center justify-center md:justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-[#166534]">
                {isEn
                  ? 'Personal 4D Farming Companion · Always Ready'
                  : 'ನಿಮ್ಮ ಆತ್ಮೀಯ 4D ಕೃಷಿ ಸ್ನೇಹಿತ · ಸದಾ ಸಿದ್ಧ'}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111814] text-balance">
                {isEn ? 'Raitha Mithra — Your Farm Friend' : 'ರೈತ ಮಿತ್ರ — ನಿಮ್ಮ ಹೊಲದ ಗೆಳೆಯ'}
              </h1>
            </div>
            <div
              className="hidden sm:flex shrink-0"
              title={isEn ? 'Agron 5D Living Emblem — hover or tap' : 'Agron 5D ಲೋಗೋ — ಸ್ಪರ್ಶಿಸಿ ಅಥವಾ ಮೌಸ್ ತಿರುಗಿಸಿ'}
            >
              <AgronLogo5D size={72} mood={mood} micLevel={micLevel} />
            </div>
          </div>
          <p className="text-sm text-[#3B473F] leading-relaxed">{moodText}</p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
            {onStartVoice && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartVoice();
                }}
                className="px-4 py-2 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-transform active:scale-95"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>
                  {isEn ? 'Speak in Kannada / English' : 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ'}
                </span>
              </button>
            )}
            <div className="inline-flex items-center gap-2 text-xs text-[#4F5B53]">
              <Volume2 className="w-3.5 h-3.5 text-[#166534]" />
              <span>
                {isEn
                  ? 'Full clear voice answer enabled'
                  : 'ಸಂಪೂರ್ಣ ಸ್ಪಷ್ಟ ಕನ್ನಡ ಧ್ವನಿ ಉತ್ತರ ಲಭ್ಯ'}
              </span>
              {!prefersReduced && (
                <span className="inline-flex items-center gap-0.5 h-3" aria-hidden="true">
                  {EQUALIZER_PHASES.map((delay, i) => (
                    <motion.span
                      key={i}
                      className="w-0.5 h-3 bg-[#166534]/70 rounded-full origin-bottom"
                      animate={
                        mood === 'listening'
                          ? {
                              scaleY:
                                0.3 + normalizedMic * (0.55 + ((i % 3) * 0.2)),
                            }
                          : mood === 'speaking'
                          ? { scaleY: [0.3, 1, 0.35] }
                          : { scaleY: [0.35, 0.65, 0.35] }
                      }
                      transition={
                        mood === 'listening'
                          ? { duration: 0.08 }
                          : {
                              duration: mood === 'speaking' ? 0.55 : 1.8,
                              delay,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
