import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Volume2,
} from 'lucide-react';
import type { LanguageMode, LiveMarketResponse } from '../types.ts';
import {
  INDIA_MARKET_LOCATIONS,
  POPULAR_COMMODITIES,
  QUICK_MARKET_HUBS,
} from '../constants/locations.ts';
import { speakMaleBrowserFallback } from '../utils/speakFallback.ts';

export interface MarketInitialQuery {
  state: string;
  district: string;
  taluk: string;
  commodity: string;
  autoFetchKey?: number;
}

interface MarketPanelProps {
  language: LanguageMode;
  initialQuery?: MarketInitialQuery | null;
  onAskInChat: (prompt: string) => void;
}

export const MarketPanel: React.FC<MarketPanelProps> = ({
  language,
  initialQuery,
  onAskInChat,
}) => {
  const isEn = language === 'en';
  const prefersReduced = useReducedMotion();

  const [selectedState, setSelectedState] = useState<string>('Karnataka');
  const [selectedDistrict, setSelectedDistrict] =
    useState<string>('Bengaluru Urban');
  const [selectedTaluk, setSelectedTaluk] =
    useState<string>('Yeshwanthpur APMC');
  const [customTaluk, setCustomTaluk] = useState<string>('');
  const [commodity, setCommodity] = useState<string>('');
  const [customCommodity, setCustomCommodity] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveMarketResponse | null>(null);

  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rowSearch, setRowSearch] = useState<string>('');
  const [listCategory, setListCategory] = useState<'all' | 'veg' | 'grains'>(
    'all'
  );

  const stateObj = useMemo(
    () =>
      INDIA_MARKET_LOCATIONS.find((s) => s.state === selectedState) ??
      INDIA_MARKET_LOCATIONS[0],
    [selectedState]
  );

  const districts = useMemo(
    () => Object.keys(stateObj.districts),
    [stateObj]
  );

  const taluks = useMemo(
    () => stateObj.districts[selectedDistrict] ?? [],
    [stateObj, selectedDistrict]
  );

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    const entry =
      INDIA_MARKET_LOCATIONS.find((s) => s.state === newState) ??
      INDIA_MARKET_LOCATIONS[0];
    const firstDist = Object.keys(entry.districts)[0] ?? '';
    const firstTaluk = entry.districts[firstDist]?.[0] ?? '';
    setSelectedDistrict(firstDist);
    setSelectedTaluk(firstTaluk);
    setCustomTaluk('');
  };

  const handleDistrictChange = (newDistrict: string) => {
    setSelectedDistrict(newDistrict);
    const list = stateObj.districts[newDistrict] ?? [];
    setSelectedTaluk(list[0] ?? '');
    setCustomTaluk('');
  };

  const effectiveTaluk = customTaluk.trim() || selectedTaluk || selectedDistrict;
  const effectiveCommodity = customCommodity.trim() || commodity;

  const fetchMarketRates = async (params: {
    state: string;
    district: string;
    taluk: string;
    commodity: string;
  }) => {
    const cacheKey = `agron_mkt_${params.state}_${params.district}_${params.taluk}_${params.commodity}_${language}`.toLowerCase();
    try {
      const cachedRaw = sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as {
          ts: number;
          data: LiveMarketResponse;
        };
        if (Date.now() - parsed.ts < 10 * 60 * 1000 && parsed.data?.ok) {
          setResult(parsed.data);
          setError(null);
          return;
        }
      }
    } catch {
      // Ignore cache error
    }

    setLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      const res = await fetch('/api/market/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: params.state,
          district: params.district,
          taluk: params.taluk,
          commodity: params.commodity,
          language,
        }),
      });
      const data = (await res.json()) as LiveMarketResponse & { error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Could not fetch live market rates.');
      }
      setResult(data);
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ ts: Date.now(), data })
        );
      } catch {
        // Ignore quota error
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Network error fetching market rates.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialQuery) return;
    const matchedState =
      INDIA_MARKET_LOCATIONS.find((s) => s.state === initialQuery.state) ??
      INDIA_MARKET_LOCATIONS[0];
    const distKeys = Object.keys(matchedState.districts);
    const matchedDistrict = distKeys.includes(initialQuery.district)
      ? initialQuery.district
      : distKeys[0] ?? '';
    const talukList = matchedState.districts[matchedDistrict] ?? [];
    const matchedTaluk = talukList.includes(initialQuery.taluk)
      ? initialQuery.taluk
      : talukList[0] ?? '';

    const matchedCommodity = POPULAR_COMMODITIES.find(
      (c) => c.id.toLowerCase() === initialQuery.commodity.toLowerCase()
    );

    setSelectedState(matchedState.state);
    setSelectedDistrict(matchedDistrict);
    setSelectedTaluk(matchedTaluk);
    setCustomTaluk(
      talukList.includes(initialQuery.taluk) ? '' : initialQuery.taluk
    );
    if (matchedCommodity) {
      setCommodity(matchedCommodity.id);
      setCustomCommodity('');
    } else {
      setCommodity('');
      setCustomCommodity(initialQuery.commodity);
    }

    void fetchMarketRates({
      state: matchedState.state,
      district: matchedDistrict,
      taluk: initialQuery.taluk || matchedTaluk,
      commodity: initialQuery.commodity,
    });
  }, [initialQuery?.autoFetchKey]);

  // Auto-load Bengaluru full market list on first view so farmers see real live prices immediately
  useEffect(() => {
    if (initialQuery || result || loading) return;
    void fetchMarketRates({
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      taluk: 'Yeshwanthpur APMC',
      commodity: '',
    });
  }, []);

  const handleQuickHub = (hub: (typeof QUICK_MARKET_HUBS)[number]) => {
    setSelectedState(hub.state);
    setSelectedDistrict(hub.district);
    setSelectedTaluk(hub.taluk);
    setCustomTaluk('');
    setCommodity('');
    setCustomCommodity('');
    setRowSearch('');
    setListCategory('all');
    void fetchMarketRates({
      state: hub.state,
      district: hub.district,
      taluk: hub.taluk,
      commodity: '',
    });
  };

  const handleFetchMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    await fetchMarketRates({
      state: selectedState,
      district: selectedDistrict,
      taluk: effectiveTaluk,
      commodity: effectiveCommodity,
    });
  };

  const handleSpeakMarket = async () => {
    if (!result || audioLoading) return;
    setAudioLoading(true);
    try {
      const rowText = result.rows
        .slice(0, 12)
        .map((r) =>
          isEn
            ? `${r.commodity}: modal ${r.modalPrice} (${r.arrivalDate})`
            : `${r.commodity}: ಮಾದರಿ ಬೆಲೆ ${r.modalPrice}, ಕನಿಷ್ಠ ${r.minPrice ?? ''}`
        )
        .join('. ');
      const fullSpeech = `${result.summary} ${rowText}`.trim();
      const res = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullSpeech, language }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        audioDataUrl?: string;
        spokenScript?: string;
      };
      if (data.audioDataUrl) {
        setAudioUrl(data.audioDataUrl);
        const audio = new Audio(data.audioDataUrl);
        void audio.play().catch(() => {});
      } else {
        speakMaleBrowserFallback(data.spokenScript || fullSpeech, isEn);
      }
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[#E2E5E0] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#E2E5E0] bg-[#FAFBF9] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#166534]" />
          <h2 className="text-sm font-semibold text-[#141A16]">
            {isEn
              ? 'Real APMC / Agmarknet Market Details (State · District · Taluk)'
              : 'ನೈಜ ಎಪಿಎಂಸಿ ಮಾರುಕಟ್ಟೆ ದರ (ರಾಜ್ಯ · ಜಿಲ್ಲೆ · ತಾಲೂಕು)'}
          </h2>
        </div>
        <span className="text-xs text-[#5E6A62]">
          {isEn
            ? 'Direct Agmarknet Official API · Zero hardcoded prices'
            : 'ನೇರ Agmarknet ಅಧಿಕೃತ ಮಾಹಿತಿ · ನೈಜ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು'}
        </span>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Quick 1-Tap Market Hubs (All Markets Directory) */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62]">
            {isEn
              ? 'Quick APMC Markets (1-Tap Full List)'
              : 'ಪ್ರಮುಖ ಎಪಿಎಂಸಿ ಮಾರುಕಟ್ಟೆಗಳು (ಒಂದೇ ಒತ್ತಿನಲ್ಲಿ ಪೂರ್ಣ ಪಟ್ಟಿ)'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_MARKET_HUBS.map((hub) => {
              const active =
                selectedDistrict === hub.district &&
                (selectedTaluk === hub.taluk || !customTaluk);
              return (
                <motion.button
                  key={`${hub.district}-${hub.taluk}`}
                  type="button"
                  whileHover={prefersReduced ? undefined : { y: -1 }}
                  whileTap={prefersReduced ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  onClick={() => handleQuickHub(hub)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#166534] border-[#166534] text-white'
                      : 'bg-[#FAFBF9] border-[#D4DAD4] text-[#1A221D] hover:bg-[#EEF4EE]'
                  }`}
                >
                  {isEn ? hub.labelEn : hub.labelKn}
                </motion.button>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleFetchMarket}
          className="border border-[#E2E5E0] bg-[#FAFBF9] rounded-xl p-4 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* State */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                {isEn ? 'State' : 'ರಾಜ್ಯ (State)'}
              </label>
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16] focus:outline-none focus:border-[#166534]"
              >
                {INDIA_MARKET_LOCATIONS.map((entry) => (
                  <option key={entry.state} value={entry.state}>
                    {isEn ? entry.state : entry.labelKn ?? entry.state}
                  </option>
                ))}
              </select>
            </div>

            {/* District */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                {isEn ? 'District' : 'ಜಿಲ್ಲೆ (District)'}
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16] focus:outline-none focus:border-[#166534]"
              >
                {districts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            {/* Taluk */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                {isEn ? 'Taluk / APMC Yard' : 'ತಾಲೂಕು / ಎಪಿಎಂಸಿ'}
              </label>
              <select
                value={selectedTaluk}
                onChange={(e) => setSelectedTaluk(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16] focus:outline-none focus:border-[#166534]"
              >
                {taluks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Commodity */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-1">
                {isEn ? 'Crop / Commodity' : 'ಬೆಳೆ (Crop)'}
              </label>
              <select
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16] focus:outline-none focus:border-[#166534]"
              >
                {POPULAR_COMMODITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isEn ? c.labelEn : c.labelKn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Taluk / Custom Crop + Submit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-medium text-[#647068] mb-1">
                {isEn
                  ? 'Or type any other Taluk / Mandi'
                  : 'ಅಥವಾ ಬೇರೆ ತಾಲೂಕು / ಮಾರುಕಟ್ಟೆ ಹೆಸರು ಬರೆಯಿರಿ'}
              </label>
              <input
                type="text"
                value={customTaluk}
                onChange={(e) => setCustomTaluk(e.target.value)}
                placeholder={isEn ? 'e.g., Channapatna APMC' : 'ಉದಾ: ಚನ್ನಪಟ್ಟಣ ಎಪಿಎಂಸಿ'}
                className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16] placeholder:text-[#8A948E] focus:outline-none focus:border-[#166534]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#647068] mb-1">
                {isEn
                  ? 'Or type specific Crop name'
                  : 'ಅಥವಾ ನಿರ್ದಿಷ್ಟ ಬೆಳೆ ಹೆಸರು ಬರೆಯಿರಿ'}
              </label>
              <input
                type="text"
                value={customCommodity}
                onChange={(e) => setCustomCommodity(e.target.value)}
                placeholder={isEn ? 'e.g., Green Chilli, Wheat' : 'ಉದಾ: ಹಸಿ ಮೆಣಸಿನಕಾಯಿ, ಗೋಧಿ'}
                className="w-full h-10 rounded-lg border border-[#D4DAD4] bg-white px-3 text-sm text-[#141A16] placeholder:text-[#8A948E] focus:outline-none focus:border-[#166534]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-10 px-4 rounded-lg bg-[#166534] hover:bg-[#14532D] disabled:bg-[#9CA69F] text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>
                {loading
                  ? isEn
                    ? 'Loading Real Rates...'
                    : 'ನೈಜ ದರ ತರಲಾಗುತ್ತಿದೆ...'
                  : isEn
                  ? 'Get Real Market Details'
                  : 'ಇಂದಿನ ಮಾರುಕಟ್ಟೆ ದರ ನೋಡಿ'}
              </span>
            </button>
          </div>
        </form>

        {error && (
          <div className="border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="border border-dashed border-[#D4DAD4] rounded-xl p-8 text-center text-sm text-[#5E6A62]">
            {isEn
              ? 'Select your State, District, and Taluk above and click "Get Real Market Details" to inspect verified official Agmarknet APMC rates.'
              : 'ಮೇಲೆ ನಿಮ್ಮ ರಾಜ್ಯ, ಜಿಲ್ಲೆ ಮತ್ತು ತಾಲೂಕನ್ನು ಆಯ್ಕೆ ಮಾಡಿ "ಇಂದಿನ ಮಾರುಕಟ್ಟೆ ದರ ನೋಡಿ" ಒತ್ತಿ — ಅಧಿಕೃತ Agmarknet ನೈಜ ಬೆಲೆಗಳನ್ನು ತಕ್ಷಣ ತೋರಿಸುತ್ತದೆ.'}
          </div>
        )}

        {result && (
          <motion.div
            key={result.fetchedAt}
            initial={prefersReduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="border border-[#E2E5E0] rounded-xl overflow-hidden bg-white"
          >
            <div className="px-4 py-3 border-b border-[#E6E9E4] bg-[#FAFBF9] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#111814]">
                  {result.taluk}, {result.district} — {result.state}
                </div>
                <div className="text-xs text-[#647068] font-mono tabular-nums">
                  {new Date(result.fetchedAt).toLocaleString()}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSpeakMarket}
                  disabled={audioLoading}
                  className="px-3 py-1.5 rounded-lg border border-[#D4DAD4] bg-white hover:bg-[#F1F4EF] text-xs font-medium text-[#141A16] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {audioLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#166534]" />
                  )}
                  <span>{isEn ? 'Listen Report' : 'ಕೇಳಿ (ಆಡಿಯೋ)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onAskInChat(
                      isEn
                        ? `Check real market prices and selling guidance for ${effectiveCommodity || 'major crops'} in ${effectiveTaluk} taluk, ${selectedDistrict} district, ${selectedState}.`
                        : `${selectedState} ರಾಜ್ಯದ ${selectedDistrict} ಜಿಲ್ಲೆಯ ${effectiveTaluk} ತಾಲೂಕಿನ ${effectiveCommodity || 'ಪ್ರಮುಖ ಬೆಳೆಗಳ'} ನೈಜ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಮತ್ತು ಮಾರಾಟ ಸಲಹೆ ತಿಳಿಸಿ.`
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#13221A] hover:bg-[#1E3529] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Discuss in Chat' : 'ಚಾಟ್‌ನಲ್ಲಿ ಕೇಳಿ'}</span>
                </button>
              </div>
            </div>

            {audioUrl && (
              <div className="px-4 py-2.5 border-b border-[#E6E9E4] bg-[#F6F7F5]">
                <audio controls src={audioUrl} className="w-full h-9" />
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#1A221D] leading-relaxed">
                  {result.summary}
                </p>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#166534] whitespace-nowrap">
                  {result.rows.length}{' '}
                  {isEn ? 'commodities listed' : 'ಬೆಳೆಗಳ ದರ ಪಟ್ಟಿ'}
                </span>
              </div>

              {result.rows.length > 0 && (() => {
                const filteredRows = result.rows.filter((r) => {
                  if (listCategory === 'veg' && !r.retailPrice) return false;
                  if (listCategory === 'grains' && Boolean(r.retailPrice))
                    return false;
                  if (rowSearch.trim()) {
                    const q = rowSearch.trim().toLowerCase();
                    return (
                      r.commodity.toLowerCase().includes(q) ||
                      r.marketYard.toLowerCase().includes(q)
                    );
                  }
                  return true;
                });
                const hasRetail = filteredRows.some((r) => Boolean(r.retailPrice));

                return (
                <div className="space-y-3">
                  {/* Category Switch & Search Filter inside All List */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="inline-flex items-center rounded-lg border border-[#DCE2DC] bg-[#FAFBF9] p-0.5">
                      {(
                        [
                          { id: 'all', kn: 'ಎಲ್ಲಾ ಪಟ್ಟಿ', en: 'All List' },
                          { id: 'veg', kn: 'ತರಕಾರಿ & ಹಣ್ಣು', en: 'Vegetables & Fruits' },
                          { id: 'grains', kn: 'ಧಾನ್ಯ & ವಾಣಿಜ್ಯ ಬೆಳೆ', en: 'Grains & Cash Crops' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setListCategory(tab.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                            listCategory === tab.id
                              ? 'bg-[#13221A] text-white'
                              : 'text-[#5E6A62] hover:text-[#141A16]'
                          }`}
                        >
                          {isEn ? tab.en : tab.kn}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={rowSearch}
                      onChange={(e) => setRowSearch(e.target.value)}
                      placeholder={
                        isEn
                          ? 'Filter crop in list (e.g., Tomato, Ragi, Beans)...'
                          : 'ಪಟ್ಟಿಯಲ್ಲಿ ಬೆಳೆ ಹುಡುಕಿ (ಉದಾ: Tomato, Ragi, Beans)...'
                      }
                      className="h-9 w-full sm:w-72 rounded-lg border border-[#D4DAD4] bg-white px-3 text-xs text-[#141A16] placeholder:text-[#8A948E] focus:outline-none focus:border-[#166534]"
                    />
                  </div>

                  <div className="overflow-x-auto border border-[#E2E5E0] rounded-lg max-h-[520px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-[#F2F4F0] text-[#1A221D] text-xs font-semibold border-b border-[#E2E5E0]">
                          <th className="py-2.5 px-3">
                            {isEn ? 'Commodity' : 'ಬೆಳೆ (Commodity)'}
                          </th>
                          <th className="py-2.5 px-3">
                            {isEn ? 'Market / APMC' : 'ಮಾರುಕಟ್ಟೆ ವ್ಯಾಪ್ತಿ'}
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            {isEn ? 'Min' : 'ಕನಿಷ್ಠ'}
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            {isEn ? 'Modal (₹/Qtl)' : 'ಮಾದರಿ (₹/Qtl)'}
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            {isEn ? 'Max' : 'ಗರಿಷ್ಠ'}
                          </th>
                          {hasRetail && (
                            <th className="py-2.5 px-3 text-right">
                              {isEn ? 'Retail' : 'ಚಿಲ್ಲರೆ (Retail)'}
                            </th>
                          )}
                          <th className="py-2.5 px-3 text-right">
                            {isEn ? 'Arrivals' : 'ಆವಕ'}
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            {isEn ? 'Date' : 'ದಿನಾಂಕ'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EBEEE9]">
                        {filteredRows.map((row, idx) => (
                          <motion.tr
                            key={`${row.commodity}-${idx}`}
                            initial={
                              prefersReduced
                                ? false
                                : { opacity: 0, y: 6 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.18,
                              delay: Math.min(idx, 16) * 0.014,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="hover:bg-[#FAFBF9]"
                          >
                            <td className="py-2.5 px-3 font-medium text-[#111814]">
                              {row.commodity}
                            </td>
                            <td className="py-2.5 px-3 text-xs text-[#4A554E]">
                              {row.marketYard}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#3B473F]">
                              {row.minPrice ?? '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#166534]">
                              {row.modalPrice ?? '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#3B473F]">
                              {row.maxPrice ?? '—'}
                            </td>
                            {hasRetail && (
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1A221D]">
                                {row.retailPrice ?? '—'}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-[#5E6A62]">
                              {row.arrivalsTonnes ?? '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-[#5E6A62] whitespace-nowrap">
                              {row.arrivalDate ?? '—'}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })()}
            </div>

            {result.sources && result.sources.length > 0 && (
              <div className="px-5 py-3 border-t border-[#E6E9E4] bg-[#FAFBF9]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5E6A62] mb-2">
                  {isEn
                    ? 'Official Live Market Portals'
                    : 'ಅಧಿಕೃತ ನೈಜ ಮಾರುಕಟ್ಟೆ ಮೂಲಗಳು'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.sources.map((src) => (
                    <a
                      key={src.uri}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#DCE2DC] bg-white hover:bg-[#F1F4EF] text-xs text-[#166534] max-w-xs truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
