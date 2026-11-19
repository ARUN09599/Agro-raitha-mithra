import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Bug,
  Camera,
  CloudRain,
  ExternalLink,
  Image as ImageIcon,
  ImagePlus,
  IndianRupee,
  Loader2,
  Mic,
  RotateCcw,
  Sprout,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import type {
  AgriSector,
  ChatAttachment,
  ChatMessage,
  FarmingMode,
  LanguageMode,
} from '../types.ts';
import { AGRI_SECTORS, FARMING_MODE_OPTIONS } from '../constants/sectors.ts';
import { SECTOR_TITLE_IMAGES } from '../constants/sectorMedia.ts';
import { compressImageFile } from '../utils/compressImage.ts';
import { MediaBlockList } from './MediaBlocks.tsx';
import { FarmerAssistant4D, type AssistantMood } from './FarmerAssistant4D.tsx';
import {
  LiveCropScanner,
  type ScannedPhotoPayload,
} from './LiveCropScanner.tsx';

interface ChatPanelProps {
  sector: AgriSector;
  language: LanguageMode;
  farmingMode: FarmingMode;
  autoAudio: boolean;
  messages: ChatMessage[];
  isSending: boolean;
  speakingMsgId: string | null;
  isSpeakingAudio: boolean;
  onChangeFarmingMode: (mode: FarmingMode) => void;
  onEnsureAutoAudio?: () => void;
  onUnlockAudio?: () => void;
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  onRetryMessage: (errorMsgId: string) => void;
  onSpeakMessage: (msgId: string, text: string) => void;
  onStopSpeaking: () => void;
  onClearChat: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  sector,
  language,
  farmingMode,
  autoAudio,
  messages,
  isSending,
  speakingMsgId,
  isSpeakingAudio,
  onChangeFarmingMode,
  onEnsureAutoAudio,
  onUnlockAudio,
  onSendMessage,
  onRetryMessage,
  onSpeakMessage,
  onStopSpeaking,
  onClearChat,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [highSensitivity, setHighSensitivity] = useState<boolean>(true);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [liveCaption, setLiveCaption] = useState<string>('');
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);
  const [sectorTilt, setSectorTilt] = useState<{ rx: number; ry: number }>({
    rx: 0,
    ry: 0,
  });
  const prefersReduced = useReducedMotion();

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const liveCaptionRef = useRef<string>('');
  const speechDetectedRef = useRef<boolean>(false);
  const silenceSinceRef = useRef<number | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  const isEn = language === 'en';
  const sectorMeta =
    AGRI_SECTORS.find((s) => s.id === sector) ?? AGRI_SECTORS[0];

  const samplePrompts = isEn
    ? sectorMeta.samplePromptsEn
    : sectorMeta.samplePromptsKn;

  const assistantMood: AssistantMood =
    isRecording || isTranscribing
      ? 'listening'
      : isSpeakingAudio || speakingMsgId !== null
      ? 'speaking'
      : isSending
      ? 'thinking'
      : 'idle';

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const next: ChatAttachment[] = [];
    for (const file of files.slice(0, 3)) {
      if (!file.type.startsWith('image/')) {
        setUploadError(
          isEn
            ? 'Only image files (JPG, PNG, WebP) are supported.'
            : 'ಫೋಟೋ ಮಾತ್ರ ಹಾಕಿ (JPG, PNG).'
        );
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(
          isEn ? 'Images must be under 10 MB.' : 'ಫೋಟೋ 10 MB ಗಿಂತ ಕಡಿಮೆ ಇರಬೇಕು.'
        );
        continue;
      }
      const compressed = await compressImageFile(file);
      next.push({
        name: file.name,
        mimeType: compressed.mimeType,
        dataBase64: compressed.dataBase64,
        previewUrl: compressed.previewUrl,
      });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraCaptured = (
    payload: ScannedPhotoPayload,
    autoSend: boolean
  ) => {
    setUploadError(null);
    const capturedAttachment: ChatAttachment = {
      name: payload.name,
      mimeType: payload.mimeType,
      dataBase64: payload.dataBase64,
      previewUrl: payload.previewUrl,
    };
    const nextAttachments = [...attachments, capturedAttachment].slice(0, 3);

    if (autoSend && !isSending && !isTranscribing) {
      const trimmed = input.trim();
      setInput('');
      setAttachments([]);
      onSendMessage(trimmed, nextAttachments);
      return;
    }

    setAttachments(nextAttachments);
  };

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = highSensitivity ? 3.2 : 1.5;
    }
  }, [highSensitivity]);

  const cleanupAudioPipeline = () => {
    if (levelRafRef.current !== null) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    setMicLevel(0);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    gainNodeRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupAudioPipeline();
    };
  }, []);

  const pickSupportedAudioMime = (): string | undefined => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return undefined;
  };

  const startRecording = async () => {
    setMicError(null);
    setLiveCaption('');
    liveCaptionRef.current = '';
    speechDetectedRef.current = false;
    silenceSinceRef.current = null;
    recordStartTimeRef.current = Date.now();
    isStoppingRef.current = false;

    onUnlockAudio?.();
    onStopSpeaking();
    if (!autoAudio) {
      onEnsureAutoAudio?.();
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(
        isEn
          ? 'Microphone recording is not supported in this browser.'
          : 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಮೈಕ್ ಬೆಂಬಲವಿಲ್ಲ.'
      );
      return;
    }

    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // Route mic through Web Audio High-Sensitivity Pre-Amp + Dynamics Compressor + Wind Filter
      let recordStream: MediaStream = rawStream;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          const source = ctx.createMediaStreamSource(rawStream);
          const highpass = ctx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.value = 80;

          const gain = ctx.createGain();
          gain.gain.value = highSensitivity ? 3.2 : 1.5;

          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -36;
          compressor.knee.value = 24;
          compressor.ratio.value = 10;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.15;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;

          const dest = ctx.createMediaStreamDestination();
          source.connect(highpass);
          highpass.connect(gain);
          gain.connect(compressor);
          compressor.connect(analyser);
          compressor.connect(dest);

          audioCtxRef.current = ctx;
          gainNodeRef.current = gain;
          recordStream = dest.stream;

          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            setMicLevel(Math.min(100, Math.round(rms * 320)));

            // Smart silence auto-stop in Direct Speak mode so farmers never need to hunt for a Stop button
            if (!isStoppingRef.current && mediaRecorderRef.current?.state === 'recording') {
              const now = Date.now();
              const elapsed = now - recordStartTimeRef.current;
              const hasLiveSpeech = rms > 0.022 || liveCaptionRef.current.length > 0;
              if (hasLiveSpeech) {
                speechDetectedRef.current = true;
                silenceSinceRef.current = null;
              } else if (speechDetectedRef.current && elapsed > 1200) {
                if (silenceSinceRef.current === null) {
                  silenceSinceRef.current = now;
                } else if (now - silenceSinceRef.current > 1700) {
                  stopRecording();
                  return;
                }
              } else if (!speechDetectedRef.current && elapsed > 9000) {
                stopRecording();
                return;
              }

              if (elapsed > 30000) {
                stopRecording();
                return;
              }
            }

            levelRafRef.current = requestAnimationFrame(tick);
          };
          levelRafRef.current = requestAnimationFrame(tick);
        }
      } catch {
        // Clean fallback to rawStream if Web Audio routing is unavailable
      }

      // Parallel browser SpeechRecognition (kn-IN / en-IN) for instant live captions & fail-safe backup
      try {
        const SpeechRec =
          (window as unknown as { SpeechRecognition?: new () => unknown })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => unknown })
            .webkitSpeechRecognition;
        if (SpeechRec) {
          const rec = new SpeechRec() as {
            lang: string;
            continuous: boolean;
            interimResults: boolean;
            onresult: (ev: {
              results: ArrayLike<{
                isFinal: boolean;
                0: { transcript: string };
              }>;
            }) => void;
            onerror: () => void;
            start: () => void;
            stop: () => void;
          };
          rec.lang = isEn ? 'en-IN' : 'kn-IN';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev) => {
            let full = '';
            for (let i = 0; i < ev.results.length; i++) {
              full += ev.results[i][0]?.transcript ?? '';
            }
            const trimmed = full.trim();
            if (trimmed) {
              liveCaptionRef.current = trimmed;
              setLiveCaption(trimmed);
            }
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        }
      } catch {
        // Browser SpeechRecognition optional
      }

      const chosenMime = pickSupportedAudioMime();
      const recorder = chosenMime
        ? new MediaRecorder(recordStream, { mimeType: chosenMime })
        : new MediaRecorder(recordStream);
      const effectiveMime = recorder.mimeType || chosenMime || 'audio/webm';
      audioChunksRef.current = [];

      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) audioChunksRef.current.push(evt.data);
      };

      recorder.onstop = async () => {
        rawStream.getTracks().forEach((t) => t.stop());
        cleanupAudioPipeline();

        const blob = new Blob(audioChunksRef.current, { type: effectiveMime });
        const browserBackup = liveCaptionRef.current.trim();
        setLiveCaption('');

        if (blob.size < 180) {
          if (browserBackup) {
            onSendMessage(browserBackup, attachments);
            setAttachments([]);
          } else {
            setMicError(
              isEn
                ? 'Recording was too short. Hold Speak for at least 1 second.'
                : 'ಧ್ವನಿ ತುಂಬಾ ಚಿಕ್ಕದಾಗಿತ್ತು — ದಯವಿಟ್ಟು ಕನಿಷ್ಠ 1 ಸೆಕೆಂಡ್ ಮಾತನಾಡಿ ನಿಲ್ಲಿಸಿ.'
            );
          }
          return;
        }

        setIsTranscribing(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const str = String(reader.result);
              resolve(str.split(',')[1] ?? '');
            };
            reader.onerror = () => reject(new Error('Audio read error'));
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/audio/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: effectiveMime,
              language,
            }),
          });
          const data = (await res.json()) as {
            ok?: boolean;
            transcript?: string;
            error?: string;
          };

          const finalTranscript =
            (res.ok && data.transcript?.trim()) || browserBackup;

          if (!finalTranscript) {
            setMicError(
              data.error ??
                (isEn
                  ? 'Could not hear clearly. Please speak closer to the mic or type below.'
                  : 'ಧ್ವನಿ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ, ಮೈಕ್ ಹತ್ತಿರ ಹಿಡಿದು ಮತ್ತೊಮ್ಮೆ ಮಾತನಾಡಿ.')
            );
            return;
          }
          onSendMessage(finalTranscript, attachments);
          setAttachments([]);
        } catch {
          if (browserBackup) {
            onSendMessage(browserBackup, attachments);
            setAttachments([]);
          } else {
            setMicError(
              isEn
                ? 'Voice upload failed. Please try again.'
                : 'ಧ್ವನಿ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ, ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'
            );
          }
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setIsRecording(true);
    } catch {
      cleanupAudioPipeline();
      setMicError(
        isEn
          ? 'Please allow microphone permission to use voice chat.'
          : 'ಮಾತನಾಡಲು ಮೈಕ್ರೋಫೋನ್ (Microphone) ಅನುಮತಿ ನೀಡಿ.'
      );
    }
  };

  const stopRecording = () => {
    if (isStoppingRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      isStoppingRef.current = true;
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      } catch {
        // Ignore
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || isTranscribing) return;
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    onSendMessage(trimmed, attachments);
    setInput('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] border border-[#E2E5E0] rounded-xl overflow-hidden">
      {/* Compact Domain + Farming Method Header */}
      <div className="border-b border-[#E2E5E0] bg-[#FAFBF9] px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={SECTOR_TITLE_IMAGES[sector]}
            alt={isEn ? sectorMeta.labelEn : sectorMeta.labelKn}
            referrerPolicy="no-referrer"
            className="w-8 h-6 rounded object-cover border border-[#D4DAD4] shrink-0"
          />
          <span className="text-sm font-semibold text-[#141A16] truncate">
            {isEn ? sectorMeta.labelEn : sectorMeta.labelKn}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Farming Mode Selector: Organic + Chemical / Organic Only / Chemical Only */}
          <div className="inline-flex items-center rounded-lg border border-[#DCE2DC] bg-white p-0.5">
            {FARMING_MODE_OPTIONS.map((opt) => {
              const active = farmingMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeFarmingMode(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#13221A] text-white'
                      : 'text-[#5E6A62] hover:text-[#141A16]'
                  }`}
                >
                  {isEn ? opt.labelEn : opt.labelKn}
                </button>
              );
            })}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5E6A62] hover:text-[#141A16] transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isEn ? 'New Chat' : 'ಹೊಸ ಚಾಟ್'}
            </button>
          )}
        </div>
      </div>

      {/* Live 4D Companion Strip when chatting */}
      {messages.length > 0 && (
        <FarmerAssistant4D
          language={language}
          mood={assistantMood}
          micLevel={micLevel}
          compact
          onStopSpeaking={onStopSpeaking}
          onStartVoice={isRecording ? stopRecording : startRecording}
        />
      )}

      {/* Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto py-2 space-y-5">
            {/* 4D Animated Farmer Assistant Friend Hero */}
            <FarmerAssistant4D
              language={language}
              mood={assistantMood}
              micLevel={micLevel}
              onStopSpeaking={onStopSpeaking}
              onStartVoice={isRecording ? stopRecording : startRecording}
            />

            {/* Zero-Reading Voice & Camera First Deck for Uneducated / Low-Literacy Farmers */}
            <div className="rounded-xl border border-[#C6DCC6] bg-[#F5FAF5] p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#14532D] flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#166534]" />
                  <span>
                    {isEn
                      ? 'Easy Voice & Camera Mode (No Reading Needed)'
                      : 'ಸರಳ ಧ್ವನಿ ಮತ್ತು ಕ್ಯಾಮೆರಾ (ಓದಲು-ಬರೆಯಲು ಬೇಡ)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onSpeakMessage(
                      `help_${Date.now()}`,
                      isEn
                        ? 'Tap the green Speak button and talk in your language, or tap the Camera button to take a leaf or crop photo. I will speak the full answer out loud.'
                        : 'ನೋಡಣ್ಣ, ಈ ಹಸಿರು ಮಾತನಾಡಿ ಬಟನ್ ಒತ್ತಿ ನಿಮ್ಮ ಹಳ್ಳಿ ಮಾತಲ್ಲೇ ಕೇಳಿ, ಇಲ್ಲಾ ಕ್ಯಾಮೆರಾ ಒತ್ತಿ ಎಲೆ ಅಥವಾ ಬೆಳೆ ಫೋಟೋ ತೋರ್ಸಿ. ನಾನು ನಿಮಗೆ ಧ್ವನಿಯಲ್ಲೇ ಪೂರ್ತಿ ವಿಷ್ಯ ಹೇಳ್ತೀನಿ.'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg border border-[#86EFAC] bg-white hover:bg-[#DCFCE7] text-[11px] font-semibold text-[#166534] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>
                    {isEn ? 'Hear Instructions' : 'ಬಳಸುವ ವಿಧಾನ ಕೇಳಿ'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing || isSending}
                  className={`rounded-xl p-4 border-2 text-left transition-all flex items-center gap-3 cursor-pointer disabled:opacity-60 ${
                    isRecording
                      ? 'bg-[#B91C1C] border-[#991B1B] text-white shadow-md'
                      : 'bg-[#166534] hover:bg-[#14532D] border-[#14532D] text-white shadow-sm'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    {isTranscribing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : isRecording ? (
                      <Square className="w-6 h-6 fill-current" />
                    ) : (
                      <Mic className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-bold leading-tight">
                      {isTranscribing
                        ? isEn
                          ? 'Listening...'
                          : 'ಕೇಳುತ್ತಿದೆ...'
                        : isRecording
                        ? isEn
                          ? 'Tap to Stop'
                          : 'ನಿಲ್ಲಿಸಲು ಒತ್ತಿ'
                        : isEn
                        ? 'Speak Question'
                        : 'ಮಾತನಾಡಿ ಕೇಳಿ'}
                    </div>
                    <div className="text-[11px] text-white/85 mt-0.5">
                      {isEn ? 'Voice reply auto-plays' : 'ಧ್ವನಿಯಲ್ಲೇ ಉತ್ತರ ಬರುತ್ತದೆ'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCameraScanner(true)}
                  disabled={isSending || isTranscribing}
                  className="rounded-xl p-4 border-2 border-[#86EFAC] bg-white hover:bg-[#EEF4EE] text-[#13221A] text-left transition-all flex items-center gap-3 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  <div className="w-12 h-12 rounded-full bg-[#EEF4EE] border border-[#C6DCC6] text-[#166534] flex items-center justify-center shrink-0">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-bold leading-tight text-[#14532D]">
                      {isEn ? 'Open Camera' : 'ಫೋಟೋ ತೆಗೆಯಿರಿ'}
                    </div>
                    <div className="text-[11px] text-[#4F5B53] mt-0.5">
                      {isEn
                        ? 'Show leaf, pest or crop'
                        : 'ಬೆಳೆ / ರೋಗ ತೋರಿಸಿ'}
                    </div>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onSendMessage(
                      isEn
                        ? 'Give today weather and rain forecast in simple spoken words for farming.'
                        : 'ಇವತ್ತು ಮಳೆ ಮತ್ತೆ ಬಿಸಿಲು ಹೆಂಗಿದೆ ಅಣ್ಣ? ಹೊಲಕ್ಕೆ ಏನ್ ಮಾಡ್ಬೇಕು ಹೇಳು.',
                      []
                    )
                  }
                  className="p-2.5 rounded-lg border border-[#DCE2DC] bg-white hover:bg-[#EEF4EE] text-left flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <CloudRain className="w-5 h-5 text-[#0284C7] shrink-0" />
                  <span className="text-xs font-semibold text-[#141A16]">
                    {isEn ? 'Today Rain' : 'ಇಂದಿನ ಮಳೆ'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onSendMessage(
                      isEn
                        ? 'Tell me today Karnataka APMC market prices for main crops like tomato, onion, maize, and paddy.'
                        : 'ಇವತ್ತು ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಟೊಮೆಟೊ, ಈರುಳ್ಳಿ, ಮೆಕ್ಕೆಜೋಳ ಮತ್ತೆ ಭತ್ತದ ಬೆಲೆ ಎಷ್ಟಿದೆ ಹೇಳು ಅಣ್ಣ.',
                      []
                    )
                  }
                  className="p-2.5 rounded-lg border border-[#DCE2DC] bg-white hover:bg-[#EEF4EE] text-left flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <IndianRupee className="w-5 h-5 text-[#166534] shrink-0" />
                  <span className="text-xs font-semibold text-[#141A16]">
                    {isEn ? 'Market Rate' : 'ಇಂದಿನ ಬೆಲೆ'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCameraScanner(true)}
                  className="p-2.5 rounded-lg border border-[#DCE2DC] bg-white hover:bg-[#EEF4EE] text-left flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Bug className="w-5 h-5 text-[#B45309] shrink-0" />
                  <span className="text-xs font-semibold text-[#141A16]">
                    {isEn ? 'Pest / Disease' : 'ರೋಗ ಪರೀಕ್ಷೆ'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onSendMessage(
                      isEn
                        ? 'Tell me simple organic and chemical fertilizer & pest spray tips for healthy crops.'
                        : 'ಬೆಳೆ ಚೆನ್ನಾಗಿ ಬರೋಕೆ ಮನೆ ಮದ್ದು ಮತ್ತೆ ಅಂಗಡಿ ಗೊಬ್ಬರ, ಔಷಧಿ ಏನ್ ಹಾಕೋದು ಅಂತ ಸರಳವಾಗಿ ಹೇಳು.',
                      []
                    )
                  }
                  className="p-2.5 rounded-lg border border-[#DCE2DC] bg-white hover:bg-[#EEF4EE] text-left flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Sprout className="w-5 h-5 text-[#15803D] shrink-0" />
                  <span className="text-xs font-semibold text-[#141A16]">
                    {isEn ? 'Fertilizer Tip' : 'ಗೊಬ್ಬರ ಮದ್ದು'}
                  </span>
                </button>
              </div>
            </div>

            {/* 4D Interactive Title-Based Agriculture Sector Visual Card */}
            <div style={{ perspective: '1000px' }}>
              <motion.div
                onPointerMove={(e) => {
                  if (prefersReduced) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const px = (e.clientX - rect.left) / rect.width - 0.5;
                  const py = (e.clientY - rect.top) / rect.height - 0.5;
                  setSectorTilt({
                    rx: Number((-py * 8).toFixed(2)),
                    ry: Number((px * 10).toFixed(2)),
                  });
                }}
                onPointerLeave={() => setSectorTilt({ rx: 0, ry: 0 })}
                animate={
                  prefersReduced
                    ? {}
                    : { rotateX: sectorTilt.rx, rotateY: sectorTilt.ry }
                }
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative rounded-xl overflow-hidden border border-[#DCE2DC] bg-[#13221A] h-44 sm:h-48 shadow-sm"
              >
                <motion.img
                  key={sector}
                  src={SECTOR_TITLE_IMAGES[sector]}
                  alt={isEn ? sectorMeta.labelEn : sectorMeta.labelKn}
                  referrerPolicy="no-referrer"
                  animate={
                    prefersReduced
                      ? {}
                      : { scale: [1.04, 1.1, 1.04], x: [0, -8, 0] }
                  }
                  transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex flex-col justify-end p-5">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {isEn ? sectorMeta.labelEn : sectorMeta.labelKn}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed mt-1 max-w-2xl">
                    {isEn ? sectorMeta.descriptionEn : sectorMeta.descriptionKn}
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="pt-1">
              <div className="text-xs font-semibold text-[#5E6A62] uppercase tracking-wider mb-2.5">
                {isEn
                  ? 'Tap a Question, Open Camera / Photo, or Press Speak'
                  : 'ಪ್ರಶ್ನೆ ಒತ್ತಿ, ಕ್ಯಾಮೆರಾ / ಫೋಟೋ ಹಾಕಿ ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ'}
              </div>
              <div className="space-y-2" style={{ perspective: '900px' }}>
                {samplePrompts.map((prompt) => (
                  <motion.button
                    key={prompt}
                    type="button"
                    whileHover={
                      prefersReduced
                        ? undefined
                        : { scale: 1.008, y: -1 }
                    }
                    whileTap={prefersReduced ? undefined : { scale: 0.992 }}
                    transition={{ duration: 0.16 }}
                    onClick={() => onSendMessage(prompt, [])}
                    className="w-full text-left px-4 py-3 rounded-lg border border-[#E2E5E0] bg-[#FAFBF9] hover:bg-[#F1F4EF] hover:border-[#C5CEC7] transition-colors text-sm text-[#1A221D] cursor-pointer"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6" style={{ perspective: '1000px' }}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={
                  prefersReduced
                    ? false
                    : { opacity: 0, y: 12, rotateX: 5 }
                }
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  duration: 0.24,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={
                  msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                }
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[82%] bg-[#13221A] text-[#F6F8F6] rounded-xl px-4 py-3">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2.5">
                        {msg.attachments.map((att, idx) => (
                          <img
                            key={idx}
                            src={att.previewUrl}
                            alt={att.name}
                            referrerPolicy="no-referrer"
                            className="w-28 h-28 object-cover rounded-lg border border-white/15"
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#647068]">
                      <span className="font-semibold text-[#141A16]">
                        {isEn ? 'Agron' : 'ರೈತ ಮಿತ್ರ'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {msg.media && msg.media.length > 0 && (
                      <MediaBlockList
                        media={msg.media.filter(
                          (item) =>
                            item.kind !== 'audio' || Boolean(item.audioDataUrl)
                        )}
                      />
                    )}

                    {msg.error ? (
                      <div className="border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-3">
                        <span>{msg.error}</span>
                        <button
                          type="button"
                          onClick={() => onRetryMessage(msg.id)}
                          disabled={isSending}
                          className="px-3 py-1 rounded-md bg-[#991B1B] hover:bg-[#7F1D1D] text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isEn ? 'Retry' : 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="agron-prose">
                          {msg.content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          ) : msg.isStreaming ? (
                            <span className="inline-flex items-center gap-2 text-sm text-[#5E6A62]">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {isEn
                                ? 'Preparing quick answer...'
                                : 'ತಕ್ಷಣದ ಉತ್ತರ ಸಿದ್ಧವಾಗುತ್ತಿದೆ...'}
                            </span>
                          ) : null}
                        </div>

                        {msg.sources && msg.sources.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1.5">
                            {msg.sources.map((src) => (
                              <a
                                key={src.uri}
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#DCE2DC] bg-[#FAFBF9] hover:bg-[#F1F4EF] text-[11px] text-[#166534] max-w-[240px] truncate"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        {!msg.isStreaming && msg.content && (
                          <div className="flex flex-wrap items-center gap-2 pt-1.5">
                            <button
                              type="button"
                              onClick={() => onSpeakMessage(msg.id, msg.content)}
                              disabled={speakingMsgId === msg.id}
                              className="h-9 px-3.5 rounded-lg border border-[#86EFAC] bg-[#EEF4EE] hover:bg-[#DCFCE7] text-xs font-semibold text-[#166534] inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {speakingMsgId === msg.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                              <span>
                                {speakingMsgId === msg.id
                                  ? isEn
                                    ? 'Speaking...'
                                    : 'ಧ್ವನಿ ಸಿದ್ಧವಾಗುತ್ತಿದೆ...'
                                  : isEn
                                  ? 'Listen Answer'
                                  : 'ಉತ್ತರ ಕೇಳಿ (ಆಡಿಯೋ)'}
                              </span>
                            </button>

                            {isSpeakingAudio && (
                              <button
                                type="button"
                                onClick={onStopSpeaking}
                                className="h-9 px-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#991B1B] inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>{isEn ? 'Stop' : 'ನಿಲ್ಲಿಸಿ'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={scrollEndRef} />
          </div>
        )}
      </div>

      {/* Composer + Voice Mic + Camera + Photo + Quick Media */}
      <div className="border-t border-[#E2E5E0] bg-[#FAFBF9] px-5 py-3.5">
          {(uploadError || micError) && (
            <div className="mb-2 text-xs text-[#B91C1C]">
              {uploadError ?? micError}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="relative group border border-[#D4DAD4] rounded-lg overflow-hidden bg-white"
                >
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="absolute top-1 right-1 bg-[#141A16]/80 text-white rounded-full p-0.5 cursor-pointer"
                    aria-label="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isRecording && (
            <div className="mb-2.5 rounded-lg border border-[#86EFAC] bg-[#EEF4EE] px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#133A1D]">
                <span>
                  {isEn
                    ? `Listening (${highSensitivity ? 'Full Sensitivity 3.2x' : 'Standard'}) — Tap Stop when done`
                    : `ಕೇಳುತ್ತಿದೆ (${highSensitivity ? 'ಫುಲ್ ಸೆನ್ಸಿಟಿವಿಟಿ 3.2x' : 'ಸಾಮಾನ್ಯ'}) — ಮುಗಿದ ಮೇಲೆ ನಿಲ್ಲಿಸಿ ಒತ್ತಿ`}
                </span>
                <span className="font-mono tabular-nums text-[11px]">
                  {micLevel}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-[#C6DCC6]">
                <div
                  className="h-full bg-[#166534] transition-[width] duration-75"
                  style={{ width: `${Math.max(4, micLevel)}%` }}
                />
              </div>
              {liveCaption && (
                <p className="text-xs text-[#14532D] truncate">
                  {liveCaption}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-[#647068]">
                {isEn ? 'Create:' : 'ತಯಾರಿಸಿ:'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setInput((prev) =>
                    prev.trim() ||
                    (isEn
                      ? 'Generate an illustrated farming diagram for drip irrigation and healthy crop roots.'
                      : 'ಹನಿ ನೀರಾವರಿ ಮತ್ತು ಆರೋಗ್ಯಕರ ಬೆಳೆ ಬೇರುಗಳ ಚಿತ್ರವನ್ನು ಬರೆದು ತೋರಿಸಿ.')
                  )
                }
                className="px-2.5 py-1 rounded-md border border-[#E2E5E0] bg-white hover:bg-[#F1F4EF] text-[11px] font-medium text-[#3B473F] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <ImageIcon className="w-3 h-3 text-[#166534]" />
                {isEn ? 'Image' : 'ಚಿತ್ರ (Image)'}
              </button>
              <button
                type="button"
                onClick={() =>
                  setInput((prev) =>
                    prev.trim() ||
                    (isEn
                      ? 'Generate an audio voice guide on organic & chemical crop protection.'
                      : 'ಸಾವಯವ ಮತ್ತು ರಾಸಾಯನಿಕ ಬೆಳೆ ರಕ್ಷಣೆ ಬಗ್ಗೆ ಹಳ್ಳಿ ಕನ್ನಡದಲ್ಲಿ ಆಡಿಯೋ ಸಲಹೆ ಕೊಡಿ.')
                  )
                }
                className="px-2.5 py-1 rounded-md border border-[#E2E5E0] bg-white hover:bg-[#F1F4EF] text-[11px] font-medium text-[#3B473F] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3 h-3 text-[#166534]" />
                {isEn ? 'Audio' : 'ಆಡಿಯೋ (Audio)'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setHighSensitivity((v) => !v)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                highSensitivity
                  ? 'bg-[#EEF4EE] border-[#86EFAC] text-[#166534]'
                  : 'bg-white border-[#E2E5E0] text-[#5E6A62]'
              }`}
            >
              <Mic className="w-3 h-3" />
              <span>
                {isEn
                  ? `Mic Boost: ${highSensitivity ? 'Full 3.2x' : 'Normal'}`
                  : `ಮೈಕ್ ಶಕ್ತಿ: ${highSensitivity ? 'ಫುಲ್ 3.2x' : 'ಸಾಮಾನ್ಯ'}`}
              </span>
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-wrap sm:flex-nowrap items-end gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              disabled={isSending || isTranscribing}
              className="h-10 px-3 rounded-lg border border-[#86EFAC] bg-[#EEF4EE] hover:bg-[#DCFCE7] text-[#166534] transition-colors inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              title={
                isEn
                  ? 'Open live camera to capture crop or leaf photo'
                  : 'ಬೆಳೆ ಅಥವಾ ಎಲೆಯ ಫೋಟೋ ತೆಗೆಯಲು ಲೈವ್ ಕ್ಯಾಮೆರಾ ತೆರೆಯಿರಿ'
              }
            >
              <Camera className="w-4 h-4" />
              <span>{isEn ? 'Camera' : 'ಕ್ಯಾಮೆರಾ'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-3 rounded-lg border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-[#3B473F] transition-colors inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              title={
                isEn
                  ? 'Attach leaf, crop, or soil photo from gallery'
                  : 'ಗ್ಯಾಲರಿಯಿಂದ ಬೆಳೆ ಅಥವಾ ಎಲೆಯ ಫೋಟೋ ಹಾಕಿ'
              }
            >
              <ImagePlus className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isEn ? 'Photo' : 'ಫೋಟೋ'}
              </span>
            </button>

            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing || isSending}
              className={`h-10 px-3 rounded-lg border transition-colors inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                isRecording
                  ? 'bg-[#B91C1C] border-[#B91C1C] text-white'
                  : 'border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-[#141A16]'
              }`}
              title={
                isEn
                  ? 'Speak your farming question'
                  : 'ಮಾತನಾಡಿ ಪ್ರಶ್ನೆ ಕೇಳಿ (ಕನ್ನಡ ಧ್ವನಿ)'
              }
            >
              {isTranscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Mic className="w-4 h-4 text-[#166534]" />
              )}
              <span>
                {isTranscribing
                  ? isEn
                    ? 'Listening...'
                    : 'ಕೇಳುತ್ತಿದೆ...'
                  : isRecording
                  ? isEn
                    ? 'Stop'
                    : 'ನಿಲ್ಲಿಸಿ'
                  : isEn
                  ? 'Speak'
                  : 'ಮಾತನಾಡಿ'}
              </span>
            </button>

            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isEn
                  ? 'Ask why a crop problem happened (with or without photo), or ask market price...'
                  : 'ಬೆಳೆಗೆ ರೋಗ ಯಾಕೆ ಬಂತು, ಮನೆ ಮದ್ದು/ಅಂಗಡಿ ಔಷಧಿ ಅಥವಾ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಇಲ್ಲಿ ಕೇಳಿ...'
              }
              className="flex-1 min-w-[160px] min-h-[40px] max-h-36 resize-none rounded-lg border border-[#D4DAD4] bg-white px-3.5 py-2 text-sm text-[#141A16] placeholder:text-[#7C8780] focus:outline-none focus:border-[#166534]"
            />

            <button
              type="submit"
              disabled={
                isSending ||
                isTranscribing ||
                (!input.trim() && attachments.length === 0)
              }
              className="h-10 px-4 rounded-lg bg-[#166534] hover:bg-[#14532D] disabled:bg-[#9CA69F] text-white text-sm font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
              <span>{isEn ? 'Send' : 'ಕಳುಹಿಸಿ'}</span>
            </button>
          </form>
        </div>

      {showCameraScanner && (
        <LiveCropScanner
          mode="chat"
          isEn={isEn}
          onClose={() => setShowCameraScanner(false)}
          onScanCaptured={handleCameraCaptured}
        />
      )}
    </div>
  );
};
