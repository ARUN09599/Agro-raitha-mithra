export type AgriSector =
  | 'all'
  | 'row-crops'
  | 'horticulture'
  | 'greenhouse'
  | 'livestock'
  | 'aquaculture';

export type LanguageMode = 'kn-village' | 'kn-en' | 'en';

export type FarmingMode = 'both' | 'organic' | 'chemical';

export type WorkspaceTab = 'chat' | 'krishi-care' | 'market';

export interface GroundSource {
  title: string;
  uri: string;
}

export interface MarketPriceRow {
  commodity: string;
  variety?: string;
  marketYard: string;
  minPrice?: string;
  modalPrice?: string;
  maxPrice?: string;
  retailPrice?: string;
  arrivalsTonnes?: string;
  unit?: string;
  arrivalDate?: string;
  scope?: 'district' | 'state';
}

export interface LiveMarketResponse {
  ok: boolean;
  state: string;
  district: string;
  taluk: string;
  commodity?: string;
  fetchedAt: string;
  summary: string;
  rows: MarketPriceRow[];
  sources: GroundSource[];
  noLiveDataNote?: string;
}

export interface WeatherForecastDay {
  date: string;
  tempMax: number;
  tempMin: number;
  precipMm: number;
  precipProb: number;
}

export interface LiveWeatherData {
  ok: boolean;
  locationLabel: string;
  currentTempC: number;
  humidityPct: number;
  precipMm: number;
  windKmh: number;
  weatherSummary: string;
  daily: WeatherForecastDay[];
}

export type CropStage =
  | 'sowing'
  | 'growing'
  | 'flowering'
  | 'cutting-ready'
  | 'sent-to-market';

export interface DailyCropLogEntry {
  id: string;
  date: string;
  dayNumber: number;
  changesObserved: string;
  problemObserved: string;
  aiGuidance: string;
  weatherNote?: string;
  detectedStage?: CropStage;
  stageLabel?: string;
  diseaseName?: string;
  healthStatus?: 'healthy' | 'warning' | 'critical';
  daysToHarvest?: number;
  recoveryDays?: number;
  solutionSummary?: string;
  photoThumbUrl?: string;
  scanSource?: 'camera' | 'upload' | 'manual';
}

export interface KrishiCropItem {
  id: string;
  cropName: string;
  sowingDate: string;
  state: string;
  district: string;
  taluk: string;
  stage: CropStage;
  logs: DailyCropLogEntry[];
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
  previewUrl: string;
}

export type GeneratedMediaItem =
  | {
      id: string;
      kind: 'image';
      title: string;
      description: string;
      svgMarkup: string;
    }
  | {
      id: string;
      kind: 'audio';
      title: string;
      script: string;
      voiceName: string;
      audioDataUrl: string;
    };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sector?: AgriSector;
  attachments?: ChatAttachment[];
  media?: GeneratedMediaItem[];
  sources?: GroundSource[];
  isStreaming?: boolean;
  error?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  sector: AgriSector;
  language: LanguageMode;
  farmingMode: FarmingMode;
  updatedAt: string;
  messages: ChatMessage[];
}
