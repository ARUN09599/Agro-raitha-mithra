import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CalendarDays,
  Cloud,
  History,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AgriSector,
  ChatAttachment,
  ChatMessage,
  ChatThread,
  FarmingMode,
  GeneratedMediaItem,
  GroundSource,
  LanguageMode,
  WorkspaceTab,
} from './types.ts';
import { AGRI_SECTORS, LANGUAGE_OPTIONS } from './constants/sectors.ts';
import { SECTOR_TITLE_IMAGES } from './constants/sectorMedia.ts';
import { ChatPanel } from './components/ChatPanel.tsx';
import type { MarketInitialQuery } from './components/MarketPanel.tsx';
import { AgronLogo5D } from './components/AgronLogo5D.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { speakMaleBrowserFallback } from './utils/speakFallback.ts';
import {
  auth,
  deleteThreadFromFirestore,
  ensureUserProfile,
  onAuthStateChanged,
  saveThreadToFirestore,
  signInWithGooglePopup,
  signOutUser,
  subscribeUserThreads,
  type User,
} from './firebase.ts';

const KrishiCarePanel = lazy(() =>
  import('./components/KrishiCarePanel.tsx').then((m) => ({
    default: m.KrishiCarePanel,
  }))
);
const MarketPanel = lazy(() =>
  import('./components/MarketPanel.tsx').then((m) => ({
    default: m.MarketPanel,
  }))
);

const LEGACY_CHAT_STORAGE_KEY = 'agron_kn_chat_history_v2';
const THREADS_STORAGE_KEY = 'agron_kn_chat_threads_v1';

function compactMessagesForStorage(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.slice(-50).map((m) => ({
    ...m,
    isStreaming: false,
    attachments: undefined,
    media: m.media?.map((item) =>
      item.kind === 'audio' ? { ...item, audioDataUrl: '' } : item
    ),
  }));
}

function buildThreadTitle(text: string, isEn: boolean): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return isEn ? 'Crop Photo Query' : 'ಬೆಳೆ ಫೋಟೋ ಪ್ರಶ್ನೆ';
  return clean.length > 44 ? `${clean.slice(0, 44)}…` : clean;
}

function loadSavedThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(THREADS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatThread[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => ({
          ...t,
          messages: Array.isArray(t.messages)
            ? t.messages.map((m) => ({ ...m, isStreaming: false }))
            : [],
        }));
      }
    }
    const legacyRaw = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
    if (legacyRaw) {
      const legacyMsgs = JSON.parse(legacyRaw) as ChatMessage[];
      if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
        const firstUser = legacyMsgs.find((m) => m.role === 'user');
        return [
          {
            id: `chat_${Date.now()}`,
            title: buildThreadTitle(firstUser?.content ?? 'Saved Chat', false),
            sector: firstUser?.sector ?? 'all',
            language: 'kn-village',
            farmingMode: 'both',
            updatedAt:
              legacyMsgs[legacyMsgs.length - 1]?.timestamp ??
              new Date().toISOString(),
            messages: legacyMsgs.map((m) => ({ ...m, isStreaming: false })),
          },
        ];
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [guestMode, setGuestMode] = useState<boolean>(false);

  const [threads, setThreads] = useState<ChatThread[]>(loadSavedThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => loadSavedThreads()[0]?.id ?? null
  );
  const activeThreadIdRef = useRef<string | null>(activeThreadId);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('chat');
  const [sector, setSector] = useState<AgriSector>(
    () => loadSavedThreads()[0]?.sector ?? 'all'
  );
  const [language, setLanguage] = useState<LanguageMode>('kn-village');
  const [farmingMode, setFarmingMode] = useState<FarmingMode>(
    () => loadSavedThreads()[0]?.farmingMode ?? 'both'
  );
  const [autoAudio, setAutoAudio] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => loadSavedThreads()[0]?.messages ?? []
  );
  const [isSending, setIsSending] = useState<boolean>(false);
  const isSendingRef = useRef<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isSpeakingAudio, setIsSpeakingAudio] = useState<boolean>(false);
  const [mobileRailOpen, setMobileRailOpen] = useState<boolean>(false);
  const [marketHandoff, setMarketHandoff] = useState<MarketInitialQuery | null>(
    null
  );
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (user) {
        setGuestMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return;
    let unsubThreads: (() => void) | undefined;
    let cancelled = false;

    const initCloud = async () => {
      try {
        await ensureUserProfile(authUser, language, farmingMode);
      } catch {
        // Error handler already logged
      }
      if (cancelled) return;

      let migratedLocal = false;
      unsubThreads = subscribeUserThreads(
        authUser.uid,
        (cloudThreads) => {
          if (cloudThreads.length === 0 && !migratedLocal) {
            migratedLocal = true;
            const localSeed = loadSavedThreads();
            if (localSeed.length > 0) {
              for (const t of localSeed.slice(0, 10)) {
                void saveThreadToFirestore(authUser.uid, t).catch(() => {});
              }
              return;
            }
          }
          setThreads(cloudThreads);
          const currentId = activeThreadIdRef.current;
          const matching = currentId
            ? cloudThreads.find((t) => t.id === currentId)
            : cloudThreads[0];
          if (matching && !isSendingRef.current) {
            activeThreadIdRef.current = matching.id;
            setActiveThreadId(matching.id);
            setMessages(matching.messages);
          } else if (cloudThreads.length === 0 && !currentId) {
            setMessages([]);
          }
        },
        () => {}
      );
    };

    void initCloud();
    return () => {
      cancelled = true;
      if (unsubThreads) unsubThreads();
    };
  }, [authReady, authUser]);

  const getSharedAudioElement = () => {
    if (!activeAudioRef.current) {
      activeAudioRef.current = new Audio();
    }
    return activeAudioRef.current;
  };

  const unlockAudioPlayback = () => {
    if (audioUnlockedRef.current || typeof window === 'undefined') return;
    try {
      const audio = getSharedAudioElement();
      audio.muted = true;
      audio.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        void p
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            audioUnlockedRef.current = true;
          })
          .catch(() => {
            audio.muted = false;
          });
      }
    } catch {
      // Ignore autoplay unlock errors
    }
  };

  const stopAudioPlayback = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeakingAudio(false);
  };

  const speakWithBrowserFallback = (rawText: string) => {
    stopAudioPlayback();
    const started = speakMaleBrowserFallback(rawText, language === 'en', {
      onStart: () => setIsSpeakingAudio(true),
      onEnd: () => setIsSpeakingAudio(false),
      onError: () => setIsSpeakingAudio(false),
    });
    if (started) {
      setIsSpeakingAudio(true);
    }
  };

  const playAudioUrl = (url: string, fallbackText?: string) => {
    stopAudioPlayback();
    const audio = getSharedAudioElement();
    audio.muted = false;
    audio.src = url;
    audio.onended = () => setIsSpeakingAudio(false);
    audio.onerror = () => {
      setIsSpeakingAudio(false);
      if (fallbackText) speakWithBrowserFallback(fallbackText);
    };
    setIsSpeakingAudio(true);
    void audio.play().catch(() => {
      setIsSpeakingAudio(false);
      if (fallbackText) speakWithBrowserFallback(fallbackText);
    });
  };

  // Sync active thread messages & persist all Chat History threads in localStorage
  useEffect(() => {
    const tid = activeThreadIdRef.current;
    if (!tid || messages.length === 0) return;

    setThreads((prev) => {
      const idx = prev.findIndex((t) => t.id === tid);
      if (idx === -1) return prev;
      const prevMsgs = prev[idx].messages;
      const prevLast = prevMsgs[prevMsgs.length - 1];
      const nextLast = messages[messages.length - 1];
      const sameContent =
        prevMsgs.length === messages.length &&
        prevLast?.id === nextLast?.id &&
        prevLast?.content === nextLast?.content &&
        (prevLast?.media?.length ?? 0) === (nextLast?.media?.length ?? 0) &&
        Boolean(prevLast?.isStreaming) === Boolean(nextLast?.isStreaming) &&
        prevLast?.error === nextLast?.error;
      if (sameContent) return prev;

      const updated: ChatThread = {
        ...prev[idx],
        sector,
        language,
        farmingMode,
        updatedAt: new Date().toISOString(),
        messages,
      };
      return [updated, ...prev.filter((t) => t.id !== tid)].slice(0, 40);
    });
  }, [messages, sector, language, farmingMode]);

  useEffect(() => {
    try {
      const compact = threads.slice(0, 40).map((t) => ({
        ...t,
        messages: compactMessagesForStorage(t.messages),
      }));
      localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // Ignore quota exceeded
    }
  }, [threads]);

  const handleStartNewChat = () => {
    stopAudioPlayback();
    activeThreadIdRef.current = null;
    setActiveThreadId(null);
    setMessages([]);
    setWorkspaceTab('chat');
    setMobileRailOpen(false);
  };

  const handleSelectThread = (thread: ChatThread) => {
    stopAudioPlayback();
    activeThreadIdRef.current = thread.id;
    setActiveThreadId(thread.id);
    setMessages(thread.messages.map((m) => ({ ...m, isStreaming: false })));
    setSector(thread.sector ?? 'all');
    setFarmingMode(thread.farmingMode ?? 'both');
    setWorkspaceTab('chat');
    setMobileRailOpen(false);
  };

  const handleDeleteThread = (threadId: string) => {
    const remaining = threads.filter((t) => t.id !== threadId);
    setThreads(remaining);
    if (activeThreadIdRef.current === threadId) {
      const fallback = remaining[0] ?? null;
      activeThreadIdRef.current = fallback?.id ?? null;
      setActiveThreadId(fallback?.id ?? null);
      setMessages(fallback?.messages ?? []);
    }
    if (authUser) {
      void deleteThreadFromFirestore(authUser.uid, threadId).catch(() => {});
    }
  };

  const handleSpeakMessage = async (msgId: string, text: string) => {
    if (!text.trim()) return;
    setSpeakingMsgId(msgId);
    try {
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) {
        speakWithBrowserFallback(text);
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        audioDataUrl?: string;
        spokenScript?: string;
      };
      if (!data.audioDataUrl) {
        speakWithBrowserFallback(data.spokenScript || text);
        return;
      }
      const audioItem: GeneratedMediaItem = {
        id: `tts_${Date.now()}`,
        kind: 'audio',
        title: language === 'en' ? 'Full Voice Answer' : 'ಸಂಪೂರ್ಣ ಕನ್ನಡ ಧ್ವನಿ ಉತ್ತರ',
        script: '',
        voiceName: 'Puck',
        audioDataUrl: data.audioDataUrl,
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, media: [...(m.media ?? []), audioItem] } : m
        )
      );
      playAudioUrl(data.audioDataUrl, data.spokenScript || text);
    } catch {
      speakWithBrowserFallback(text);
    } finally {
      setSpeakingMsgId((prev) => (prev === msgId ? null : prev));
    }
  };

  const handleSendMessage = async (
    text: string,
    attachments: ChatAttachment[]
  ) => {
    setWorkspaceTab('chat');

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content:
        text ||
        (language === 'en'
          ? 'Analyze this crop/farm photo: explain why this happened and give both organic and chemical solutions.'
          : 'ಈ ಫೋಟೋ ನೋಡಿ ಅಣ್ಣ: ಬೆಳೆಗೆ ಯಾಕೆ ಹಿಂಗಾಗಿದೆ ಮತ್ತೆ ಮನೆ ಮದ್ದು, ಅಂಗಡಿ ಔಷಧಿ ಎರಡನ್ನೂ ಹೇಳು.'),
      timestamp: new Date().toISOString(),
      sector,
      attachments,
    };

    const assistantId = `msg_a_${Date.now() + 1}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      sector,
      isStreaming: true,
    };

    if (!activeThreadIdRef.current) {
      const newTid = `chat_${Date.now()}`;
      activeThreadIdRef.current = newTid;
      setActiveThreadId(newTid);
      const newThread: ChatThread = {
        id: newTid,
        title: buildThreadTitle(userMsg.content, language === 'en'),
        sector,
        language,
        farmingMode,
        updatedAt: new Date().toISOString(),
        messages: [userMsg, assistantPlaceholder],
      };
      setThreads((prev) => [newThread, ...prev].slice(0, 40));
    }

    const historyForApi = [
      ...messages.filter((m) => !m.error && m.content.trim().length > 0),
      userMsg,
    ]
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    isSendingRef.current = true;
    setIsSending(true);

    let streamedText = '';
    let collectedSources: GroundSource[] = [];
    let hasAudioMedia = false;
    let streamErrored = false;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          sector,
          language,
          farmingMode,
          attachments: attachments.map((a) => ({
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
          })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const evt = JSON.parse(jsonStr) as {
              type: 'text' | 'media' | 'sources' | 'error' | 'done';
              delta?: string;
              media?: GeneratedMediaItem;
              sources?: GroundSource[];
              message?: string;
            };

            if (evt.type === 'text' && evt.delta) {
              streamedText += evt.delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + evt.delta }
                    : m
                )
              );
            } else if (evt.type === 'media' && evt.media) {
              if (evt.media.kind === 'audio') {
                hasAudioMedia = true;
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        media: [...(m.media ?? []), evt.media!],
                      }
                    : m
                )
              );
            } else if (evt.type === 'sources' && evt.sources) {
              collectedSources = evt.sources;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: evt.sources } : m
                )
              );
            } else if (evt.type === 'error') {
              streamErrored = true;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        error: evt.message ?? 'Error calling AI model.',
                        isStreaming: false,
                      }
                    : m
                )
              );
            } else if (evt.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false } : m
                )
              );
            }
          } catch {
            // Ignore malformed SSE chunk
          }
        }
      }
    } catch (err) {
      streamErrored = true;
      const msg =
        err instanceof Error ? err.message : 'Network error reaching chat API.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, error: msg, isStreaming: false } : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
      isSendingRef.current = false;
      setIsSending(false);

      // Persist completed thread to Firestore when signed in
      const completedTid = activeThreadIdRef.current;
      if (authUser && completedTid) {
        const finalThread: ChatThread = {
          id: completedTid,
          title:
            threads.find((t) => t.id === completedTid)?.title ||
            buildThreadTitle(userMsg.content, language === 'en'),
          sector,
          language,
          farmingMode,
          updatedAt: new Date().toISOString(),
          messages: [
            ...messages,
            userMsg,
            {
              ...assistantPlaceholder,
              content: streamedText,
              sources: collectedSources.length > 0 ? collectedSources : undefined,
              isStreaming: false,
            },
          ],
        };
        void saveThreadToFirestore(authUser.uid, finalThread).catch(() => {});
      }

      // Non-blocking background TTS when Audio Chat is ON so text finishes instantaneously
      if (
        autoAudio &&
        !streamErrored &&
        !hasAudioMedia &&
        streamedText.trim().length > 0
      ) {
        void handleSpeakMessage(assistantId, streamedText);
      }
    }
  };

  const handleRetryMessage = (errorMsgId: string) => {
    if (isSending) return;
    const errorIdx = messages.findIndex((m) => m.id === errorMsgId);
    if (errorIdx <= 0) return;
    const prevUserMsg = [...messages.slice(0, errorIdx)]
      .reverse()
      .find((m) => m.role === 'user');
    if (!prevUserMsg) return;

    const trimmedMessages = messages.slice(
      0,
      messages.lastIndexOf(prevUserMsg)
    );
    setMessages(trimmedMessages);
    setTimeout(() => {
      void handleSendMessage(prevUserMsg.content, prevUserMsg.attachments ?? []);
    }, 0);
  };

  const isEn = language === 'en';
  const prefersReduced = useReducedMotion();
  const headerLogoMood =
    isSpeakingAudio || speakingMsgId !== null
      ? 'speaking'
      : isSending
      ? 'thinking'
      : 'idle';

  if (!authReady) {
    return (
      <div className="h-screen bg-[#F6F7F5] flex flex-col items-center justify-center gap-3 text-[#141A16]">
        <AgronLogo5D size={52} mood="thinking" />
        <p className="text-xs font-medium text-[#5E6A62]">
          {isEn ? 'Loading Agron...' : 'Agron ತೆರೆಯುತ್ತಿದೆ...'}
        </p>
      </div>
    );
  }

  if (!authUser && !guestMode) {
    return (
      <LoginPage
        language={language}
        onChangeLanguage={setLanguage}
        onGoogleLogin={async () => {
          await signInWithGooglePopup();
          setGuestMode(false);
        }}
        onContinueGuest={() => setGuestMode(true)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F6F7F5] text-[#141A16] overflow-hidden">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (Language links) — Zone 3 (1 primary CTA: Audio Chat toggle) */}
      <header className="h-14 bg-white border-b border-[#E2E5E0] px-5 flex items-center justify-between gap-8 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileRailOpen((o) => !o)}
            className="lg:hidden p-1.5 rounded-md text-[#3B473F] hover:bg-[#F2F5F1] cursor-pointer"
            aria-label="Toggle agriculture menu"
          >
            {mobileRailOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
          <a
            href="#top"
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#111814] whitespace-nowrap shrink-0"
          >
            <AgronLogo5D size={36} mood={headerLogoMood} />
            <span>Agron · ರೈತ ಮಿತ್ರ</span>
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-6 h-full">
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = language === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLanguage(opt.id)}
                className={`relative h-full inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'text-[#111814]'
                    : 'text-[#5E6A62] hover:text-[#141A16]'
                }`}
              >
                <span>{opt.label}</span>
                {active && (
                  <motion.span
                    layoutId={prefersReduced ? undefined : 'langActiveBar'}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#166534]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAutoAudio((v) => !v)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              autoAudio
                ? 'bg-[#166534] hover:bg-[#14532D] text-white'
                : 'bg-[#ECEEEB] hover:bg-[#DFE3DE] text-[#141A16]'
            }`}
          >
            {autoAudio ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span>
              {isEn
                ? `Audio Chat: ${autoAudio ? 'ON' : 'OFF'}`
                : `ಧ್ವನಿ ಚಾಟ್: ${autoAudio ? 'ON' : 'OFF'}`}
            </span>
          </button>

          {authUser ? (
            <button
              type="button"
              onClick={() => {
                stopAudioPlayback();
                void signOutUser();
              }}
              title={authUser.email || 'Sign out'}
              className="px-3 py-2 rounded-lg border border-[#DCE2DC] bg-[#FAFBF9] hover:bg-[#FEF2F2] hover:border-[#FECACA] text-xs font-medium text-[#3B473F] hover:text-[#991B1B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isEn ? 'Logout' : 'ಲಾಗ್ ಔಟ್'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setGuestMode(false)}
              className="px-3 py-2 rounded-lg border border-[#166534] bg-[#EEF4EE] hover:bg-[#DFECE0] text-xs font-semibold text-[#166534] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isEn ? 'Login' : 'ಲಾಗಿನ್'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Workspace & Language Bar */}
      <div className="lg:hidden bg-white border-b border-[#E2E5E0] px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setWorkspaceTab('chat')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
              workspaceTab === 'chat'
                ? 'bg-[#166534] text-white'
                : 'text-[#5E6A62]'
            }`}
          >
            {isEn ? 'Chat' : 'ಚಾಟ್'}
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('krishi-care')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
              workspaceTab === 'krishi-care'
                ? 'bg-[#166534] text-white'
                : 'text-[#5E6A62]'
            }`}
          >
            {isEn ? 'Krishi Care' : 'ಕೃಷಿ ಆರೈಕೆ'}
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('market')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
              workspaceTab === 'market'
                ? 'bg-[#166534] text-white'
                : 'text-[#5E6A62]'
            }`}
          >
            {isEn ? 'Live Market' : 'ಮಾರುಕಟ್ಟೆ'}
          </button>
          <button
            type="button"
            onClick={() => setMobileRailOpen(true)}
            className="px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer text-[#166534] bg-[#EEF4EE] inline-flex items-center gap-1"
          >
            <History className="w-3 h-3" />
            <span>{isEn ? 'History' : 'ಹಿಂದಿನ ಚಾಟ್'}</span>
          </button>
        </div>
        <div className="md:hidden flex items-center gap-1 shrink-0">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLanguage(opt.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                language === opt.id
                  ? 'bg-[#13221A] text-white'
                  : 'text-[#5E6A62]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Sidebar Rail: Workspace Tabs (AI Chat / Krishi Care / Live Market) + Agriculture Sectors */}
        <aside
          className={`${
            mobileRailOpen
              ? 'fixed inset-y-14 left-0 z-40 w-72 shadow-lg'
              : 'hidden lg:flex lg:w-72'
          } bg-white border-r border-[#E2E5E0] flex-col shrink-0 overflow-y-auto`}
        >
          <div className="p-4 space-y-5">
            {/* Farmer Account Cloud Status */}
            <div className="rounded-xl border border-[#DCE8DC] bg-[#F7FAF7] p-3 flex items-center justify-between gap-2.5">
              {authUser ? (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {authUser.photoURL ? (
                      <img
                        src={authUser.photoURL}
                        alt={authUser.displayName || 'Farmer'}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-[#C6DCC6] shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#166534] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {(authUser.displayName || authUser.email || 'F')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#111814] truncate">
                        {authUser.displayName || authUser.email}
                      </div>
                      <div className="text-[10px] text-[#166534] inline-flex items-center gap-1 font-medium">
                        <Cloud className="w-3 h-3" />
                        <span>
                          {isEn ? 'Firebase Cloud Synced' : 'ಕ್ಲೌಡ್ ಸೇವ್ ಸಕ್ರಿಯ'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="text-[11px] text-[#4F5B53]">
                    {isEn ? 'Guest Mode (Local only)' : 'ಅತಿಥಿ ಮೋಡ್ (ಸ್ಥಳೀಯ ಸೇವ್)'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuestMode(false)}
                    className="px-2.5 py-1 rounded-md bg-[#166534] text-white text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    {isEn ? 'Login' : 'ಲಾಗಿನ್'}
                  </button>
                </div>
              )}
            </div>

            {/* Primary Workspace Switch */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#647068] mb-2">
                {isEn ? 'Workspace' : 'ವಿಭಾಗ'}
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('chat');
                    setMobileRailOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer ${
                    workspaceTab === 'chat'
                      ? 'bg-[#166534] text-white'
                      : 'text-[#3B473F] hover:bg-[#F2F5F1]'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>
                    {isEn ? 'AI Farm Advisor' : 'ಕೃಷಿ ಸಲಹೆಗಾರ (AI Chat)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('krishi-care');
                    setMobileRailOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer ${
                    workspaceTab === 'krishi-care'
                      ? 'bg-[#166534] text-white'
                      : 'text-[#3B473F] hover:bg-[#F2F5F1]'
                  }`}
                >
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  <span>
                    {isEn
                      ? 'Krishi Care & Weather'
                      : 'ಕೃಷಿ ಕ್ಯಾಲೆಂಡರ್ ಮತ್ತು ಹವಾಮಾನ'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('market');
                    setMobileRailOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer ${
                    workspaceTab === 'market'
                      ? 'bg-[#166534] text-white'
                      : 'text-[#3B473F] hover:bg-[#F2F5F1]'
                  }`}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>
                    {isEn
                      ? 'Live Market (State/Taluk)'
                      : 'ಇಂದಿನ ಮಾರುಕಟ್ಟೆ (ರಾಜ್ಯ/ತಾಲೂಕು)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Gemini-Style Chat History Menu */}
            <div className="border-t border-[#E6E9E4] pt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#647068] inline-flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Chat History' : 'ಹಿಂದಿನ ಚಾಟ್‌ಗಳು'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="px-2 py-1 rounded-md bg-[#EEF4EE] hover:bg-[#DFECE0] text-[#166534] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isEn ? 'New Chat' : 'ಹೊಸ ಚಾಟ್'}</span>
                </button>
              </div>

              {threads.length === 0 ? (
                <p className="text-xs text-[#647068] leading-relaxed px-1 py-1">
                  {isEn
                    ? 'Your previous farming questions auto-save here.'
                    : 'ನಿಮ್ಮ ಹಿಂದಿನ ಕೃಷಿ ಪ್ರಶ್ನೆಗಳು ಇಲ್ಲಿ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸೇವ್ ಆಗುತ್ತವೆ.'}
                </p>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                  {threads.map((thread) => {
                    const isCurrent =
                      workspaceTab === 'chat' && activeThreadId === thread.id;
                    return (
                      <div
                        key={thread.id}
                        className={`group flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 transition-colors ${
                          isCurrent
                            ? 'bg-[#EEF4EE] border-[#86EFAC] text-[#133A1D]'
                            : 'bg-[#FAFBF9] border-transparent hover:bg-[#F2F5F1] text-[#3B473F]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectThread(thread)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="text-xs font-medium truncate">
                            {thread.title}
                          </div>
                          <div className="text-[10px] text-[#647068] font-mono tabular-nums mt-0.5">
                            {new Date(thread.updatedAt).toLocaleDateString()} ·{' '}
                            {thread.messages.length}{' '}
                            {isEn ? 'msgs' : 'ಸಂದೇಶ'}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteThread(thread.id)}
                          aria-label={isEn ? 'Delete chat' : 'ಚಾಟ್ ಅಳಿಸಿ'}
                          className="p-1 rounded text-[#7C8780] hover:text-[#B91C1C] hover:bg-white/70 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Agriculture Sectors with Title-Matched Visuals */}
            <div className="border-t border-[#E6E9E4] pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#647068] mb-2">
                {isEn ? 'Agriculture Sectors' : 'ಕೃಷಿ ವಿಭಾಗಗಳು'}
              </div>
              <div className="space-y-2">
                {AGRI_SECTORS.map((s) => {
                  const active = workspaceTab === 'chat' && sector === s.id;
                  return (
                    <motion.button
                      key={s.id}
                      type="button"
                      whileHover={prefersReduced ? undefined : { x: 3 }}
                      whileTap={prefersReduced ? undefined : { scale: 0.985 }}
                      transition={{ duration: 0.14 }}
                      onClick={() => {
                        setSector(s.id);
                        setWorkspaceTab('chat');
                        setMobileRailOpen(false);
                      }}
                      className={`w-full text-left p-1.5 rounded-lg border transition-colors flex items-center gap-2.5 cursor-pointer ${
                        active
                          ? 'bg-[#13221A] border-[#13221A] text-white'
                          : 'bg-[#FAFBF9] border-[#E6E9E4] text-[#3B473F] hover:bg-[#F2F5F1]'
                      }`}
                    >
                      <img
                        src={SECTOR_TITLE_IMAGES[s.id]}
                        alt={isEn ? s.labelEn : s.labelKn}
                        referrerPolicy="no-referrer"
                        className="w-12 h-9 rounded object-cover shrink-0 bg-[#E4EAE3]"
                      />
                      <span className="text-xs font-medium leading-snug line-clamp-2">
                        {isEn ? s.labelEn : s.labelKn}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 p-4 lg:p-5 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={workspaceTab}
              initial={prefersReduced ? false : { opacity: 0, y: 8, scale: 0.994 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReduced ? undefined : { opacity: 0, y: -6, scale: 0.996 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              {workspaceTab === 'market' ? (
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center bg-white border border-[#E2E5E0] rounded-xl text-sm text-[#5E6A62]">
                      {isEn ? 'Loading Live Market...' : 'ಮಾರುಕಟ್ಟೆ ವಿವರ ಲೋಡ್ ಆಗುತ್ತಿದೆ...'}
                    </div>
                  }
                >
                  <MarketPanel
                    language={language}
                    initialQuery={marketHandoff}
                    onAskInChat={(prompt) => {
                      void handleSendMessage(prompt, []);
                    }}
                  />
                </Suspense>
              ) : workspaceTab === 'krishi-care' ? (
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center bg-white border border-[#E2E5E0] rounded-xl text-sm text-[#5E6A62]">
                      {isEn ? 'Loading Krishi Care...' : 'ಕೃಷಿ ಕ್ಯಾಲೆಂಡರ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ...'}
                    </div>
                  }
                >
                  <KrishiCarePanel
                    language={language}
                    farmingMode={farmingMode}
                    userId={authUser?.uid ?? null}
                    onChangeFarmingMode={setFarmingMode}
                    onSendToMarket={(payload) => {
                      setMarketHandoff({
                        ...payload,
                        autoFetchKey: Date.now(),
                      });
                      setWorkspaceTab('market');
                    }}
                  />
                </Suspense>
              ) : (
                <ChatPanel
                  sector={sector}
                  language={language}
                  farmingMode={farmingMode}
                  autoAudio={autoAudio}
                  messages={messages}
                  isSending={isSending}
                  speakingMsgId={speakingMsgId}
                  isSpeakingAudio={isSpeakingAudio}
                  onChangeFarmingMode={setFarmingMode}
                  onEnsureAutoAudio={() => setAutoAudio(true)}
                  onUnlockAudio={unlockAudioPlayback}
                  onSendMessage={handleSendMessage}
                  onRetryMessage={handleRetryMessage}
                  onSpeakMessage={handleSpeakMessage}
                  onStopSpeaking={stopAudioPlayback}
                  onClearChat={handleStartNewChat}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
