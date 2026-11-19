import express from 'express';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzip } from 'node:zlib';
import dotenv from 'dotenv';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
} from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type {
  AgriSector,
  CropStage,
  DailyCropLogEntry,
  FarmingMode,
  GeneratedMediaItem,
  GroundSource,
  LanguageMode,
  LiveWeatherData,
  MarketPriceRow,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const hasDist = fs.existsSync(path.resolve(__dirname, 'dist', 'index.html'));
const isProd =
  hasDist &&
  (process.env.NODE_ENV === 'production' ||
    (process.env.DISABLE_HMR !== 'true' && !process.argv.includes('--port')));

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Check your Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// ---------------------------------------------------------------------------
// Real Market Data Engine (Live Daily Vegetable Mandi + Official CEDA Agmarknet)
// ---------------------------------------------------------------------------

const CEDA_BASE = 'https://agmarknet.ceda.ashoka.edu.in/api';

interface CedaState {
  census_state_id: number;
  census_state_name: string;
}
interface CedaDistrict {
  census_district_id: number;
  census_district_name: string;
}
interface CedaCommodity {
  category_id: number;
  commodity_id: number;
  commodity_disp_name: string;
}
interface CedaPricePoint {
  t: string;
  cmdty: string;
  p_min: number;
  p_max: number;
  p_modal: number;
}
interface CedaQtyPoint {
  t: string;
  qty: number;
}

const cedaCache: {
  states?: CedaState[];
  commodities?: CedaCommodity[];
  districtsByState: Record<number, CedaDistrict[]>;
} = {
  districtsByState: {},
};

const DISTRICT_ALIASES: Record<string, string> = {
  belagavi: 'belgaum',
  vijayapura: 'bijapur',
  bagalkote: 'bagalkot',
  kalaburagi: 'gulbarga',
  shivamogga: 'shimoga',
  chikkamagaluru: 'chikmagalur',
  tumakuru: 'tumkur',
  mysuru: 'mysore',
  chamarajanagara: 'chamarajanagar',
  ballari: 'bellary',
  vijayanagara: 'bellary',
  'bengaluru urban': 'bangalore',
  'bengaluru rural': 'bangalore rural',
  bengaluru: 'bangalore',
  anantapuramu: 'anantapur',
  ahilyanagar: 'ahmadnagar',
  ahmednagar: 'ahmadnagar',
  'purba bardhaman': 'barddhaman',
  hooghly: 'hugli',
};

const LIVE_MANDI_SLUGS: Record<string, string> = {
  'bengaluru urban': 'bangalore',
  'bengaluru rural': 'bangalore',
  bengaluru: 'bangalore',
  bangalore: 'bangalore',
  yeshwanthpur: 'bangalore',
  mysuru: 'mysore',
  mysore: 'mysore',
  mandya: 'mandya',
  ramanagara: 'ramanagara',
  kolar: 'kolar',
  tumakuru: 'tumkur',
  tumkur: 'tumkur',
  hassan: 'hassan',
  dharwad: 'dharwad',
  hubballi: 'dharwad',
  belagavi: 'belgaum',
  belgaum: 'belgaum',
  'dakshina kannada': 'mangalore',
  mangaluru: 'mangalore',
  'uttara kannada': 'karwar',
  kodagu: 'madikeri',
  shivamogga: 'shimoga',
  shimoga: 'shimoga',
  davanagere: 'davangere',
  ballari: 'bellary',
  bellary: 'bellary',
  vijayanagara: 'bellary',
  chitradurga: 'chitradurga',
  raichur: 'raichur',
  kalaburagi: 'gulbarga',
  gulbarga: 'gulbarga',
  bidar: 'bidar',
  vijayapura: 'vijayapura',
  bijapur: 'bijapur',
  bagalkote: 'bagalkot',
  bagalkot: 'bagalkot',
  haveri: 'haveri',
  koppal: 'koppal',
  yadgir: 'yadgir',
  udupi: 'udupi',
  chikkaballapura: 'chikkaballapur',
  chikkaballapur: 'chikkaballapur',
  chamarajanagara: 'chamarajanagar',
  chamarajanagar: 'chamarajanagar',
  pune: 'pune',
  nashik: 'nashik',
  nagpur: 'nagpur',
  kolhapur: 'kolhapur',
  sangli: 'sangli',
  satara: 'satara',
  solapur: 'solapur',
  hyderabad: 'hyderabad',
  coimbatore: 'coimbatore',
  erode: 'erode',
  salem: 'salem',
  madurai: 'madurai',
  guntur: 'guntur',
  kurnool: 'kurnool',
  chittoor: 'chittoor',
  indore: 'indore',
  bhopal: 'bhopal',
  jaipur: 'jaipur',
  surat: 'surat',
  rajkot: 'rajkot',
  amritsar: 'amritsar',
  ludhiana: 'ludhiana',
  karnataka: 'karnataka',
  maharashtra: 'maharashtra',
  'andhra pradesh': 'andhrapradesh',
  telangana: 'telangana',
  'tamil nadu': 'tamilnadu',
  kerala: 'kerala',
  gujarat: 'gujarat',
};

const KANNADA_COMMODITY_ALIASES: Array<[RegExp, string]> = [
  [/ಟೊಮೇಟೊ|ಟೊಮೆಟೊ|tomato/i, 'Tomato'],
  [/ರಾಗಿ|ragi/i, 'Ragi (Finger Millet)'],
  [/ಭತ್ತ|ಅಕ್ಕಿ|paddy|rice/i, 'Paddy(Dhan)(Common)'],
  [/ಮೆಕ್ಕೆಜೋಳ|ಜೋಳ|maize|corn/i, 'Maize'],
  [/ಬಿಳಿ ಜೋಳ|jowar|sorghum/i, 'Jowar (Sorghum)'],
  [/ಅಡಿಕೆ|arecanut|betel/i, 'Arecanut (Betelnut/Supari)'],
  [/ತೆಂಗು|ಕೊಬ್ಬರಿ|coconut/i, 'Coconut'],
  [/ಈರುಳ್ಳಿ|ಉಳ್ಳಾಗಡ್ಡಿ|onion/i, 'Onion'],
  [/ಆಲೂಗಡ್ಡೆ|potato/i, 'Potato'],
  [/ತೊಗರಿ|tur|arhar|red gram/i, 'Arhar (Tur/Red Gram)(Whole)'],
  [/ಶೇಂಗಾ|ಕಡಲೆಕಾಯಿ|groundnut|peanut/i, 'Groundnut'],
  [/ಹತ್ತಿ|cotton/i, 'Cotton'],
  [/ಒಣ ಮೆಣಸಿನಕಾಯಿ|dry chilli/i, 'Dry Chillies'],
  [/ಹಸಿ ಮೆಣಸಿನಕಾಯಿ|ಮೆಣಸಿನಕಾಯಿ|green chilli|chilli/i, 'Green Chilli'],
  [/ಬಾಳೆ|banana/i, 'Banana'],
  [/ಅರಿಶಿನ|turmeric/i, 'Turmeric'],
  [/ಶುಂಠಿ|ginger/i, 'Ginger (Green)'],
  [/ಕಾಫಿ|coffee/i, 'Coffee'],
  [/ಕಾಳುಮೆಣಸು|ಮೆಣಸು|pepper/i, 'Pepper - garbled'],
  [/ಕಬ್ಬು|sugarcane/i, 'Sugarcane'],
  [/ಗೋಧಿ|wheat/i, 'Wheat'],
  [/ಕ್ಯಾರೆಟ್|carrot/i, 'Carrot'],
  [/ಎಲೆಕೋಸು|cabbage/i, 'Cabbage'],
  [/ಹೂಕೋಸು|cauliflower/i, 'Cauliflower'],
  [/ಬೆಂಡೆಕಾಯಿ|lady|bhindi/i, 'Bhindi(Ladies Finger)'],
  [/ಬದನೆಕಾಯಿ|brinjal/i, 'Brinjal'],
  [/ಸೌತೆಕಾಯಿ|cucumber/i, 'Cucumbar(Kheera)'],
  [/ಬೀನ್ಸ್|beans/i, 'Beans'],
];

async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 5500
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs = 7000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLiveDailyVegetableFeed(params: {
  state: string;
  district: string;
  taluk: string;
  commodity: string;
}): Promise<{ rows: MarketPriceRow[]; sourceUrl?: string }> {
  const candidates = [
    params.taluk.toLowerCase().replace(/\s+apmc$/i, '').trim(),
    params.district.toLowerCase().trim(),
    params.state.toLowerCase().trim(),
  ];

  let slug = '';
  for (const cand of candidates) {
    if (LIVE_MANDI_SLUGS[cand]) {
      slug = LIVE_MANDI_SLUGS[cand];
      break;
    }
  }
  if (!slug) {
    slug = params.district
      .toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z]/g, '');
  }
  if (!slug) return { rows: [] };

  const url = `https://vegetablemarketprice.com/market/${slug}/today`;
  try {
    const html = await fetchTextWithTimeout(url, 4500);
    const dateMatch = html.match(/data-current-date="([^"]+)"/);
    const reportDate = dateMatch?.[1] ?? new Date().toISOString().split('T')[0];

    const rowRegex =
      /<tr class="todayVegetableTableRows"[\s\S]*?<td scope="row">\s*([^<]+?)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/gi;

    const allParsed: MarketPriceRow[] = [];
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(html)) !== null) {
      const name = match[1].replace(/\s+/g, ' ').trim();
      const wholesaleRaw = match[2].replace(/\s+/g, ' ').trim();
      const retailRaw = match[3].replace(/\s+/g, ' ').trim();
      const unitRaw = match[4].replace(/\s+/g, ' ').trim();

      const numMatch = wholesaleRaw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
      const perKgNum = numMatch ? Number(numMatch[1]) : 0;
      const quintalStr =
        unitRaw.toLowerCase().includes('kg') && perKgNum > 0
          ? `₹${Math.round(perKgNum * 100).toLocaleString('en-IN')}`
          : wholesaleRaw;

      allParsed.push({
        commodity: name,
        marketYard: `${params.taluk || params.district} (${slug.charAt(0).toUpperCase() + slug.slice(1)} Live Market)`,
        minPrice: `${wholesaleRaw} / ${unitRaw}`,
        modalPrice: `${quintalStr} / Qtl`,
        retailPrice: `${retailRaw} / ${unitRaw}`,
        unit: unitRaw,
        arrivalDate: reportDate,
        scope: 'district',
      });
    }

    if (allParsed.length === 0) return { rows: [] };

    const query = params.commodity.trim().toLowerCase();
    let filtered = allParsed;
    if (query) {
      let searchTerm = query;
      for (const [regex, mappedName] of KANNADA_COMMODITY_ALIASES) {
        if (regex.test(query)) {
          searchTerm = mappedName.toLowerCase().split(/[\s(/]+/)[0];
          break;
        }
      }
      const key = searchTerm.split(/[\s(/]+/)[0];
      filtered = allParsed.filter(
        (r) =>
          r.commodity.toLowerCase().includes(key) ||
          r.commodity.toLowerCase().includes(query)
      );
      return { rows: filtered.slice(0, 15), sourceUrl: url };
    }

    // When user requests ALL crops / full market list, return ALL live market items without artificial 8-row limit
    return { rows: allParsed, sourceUrl: url };
  } catch {
    return { rows: [] };
  }
}

async function ensureCedaMeta() {
  if (!cedaCache.states || !cedaCache.commodities) {
    const [statesRes, cmdtyRes] = await Promise.all([
      fetchJsonWithTimeout<{ data: CedaState[] }>(`${CEDA_BASE}/states`),
      fetchJsonWithTimeout<{ data: CedaCommodity[] }>(`${CEDA_BASE}/commodities`),
    ]);
    cedaCache.states = statesRes.data ?? [];
    cedaCache.commodities = cmdtyRes.data ?? [];
  }
}

async function getDistrictsForState(stateId: number): Promise<CedaDistrict[]> {
  if (!cedaCache.districtsByState[stateId]) {
    const res = await fetchJsonWithTimeout<{ data: CedaDistrict[] }>(
      `${CEDA_BASE}/districts?state_id=${stateId}`
    );
    cedaCache.districtsByState[stateId] = res.data ?? [];
  }
  return cedaCache.districtsByState[stateId];
}

function normalizePlaceName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .split('/')[0]
    .trim();
  return DISTRICT_ALIASES[cleaned] ?? cleaned;
}

function resolveState(stateName: string): CedaState | undefined {
  const target = stateName.toLowerCase().trim();
  const list = cedaCache.states ?? [];
  return (
    list.find((s) => s.census_state_name.toLowerCase() === target) ??
    list.find((s) => s.census_state_name.toLowerCase().includes(target))
  );
}

function resolveDistrict(
  districts: CedaDistrict[],
  districtName: string
): CedaDistrict | undefined {
  const norm = normalizePlaceName(districtName);
  return (
    districts.find((d) => d.census_district_name.toLowerCase() === norm) ??
    districts.find(
      (d) =>
        d.census_district_name.toLowerCase().includes(norm) ||
        norm.includes(d.census_district_name.toLowerCase())
    )
  );
}

function resolveCedaCommodities(query: string): CedaCommodity[] {
  const all = cedaCache.commodities ?? [];
  const trimmed = query.trim();
  if (!trimmed) {
    const defaultNames = [
      'Ragi (Finger Millet)',
      'Paddy(Dhan)(Common)',
      'Maize',
      'Jowar (Sorghum)',
      'Wheat',
      'Arhar (Tur/Red Gram)(Whole)',
      'Green Gram (Moong)(Whole)',
      'Black Gram (Urd Beans)(Whole)',
      'Bengal Gram(Gram)(Whole)',
      'Groundnut',
      'Cotton',
      'Arecanut (Betelnut/Supari)',
      'Coconut',
      'Dry Chillies',
      'Turmeric',
    ];
    return defaultNames
      .map((n) => all.find((c) => c.commodity_disp_name === n))
      .filter((c): c is CedaCommodity => Boolean(c));
  }

  for (const [regex, mappedName] of KANNADA_COMMODITY_ALIASES) {
    if (regex.test(trimmed)) {
      const exact = all.find(
        (c) => c.commodity_disp_name.toLowerCase() === mappedName.toLowerCase()
      );
      if (exact) return [exact];
    }
  }

  const lower = trimmed.toLowerCase();
  const exact = all.find((c) => c.commodity_disp_name.toLowerCase() === lower);
  if (exact) return [exact];

  const partial = all.filter((c) =>
    c.commodity_disp_name.toLowerCase().includes(lower)
  );
  if (partial.length > 0) return partial.slice(0, 2);

  const firstWord = lower.split(/[\s(/]+/)[0];
  if (firstWord.length >= 3) {
    const fuzzy = all.filter((c) =>
      c.commodity_disp_name.toLowerCase().includes(firstWord)
    );
    if (fuzzy.length > 0) return fuzzy.slice(0, 2);
  }

  return [];
}

async function fetchCommodityRealRow(
  stateId: number,
  stateName: string,
  districtObj: CedaDistrict | undefined,
  talukName: string,
  commodity: CedaCommodity
): Promise<MarketPriceRow | null> {
  const startDate = '2025-08-01';
  const endDate = new Date().toISOString().split('T')[0];

  const fetchPoints = async (districtId: number, timeoutMs: number) => {
    const payload = {
      state_id: stateId,
      commodity_id: commodity.commodity_id,
      district_id: districtId,
      calculation_type: 'd',
      start_date: startDate,
      end_date: endDate,
    };
    const [pricesRes, qtyRes] = await Promise.all([
      fetchJsonWithTimeout<{ data?: CedaPricePoint[] }>(
        `${CEDA_BASE}/prices`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        timeoutMs
      ),
      fetchJsonWithTimeout<{ data?: CedaQtyPoint[] }>(
        `${CEDA_BASE}/quantities`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        timeoutMs
      ).catch(() => ({ data: [] as CedaQtyPoint[] })),
    ]);
    return {
      prices: pricesRes.data ?? [],
      quantities: qtyRes.data ?? [],
    };
  };

  // District 572 (Bangalore Urban) hangs in CEDA's DB; skip straight to State 0 for Bangalore Urban grains
  const skipSlowDistrict = districtObj?.census_district_id === 572;

  let scope: 'district' | 'state' = 'district';
  let result: { prices: CedaPricePoint[]; quantities: CedaQtyPoint[] } = {
    prices: [],
    quantities: [],
  };

  if (districtObj && !skipSlowDistrict) {
    try {
      result = await fetchPoints(districtObj.census_district_id, 4200);
    } catch {
      result = { prices: [], quantities: [] };
    }
  }

  if (result.prices.length === 0) {
    scope = 'state';
    try {
      result = await fetchPoints(0, 5500);
    } catch {
      result = { prices: [], quantities: [] };
    }
  }

  if (result.prices.length === 0) return null;

  const sorted = [...result.prices].sort((a, b) => b.t.localeCompare(a.t));
  const latest = sorted[0];
  const qtyMatch = result.quantities.find((q) => q.t === latest.t);

  const yardLabel =
    scope === 'district' && districtObj
      ? `${talukName || districtObj.census_district_name} (${districtObj.census_district_name} Dist. APMC)`
      : `${stateName} (State Agmarknet Avg)`;

  const fmt = (val: number) =>
    val > 0 ? `₹${Math.round(val).toLocaleString('en-IN')}` : undefined;

  return {
    commodity: latest.cmdty || commodity.commodity_disp_name,
    marketYard: yardLabel,
    minPrice: fmt(latest.p_min),
    modalPrice: fmt(latest.p_modal),
    maxPrice: fmt(latest.p_max),
    arrivalsTonnes:
      qtyMatch && typeof qtyMatch.qty === 'number' && qtyMatch.qty > 0
        ? `${qtyMatch.qty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} T`
        : undefined,
    unit: '₹/Quintal',
    arrivalDate: latest.t,
    scope,
  };
}

const marketResponseCache = new Map<
  string,
  {
    expiresAt: number;
    data: {
      state: string;
      district: string;
      taluk: string;
      rows: MarketPriceRow[];
      sources: GroundSource[];
    };
  }
>();

async function fetchRealCombinedMarket(params: {
  state: string;
  district: string;
  taluk: string;
  commodity: string;
}): Promise<{
  state: string;
  district: string;
  taluk: string;
  rows: MarketPriceRow[];
  sources: GroundSource[];
}> {
  const cacheKey = [
    params.state.trim().toLowerCase(),
    params.district.trim().toLowerCase(),
    params.taluk.trim().toLowerCase(),
    params.commodity.trim().toLowerCase(),
  ].join('|');

  const cached = marketResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const liveFeedPromise = fetchLiveDailyVegetableFeed(params);

  const cedaPromise = (async () => {
    try {
      await ensureCedaMeta();
      const stateObj = resolveState(params.state) ?? {
        census_state_id: 29,
        census_state_name: 'Karnataka',
      };
      const districts = await getDistrictsForState(stateObj.census_state_id);
      const districtObj = params.district
        ? resolveDistrict(districts, params.district)
        : undefined;
      const targets = resolveCedaCommodities(params.commodity);
      const settled = await Promise.all(
        targets.map((cmdty) =>
          fetchCommodityRealRow(
            stateObj.census_state_id,
            stateObj.census_state_name,
            districtObj,
            params.taluk,
            cmdty
          ).catch(() => null)
        )
      );
      return {
        stateName: stateObj.census_state_name,
        districtName: districtObj?.census_district_name ?? params.district,
        rows: settled.filter((r): r is MarketPriceRow => r !== null),
      };
    } catch {
      return {
        stateName: params.state,
        districtName: params.district,
        rows: [] as MarketPriceRow[],
      };
    }
  })();

  const [liveFeed, cedaResult] = await Promise.all([liveFeedPromise, cedaPromise]);

  // Combine today's live market rows first (especially great for Bengaluru, vegetables, fruits),
  // followed by non-duplicate Agmarknet grains/cash crops
  const seenCommodities = new Set<string>();
  const mergedRows: MarketPriceRow[] = [];

  for (const row of liveFeed.rows) {
    const key = row.commodity.toLowerCase();
    if (!seenCommodities.has(key)) {
      seenCommodities.add(key);
      mergedRows.push(row);
    }
  }
  for (const row of cedaResult.rows) {
    const key = row.commodity.toLowerCase();
    if (!seenCommodities.has(key)) {
      seenCommodities.add(key);
      mergedRows.push(row);
    }
  }

  const sources: GroundSource[] = [];
  if (liveFeed.sourceUrl) {
    sources.push({
      title: `Live Daily Market Rates (${cedaResult.districtName || params.district})`,
      uri: liveFeed.sourceUrl,
    });
  }
  if ((cedaResult.stateName || params.state).toLowerCase() === 'karnataka') {
    sources.push({
      title: 'Karnataka Krishi Marata Vahini (Taluk APMC Daily Rates)',
      uri: 'https://krishimaratavahini.karnataka.gov.in/',
    });
  }
  sources.push(
    {
      title: 'CEDA Agmarknet Official Market Data',
      uri: 'https://agmarknet.ceda.ashoka.edu.in/',
    },
    {
      title: 'e-NAM National Agriculture Market',
      uri: 'https://enam.gov.in/web/dashboard/live_price',
    }
  );

  const responsePayload = {
    state: cedaResult.stateName || params.state,
    district: params.district || cedaResult.districtName,
    taluk: params.taluk || params.district || cedaResult.districtName,
    rows: mergedRows,
    sources,
  };

  if (mergedRows.length > 0) {
    marketResponseCache.set(cacheKey, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      data: responsePayload,
    });
  }

  return responsePayload;
}

// ---------------------------------------------------------------------------
// Live Weather Engine (Open-Meteo — Free, Real, Sub-Second)
// ---------------------------------------------------------------------------

async function fetchRealLiveWeather(params: {
  state: string;
  district: string;
  taluk: string;
}): Promise<LiveWeatherData> {
  const queries = [
    params.taluk.replace(/\s+apmc$/i, '').trim(),
    params.district.trim(),
    params.state.trim(),
  ].filter(Boolean);

  let lat = 12.9719;
  let lon = 77.5937;
  let resolvedName = params.taluk || params.district || params.state || 'Bengaluru';

  for (const q of queries) {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=3&countryCode=IN`;
      const geo = await fetchJsonWithTimeout<{
        results?: Array<{
          name: string;
          admin1?: string;
          latitude: number;
          longitude: number;
        }>;
      }>(geoUrl, undefined, 5000);
      if (geo.results && geo.results.length > 0) {
        const matchState =
          geo.results.find((r) =>
            (r.admin1 ?? '').toLowerCase().includes(params.state.toLowerCase())
          ) ?? geo.results[0];
        lat = matchState.latitude;
        lon = matchState.longitude;
        resolvedName = `${matchState.name}${matchState.admin1 ? `, ${matchState.admin1}` : ''}`;
        break;
      }
    } catch {
      // try next query
    }
  }

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=5`;
  const w = await fetchJsonWithTimeout<{
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      precipitation?: number;
      wind_speed_10m?: number;
    };
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      precipitation_probability_max?: number[];
    };
  }>(forecastUrl, undefined, 6000);

  const curTemp = Math.round(w.current?.temperature_2m ?? 26);
  const humidity = Math.round(w.current?.relative_humidity_2m ?? 65);
  const precip = Number((w.current?.precipitation ?? 0).toFixed(1));
  const wind = Math.round(w.current?.wind_speed_10m ?? 10);

  const dates = w.daily?.time ?? [];
  const daily = dates.map((d, i) => ({
    date: d,
    tempMax: Math.round(w.daily?.temperature_2m_max?.[i] ?? curTemp),
    tempMin: Math.round(w.daily?.temperature_2m_min?.[i] ?? curTemp - 8),
    precipMm: Number((w.daily?.precipitation_sum?.[i] ?? 0).toFixed(1)),
    precipProb: Math.round(w.daily?.precipitation_probability_max?.[i] ?? 0),
  }));

  const rainSoon = daily.slice(0, 2).some((d) => d.precipProb >= 50 || d.precipMm >= 2);
  const summary = rainSoon
    ? `Rain likely within 48h (${daily[0]?.precipProb ?? 50}% chance) — avoid foliar spraying just before rain and ensure field drainage.`
    : curTemp >= 33
    ? `Warm weather (${curTemp}°C, ${humidity}% RH) — irrigate early morning/evening and maintain soil mulching.`
    : `Favorable weather (${curTemp}°C, ${humidity}% RH, ${wind} km/h wind) — suitable for scheduled spraying and crop care.`;

  return {
    ok: true,
    locationLabel: resolvedName,
    currentTempC: curTemp,
    humidityPct: humidity,
    precipMm: precip,
    windKmh: wind,
    weatherSummary: summary,
    daily,
  };
}

// ---------------------------------------------------------------------------
// Function Calling Tools (Real Market Lookup + Free Image & Audio — NO Video AI)
// ---------------------------------------------------------------------------

const getRealMarketPricesDecl: FunctionDeclaration = {
  name: 'get_real_market_prices',
  description:
    'Fetch REAL live market & official Agmarknet APMC mandi prices (Wholesale, Retail, Min/Modal/Max, Arrivals, and Date) for any Indian State, District, Taluk, including Bengaluru, Mysuru, Mandya, etc.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      state: {
        type: Type.STRING,
        description: 'Indian state name, e.g., Karnataka, Maharashtra, Andhra Pradesh.',
      },
      district: {
        type: Type.STRING,
        description: 'District name, e.g., Bengaluru Urban, Mandya, Mysuru, Ramanagara.',
      },
      taluk: {
        type: Type.STRING,
        description: 'Taluk or APMC market yard name, e.g., Yeshwanthpur APMC, Maddur.',
      },
      commodity: {
        type: Type.STRING,
        description:
          'Crop or commodity name (e.g., Tomato, Onion, Ragi, Paddy, Arecanut). Leave empty for major crops.',
      },
    },
    required: ['state', 'district'],
  },
};

const getRealWeatherDecl: FunctionDeclaration = {
  name: 'get_real_weather',
  description:
    'Fetch REAL live current weather and 5-day rain/temperature forecast for any Indian Taluk, District, or State.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      state: { type: Type.STRING },
      district: { type: Type.STRING },
      taluk: { type: Type.STRING },
    },
    required: ['district'],
  },
};

const generateAgronomyImageDecl: FunctionDeclaration = {
  name: 'generate_agronomy_image',
  description:
    'Generate a clean visual image, crop anatomy/pathology illustration, farm layout, or irrigation diagram rendered directly in chat.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description:
          'Short title for the image (in Kannada or English matching user language).',
      },
      description: {
        type: Type.STRING,
        description: 'Short caption explaining the image.',
      },
      visualPrompt: {
        type: Type.STRING,
        description:
          'Detailed description of elements, plants, soil layers, water flow, animals, labels, and colors to draw in an 800x500 SVG diagram.',
      },
    },
    required: ['title', 'description', 'visualPrompt'],
  },
};

const generateAgronomyAudioDecl: FunctionDeclaration = {
  name: 'generate_agronomy_audio',
  description:
    'Generate a spoken voice audio briefing or verbal farming advice playable in an audio player.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Title of the audio clip.',
      },
      script: {
        type: Type.STRING,
        description:
          'Natural spoken script (2-5 sentences) in the requested language (Kannada or English).',
      },
      voiceName: {
        type: Type.STRING,
        description: 'Optional voice name: Puck (male default), Charon, Fenrir, Kore, or Zephyr.',
      },
    },
    required: ['title', 'script'],
  },
};

const chatTools = [
  {
    functionDeclarations: [
      getRealMarketPricesDecl,
      getRealWeatherDecl,
      generateAgronomyImageDecl,
      generateAgronomyAudioDecl,
    ],
  },
];

function sanitizeSvgMarkup(rawSvg: string): string {
  let clean = rawSvg.trim();
  const match = clean.match(/<svg[\s\S]*<\/svg>/i);
  if (match) clean = match[0];
  clean = clean
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
  if (!clean.toLowerCase().startsWith('<svg')) {
    return `<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#F6F7F5"/><text x="40" y="60" font-family="sans-serif" font-size="22" fill="#141A16">Illustration</text></svg>`;
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Error & Retry Helpers (Silent Failover + 60s Cooldown on 503 Spikes)
// ---------------------------------------------------------------------------

let hydrogenCooldownUntil = 0;

const isTransientError = (err: unknown): boolean => {
  const status = (err as { status?: number })?.status;
  if (status && [429, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err);
  const lower = raw.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('fetch failed') ||
    lower.includes('socket hang up') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout')
  );
};

const formatGeminiError = (err: unknown): string => {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const tryExtract = (str: string): string | null => {
    try {
      const parsed = JSON.parse(str) as { error?: { message?: string } };
      if (parsed?.error?.message) {
        return tryExtract(parsed.error.message) ?? parsed.error.message;
      }
    } catch {
      // ignore
    }
    return null;
  };
  const extracted = tryExtract(raw) ?? raw;
  const lower = extracted.toLowerCase();
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('api key')
  ) {
    return 'Gemini API key is missing or invalid. Please check Settings > Secrets.';
  }
  if (
    lower.includes('503') ||
    lower.includes('high demand') ||
    lower.includes('unavailable')
  ) {
    return 'AI service is briefly busy. Please tap Retry.';
  }
  if (lower.includes('429') || lower.includes('resource_exhausted')) {
    return 'Rate limit reached. Please wait a moment and tap Retry.';
  }
  return extracted;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanTextForVoice(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\|[-:\s|]+\|$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/[#*_`>]/g, '')
    .replace(/₹\s*/g, '₹ ')
    .replace(/\bml\/L\b/gi, 'ml per liter')
    .replace(/\bg\/L\b/gi, 'grams per liter')
    .replace(/\bQtl\b/gi, 'Quintal')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitIntoVoiceChunks(text: string, maxChunkLen = 780): string[] {
  const cleaned = cleanTextForVoice(text).slice(0, 3400);
  if (!cleaned) return [];
  if (cleaned.length <= maxChunkLen) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?।])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (!s) continue;
    if ((current + ' ' + s).trim().length <= maxChunkLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      if (s.length <= maxChunkLen) {
        current = s;
      } else {
        chunks.push(s.slice(0, maxChunkLen));
        current = s.slice(maxChunkLen).trim();
      }
    }
    if (chunks.length >= 4) break;
  }
  if (current && chunks.length < 4) chunks.push(current);
  return chunks;
}

function extractWavPcm(buf: Buffer): { fmtChunk: Buffer | null; pcm: Buffer } {
  if (buf.length < 12 || buf.subarray(0, 4).toString('ascii') !== 'RIFF') {
    return { fmtChunk: null, pcm: buf };
  }
  let offset = 12;
  let fmtChunk: Buffer | null = null;
  let pcm: Buffer = Buffer.alloc(0);

  while (offset + 8 <= buf.length) {
    const id = buf.subarray(offset, offset + 4).toString('ascii');
    const size = buf.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = Math.min(buf.length, dataStart + size);
    if (id === 'fmt ') {
      fmtChunk = buf.subarray(offset, dataEnd);
    } else if (id === 'data') {
      pcm = buf.subarray(dataStart, dataEnd);
      break;
    }
    offset = dataStart + size + (size % 2);
  }
  return { fmtChunk, pcm };
}

function downsamplePcm24kTo16k(pcm: Buffer): Buffer {
  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount < 4) return pcm;
  const outSamples = Math.floor((sampleCount * 2) / 3);
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const srcPos = i * 1.5;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const sPrev = idx > 0 ? pcm.readInt16LE((idx - 1) * 2) : pcm.readInt16LE(idx * 2);
    const s0 = pcm.readInt16LE(idx * 2);
    const s1 = idx + 1 < sampleCount ? pcm.readInt16LE((idx + 1) * 2) : s0;
    const s2 = idx + 2 < sampleCount ? pcm.readInt16LE((idx + 2) * 2) : s1;
    // Gentle 3-tap smoothing around interpolated sample for warm, non-harsh voice output
    const interp = s0 + (s1 - s0) * frac;
    const smoothed = Math.round(0.2 * sPrev + 0.6 * interp + 0.2 * s2);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, smoothed)), i * 2);
  }
  return out;
}

function stitchWavBuffers(buffers: Buffer[]): Buffer {
  const pcmParts: Buffer[] = [];
  let sourceSampleRate = 24000;

  for (const b of buffers) {
    const { fmtChunk, pcm } = extractWavPcm(b);
    if (fmtChunk && fmtChunk.length >= 16) {
      sourceSampleRate = fmtChunk.readUInt32LE(12) || 24000;
    }
    if (pcm.length > 0) pcmParts.push(pcm);
  }

  const rawPcm = Buffer.concat(pcmParts);
  const shouldDownsample = sourceSampleRate === 24000 && rawPcm.length > 0;
  const combinedPcm = shouldDownsample ? downsamplePcm24kTo16k(rawPcm) : rawPcm;
  const targetRate = shouldDownsample ? 16000 : sourceSampleRate;

  const fmtBlock = Buffer.alloc(24);
  fmtBlock.write('fmt ', 0, 'ascii');
  fmtBlock.writeUInt32LE(16, 4);
  fmtBlock.writeUInt16LE(1, 8);
  fmtBlock.writeUInt16LE(1, 10);
  fmtBlock.writeUInt32LE(targetRate, 12);
  fmtBlock.writeUInt32LE(targetRate * 2, 16);
  fmtBlock.writeUInt16LE(2, 20);
  fmtBlock.writeUInt16LE(16, 22);

  const totalSize = 4 + fmtBlock.length + 8 + combinedPcm.length;
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(totalSize, 4);
  header.write('WAVE', 8, 'ascii');

  const dataHeader = Buffer.alloc(8);
  dataHeader.write('data', 0, 'ascii');
  dataHeader.writeUInt32LE(combinedPcm.length, 4);

  return Buffer.concat([header, fmtBlock, dataHeader, combinedPcm]);
}

const ttsModelCooldownUntil: Record<string, number> = {};
const ttsAudioCache = new Map<string, string>();
const MAX_TTS_CACHE_ITEMS = 60;

function isQuotaRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) return true;
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota')
  );
}

async function synthesizeSingleTtsChunk(
  ai: GoogleGenAI,
  script: string,
  style: string,
  chosenVoice: string
): Promise<Buffer | null> {
  const attempts: Array<{ model: string; useMetadata: boolean }> = [
    { model: 'gemini-3.8-flash-lite-tts', useMetadata: true },
    { model: 'gemini-3.8-flash-lite-tts', useMetadata: false },
    { model: 'gemini-3.8-flash-tts', useMetadata: true },
    { model: 'gemini-3.8-flash-tts', useMetadata: false },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { model, useMetadata } = attempts[i];
    if (Date.now() < (ttsModelCooldownUntil[model] ?? 0)) {
      continue;
    }

    try {
      const part: Part = useMetadata
        ? {
            text: script,
            speechMetadata: { style },
          }
        : {
            text: script,
          };

      const ttsResponse = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [part],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });
      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return Buffer.from(base64Audio, 'base64');
      }
    } catch (err) {
      if (isQuotaRateLimitError(err)) {
        // Cool down this model for 30 minutes so we don't fire duplicate 429 requests
        ttsModelCooldownUntil[model] = Date.now() + 30 * 60 * 1000;
        continue;
      }
      if (i < attempts.length - 1) await sleep(150);
    }
  }
  return null;
}

function cleanTextForNaturalSpeech(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\([^)]*%[^)]*\)/g, ' ')
    .replace(/\/[A-Za-z &?/-]+(?=\n|$)/g, ' ')
    .replace(/[#*_`~>|]/g, ' ')
    .replace(/(?:^|\n)\s*\d+\.\s+/g, '. ')
    .replace(/(?:^|\n)\s*[-•]\s+/g, ', ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pickMaleEdgeVoice(text: string, language: LanguageMode): string {
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN-GaganNeural';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN-MadhurNeural';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN-MohanNeural';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN-ValluvarNeural';
  if (language === 'en') return 'en-IN-PrabhatNeural';
  return 'kn-IN-GaganNeural';
}

function escapeXmlForSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeVillageSpeechUnits(text: string, isEn: boolean): string {
  let out = text;
  if (!isEn) {
    out = out
      .replace(/\b(\d+(?:\.\d+)?)\s*ml\b/gi, '$1 ಮಿಲಿ')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:gm|gms|g)\b/gi, '$1 ಗ್ರಾಂ')
      .replace(/\b(\d+(?:\.\d+)?)\s*kg\b/gi, '$1 ಕೆಜಿ')
      .replace(/\b(\d+(?:\.\d+)?)\s*(?:ltr|liters?|litres?|L)\b/gi, '$1 ಲೀಟರ್')
      .replace(/\bAPMC\b/gi, 'ಎಪಿಎಂಸಿ ಮಾರುಕಟ್ಟೆ')
      .replace(/%/g, ' ಪರ್ಸೆಂಟ್')
      .replace(/ಶಿಫಾರಸು/g, 'ಸಲಹೆ')
      .replace(/ನಿಯಂತ್ರಣಕ್ಕೆ/g, 'ತಡೆಯೋಕೆ')
      .replace(/ನಿಯಂತ್ರಣ/g, 'ತಡೆ')
      .replace(/ಸಿಂಪಡಿಸಿರಿ|ಸಿಂಪಡಿಸಿ/g, 'ಹೊಡೆಯಿರಿ')
      .replace(/ರೋಗಲಕ್ಷಣಗಳು|ರೋಗಲಕ್ಷಣ/g, 'ರೋಗದ ಗುರುತು')
      .replace(/ಪ್ರಮಾಣದಲ್ಲಿ/g, 'ಅಳತೆಯಲ್ಲಿ')
      .replace(/ಪ್ರಮಾಣ/g, 'ಅಳತೆ')
      .replace(/ಅನುಸರಿಸಿ/g, 'ಹೀಗೆ ಮಾಡಿ')
      .replace(/ಪರಿಹಾರಗಳು|ಪರಿಹಾರ/g, 'ಮದ್ದು');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

async function synthesizeEdgeMaleNeuralMp3(
  script: string,
  language: LanguageMode
): Promise<string | null> {
  const cleanScript = normalizeVillageSpeechUnits(
    cleanTextForNaturalSpeech(script),
    language === 'en'
  );
  if (!cleanScript) return null;

  const voice = pickMaleEdgeVoice(cleanScript, language);
  const ssmlSafeText = escapeXmlForSsml(cleanScript);
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const mp3Buffer = await new Promise<Buffer | null>((resolve) => {
      const chunks: Buffer[] = [];
      let settled = false;
      const finish = (result: Buffer | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish(chunks.length > 0 ? Buffer.concat(chunks) : null);
      }, 12_000);

      try {
        const { audioStream } = tts.toStream(ssmlSafeText, {
          rate: 0.88,
          pitch: '-8Hz',
        });
        audioStream.on('data', (chunk: Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        audioStream.on('end', () => {
          finish(chunks.length > 0 ? Buffer.concat(chunks) : null);
        });
        audioStream.on('error', () => {
          finish(null);
        });
      } catch {
        finish(null);
      }
    });

    if (!mp3Buffer || mp3Buffer.length === 0) return null;
    return `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`;
  } catch {
    return null;
  } finally {
    try {
      tts.close();
    } catch {
      // Ignore socket close error
    }
  }
}

async function convertToFarmerSpokenScript(
  ai: GoogleGenAI,
  rawText: string,
  language: LanguageMode
): Promise<string> {
  const cleaned = cleanTextForNaturalSpeech(rawText);
  if (cleaned.length < 40) return cleaned;

  const hasKannada = /[\u0C80-\u0CFF]/.test(cleaned);
  const hasOtherIndianScript = /[\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0D00-\u0D7F]/.test(
    cleaned
  );

  const rewritePrompt =
    language === 'en'
      ? `Rewrite this farming advice into warm, friendly, everyday spoken English — like a trusted male village farmer brother chatting calmly face-to-face on the field. Remove headings, bullet numbers, and chemical percentage codes. Keep all medicines and doses accurate in plain spoken words (under 110 words). Output ONLY the spoken sentences:\n\n${cleaned}`
      : hasOtherIndianScript && !hasKannada
      ? `Rewrite this farming advice in the EXACT SAME regional Indian language script as the input, using warm everyday spoken village farmer talk (like an experienced farmer brother talking face-to-face on the field). Remove headings, bullet numbers, and chemical percentage codes, keeping medicine names and doses clear in 4-6 gentle spoken sentences. Output ONLY the spoken sentences:\n\n${cleaned}`
      : `ಈ ಕೃಷಿ ಮಾತನ್ನು ನಮ್ಮ ಕರ್ನಾಟಕದ ಹಳ್ಳಿಯ ಒಬ್ಬ ಅನುಭವಿ ರೈತ ಅಣ್ಣ ಹೊಲದ ಬದಿಯಲ್ಲಿ ನಿಂತು ತನ್ನ ರೈತ ತಮ್ಮನಿಗೆ ಪ್ರೀತಿಯಿಂದ ಹೇಳುವಂತೆ **ಅಚ್ಚ ಹಳ್ಳಿ ಆಡುಭಾಷೆಯ ಕನ್ನಡದಲ್ಲಿ** ಬದಲಾಯಿಸಿ.
ಕಡ್ಡಾಯ ನಿಯಮಗಳು:
- ಸರ್ಕಾರಿ/ಪುಸ್ತಕದ/ನ್ಯೂಸ್‌ರೀಡರ್ ಪದಗಳಾದ "ಶಿಫಾರಸು", "ನಿಯಂತ್ರಣ", "ಪ್ರಮಾಣ", "ಅನುಸರಿಸಿ", "ರೋಗಲಕ್ಷಣ", "ಸಿಂಪಡಿಸಿ", "ಪರಿಹಾರ", "ಲಭ್ಯವಿದೆ", "ವಿಧಾನ" ಪದಗಳನ್ನು ಖಂಡಿತಾ ಬಳಸಬೇಡಿ.
- ಬದಲಾಗಿ ಅಚ್ಚ ಹಳ್ಳಿ ಮಾತುಗಳಾದ "ನೋಡಣ್ಣ", "ತಲೆ ಕೆಡಿಸ್ಕೊಬೇಡ", "ಹೀಗ್ ಮಾಡಿ", "ಒಂದು ಟ್ಯಾಂಕ್ ನೀರಿಗೆ ಇಷ್ಟು ಮಿಲಿ ಹಾಕಿ ಹೊಡೆಯಿರಿ", "ಬೆಳಗ್ಗೆ ಇಲ್ಲಾ ಸಂಜೆ ಬಿಸಿಲು ಇಳಿದಾಗ ಹೊಡೆದ್ರೆ ಸಾಕು", "ನಾಲ್ಕೈದು ದಿನದಲ್ಲಿ ಗಿಡ ಹಸಿರಾಗುತ್ತೆ" ಅಂತ ಮಾತನಾಡಿ.
- ಯಾವುದೇ ಇಂಗ್ಲಿಷ್ ಪದ (ml, g, kg, APMC, Acetamiprid ಇತ್ಯಾದಿ) ಇದ್ದರೆ ಅದನ್ನು ಕನ್ನಡ ಉಚ್ಚಾರಣೆಯಲ್ಲೇ ಬರೆಯಿರಿ (ಉದಾ: "ಮಿಲಿ", "ಗ್ರಾಂ", "ಅಸಿಟಾಮಿಪ್ರಿಡ್") — ಧ್ವನಿ ಓದುವಾಗ ಇಂಗ್ಲಿಷ್ ಅಕ್ಷರ ಬರಬಾರದು!
- ನಂಬರ್ ಲಿಸ್ಟ್, ಬ್ರಾಕೆಟ್ ಅಥವಾ ಹೆಡ್ಡಿಂಗ್ ಬೇಡ — ನೇರವಾಗಿ ಒಬ್ಬ ಹಳ್ಳಿ ರೈತ ಅಣ್ಣ ಮಾತನಾಡುವಂತೆ 4–6 ಮೃದುವಾದ, ನಿಧಾನದ ವಾಕ್ಯಗಳಲ್ಲಿ (ಕಾಮಾ ಮತ್ತು ಸಣ್ಣ ವಿರಾಮ ಹಾಕಿ) ಕೊಡಿ:\n\n${cleaned}`;

  const rewriteModels =
    Date.now() < hydrogenCooldownUntil
      ? ['gemini-3.1-flash-lite']
      : ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];

  for (const modelName of rewriteModels) {
    try {
      const resp = await ai.models.generateContent({
        model: modelName,
        contents: rewritePrompt,
        config:
          modelName === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : undefined,
      });
      const spoken = normalizeVillageSpeechUnits(
        cleanTextForNaturalSpeech(resp.text ?? ''),
        language === 'en'
      );
      if (spoken.length >= 25) return spoken;
    } catch (err) {
      if (modelName === 'gemini-4-hydrogen' && isTransientError(err)) {
        hydrogenCooldownUntil = Date.now() + 60_000;
      }
    }
  }
  return normalizeVillageSpeechUnits(cleaned, language === 'en');
}

async function synthesizeFreeTtsAudio(
  ai: GoogleGenAI,
  script: string,
  style = 'Speak smoothly, warmly, and naturally in a friendly male Karnataka village farmer voice — calm conversational pace, everyday rural warmth, never official or like a newsreader.',
  voiceName = 'Puck',
  language: LanguageMode = 'kn-village'
): Promise<string | null> {
  const validVoices = new Set(['Puck', 'Charon', 'Fenrir', 'Kore', 'Zephyr']);
  const chosenVoice = validVoices.has(voiceName) ? voiceName : 'Puck';

  const cleanScript = cleanTextForNaturalSpeech(script);
  if (!cleanScript) return null;

  const cacheKey = `${language}|${chosenVoice}|${cleanScript}`;
  const cachedAudio = ttsAudioCache.get(cacheKey);
  if (cachedAudio) {
    return cachedAudio;
  }

  let dataUrl: string | null = null;

  const chunks = splitIntoVoiceChunks(cleanScript, 1200);
  if (chunks.length > 0) {
    const wavBuffers = await Promise.all(
      chunks.map((chunk) => synthesizeSingleTtsChunk(ai, chunk, style, chosenVoice))
    );
    const validBuffers = wavBuffers.filter((b): b is Buffer => Boolean(b));
    if (validBuffers.length === chunks.length && validBuffers.length > 0) {
      const finalWav = stitchWavBuffers(validBuffers);
      dataUrl = `data:audio/wav;base64,${finalWav.toString('base64')}`;
    }
  }

  // Unlimited warm male Indian neural backup when Gemini TTS daily free quota is exhausted
  if (!dataUrl) {
    dataUrl = await synthesizeEdgeMaleNeuralMp3(cleanScript, language);
  }

  if (!dataUrl) return null;

  if (ttsAudioCache.size >= MAX_TTS_CACHE_ITEMS) {
    const oldestKey = ttsAudioCache.keys().next().value;
    if (oldestKey) ttsAudioCache.delete(oldestKey);
  }
  ttsAudioCache.set(cacheKey, dataUrl);
  return dataUrl;
}

async function generateFreeSvgImage(
  ai: GoogleGenAI,
  title: string,
  visualPrompt: string
): Promise<string> {
  const prompt = `Create a clean, detailed 800x500 SVG farming illustration/diagram for:
Title: ${title}
Description: ${visualPrompt}

Rules:
- Return JSON with field "svgMarkup".
- Root MUST be <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">.
- Draw clear shapes (soil layers, leaves, roots, drip pipes, crops, polyhouse, livestock, or fish pond) with crisp readable labels and high contrast.
- No scripts or external URLs.`;

  const svgModels =
    Date.now() < hydrogenCooldownUntil
      ? ['gemini-3.1-flash-lite']
      : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

  for (const modelName of svgModels) {
    try {
      const resp = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          thinkingConfig:
            modelName === 'gemini-4-hydrogen'
              ? { thinkingLevel: ThinkingLevel.LOW }
              : undefined,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              svgMarkup: { type: Type.STRING },
            },
            required: ['svgMarkup'],
          },
        },
      });
      const parsed = JSON.parse(resp.text || '{}') as { svgMarkup?: string };
      if (parsed.svgMarkup) {
        return sanitizeSvgMarkup(parsed.svgMarkup);
      }
    } catch (err) {
      if (modelName === 'gemini-4-hydrogen' && isTransientError(err)) {
        hydrogenCooldownUntil = Date.now() + 60_000;
      }
    }
  }

  return `<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="500" fill="#F6F7F5"/>
    <rect x="32" y="32" width="736" height="436" rx="14" fill="#FFFFFF" stroke="#D4DAD4" stroke-width="2"/>
    <text x="60" y="92" font-family="sans-serif" font-size="24" font-weight="bold" fill="#141A16">${title.replace(/[<>&]/g, '')}</text>
    <text x="60" y="132" font-family="sans-serif" font-size="15" fill="#4A554E">${visualPrompt.slice(0, 90).replace(/[<>&]/g, '')}</text>
  </svg>`;
}

async function executeChatTool(
  ai: GoogleGenAI,
  name: string,
  args: Record<string, unknown>
): Promise<{
  result: Record<string, unknown>;
  media?: GeneratedMediaItem;
  sources?: GroundSource[];
}> {
  if (name === 'get_real_market_prices') {
    const state = String(args.state ?? 'Karnataka');
    const district = String(args.district ?? '');
    const taluk = String(args.taluk ?? '');
    const commodity = String(args.commodity ?? '');
    const liveData = await fetchRealCombinedMarket({
      state,
      district,
      taluk,
      commodity,
    });
    return {
      result: {
        ok: true,
        source: 'Live Daily Market Feed & Official CEDA Agmarknet Database (Real Data)',
        state: liveData.state,
        district: liveData.district,
        taluk: liveData.taluk,
        records: liveData.rows,
        strictInstruction:
          'Present ONLY these exact real figures and exact dates. NEVER change or invent prices.',
      },
      sources: liveData.sources,
    };
  }

  if (name === 'get_real_weather') {
    const state = String(args.state ?? 'Karnataka');
    const district = String(args.district ?? 'Bengaluru');
    const taluk = String(args.taluk ?? '');
    const weather = await fetchRealLiveWeather({ state, district, taluk });
    return {
      result: { ...weather },
    };
  }

  if (name === 'generate_agronomy_image') {
    const title = String(args.title ?? 'ಕೃಷಿ ಚಿತ್ರ / Farming Diagram');
    const description = String(args.description ?? '');
    const visualPrompt = String(args.visualPrompt ?? title);
    const svgMarkup = await generateFreeSvgImage(ai, title, visualPrompt);
    return {
      result: { ok: true, title },
      media: {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'image',
        title,
        description,
        svgMarkup,
      },
    };
  }

  if (name === 'generate_agronomy_audio') {
    const title = String(args.title ?? 'ಧ್ವನಿ ಸಲಹೆ / Audio Guide');
    const script = String(args.script ?? '');
    const voiceName = String(args.voiceName ?? 'Puck');
    const audioDataUrl = await synthesizeFreeTtsAudio(
      ai,
      script,
      'Warm, smooth, friendly male Karnataka village farmer voice talking naturally in everyday spoken Kannada',
      voiceName,
      /[\u0C80-\u0CFF]/.test(script) ? 'kn-village' : 'en'
    );
    if (!audioDataUrl) {
      return {
        result: { ok: false, error: 'Audio generation temporarily busy.' },
      };
    }
    return {
      result: { ok: true, title },
      media: {
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: 'audio',
        title,
        script,
        voiceName,
        audioDataUrl,
      },
    };
  }

  return { result: { error: `Unknown tool: ${name}` } };
}

function buildSystemInstruction(
  sector: AgriSector,
  language: LanguageMode,
  farmingMode: FarmingMode
) {
  const languageRules: Record<LanguageMode, string> = {
    'kn-village': `FARMER LOCAL VILLAGE LANGUAGE (CRITICAL):
- Talk ONLY in warm, genuine Karnataka village spoken Kannada (ಅಚ್ಚ ಹಳ್ಳಿಯ ರೈತರ ಆಡುಮಾತು) — like an experienced farmer brother talking face-to-face on the field. NEVER sound like an officer, textbook, or TV newsreader.
- Strictly FORBIDDEN words (never write): ಶಿಫಾರಸು, ನಿಯಂತ್ರಣ, ರೋಗಲಕ್ಷಣ, ಅನುಸರಿಸಿ, ಪ್ರಮಾಣ, ಸಿಂಪಡಿಸಿ, ಪರಿಹಾರ, ವಿಧಾನ, ಅವಶ್ಯಕತೆ, ಲಭ್ಯವಿದೆ.
- ALWAYS use warm rural village phrases: "ನೋಡಣ್ಣ / ನೋಡಕ್ಕ, ತಲೆ ಕೆಡಿಸ್ಕೊಬೇಡ", "ಹೀಗ್ ಮಾಡಿ", "ಒಂದು ಟ್ಯಾಂಕ್ ನೀರಿಗೆ ಇಷ್ಟು ಮಿಲಿ ಹಾಕಿ ಹೊಡೆಯಿರಿ", "ಬೆಳಗ್ಗೆ ಎದ್ದ ತಕ್ಷಣ ಇಲ್ಲಾ ಸಂಜೆ ಬಿಸಿಲು ಇಳಿದ ಮೇಲೆ ಹೊಡೆದ್ರೆ ಸಾಕು", "ನಾಲ್ಕೈದು ದಿನದಲ್ಲಿ ಗಿಡ ಚೆನ್ನಾಗಿ ಚಿಗುರುತ್ತೆ".
- Do NOT put English headings or long English sentences. Write shop medicine names simply in Kannada (you can keep the short shop name once so the farmer can buy it at the store).
- If the farmer asks in another local Indian language (Hindi, Telugu, Tamil, Marathi, Malayalam), reply warmly in that SAME local village spoken language!`,
    'kn-en': `FARMER LOCAL LANGUAGE:
- Talk warmly in simple everyday village Kannada with shop medicine/crop names clearly in brackets. Avoid stiff textbook words.
- If the farmer speaks in another local Indian language, reply in that SAME language.`,
    en: `FARMER LOCAL LANGUAGE:
- Talk warmly and simply like a helpful local farm friend speaking face-to-face — plain everyday words, never stiff or official.`,
  };

  const sectorFocus: Record<AgriSector, string> = {
    all: 'Cover all agriculture: field crops, horticulture, polyhouse, livestock/dairy/poultry, and fisheries.',
    'row-crops': 'Focus on paddy, ragi, maize, jowar, sugarcane, cotton, groundnut, and pulses.',
    horticulture: 'Focus on arecanut, coconut, coffee, pepper, banana, mango, tomato, onion, and vegetables.',
    greenhouse: 'Focus on polyhouse, shade-net, hydroponics, and fertigation.',
    livestock: 'Focus on dairy cattle, buffalo, sheep, goat, native poultry, fodder, and shed hygiene.',
    aquaculture: 'Focus on pond fish farming (Catla, Rohu, Tilapia), biofloc, water quality, and feeding.',
  };

  const farmingModeRule: Record<FarmingMode, string> = {
    both:
      language === 'en'
        ? `FARMING METHOD (FRIENDLY SPOKEN FLOW):
Organize clearly in 4 short, warm, easy-to-follow steps:
1. **Why this happened**: Root cause in plain words (describe photo findings if attached).
2. **Home / Organic remedy**: Natural remedy (Neem oil, Jeevamrutha, buttermilk spray, etc.) with simple per-liter / per-tank measure.
3. **Shop medicine (Chemical)**: Clear medicine name, simple dose per liter / spray tank, and safe wait days.
4. **Keep it away**: 1–2 quick farm tips.`
        : `FARMING METHOD (ಹಳ್ಳಿ ರೈತರಿಗೆ ಅರ್ಥವಾಗುವ ಸುಲಭ ಮಾತು):
ಯಾವುದೇ ಬೆಳೆ, ಮಣ್ಣು, ಹುಳು ಅಥವಾ ರೋಗದ ಪ್ರಶ್ನೆಗೆ ಈ 4 ಹಳ್ಳಿ ಮಾತಿನಲ್ಲೇ ಉತ್ತರ ಹೇಳಿ:
1. **ಯಾಕೆ ಹಿಂಗಾಗಿದೆ?**: ಯಾಕೆ ಬಂತು ಅಂತ ಸರಳ ಹಳ್ಳಿ ಮಾತಲ್ಲಿ ಹೇಳಿ (ಫೋಟೋ ಇದ್ದರೆ ಅದರಲ್ಲಿ ಕಂಡದ್ದನ್ನು ತಿಳಿಸಿ).
2. **ಮನೆ ಮದ್ದು (ಸಾವಯವ)**: ಬೇವಿನ ಎಣ್ಣೆ, ಜೀವಾಮೃತ, ಮಜ್ಜಿಗೆ/ಗೋಮೂತ್ರ ತರಹದ ಮನೆ ಮದ್ದು — ಒಂದು ಲೀಟರ್ ಇಲ್ಲಾ ಒಂದು ಟ್ಯಾಂಕ್ ನೀರಿಗೆ ಎಷ್ಟು ಹಾಕಿ ಹೊಡೆಯಬೇಕು ಹೇಳಿ.
3. **ಅಂಗಡಿ ಔಷಧಿ (ರಾಸಾಯನಿಕ)**: ಅಂಗಡಿಯಲ್ಲಿ ಏನು ಅಂತ ಕೇಳಿ ತರಬೇಕು, ಒಂದು ಟ್ಯಾಂಕ್ ನೀರಿಗೆ ಎಷ್ಟು ಮಿಲಿ ಬೆರೆಸಿ ಹೊಡೆಯಬೇಕು ಮತ್ತು ಎಷ್ಟು ದಿನ ಕಾಯಬೇಕು ಹೇಳಿ.
4. **ಮುಂದೆ ಹಿಂಗಾಗದಂಗೆ ಜಾಗ್ರತೆ**: 1–2 ಚಿಕ್ಕ ಹೊಲದ ಸಲಹೆ ಕೊಡಿ.`,
    organic:
      language === 'en'
        ? `FARMING METHOD (ORGANIC ONLY):
Explain simply in warm everyday words: 1) Why it happened, 2) Exact natural/home remedy with easy per-tank/liter measure, 3) 1–2 quick tips.`
        : `FARMING METHOD (ಮನೆ ಮದ್ದು / ಸಾವಯವ ಮಾತ್ರ):
ಸರಳ ಹಳ್ಳಿ ಮಾತಿನಲ್ಲಿ ತಿಳಿಸಿ: 1) ಯಾಕೆ ಹಿಂಗಾಗಿದೆ, 2) ಮನೆ ಮದ್ದು (ಒಂದು ಲೀಟರ್ / ಟ್ಯಾಂಕ್ ನೀರಿಗೆ ಎಷ್ಟು ಹಾಕಿ ಹೊಡೆಯಬೇಕು), 3) ಮುಂದೆ ಹಿಂಗಾಗದಂಗೆ 1–2 ಚಿಕ್ಕ ಸಲಹೆ.`,
    chemical:
      language === 'en'
        ? `FARMING METHOD (CHEMICAL ONLY):
Explain simply in warm everyday words: 1) Why it happened, 2) Exact shop medicine name & simple per-tank/liter dose + safe days, 3) 1–2 quick tips.`
        : `FARMING METHOD (ಅಂಗಡಿ ಔಷಧಿ ಮಾತ್ರ):
ಸರಳ ಹಳ್ಳಿ ಮಾತಿನಲ್ಲಿ ತಿಳಿಸಿ: 1) ಯಾಕೆ ಹಿಂಗಾಗಿದೆ, 2) ಅಂಗಡಿಯಲ್ಲಿ ಕೇಳಿ ತರುವ ಔಷಧಿ ಹೆಸರು, ಒಂದು ಟ್ಯಾಂಕ್ ನೀರಿಗೆ ಎಷ್ಟು ಹಾಕಿ ಹೊಡೆಯಬೇಕು ಮತ್ತು ಎಷ್ಟು ದಿನ ಕಾಯಬೇಕು, 3) ಮುಂದೆ ಹಿಂಗಾಗದಂಗೆ 1–2 ಚಿಕ್ಕ ಸಲಹೆ.`,
  };

  return `You are ರೈತ ಮಿತ್ರ (Agron), a friendly, down-to-earth local village farming companion.

${languageRules[language]}

SECTOR FOCUS: ${sectorFocus[sector] ?? sectorFocus.all}

${farmingModeRule[farmingMode]}

NATURAL FARMER VOICE & RURAL SPEED STYLE:
- Write in short, warm, spoken sentences that sound completely natural when read aloud to a farmer who cannot read — zero robotic phrasing, zero markdown tables.
- If the farmer asks for APMC / mandi / market rates for any State, District, Taluk (including Bengaluru), or Crop, call \`get_real_market_prices\` and report ONLY the exact real figures and dates returned (NEVER guess or modify prices).
- If the farmer asks for local weather or rain/temperature forecast, call \`get_real_weather\`.
- Only call \`generate_agronomy_image\` or \`generate_agronomy_audio\` when the user explicitly asks for an image/diagram or audio clip.
- Keep replies concise (100–175 words) so both text and warm farmer voice play fast even on slow village internet.`;
}

// ---------------------------------------------------------------------------
// Express App & Routes
// ---------------------------------------------------------------------------

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Lightweight built-in GZIP compression for low-bandwidth village connections
  app.use((req, res, next) => {
    if (req.path === '/api/chat') return next();
    const accept = String(req.headers['accept-encoding'] || '');
    if (!accept.includes('gzip')) return next();

    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const raw = Buffer.from(JSON.stringify(body), 'utf8');
      if (raw.length < 1024) {
        return origJson(body);
      }
      gzip(raw, { level: 6 }, (err, compressed) => {
        if (err) {
          origJson(body);
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.send(compressed);
      });
      return res;
    }) as typeof res.json;
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // Live Real Weather Endpoint (Open-Meteo)
  app.post('/api/weather/live', async (req, res) => {
    try {
      const {
        state = 'Karnataka',
        district = 'Bengaluru Urban',
        taluk = '',
      } = req.body as {
        state?: string;
        district?: string;
        taluk?: string;
      };
      const weather = await fetchRealLiveWeather({ state, district, taluk });
      res.json(weather);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Could not fetch live weather.',
      });
    }
  });

  // Daily Krishi Care & Crop Calendar AI Analysis (Daily Update + Weather + Problem/Changes + Organic/Chemical + Cutting)
  app.post('/api/krishi-care/analyze', async (req, res) => {
    try {
      const {
        cropName,
        dayNumber = 1,
        stage = 'growing',
        state = 'Karnataka',
        district = '',
        taluk = '',
        changesObserved = '',
        problemObserved = '',
        previousLogs = [],
        weather = null,
        farmingMode = 'both',
        language = 'kn-village',
        attachment = null,
      } = req.body as {
        cropName?: string;
        dayNumber?: number;
        stage?: CropStage;
        state?: string;
        district?: string;
        taluk?: string;
        changesObserved?: string;
        problemObserved?: string;
        previousLogs?: DailyCropLogEntry[];
        weather?: LiveWeatherData | null;
        farmingMode?: FarmingMode;
        language?: LanguageMode;
        attachment?: { mimeType: string; dataBase64: string } | null;
      };

      if (!cropName?.trim()) {
        res.status(400).json({ error: 'Crop name is required.' });
        return;
      }

      const ai = getGeminiClient();
      const langPrompt =
        language === 'en'
          ? 'Reply in simple, warm, everyday farmer English (no stiff official tone).'
          : language === 'kn-en'
          ? 'Reply in warm everyday village Kannada with clear shop medicine names in brackets (no formal textbook words).'
          : 'Reply ONLY in warm, simple everyday Karnataka village farmer Kannada (ಸಹಜ ಹಳ್ಳಿಯ ರೈತರ ಮಾತುಕತೆ — ಯಾವುದೇ ಅಧಿಕೃತ/ಪಠ್ಯಪುಸ್ತಕ ಪದಗಳು ಅಥವಾ ಇಂಗ್ಲಿಷ್ ಸ್ಲ್ಯಾಶ್ ಹೆಡ್ಡಿಂಗ್ ಬೇಡ).';

      const prevSummary = (previousLogs ?? [])
        .slice(-3)
        .map(
          (l) =>
            `Day ${l.dayNumber} (${l.date}): Changes="${l.changesObserved}", Problem="${l.problemObserved}"`
        )
        .join('\n');

      const weatherCtx = weather
        ? `Live Weather in ${weather.locationLabel}: ${weather.currentTempC}°C, Humidity ${weather.humidityPct}%, Rain ${weather.precipMm}mm, Wind ${weather.windKmh}km/h. 5-day forecast: ${weather.daily
            .map((d) => `${d.date}: ${d.tempMin}-${d.tempMax}°C, Rain ${d.precipProb}% (${d.precipMm}mm)`)
            .join('; ')}`
        : 'Weather not provided.';

      const farmingInstruction =
        farmingMode === 'organic'
          ? 'Give Organic / home-made farming solutions in simple tank/liter terms.'
          : farmingMode === 'chemical'
          ? 'Give Chemical / shop medicine solutions in simple tank/liter terms.'
          : 'Give BOTH Organic (ಮನೆ ಮದ್ದು) and Chemical (ಅಂಗಡಿ ಔಷಧಿ) solutions in simple tank/liter terms.';

      const hasImage = Boolean(attachment?.dataBase64 && attachment?.mimeType);
      const prompt = `Analyze today's Daily Krishi Care update & ${
        hasImage ? 'attached daily crop scan photo' : 'field observation'
      } for this farmer's crop:
- Crop: ${cropName}
- Crop Age: Day ${dayNumber} (Reported Stage: ${stage})
- Location: ${taluk || district}, ${district}, ${state}
- ${weatherCtx}
- Recent Previous Daily Updates:\n${prevSummary || 'First update today'}
- TODAY'S CHANGES OBSERVED: ${changesObserved || (hasImage ? 'Visual scan photo provided' : 'Normal growth')}
- TODAY'S PROBLEM / SYMPTOMS: ${problemObserved || (hasImage ? 'Inspect photo closely for any disease, pest, spot, curl, deficiency, or rot' : 'None reported')}

${langPrompt}
${farmingInstruction}

Return a JSON object with ALL fields below:
1. "detectedStage": MUST be one exact value from ["sowing", "growing", "flowering", "cutting-ready"] based on visual inspection of the photo (leaves/flowers/fruits/maturity) and Day ${dayNumber}.
2. "stageLabel": Short localized stage label (e.g., "${language === 'en' ? 'Flowering Stage' : 'ಹೂವು ಮತ್ತು ಕಾಯಿ ಹಂತ'}").
3. "diseaseName": Simple farmer-friendly name of the exact disease/pest/nutrient issue seen (e.g., "ಎಲೆ ಚುಕ್ಕೆ ರೋಗ") OR "${language === 'en' ? 'Healthy Crop (No Disease)' : 'ಬೆಳೆ ಆರೋಗ್ಯವಾಗಿದೆ (ಯಾವುದೇ ರೋಗ ಇಲ್ಲ)'}" if healthy.
4. "healthStatus": "healthy" if crop looks good, "warning" if mild/early symptoms, or "critical" if moderate/severe disease/pest needs urgent spray.
5. "daysToHarvest": Integer estimate of remaining days until cutting/harvest from today (0 if already ready for cutting now).
6. "recoveryDays": Integer estimate of days needed to recover/control the issue with solution (0 if healthy).
7. "solutionSummary": 1 simple farmer-friendly sentence summarizing what to do today and in how many days it recovers.
8. "guidance": Concise warm advice in 4 easy sections (no official jargon):
   1. **${language === 'en' ? 'Crop Stage & What Happened' : 'ಬೆಳೆ ಹಂತ ಮತ್ತು ಯಾಕೆ ಹೀಗಾಗಿದೆ?'}**: Plain explanation of stage, weather comparison, and why any issue appeared.
   2. **${language === 'en' ? "Today's Water & Care" : 'ಇಂದಿನ ನೀರು ಮತ್ತು ಆರೈಕೆ'}**: Easy watering & timing for Day ${dayNumber}.
   3. **${language === 'en' ? 'Remedy & Day Plan' : 'ಪರಿಹಾರ ಮತ್ತು ದಿನಗಳ ಲೆಕ್ಕ'}**: Simple per-liter / per-tank dosage + Day 1, Day 4, Day 7 check.
   4. **${language === 'en' ? 'Days Left to Harvest' : 'ಕಟಾವಿಗೆ ಎಷ್ಟು ದಿನ ಬಾಕಿ?'}**: Harvest countdown and recovery days.`;

      const parts: Part[] = [];
      if (attachment?.dataBase64 && attachment?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.dataBase64,
          },
        });
      }
      parts.push({ text: prompt });

      const candidates =
        Date.now() < hydrogenCooldownUntil
          ? ['gemini-3.1-flash-lite']
          : ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];

      let rawResponse = '';
      let lastErr: unknown = null;

      for (let i = 0; i < candidates.length; i++) {
        const modelName = candidates[i];
        try {
          const resp = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts }],
            config: {
              temperature: 0.25,
              thinkingConfig:
                modelName === 'gemini-4-hydrogen'
                  ? { thinkingLevel: ThinkingLevel.LOW }
                  : undefined,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  detectedStage: {
                    type: Type.STRING,
                    enum: ['sowing', 'growing', 'flowering', 'cutting-ready'],
                  },
                  stageLabel: { type: Type.STRING },
                  diseaseName: { type: Type.STRING },
                  healthStatus: {
                    type: Type.STRING,
                    enum: ['healthy', 'warning', 'critical'],
                  },
                  daysToHarvest: { type: Type.INTEGER },
                  recoveryDays: { type: Type.INTEGER },
                  solutionSummary: { type: Type.STRING },
                  guidance: { type: Type.STRING },
                },
                required: [
                  'detectedStage',
                  'stageLabel',
                  'diseaseName',
                  'healthStatus',
                  'daysToHarvest',
                  'recoveryDays',
                  'solutionSummary',
                  'guidance',
                ],
              },
            },
          });
          rawResponse = (resp.text ?? '').trim();
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (modelName === 'gemini-4-hydrogen' && isTransientError(err)) {
            hydrogenCooldownUntil = Date.now() + 60_000;
          }
          if (isTransientError(err) && i < candidates.length - 1) {
            await sleep(250);
            continue;
          }
          throw err;
        }
      }

      if (lastErr) throw lastErr;

      let parsed: {
        detectedStage?: CropStage;
        stageLabel?: string;
        diseaseName?: string;
        healthStatus?: 'healthy' | 'warning' | 'critical';
        daysToHarvest?: number;
        recoveryDays?: number;
        solutionSummary?: string;
        guidance?: string;
      } = {};

      try {
        const cleanJson = rawResponse
          .replace(/^```json\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        parsed = JSON.parse(cleanJson) as typeof parsed;
      } catch {
        parsed = { guidance: rawResponse };
      }

      const validStages = new Set<CropStage>([
        'sowing',
        'growing',
        'flowering',
        'cutting-ready',
      ]);
      const detectedStage =
        parsed.detectedStage && validStages.has(parsed.detectedStage)
          ? parsed.detectedStage
          : stage;

      res.json({
        ok: true,
        detectedStage,
        stageLabel: parsed.stageLabel || detectedStage,
        diseaseName:
          parsed.diseaseName ||
          (language === 'en' ? 'Scan completed' : 'ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಂಡಿದೆ'),
        healthStatus:
          parsed.healthStatus === 'warning' ||
          parsed.healthStatus === 'critical'
            ? parsed.healthStatus
            : 'healthy',
        daysToHarvest:
          typeof parsed.daysToHarvest === 'number' &&
          Number.isFinite(parsed.daysToHarvest)
            ? Math.max(0, Math.round(parsed.daysToHarvest))
            : undefined,
        recoveryDays:
          typeof parsed.recoveryDays === 'number' &&
          Number.isFinite(parsed.recoveryDays)
            ? Math.max(0, Math.round(parsed.recoveryDays))
            : undefined,
        solutionSummary: parsed.solutionSummary || '',
        guidance: (parsed.guidance || rawResponse).trim(),
        weatherNote: weather?.weatherSummary,
      });
    } catch (err) {
      res.status(500).json({ error: formatGeminiError(err) });
    }
  });

  // Live Real State -> District -> Taluk Market Details (Live Vegetable Feed + Official CEDA Agmarknet)
  app.post('/api/market/live', async (req, res) => {
    try {
      const {
        state = 'Karnataka',
        district = '',
        taluk = '',
        commodity = '',
        language = 'kn-village',
      } = req.body as {
        state?: string;
        district?: string;
        taluk?: string;
        commodity?: string;
        language?: LanguageMode;
      };

      if (!state.trim() || !district.trim()) {
        res.status(400).json({ error: 'State and District are required.' });
        return;
      }

      const data = await fetchRealCombinedMarket({
        state: state.trim(),
        district: district.trim(),
        taluk: taluk.trim(),
        commodity: commodity.trim(),
      });

      const hasDistrictRows = data.rows.some((r) => r.scope === 'district');
      let summary = '';

      if (data.rows.length === 0) {
        summary =
          language === 'en'
            ? `No market records matched "${commodity || 'this selection'}" for ${data.taluk}, ${data.district}. Check the official APMC portals linked below.`
            : `${data.state} ರಾಜ್ಯದ ${data.district} ಜಿಲ್ಲೆಯ ${data.taluk} ತಾಲೂಕಿಗೆ "${commodity || 'ಈ ಬೆಳೆ'}" ಬಗ್ಗೆ ದಾಖಲೆ ಸಿಗಲಿಲ್ಲ. ಕೆಳಗಿನ ಅಧಿಕೃತ ಎಪಿಎಂಸಿ ಲಿಂಕ್‌ಗಳಲ್ಲಿ ನೋಡಿ.`;
      } else if (language === 'en') {
        summary = hasDistrictRows
          ? `Real market rates for ${data.taluk} (${data.district}, ${data.state}). All prices below are exact unedited official live & Agmarknet figures.`
          : `Showing real ${data.state} State official Agmarknet rates for your selected crops below.`;
      } else {
        summary = hasDistrictRows
          ? `${data.state} ರಾಜ್ಯದ ${data.district} (${data.taluk}) ನೈಜ ಮಾರುಕಟ್ಟೆ ದರಗಳು ಕೆಳಗಿವೆ. ಯಾವುದೇ ಬದಲಾವಣೆ ಇಲ್ಲದ ಅಧಿಕೃತ ನೈಜ ಬೆಲೆಗಳು:`
          : `${data.state} ರಾಜ್ಯದ ಅಧಿಕೃತ Agmarknet ನೈಜ ಬೆಲೆಗಳನ್ನು ಕೆಳಗೆ ತೋರಿಸಲಾಗಿದೆ:`;
      }

      res.json({
        ok: true,
        state: data.state,
        district: data.district,
        taluk: data.taluk,
        commodity: commodity || undefined,
        fetchedAt: new Date().toISOString(),
        summary,
        rows: data.rows,
        sources: data.sources,
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Could not reach live market data service.',
      });
    }
  });

  // Transcribe recorded voice audio (Kannada / English) with maximum sensitivity & multi-model fallback
  app.post('/api/audio/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm', language = 'kn-village' } =
        req.body as {
          audioBase64?: string;
          mimeType?: string;
          language?: LanguageMode;
        };

      if (!audioBase64 || audioBase64.length < 64) {
        res.status(400).json({ error: 'Audio data is too short or empty.' });
        return;
      }

      const cleanMime = mimeType.split(';')[0].trim() || 'audio/webm';
      const ai = getGeminiClient();
      const langHint =
        language === 'en'
          ? 'Listen with maximum sensitivity to natural everyday speech, soft voices, rural accents, pauses, or outdoor farm wind noise. Transcribe EVERY audible spoken word naturally and accurately (preserving English or any regional crop words). Output ONLY the spoken words with no commentary.'
          : 'Listen with MAXIMUM sensitivity to natural village speech, soft/distant voices, rural Karnataka Kannada dialects, pauses, or other natural Indian languages (Hindi, Telugu, Tamil, Marathi) with farm background noise. Transcribe EVERY audible word faithfully in the natural script spoken (Kannada script for Kannada, preserving any English crop/chemical names). Output ONLY the spoken words with no extra commentary.';

      const transcribeModels = [
        'gemini-3.5-transcribe',
        'gemini-3.1-flash-lite',
        'gemini-4-hydrogen',
      ];
      let transcriptText = '';
      let lastTranscribeErr: unknown = null;

      for (let i = 0; i < transcribeModels.length; i++) {
        const modelName = transcribeModels[i];
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                { inlineData: { mimeType: cleanMime, data: audioBase64 } },
                { text: langHint },
              ],
            },
          });
          const candidate = (response.text ?? '').trim();
          const isBlankOrNoiseTag =
            !candidate ||
            /^(\[.*\]|\(.*\)|<.*>|silence|inaudible|no speech|blank|empty)\.?$/i.test(
              candidate
            );
          if (!isBlankOrNoiseTag) {
            transcriptText = candidate;
            lastTranscribeErr = null;
            break;
          }
          // Model returned empty/placeholder — try next model if available
          lastTranscribeErr = null;
        } catch (err) {
          lastTranscribeErr = err;
          if (i < transcribeModels.length - 1) {
            await sleep(200);
            continue;
          }
        }
      }

      if (lastTranscribeErr && !transcriptText) {
        throw lastTranscribeErr;
      }

      res.json({ ok: Boolean(transcriptText), transcript: transcriptText });
    } catch (err) {
      res.status(500).json({ error: formatGeminiError(err) });
    }
  });

  // Smooth Male Local-Dialect Farmer Text-to-Speech endpoint via gemini-3.8-flash-lite-tts
  app.post('/api/audio/tts', async (req, res) => {
    try {
      const {
        text,
        voiceName = 'Puck',
        language = 'kn-village',
      } = req.body as {
        text?: string;
        voiceName?: string;
        language?: LanguageMode;
      };
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required.' });
        return;
      }
      const ai = getGeminiClient();

      const spokenFarmerScript = await convertToFarmerSpokenScript(
        ai,
        text,
        language
      );

      const voiceStyle =
        language === 'en'
          ? 'Speak smoothly, warmly, and naturally in a friendly male local farmer voice chatting in person on the farm—relaxed pace, everyday tone, never official or like a newsreader.'
          : 'Speak smoothly, warmly, and naturally in a caring male Karnataka village farmer voice talking calmly on the field—authentic spoken village Kannada rhythm, friendly brotherly warmth, zero official or newsreader stiffness.';

      const audioDataUrl = await synthesizeFreeTtsAudio(
        ai,
        spokenFarmerScript,
        voiceStyle,
        voiceName,
        language
      );
      if (!audioDataUrl) {
        res.status(200).json({
          ok: false,
          fallback: 'browser-tts',
          spokenScript: spokenFarmerScript,
        });
        return;
      }
      res.json({ ok: true, audioDataUrl, spokenScript: spokenFarmerScript });
    } catch (err) {
      res.status(500).json({ error: formatGeminiError(err) });
    }
  });

  // Ultra-Fast Streaming Chat Endpoint
  app.post('/api/chat', async (req, res) => {
    req.setTimeout(0);
    res.setTimeout(0);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, unknown>) => {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Ignore closed socket
      }
    };

    try {
      const {
        messages = [],
        sector = 'all',
        language = 'kn-village',
        farmingMode = 'both',
        attachments = [],
      } = req.body as {
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        sector?: AgriSector;
        language?: LanguageMode;
        farmingMode?: FarmingMode;
        attachments?: Array<{ mimeType: string; dataBase64: string }>;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        sendEvent({ type: 'error', message: 'Message cannot be empty.' });
        res.end();
        return;
      }

      const ai = getGeminiClient();
      const systemInstruction = buildSystemInstruction(
        sector,
        language,
        farmingMode
      );

      // Sliding window (10 turns for lowest latency) + strict role alternation
      const recent = messages
        .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
        .slice(-10);

      const normalized: Array<{ role: 'user' | 'model'; text: string }> = [];
      for (const m of recent) {
        const mappedRole: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
        const last = normalized[normalized.length - 1];
        if (last && last.role === mappedRole) {
          last.text += `\n\n${m.content.trim()}`;
        } else {
          normalized.push({ role: mappedRole, text: m.content.trim() });
        }
      }
      while (normalized.length > 0 && normalized[0].role !== 'user') {
        normalized.shift();
      }
      if (normalized.length === 0) {
        normalized.push({ role: 'user', text: 'ನಮಸ್ಕಾರ, ಕೃಷಿ ಸಲಹೆ ಕೊಡಿ.' });
      }

      const contents: Content[] = normalized.map((msg, index) => {
        const isLast = index === normalized.length - 1;
        const parts: Part[] = [];
        if (isLast && msg.role === 'user' && Array.isArray(attachments)) {
          for (const att of attachments) {
            if (att.dataBase64 && att.mimeType) {
              parts.push({
                inlineData: {
                  mimeType: att.mimeType,
                  data: att.dataBase64,
                },
              });
            }
          }
        }
        const finalText =
          isLast && msg.role === 'user' && language === 'kn-village'
            ? `${msg.text}\n\n[ನೆನಪಿಡಿ: ಅಚ್ಚ ಹಳ್ಳಿಯ ರೈತ ಅಣ್ಣನಂತೆ ಸರಳ ಆಡುಭಾಷೆಯಲ್ಲೇ (ನೋಡಣ್ಣ, ಚಿಂತೆ ಬೇಡ, ಟ್ಯಾಂಕ್ ನೀರಿಗೆ ಹಾಕಿ ಹೊಡೆಯಿರಿ) ಪ್ರೀತಿಯಿಂದ ಉತ್ತರಿಸಿ; ಅಧಿಕೃತ/ಪುಸ್ತಕದ ಪದಗಳು ಬೇಡ.]`
            : isLast &&
              msg.role === 'user' &&
              normalized.length >= 3 &&
              language !== 'en'
            ? `${msg.text}\n\n[ನೆನಪಿಡಿ: ಹಳ್ಳಿಯ ರೈತ ಅಣ್ಣನಂತೆ ಸರಳ ಆಡುಭಾಷೆಯಲ್ಲೇ ಪ್ರೀತಿಯಿಂದ ಉತ್ತರಿಸಿ; ಅಧಿಕೃತ ಪದಗಳು ಬೇಡ.]`
            : msg.text;
        parts.push({ text: finalText });
        return { role: msg.role, parts };
      });

      const modelCandidates = [
        { model: 'gemini-3.1-flash-lite', delayMs: 120 },
        { model: 'gemini-3.1-flash-lite', delayMs: 250 },
        ...(Date.now() < hydrogenCooldownUntil
          ? []
          : [{ model: 'gemini-4-hydrogen', delayMs: 0 }]),
      ];

      let currentContents = [...contents];
      let loopCount = 0;
      const maxToolLoops = 4;
      let totalTextEmitted = '';
      const collectedSources: GroundSource[] = [];

      while (loopCount < maxToolLoops) {
        loopCount += 1;

        let collectedText = '';
        let pendingFunctionCalls: Array<{
          id?: string;
          name: string;
          args: Record<string, unknown>;
        }> = [];
        let cleanToolParts: Part[] = [];
        let turnSucceeded = false;
        let lastErr: unknown = null;

        for (let i = 0; i < modelCandidates.length; i++) {
          const candidate = modelCandidates[i];
          const hasNext = i < modelCandidates.length - 1;
          let emittedAnyChunk = false;
          collectedText = '';
          pendingFunctionCalls = [];
          cleanToolParts = [];

          try {
            const stream = await ai.models.generateContentStream({
              model: candidate.model,
              contents: currentContents,
              config: {
                systemInstruction,
                temperature: 0.3,
                thinkingConfig:
                  candidate.model === 'gemini-4-hydrogen'
                    ? { thinkingLevel: ThinkingLevel.LOW }
                    : undefined,
                tools: loopCount < maxToolLoops ? chatTools : undefined,
              },
            });

            for await (const chunk of stream) {
              if (chunk.text) {
                emittedAnyChunk = true;
                collectedText += chunk.text;
                totalTextEmitted += chunk.text;
                sendEvent({ type: 'text', delta: chunk.text });
              }

              const candidateParts = chunk.candidates?.[0]?.content?.parts;
              if (candidateParts) {
                for (const part of candidateParts) {
                  if (part.functionCall && part.functionCall.name) {
                    emittedAnyChunk = true;
                    cleanToolParts.push(part);
                    pendingFunctionCalls.push({
                      id: part.functionCall.id,
                      name: part.functionCall.name,
                      args: (part.functionCall.args ?? {}) as Record<string, unknown>,
                    });
                  }
                }
              }
            }

            turnSucceeded = true;
            break;
          } catch (err) {
            lastErr = err;
            if (candidate.model === 'gemini-4-hydrogen' && isTransientError(err)) {
              hydrogenCooldownUntil = Date.now() + 60_000;
            }
            if (!emittedAnyChunk && isTransientError(err) && hasNext) {
              if (candidate.delayMs > 0) await sleep(candidate.delayMs);
              continue;
            }
            throw err;
          }
        }

        if (!turnSucceeded) {
          throw lastErr ?? new Error('Model unavailable after retries.');
        }

        if (pendingFunctionCalls.length === 0) {
          break;
        }

        const functionResponseParts: Part[] = [];
        for (const fc of pendingFunctionCalls) {
          const { result, media, sources } = await executeChatTool(
            ai,
            fc.name,
            fc.args
          );
          if (media) {
            sendEvent({ type: 'media', media });
          }
          if (sources) {
            for (const s of sources) {
              if (!collectedSources.some((e) => e.uri === s.uri)) {
                collectedSources.push(s);
              }
            }
          }
          functionResponseParts.push({
            functionResponse: {
              id: fc.id,
              name: fc.name,
              response: result,
            },
          });
        }

        const modelHistoryParts: Part[] = [];
        if (collectedText.trim().length > 0) {
          modelHistoryParts.push({ text: collectedText });
        }
        modelHistoryParts.push(...cleanToolParts);

        currentContents = [
          ...currentContents,
          { role: 'model', parts: modelHistoryParts },
          { role: 'user', parts: functionResponseParts },
        ];

        if (collectedText.trim().length > 0) {
          sendEvent({ type: 'text', delta: '\n\n' });
        }
      }

      if (totalTextEmitted.trim().length === 0) {
        const msg =
          language === 'en'
            ? 'Generated your requested media above.'
            : 'ನಿಮ್ಮ ಚಿತ್ರ/ಆಡಿಯೋ ಮೇಲೆ ತಯಾರಾಗಿದೆ ನೋಡಿ.';
        totalTextEmitted = msg;
        sendEvent({ type: 'text', delta: msg });
      }

      if (collectedSources.length > 0) {
        sendEvent({ type: 'sources', sources: collectedSources });
      }

      sendEvent({ type: 'done' });
      res.end();
    } catch (err: unknown) {
      console.error('Gemini chat error:', err);
      sendEvent({ type: 'error', message: formatGeminiError(err) });
      res.end();
    }
  });

  return app;
}

async function startServer() {
  const app = createApiApp();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '7d',
        immutable: true,
      })
    );
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Agron server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  void startServer();
}
