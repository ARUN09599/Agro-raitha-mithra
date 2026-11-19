import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { speakMaleBrowserFallback } from '../utils/speakFallback.ts';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  CloudRain,
  Droplets,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Sprout,
  Thermometer,
  Trash2,
  Truck,
  Volume2,
  Wind,
  X,
} from 'lucide-react';
import type {
  CropStage,
  DailyCropLogEntry,
  FarmingMode,
  KrishiCropItem,
  LanguageMode,
  LiveWeatherData,
} from '../types.ts';
import { INDIA_MARKET_LOCATIONS } from '../constants/locations.ts';
import { FARMING_MODE_OPTIONS } from '../constants/sectors.ts';
import { compressImageFile } from '../utils/compressImage.ts';
import {
  deleteCropFromFirestore,
  saveCropToFirestore,
  subscribeUserCrops,
} from '../firebase.ts';
import {
  LiveCropScanner,
  type ScannedPhotoPayload,
} from './LiveCropScanner.tsx';

const KRISHI_CARE_STORAGE_KEY = 'agron_krishi_care_crops_v1';

interface SendToMarketPayload {
  state: string;
  district: string;
  taluk: string;
  commodity: string;
}

interface KrishiCarePanelProps {
  language: LanguageMode;
  farmingMode: FarmingMode;
  userId?: string | null;
  onChangeFarmingMode: (mode: FarmingMode) => void;
  onSendToMarket: (payload: SendToMarketPayload) => void;
}

const STAGE_LABELS: Record<CropStage, { kn: string; en: string }> = {
  sowing: { kn: 'ಬಿತ್ತನೆ / ನಾಟಿ', en: 'Sowing' },
  growing: { kn: 'ಬೆಳವಣಿಗೆ ಹಂತ', en: 'Growing' },
  flowering: { kn: 'ಹೂವು / ಕಾಯಿ ಹಂತ', en: 'Flowering / Fruiting' },
  'cutting-ready': { kn: 'ಕಟಾವಿಗೆ ಸಿದ್ಧ (Final)', en: 'Cutting Ready (Final)' },
  'sent-to-market': { kn: 'ಮಾರುಕಟ್ಟೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ', en: 'Sent to Market' },
};

const QUICK_CROPS = [
  { value: 'Tomato', kn: 'ಟೊಮೇಟೊ', en: 'Tomato' },
  { value: 'Ragi (Finger Millet)', kn: 'ರಾಗಿ', en: 'Ragi' },
  { value: 'Paddy (Dhan)', kn: 'ಭತ್ತ', en: 'Paddy' },
  { value: 'Onion', kn: 'ಈರುಳ್ಳಿ', en: 'Onion' },
  { value: 'Maize', kn: 'ಮೆಕ್ಕೆಜೋಳ', en: 'Maize' },
  { value: 'Arecanut (Betel Nut)', kn: 'ಅಡಿಕೆ', en: 'Arecanut' },
  { value: 'Banana', kn: 'ಬಾಳೆಹಣ್ಣು', en: 'Banana' },
  { value: 'Groundnut', kn: 'ಶೇಂಗಾ', en: 'Groundnut' },
];

function todayIsoDate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function daysAgoIsoDate(days: number): string {
  const now = new Date(Date.now() - days * 86400000);
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function computeDayNumber(sowingDate: string): number {
  const start = new Date(`${sowingDate}T00:00:00`).getTime();
  if (Number.isNaN(start)) return 1;
  const diffDays = Math.floor((Date.now() - start) / 86400000) + 1;
  return Math.max(1, diffDays);
}

function loadSavedCrops(): KrishiCropItem[] {
  try {
    const raw = localStorage.getItem(KRISHI_CARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KrishiCropItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const KrishiCarePanel: React.FC<KrishiCarePanelProps> = ({
  language,
  farmingMode,
  userId,
  onChangeFarmingMode,
  onSendToMarket,
}) => {
  const isEn = language === 'en';
  const prefersReduced = useReducedMotion();

  const [crops, setCrops] = useState<KrishiCropItem[]>(loadSavedCrops);
  const [selectedCropId, setSelectedCropId] = useState<string>(
    () => loadSavedCrops()[0]?.id ?? ''
  );
  const [showAddForm, setShowAddForm] = useState<boolean>(
    () => loadSavedCrops().length === 0
  );

  // Weather location (tracks active crop location or defaults to Bengaluru Urban)
  const [weatherState, setWeatherState] = useState<string>('Karnataka');
  const [weatherDistrict, setWeatherDistrict] =
    useState<string>('Bengaluru Urban');
  const [weatherTaluk, setWeatherTaluk] =
    useState<string>('Yeshwanthpur APMC');
  const [weather, setWeather] = useState<LiveWeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Add new crop form state
  const [newCropName, setNewCropName] = useState<string>('Tomato');
  const [newSowingDate, setNewSowingDate] = useState<string>(() =>
    daysAgoIsoDate(25)
  );
  const [newStage, setNewStage] = useState<CropStage>('growing');
  const [newState, setNewState] = useState<string>('Karnataka');
  const [newDistrict, setNewDistrict] = useState<string>('Bengaluru Urban');
  const [newTaluk, setNewTaluk] = useState<string>('Yeshwanthpur APMC');

  // Daily update & live scan state
  const [changesObserved, setChangesObserved] = useState<string>('');
  const [problemObserved, setProblemObserved] = useState<string>('');
  const [photoAttachment, setPhotoAttachment] =
    useState<ScannedPhotoPayload | null>(null);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Audio playback for latest guidance
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [audioUrlMap, setAudioUrlMap] = useState<Record<string, string>>({});

  const activeCrop = useMemo(
    () => crops.find((c) => c.id === selectedCropId) ?? crops[0] ?? null,
    [crops, selectedCropId]
  );

  useEffect(() => {
    try {
      // Keep up to 12 photo thumbnails per crop to stay lightweight on village devices
      const compactCrops = crops.map((crop) => ({
        ...crop,
        logs: crop.logs.slice(0, 30).map((log, idx) =>
          idx < 12 ? log : { ...log, photoThumbUrl: undefined }
        ),
      }));
      localStorage.setItem(KRISHI_CARE_STORAGE_KEY, JSON.stringify(compactCrops));
    } catch {
      // Ignore storage limit
    }
  }, [crops]);

  useEffect(() => {
    if (!userId) return;
    let migratedLocal = false;
    const unsubscribe = subscribeUserCrops(
      userId,
      (cloudCrops) => {
        if (cloudCrops.length === 0 && !migratedLocal) {
          migratedLocal = true;
          const localSeed = loadSavedCrops();
          if (localSeed.length > 0) {
            for (const c of localSeed.slice(0, 8)) {
              void saveCropToFirestore(userId, c).catch(() => {});
            }
            return;
          }
        }
        setCrops(cloudCrops);
        if (cloudCrops.length > 0) {
          setSelectedCropId((prev) =>
            cloudCrops.some((c) => c.id === prev) ? prev : cloudCrops[0].id
          );
          setShowAddForm(false);
        } else {
          setSelectedCropId('');
          setShowAddForm(true);
        }
      },
      () => {}
    );
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (activeCrop) {
      setWeatherState(activeCrop.state);
      setWeatherDistrict(activeCrop.district);
      setWeatherTaluk(activeCrop.taluk);
    }
  }, [activeCrop?.id, activeCrop?.state, activeCrop?.district, activeCrop?.taluk]);

  const fetchWeather = async (
    stateName: string,
    districtName: string,
    talukName: string
  ) => {
    const cacheKey = `agron_wx_${stateName}_${districtName}_${talukName}`.toLowerCase();
    try {
      const cachedRaw = sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as {
          ts: number;
          data: LiveWeatherData;
        };
        if (Date.now() - parsed.ts < 5 * 60 * 1000 && parsed.data?.ok) {
          setWeather(parsed.data);
          setWeatherError(null);
          return;
        }
      }
    } catch {
      // Ignore cache error
    }

    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const res = await fetch('/api/weather/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: stateName,
          district: districtName,
          taluk: talukName,
        }),
      });
      const data = (await res.json()) as LiveWeatherData & { error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Could not load weather.');
      }
      setWeather(data);
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ ts: Date.now(), data })
        );
      } catch {
        // Ignore quota error
      }
    } catch (err) {
      setWeatherError(
        err instanceof Error ? err.message : 'Weather unavailable right now.'
      );
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    void fetchWeather(weatherState, weatherDistrict, weatherTaluk);
  }, [weatherState, weatherDistrict, weatherTaluk]);

  // Location helpers for weather picker & new crop picker
  const weatherStateObj = useMemo(
    () =>
      INDIA_MARKET_LOCATIONS.find((s) => s.state === weatherState) ??
      INDIA_MARKET_LOCATIONS[0],
    [weatherState]
  );
  const weatherDistricts = useMemo(
    () => Object.keys(weatherStateObj.districts),
    [weatherStateObj]
  );
  const weatherTaluks = useMemo(
    () => weatherStateObj.districts[weatherDistrict] ?? [],
    [weatherStateObj, weatherDistrict]
  );

  const newCropStateObj = useMemo(
    () =>
      INDIA_MARKET_LOCATIONS.find((s) => s.state === newState) ??
      INDIA_MARKET_LOCATIONS[0],
    [newState]
  );
  const newCropDistricts = useMemo(
    () => Object.keys(newCropStateObj.districts),
    [newCropStateObj]
  );
  const newCropTaluks = useMemo(
    () => newCropStateObj.districts[newDistrict] ?? [],
    [newCropStateObj, newDistrict]
  );

  const handleAddCrop = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCropName.trim();
    if (!trimmedName) return;

    const item: KrishiCropItem = {
      id: `crop_${Date.now()}`,
      cropName: trimmedName,
      sowingDate: newSowingDate || todayIsoDate(),
      state: newState,
      district: newDistrict,
      taluk: newTaluk || newDistrict,
      stage: newStage,
      logs: [],
    };
    setCrops((prev) => [item, ...prev]);
    setSelectedCropId(item.id);
    setShowAddForm(false);
    if (userId) {
      void saveCropToFirestore(userId, item).catch(() => {});
    }
  };

  const handleUpdateStage = (cropId: string, stage: CropStage) => {
    let targetCrop: KrishiCropItem | null = null;
    setCrops((prev) =>
      prev.map((c) => {
        if (c.id !== cropId) return c;
        targetCrop = { ...c, stage };
        return targetCrop;
      })
    );
    if (userId && targetCrop) {
      void saveCropToFirestore(userId, targetCrop).catch(() => {});
    }
  };

  const handleRemoveCrop = (cropId: string) => {
    setCrops((prev) => {
      const next = prev.filter((c) => c.id !== cropId);
      if (selectedCropId === cropId) {
        setSelectedCropId(next[0]?.id ?? '');
      }
      if (next.length === 0) {
        setShowAddForm(true);
      }
      return next;
    });
    if (userId) {
      void deleteCropFromFirestore(userId, cropId).catch(() => {});
    }
  };

  const handleFinishCuttingAndSendToMarket = (crop: KrishiCropItem) => {
    const payload: SendToMarketPayload = {
      state: crop.state,
      district: crop.district,
      taluk: crop.taluk,
      commodity: crop.cropName,
    };
    handleRemoveCrop(crop.id);
    onSendToMarket(payload);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const compressed = await compressImageFile(file);
    setPhotoAttachment({
      name: file.name,
      mimeType: compressed.mimeType,
      dataBase64: compressed.dataBase64,
      previewUrl: compressed.previewUrl,
      thumbUrl: compressed.thumbUrl,
      source: 'upload',
    });
    e.target.value = '';
  };

  const runDailyAnalysis = async (overridePhoto?: ScannedPhotoPayload | null) => {
    if (!activeCrop || analyzing) return;
    const targetPhoto =
      overridePhoto !== undefined ? overridePhoto : photoAttachment;

    setAnalyzing(true);
    setAnalyzeError(null);

    const dayNumber = computeDayNumber(activeCrop.sowingDate);

    try {
      const res = await fetch('/api/krishi-care/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cropName: activeCrop.cropName,
          dayNumber,
          stage: activeCrop.stage,
          state: activeCrop.state,
          district: activeCrop.district,
          taluk: activeCrop.taluk,
          changesObserved:
            changesObserved.trim() ||
            (targetPhoto
              ? isEn
                ? 'Daily photo scan submitted for stage & health check'
                : 'ಹಂತ ಮತ್ತು ಆರೋಗ್ಯ ಪರೀಕ್ಷೆಗೆ ದೈನಂದಿನ ಫೋಟೋ ಸ್ಕ್ಯಾನ್'
              : isEn
              ? 'Routine daily check'
              : 'ದೈನಂದಿನ ಬೆಳವಣಿಗೆ ಪರಿಶೀಲನೆ'),
          problemObserved: problemObserved.trim(),
          previousLogs: activeCrop.logs.slice(0, 3),
          weather,
          farmingMode,
          language,
          attachment: targetPhoto
            ? {
                mimeType: targetPhoto.mimeType,
                dataBase64: targetPhoto.dataBase64,
              }
            : null,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        detectedStage?: CropStage;
        stageLabel?: string;
        diseaseName?: string;
        healthStatus?: 'healthy' | 'warning' | 'critical';
        daysToHarvest?: number;
        recoveryDays?: number;
        solutionSummary?: string;
        guidance?: string;
        weatherNote?: string;
        error?: string;
      };
      if (!res.ok || !data.guidance) {
        throw new Error(data.error || 'Could not analyze daily update.');
      }

      const detectedStage = data.detectedStage ?? activeCrop.stage;
      const newEntry: DailyCropLogEntry = {
        id: `log_${Date.now()}`,
        date: todayIsoDate(),
        dayNumber,
        changesObserved:
          changesObserved.trim() ||
          (targetPhoto
            ? isEn
              ? 'Daily photo scan'
              : 'ದೈನಂದಿನ ಫೋಟೋ ಸ್ಕ್ಯಾನ್'
            : isEn
            ? 'Routine daily check'
            : 'ದೈನಂದಿನ ಪರಿಶೀಲನೆ'),
        problemObserved:
          problemObserved.trim() ||
          data.diseaseName ||
          (isEn ? 'None' : 'ಯಾವುದೇ ಸಮಸ್ಯೆ ಇಲ್ಲ'),
        aiGuidance: data.guidance,
        weatherNote: data.weatherNote,
        detectedStage,
        stageLabel: data.stageLabel,
        diseaseName: data.diseaseName,
        healthStatus: data.healthStatus,
        daysToHarvest: data.daysToHarvest,
        recoveryDays: data.recoveryDays,
        solutionSummary: data.solutionSummary,
        photoThumbUrl: targetPhoto?.thumbUrl,
        scanSource: targetPhoto ? targetPhoto.source : 'manual',
      };

      const updatedCrop: KrishiCropItem = {
        ...activeCrop,
        stage: detectedStage,
        logs: [newEntry, ...activeCrop.logs],
      };
      setCrops((prev) =>
        prev.map((c) => (c.id === activeCrop.id ? updatedCrop : c))
      );
      if (userId) {
        void saveCropToFirestore(userId, updatedCrop).catch(() => {});
      }
      setChangesObserved('');
      setProblemObserved('');
      setPhotoAttachment(null);
    } catch (err) {
      setAnalyzeError(
        err instanceof Error
          ? err.message
          : 'Error analyzing daily update. Please try again.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitDailyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await runDailyAnalysis();
  };

  const handleScanCaptured = (
    payload: ScannedPhotoPayload,
    autoAnalyze: boolean
  ) => {
    setPhotoAttachment(payload);
    if (autoAnalyze) {
      void runDailyAnalysis(payload);
    }
  };

  const handleSpeakGuidance = async (logId: string, text: string) => {
    if (!text.trim() || audioLoadingId) return;
    setAudioLoadingId(logId);
    try {
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        audioDataUrl?: string;
        spokenScript?: string;
      };
      if (data.audioDataUrl) {
        setAudioUrlMap((prev) => ({ ...prev, [logId]: data.audioDataUrl! }));
        const audio = new Audio(data.audioDataUrl);
        void audio.play().catch(() => {});
      } else {
        speakMaleBrowserFallback(data.spokenScript || text, isEn);
      }
    } finally {
      setAudioLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[#E2E5E0] rounded-xl overflow-hidden">
      {/* Header Bar */}
      <div className="border-b border-[#E2E5E0] bg-[#FAFBF9] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#166534]" />
          <h2 className="text-sm font-semibold text-[#141A16]">
            {isEn
              ? 'Krishi Care Calendar, Daily Updates & Live Weather'
              : 'ಕೃಷಿ ಕ್ಯಾಲೆಂಡರ್, ದೈನಂದಿನ ಆರೈಕೆ ಮತ್ತು ಹವಾಮಾನ'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEn ? 'Add Crop' : 'ಹೊಸ ಬೆಳೆ ಸೇರಿಸಿ'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Live Weather Section */}
        <section className="border border-[#E2E5E0] bg-[#FAFBF9] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-[#166534]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#141A16]">
                {isEn
                  ? 'Live Local Weather & Spray Advisory'
                  : 'ಇಂದಿನ ಹವಾಮಾನ ಮತ್ತು 5 ದಿನದ ಮುನ್ಸೂಚನೆ'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={weatherState}
                onChange={(e) => {
                  const st = e.target.value;
                  setWeatherState(st);
                  const entry =
                    INDIA_MARKET_LOCATIONS.find((s) => s.state === st) ??
                    INDIA_MARKET_LOCATIONS[0];
                  const dist = Object.keys(entry.districts)[0] ?? '';
                  const tal = entry.districts[dist]?.[0] ?? '';
                  setWeatherDistrict(dist);
                  setWeatherTaluk(tal);
                }}
                className="h-8 rounded-md border border-[#D4DAD4] bg-white px-2 text-xs text-[#141A16]"
              >
                {INDIA_MARKET_LOCATIONS.map((s) => (
                  <option key={s.state} value={s.state}>
                    {s.state}
                  </option>
                ))}
              </select>

              <select
                value={weatherDistrict}
                onChange={(e) => {
                  const d = e.target.value;
                  setWeatherDistrict(d);
                  setWeatherTaluk(weatherStateObj.districts[d]?.[0] ?? '');
                }}
                className="h-8 rounded-md border border-[#D4DAD4] bg-white px-2 text-xs text-[#141A16]"
              >
                {weatherDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={weatherTaluk}
                onChange={(e) => setWeatherTaluk(e.target.value)}
                className="h-8 rounded-md border border-[#D4DAD4] bg-white px-2 text-xs text-[#141A16]"
              >
                {weatherTaluks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  void fetchWeather(weatherState, weatherDistrict, weatherTaluk)
                }
                disabled={weatherLoading}
                className="h-8 px-2.5 rounded-md border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-xs font-medium text-[#141A16] inline-flex items-center gap-1 cursor-pointer"
              >
                {weatherLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-[#166534]" />
                )}
                <span>{isEn ? 'Refresh' : 'ನವೀಕರಿಸಿ'}</span>
              </button>
            </div>
          </div>

          {weatherError && (
            <div className="text-xs text-[#991B1B]">{weatherError}</div>
          )}

          {weather && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    icon: <Thermometer className="w-3.5 h-3.5 text-[#166534]" />,
                    label: isEn ? 'Temperature' : 'ತಾಪಮಾನ',
                    value: `${weather.currentTempC}°C`,
                  },
                  {
                    icon: <Droplets className="w-3.5 h-3.5 text-[#166534]" />,
                    label: isEn ? 'Humidity' : 'ತೇವಾಂಶ',
                    value: `${weather.humidityPct}%`,
                  },
                  {
                    icon: <CloudRain className="w-3.5 h-3.5 text-[#166534]" />,
                    label: isEn ? 'Current Rain' : 'ಇಂದಿನ ಮಳೆ',
                    value: `${weather.precipMm} mm`,
                  },
                  {
                    icon: <Wind className="w-3.5 h-3.5 text-[#166534]" />,
                    label: isEn ? 'Wind Speed' : 'ಗಾಳಿ ವೇಗ',
                    value: `${weather.windKmh} km/h`,
                  },
                ].map((metric, idx) => (
                  <motion.div
                    key={metric.label}
                    initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={prefersReduced ? undefined : { y: -2 }}
                    transition={{
                      duration: 0.2,
                      delay: idx * 0.04,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="bg-white border border-[#E2E5E0] rounded-lg px-3 py-2.5"
                  >
                    <div className="text-[11px] text-[#5E6A62] flex items-center gap-1">
                      {metric.icon}
                      {metric.label}
                    </div>
                    <div className="text-lg font-bold font-mono tabular-nums text-[#111814] mt-0.5">
                      {metric.value}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-[#EEF4EE] border border-[#C6DCC6] rounded-lg px-3.5 py-2 text-xs text-[#133A1D]">
                <span className="font-semibold">
                  {weather.locationLabel}:{' '}
                </span>
                {weather.weatherSummary}
              </div>

              {weather.daily.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {weather.daily.map((day, idx) => (
                    <motion.div
                      key={day.date}
                      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.18,
                        delay: idx * 0.035,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="bg-white border border-[#E6E9E4] rounded-lg px-2.5 py-2 text-xs"
                    >
                      <div className="font-mono tabular-nums font-medium text-[#141A16]">
                        {day.date.slice(5)}
                      </div>
                      <div className="font-mono tabular-nums text-[#3B473F] mt-0.5">
                        {day.tempMin}°–{day.tempMax}°C
                      </div>
                      <div className="font-mono tabular-nums text-[11px] text-[#166534]">
                        {isEn ? 'Rain:' : 'ಮಳೆ:'} {day.precipProb}% ({day.precipMm}mm)
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Add Crop Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddCrop}
            className="border border-[#C6DCC6] bg-[#F7FAF7] rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111814]">
                <Sprout className="w-4 h-4 text-[#166534]" />
                <span>
                  {isEn
                    ? 'Start Daily Tracking for a Crop'
                    : 'ನಿಮ್ಮ ಹೊಲದ ಬೆಳೆಯನ್ನು ಸೇರಿಸಿ (ದೈನಂದಿನ ಟ್ರ್ಯಾಕಿಂಗ್)'}
                </span>
              </div>
              {crops.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="p-1 text-[#5E6A62] hover:text-[#141A16] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_CROPS.map((qc) => (
                <button
                  key={qc.value}
                  type="button"
                  onClick={() => setNewCropName(qc.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer ${
                    newCropName === qc.value
                      ? 'bg-[#166534] border-[#166534] text-white'
                      : 'bg-white border-[#D4DAD4] text-[#3B473F] hover:bg-[#F1F4EF]'
                  }`}
                >
                  {isEn ? qc.en : qc.kn}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                  {isEn ? 'Crop Name' : 'ಬೆಳೆ ಹೆಸರು'}
                </label>
                <input
                  type="text"
                  required
                  value={newCropName}
                  onChange={(e) => setNewCropName(e.target.value)}
                  placeholder={isEn ? 'e.g., Tomato, Ragi, Paddy' : 'ಉದಾ: ಟೊಮೇಟೊ, ರಾಗಿ'}
                  className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                  {isEn ? 'Sowing / Planting Date' : 'ಬಿತ್ತನೆ / ನಾಟಿ ದಿನಾಂಕ'}
                </label>
                <input
                  type="date"
                  required
                  value={newSowingDate}
                  max={todayIsoDate()}
                  onChange={(e) => setNewSowingDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm font-mono tabular-nums text-[#141A16]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                  {isEn ? 'Current Stage' : 'ಪ್ರಸ್ತುತ ಹಂತ'}
                </label>
                <select
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value as CropStage)}
                  className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16]"
                >
                  {(['sowing', 'growing', 'flowering', 'cutting-ready'] as CropStage[]).map(
                    (st) => (
                      <option key={st} value={st}>
                        {isEn ? STAGE_LABELS[st].en : STAGE_LABELS[st].kn}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                  {isEn ? 'State' : 'ರಾಜ್ಯ'}
                </label>
                <select
                  value={newState}
                  onChange={(e) => {
                    const st = e.target.value;
                    setNewState(st);
                    const entry =
                      INDIA_MARKET_LOCATIONS.find((s) => s.state === st) ??
                      INDIA_MARKET_LOCATIONS[0];
                    const dist = Object.keys(entry.districts)[0] ?? '';
                    const tal = entry.districts[dist]?.[0] ?? '';
                    setNewDistrict(dist);
                    setNewTaluk(tal);
                  }}
                  className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16]"
                >
                  {INDIA_MARKET_LOCATIONS.map((s) => (
                    <option key={s.state} value={s.state}>
                      {isEn ? s.state : s.labelKn ?? s.state}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                  {isEn ? 'District' : 'ಜಿಲ್ಲೆ'}
                </label>
                <select
                  value={newDistrict}
                  onChange={(e) => {
                    const d = e.target.value;
                    setNewDistrict(d);
                    setNewTaluk(newCropStateObj.districts[d]?.[0] ?? '');
                  }}
                  className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16]"
                >
                  {newCropDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                  {isEn ? 'Taluk / APMC' : 'ತಾಲೂಕು / ಎಪಿಎಂಸಿ'}
                </label>
                <select
                  value={newTaluk}
                  onChange={(e) => setNewTaluk(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16]"
                >
                  {newCropTaluks.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Save Crop' : 'ಬೆಳೆ ಉಳಿಸಿ'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Saved Crops Selector */}
        {crops.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {crops.map((crop) => {
              const active = activeCrop?.id === crop.id;
              const dayNum = computeDayNumber(crop.sowingDate);
              return (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => setSelectedCropId(crop.id)}
                  className={`px-3.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#13221A] border-[#13221A] text-white'
                      : 'bg-[#FAFBF9] border-[#E2E5E0] text-[#141A16] hover:bg-[#F1F4EF]'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-2">
                    <span>{crop.cropName}</span>
                    <span className="font-mono tabular-nums opacity-80">
                      {isEn ? `Day ${dayNum}` : `ದಿನ ${dayNum}`}
                    </span>
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      active ? 'text-[#C6DCC6]' : 'text-[#5E6A62]'
                    }`}
                  >
                    {crop.taluk} ·{' '}
                    {isEn
                      ? STAGE_LABELS[crop.stage].en
                      : STAGE_LABELS[crop.stage].kn}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Crop Daily Update & Cutting Workspace */}
        {activeCrop && (
          <div className="space-y-5">
            {/* Crop Status & Cutting / Send to Market Card */}
            <div className="border border-[#E2E5E0] rounded-xl p-4 bg-white space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-lg font-bold text-[#111814]">
                      {activeCrop.cropName}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#EEF4EE] text-[#166534] text-xs font-semibold font-mono tabular-nums">
                      {isEn
                        ? `Day ${computeDayNumber(activeCrop.sowingDate)}`
                        : `ದಿನ ${computeDayNumber(activeCrop.sowingDate)}`}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-[#F2F4F0] text-[#3B473F] text-xs font-medium">
                      {isEn
                        ? STAGE_LABELS[activeCrop.stage].en
                        : STAGE_LABELS[activeCrop.stage].kn}
                    </span>
                  </div>
                  <p className="text-xs text-[#5E6A62] mt-1 font-mono tabular-nums">
                    {isEn ? 'Sown:' : 'ಬಿತ್ತನೆ:'} {activeCrop.sowingDate} ·{' '}
                    {activeCrop.taluk}, {activeCrop.district},{' '}
                    {activeCrop.state}
                  </p>
                  {activeCrop.logs[0] && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {activeCrop.logs[0].diseaseName && (
                        <span
                          className={`px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${
                            activeCrop.logs[0].healthStatus === 'critical'
                              ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                              : activeCrop.logs[0].healthStatus === 'warning'
                              ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                              : 'bg-[#EEF4EE] text-[#166534] border border-[#C6DCC6]'
                          }`}
                        >
                          {activeCrop.logs[0].healthStatus === 'healthy' ? (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>{activeCrop.logs[0].diseaseName}</span>
                        </span>
                      )}
                      {typeof activeCrop.logs[0].daysToHarvest === 'number' && (
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F4F0] text-[#141A16] font-mono tabular-nums inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#166534]" />
                          <span>
                            {activeCrop.logs[0].daysToHarvest === 0
                              ? isEn
                                ? 'Ready for Cutting Now'
                                : 'ಈಗಲೇ ಕಟಾವಿಗೆ ಸಿದ್ಧ'
                              : isEn
                              ? `${activeCrop.logs[0].daysToHarvest} days to harvest`
                              : `ಕಟಾವಿಗೆ ${activeCrop.logs[0].daysToHarvest} ದಿನ`}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={activeCrop.stage}
                    onChange={(e) =>
                      handleUpdateStage(
                        activeCrop.id,
                        e.target.value as CropStage
                      )
                    }
                    className="h-9 rounded-lg border border-[#D4DAD4] bg-[#FAFBF9] px-2.5 text-xs font-medium text-[#141A16]"
                  >
                    {(
                      [
                        'sowing',
                        'growing',
                        'flowering',
                        'cutting-ready',
                      ] as CropStage[]
                    ).map((st) => (
                      <option key={st} value={st}>
                        {isEn ? STAGE_LABELS[st].en : STAGE_LABELS[st].kn}
                      </option>
                    ))}
                  </select>

                  {activeCrop.stage !== 'cutting-ready' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateStage(activeCrop.id, 'cutting-ready')
                      }
                      className="h-9 px-3 rounded-lg border border-[#166534] text-[#166534] hover:bg-[#EEF4EE] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>
                        {isEn ? 'Mark Ready for Cutting' : 'ಕಟಾವಿಗೆ ಸಿದ್ಧ ಮಾಡಿ'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveCrop(activeCrop.id)}
                    className="h-9 px-2.5 rounded-lg border border-[#E2E5E0] text-[#7A3030] hover:bg-[#FEF2F2] text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    title={isEn ? 'Delete crop' : 'ಬೆಳೆ ತೆಗೆದುಹಾಕಿ'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Final Cutting -> Remove & Send to Market Action Bar */}
              <div
                className={`rounded-lg border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                  activeCrop.stage === 'cutting-ready'
                    ? 'bg-[#EEF4EE] border-[#86EFAC]'
                    : 'bg-[#FAFBF9] border-[#E6E9E4]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      activeCrop.stage === 'cutting-ready'
                        ? 'text-[#166534]'
                        : 'text-[#5E6A62]'
                    }`}
                  />
                  <div className="text-xs text-[#1A221D]">
                    <div className="font-semibold">
                      {activeCrop.stage === 'cutting-ready'
                        ? isEn
                          ? 'Final Stage: Crop is Ready for Cutting & Market Sale'
                          : 'ಅಂತಿಮ ಹಂತ: ಬೆಳೆ ಕಟಾವಿಗೆ (Cutting) ಸಿದ್ಧವಾಗಿದೆ!'
                        : isEn
                        ? 'Finished Cutting / Ready to Harvest?'
                        : 'ಬೆಳೆ ಕಟಾವು (Cutting) ಮುಗಿದಿದೆಯೇ?'}
                    </div>
                    <div className="text-[#4F5B53] mt-0.5">
                      {isEn
                        ? 'Click below to remove this harvested batch from your active farm list and open live APMC Market rates.'
                        : 'ಕಟಾವು ಮುಗಿದ ಮೇಲೆ ಈ ಬೆಳೆಯನ್ನು ಇಲ್ಲಿಂದ ತೆಗೆದು ನೇರವಾಗಿ ಮಾರುಕಟ್ಟೆ ದರ ನೋಡಲು ಕಳುಹಿಸಿ.'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSendToMarket({
                        state: activeCrop.state,
                        district: activeCrop.district,
                        taluk: activeCrop.taluk,
                        commodity: activeCrop.cropName,
                      })
                    }
                    className="h-9 px-3 rounded-lg border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-xs font-medium text-[#141A16] cursor-pointer"
                  >
                    {isEn ? 'Check Live Rates First' : 'ಮೊದಲು ದರ ನೋಡಿ'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleFinishCuttingAndSendToMarket(activeCrop)
                    }
                    className="h-9 px-3.5 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>
                      {isEn
                        ? 'Finish Cutting & Send to Market'
                        : 'ಕಟಾವು ಮುಗಿಸಿ ಮಾರುಕಟ್ಟೆಗೆ ಕಳುಹಿಸಿ'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Photo Scan & Field Update Form */}
            <form
              onSubmit={handleSubmitDailyUpdate}
              className="border border-[#C6DCC6] bg-[#FAFBF9] rounded-xl p-4 space-y-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#141A16]">
                    {isEn
                      ? `Live Camera Scan & Daily Photo Tracking (Day ${computeDayNumber(activeCrop.sowingDate)})`
                      : `ಲೈವ್ ಕ್ಯಾಮೆರಾ ಸ್ಕ್ಯಾನ್ & ದೈನಂದಿನ ಫೋಟೋ ಟ್ರ್ಯಾಕಿಂಗ್ (ದಿನ ${computeDayNumber(activeCrop.sowingDate)})`}
                  </div>
                  <p className="text-[11px] text-[#5E6A62] mt-0.5">
                    {isEn
                      ? 'Scan live or upload daily photo — AI identifies crop stage, disease, solution & days remaining.'
                      : 'ಲೈವ್ ಕ್ಯಾಮೆರಾದಲ್ಲಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಅಥವಾ ದಿನದ ಫೋಟೋ ಹಾಕಿ — ಬೆಳೆ ಹಂತ, ರೋಗ, ಪರಿಹಾರ & ದಿನಗಳನ್ನು ತಕ್ಷಣ ತಿಳಿಯಿರಿ.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    disabled={analyzing}
                    className="h-9 px-3.5 rounded-lg bg-[#13221A] hover:bg-[#1E3529] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#86EFAC]" />
                    <span>
                      {isEn ? 'Open Live Camera' : 'ಲೈವ್ ಕ್ಯಾಮೆರಾ ಸ್ಕ್ಯಾನ್'}
                    </span>
                  </button>

                  <label className="h-9 px-3.5 rounded-lg border border-[#166534] bg-white hover:bg-[#EEF4EE] text-xs font-semibold text-[#166534] inline-flex items-center gap-1.5 cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    <span>
                      {isEn ? 'Upload Daily Photo' : 'ದೈನಂದಿನ ಫೋಟೋ ಹಾಕಿ'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {photoAttachment && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#86EFAC] rounded-xl p-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={photoAttachment.previewUrl}
                      alt={photoAttachment.name}
                      className="w-16 h-16 object-cover rounded-lg border border-[#E2E5E0] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#111814] truncate">
                        {photoAttachment.source === 'camera'
                          ? isEn
                            ? 'Live Camera Scan Ready'
                            : 'ಲೈವ್ ಕ್ಯಾಮೆರಾ ಫೋಟೋ ಸಿದ್ಧವಾಗಿದೆ'
                          : isEn
                          ? 'Daily Photo Attached'
                          : 'ದೈನಂದಿನ ಫೋಟೋ ಸೇರಿಸಲಾಗಿದೆ'}
                      </div>
                      <div className="text-[11px] text-[#5E6A62] truncate">
                        {photoAttachment.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => void runDailyAnalysis(photoAttachment)}
                      className="h-9 px-3.5 rounded-lg bg-[#166534] hover:bg-[#14532D] disabled:bg-[#9CA69F] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {analyzing && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      )}
                      <span>
                        {isEn
                          ? 'Scan Now (Stage, Disease & Days)'
                          : 'ಈಗಲೇ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoAttachment(null)}
                      className="p-1.5 rounded-lg text-[#5E6A62] hover:text-[#141A16] hover:bg-[#F1F4EF] cursor-pointer"
                      aria-label={isEn ? 'Remove photo' : 'ಫೋಟೋ ತೆಗೆಯಿರಿ'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#3B473F] mb-1">
                    {isEn
                      ? 'Changes Observed Today (optional if photo attached)'
                      : 'ಇಂದು ಬೆಳೆಯಲ್ಲಿ ಕಂಡ ಬದಲಾವಣೆಗಳು (ಐಚ್ಛಿಕ)'}
                  </label>
                  <textarea
                    rows={2}
                    value={changesObserved}
                    onChange={(e) => setChangesObserved(e.target.value)}
                    placeholder={
                      isEn
                        ? 'e.g., New flowers started, height grew, or leaves turning pale yellow...'
                        : 'ಉದಾ: ಹೊಸ ಹೂವು ಬರುತ್ತಿದೆ, ಎಲೆ ಸ್ವಲ್ಪ ಹಳದಿಯಾಗುತ್ತಿದೆ...'
                    }
                    className="w-full rounded-lg border border-[#D4DAD4] bg-white px-3 py-2 text-sm text-[#141A16] placeholder:text-[#7C8780] focus:outline-none focus:border-[#166534]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#3B473F] mb-1">
                    {isEn
                      ? 'Problem / Pest / Disease Observed (optional)'
                      : 'ಯಾವುದೇ ಸಮಸ್ಯೆ / ರೋಗ / ಹುಳು ಇದೆಯೇ?'}
                  </label>
                  <textarea
                    rows={2}
                    value={problemObserved}
                    onChange={(e) => setProblemObserved(e.target.value)}
                    placeholder={
                      isEn
                        ? 'e.g., Leaf curl, black spots, whitefly, fruit borer, or leave blank if scanning photo'
                        : 'ಉದಾ: ಎಲೆ ಮುರುಟು, ಕಪ್ಪು ಚುಕ್ಕೆ, ಬಿಳಿ ನೊಣ, ಕಾಯಿ ಕೊರೆಯುವ ಹುಳು...'
                    }
                    className="w-full rounded-lg border border-[#D4DAD4] bg-white px-3 py-2 text-sm text-[#141A16] placeholder:text-[#7C8780] focus:outline-none focus:border-[#166534]"
                  />
                </div>
              </div>

              {analyzeError && (
                <div className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
                  {analyzeError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={analyzing}
                  className="h-10 px-4 rounded-lg bg-[#166534] hover:bg-[#14532D] disabled:bg-[#9CA69F] text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  {analyzing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {analyzing
                      ? isEn
                        ? 'Identifying Stage, Disease, Solution & Days...'
                        : 'ಬೆಳೆ ಹಂತ, ರೋಗ, ಪರಿಹಾರ & ದಿನ ನೋಡುತ್ತಿದೆ...'
                      : isEn
                      ? 'Identify Stage, Disease, Solution & Days'
                      : 'ಹಂತ, ರೋಗ, ಪರಿಹಾರ & ದಿನ ಪಡೆಯಿರಿ'}
                  </span>
                </button>
              </div>
            </form>

            {/* Daily Photo Logs & AI Care Guidance Timeline */}
            {activeCrop.logs.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5E6A62]">
                  {isEn
                    ? 'Daily Photo Scans & AI Krishi Care Timeline'
                    : 'ದೈನಂದಿನ ಫೋಟೋ ಸ್ಕ್ಯಾನ್ & ಪರಿಹಾರ ವರದಿಗಳು'}
                </div>

                {activeCrop.logs.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    initial={prefersReduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      delay: Math.min(idx, 5) * 0.04,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="border border-[#E2E5E0] bg-white rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EBEEE9] pb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {log.photoThumbUrl && (
                          <img
                            src={log.photoThumbUrl}
                            alt={`Day ${log.dayNumber} crop scan`}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-[#D4DAD4] shrink-0"
                          />
                        )}
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-[#111814] font-mono tabular-nums">
                              {isEn ? `Day ${log.dayNumber}` : `ದಿನ ${log.dayNumber}`}{' '}
                              · {log.date}
                            </span>

                            {(log.stageLabel || log.detectedStage) && (
                              <span className="px-2 py-0.5 rounded bg-[#EEF4EE] text-[#166534] font-medium">
                                {log.stageLabel ||
                                  (log.detectedStage
                                    ? isEn
                                      ? STAGE_LABELS[log.detectedStage].en
                                      : STAGE_LABELS[log.detectedStage].kn
                                    : '')}
                              </span>
                            )}

                            {log.diseaseName && (
                              <span
                                className={`px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                                  log.healthStatus === 'critical'
                                    ? 'bg-[#FEF2F2] text-[#991B1B]'
                                    : log.healthStatus === 'warning'
                                    ? 'bg-[#FFFBEB] text-[#92400E]'
                                    : 'bg-[#F0FDF4] text-[#166534]'
                                }`}
                              >
                                {log.healthStatus === 'healthy' ? (
                                  <ShieldCheck className="w-3 h-3" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                <span>{log.diseaseName}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#3B473F] font-mono tabular-nums">
                            {typeof log.daysToHarvest === 'number' && (
                              <span>
                                {log.daysToHarvest === 0
                                  ? isEn
                                    ? 'Harvest: Ready now'
                                    : 'ಕಟಾವು: ಈಗಲೇ ಸಿದ್ಧ'
                                  : isEn
                                  ? `Harvest in ~${log.daysToHarvest} days`
                                  : `ಕಟಾವಿಗೆ ~${log.daysToHarvest} ದಿನ`}
                              </span>
                            )}
                            {typeof log.recoveryDays === 'number' &&
                              log.recoveryDays > 0 && (
                                <span className="text-[#92400E]">
                                  {isEn
                                    ? `Recovery: ~${log.recoveryDays} days`
                                    : `ಚೇತರಿಕೆಗೆ ~${log.recoveryDays} ದಿನ`}
                                </span>
                              )}
                            {log.scanSource && log.scanSource !== 'manual' && (
                              <span className="text-[#5E6A62]">
                                ({log.scanSource === 'camera'
                                  ? isEn
                                    ? 'Live Camera'
                                    : 'ಲೈವ್ ಕ್ಯಾಮೆರಾ'
                                  : isEn
                                  ? 'Daily Photo'
                                  : 'ದೈನಂದಿನ ಫೋಟೋ'})
                              </span>
                            )}
                          </div>

                          {log.solutionSummary && (
                            <p className="text-xs text-[#133A1D] bg-[#F7FAF7] border border-[#DCE8DC] rounded-md px-2.5 py-1.5">
                              {log.solutionSummary}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void handleSpeakGuidance(log.id, log.aiGuidance)
                        }
                        disabled={audioLoadingId === log.id}
                        className="px-2.5 py-1 rounded-md border border-[#D4DAD4] bg-[#FAFBF9] hover:bg-[#F1F4EF] text-xs font-medium text-[#141A16] inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {audioLoadingId === log.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-[#166534]" />
                        )}
                        <span>{isEn ? 'Listen' : 'ಕೇಳಿ'}</span>
                      </button>
                    </div>

                    {audioUrlMap[log.id] && (
                      <audio
                        controls
                        src={audioUrlMap[log.id]}
                        className="w-full h-9"
                      />
                    )}

                    <div className="agron-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {log.aiGuidance}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {scannerOpen && activeCrop && (
        <LiveCropScanner
          cropName={activeCrop.cropName}
          dayNumber={computeDayNumber(activeCrop.sowingDate)}
          isEn={isEn}
          onClose={() => setScannerOpen(false)}
          onScanCaptured={handleScanCaptured}
        />
      )}
    </div>
  );
};
