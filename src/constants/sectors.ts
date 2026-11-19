import type { AgriSector, FarmingMode, LanguageMode } from '../types.ts';

export interface SectorMeta {
  id: AgriSector;
  labelKn: string;
  labelEn: string;
  descriptionKn: string;
  descriptionEn: string;
  samplePromptsKn: string[];
  samplePromptsEn: string[];
}

export const LANGUAGE_OPTIONS: Array<{
  id: LanguageMode;
  label: string;
  sublabel: string;
}> = [
  {
    id: 'kn-village',
    label: 'ಹಳ್ಳಿ ಕನ್ನಡ (ರೈತರ ಮಾತು)',
    sublabel: 'Natural Village Kannada',
  },
  {
    id: 'kn-en',
    label: 'ಕನ್ನಡ + English',
    sublabel: 'Natural Bilingual',
  },
  {
    id: 'en',
    label: 'English',
    sublabel: 'Natural Everyday English',
  },
];

export const FARMING_MODE_OPTIONS: Array<{
  id: FarmingMode;
  labelKn: string;
  labelEn: string;
}> = [
  {
    id: 'both',
    labelKn: 'ಮನೆ ಮದ್ದು + ಅಂಗಡಿ ಔಷಧಿ',
    labelEn: 'Organic + Chemical',
  },
  {
    id: 'organic',
    labelKn: 'ಮನೆ ಮದ್ದು (ಸಾವಯವ)',
    labelEn: 'Organic Only',
  },
  {
    id: 'chemical',
    labelKn: 'ಅಂಗಡಿ ಔಷಧಿ',
    labelEn: 'Chemical Only',
  },
];

export const AGRI_SECTORS: SectorMeta[] = [
  {
    id: 'all',
    labelKn: 'ಎಲ್ಲಾ ಕೃಷಿ ಮಾಹಿತಿ',
    labelEn: 'All Agriculture',
    descriptionKn:
      'ಬೆಳೆಗೆ ರೋಗ ಯಾಕೆ ಬಂತು, ಮನೆ ಮದ್ದು ಮತ್ತೆ ಅಂಗಡಿ ಔಷಧಿ ಏನ್ ಹಾಕೋದು, ಇಂದಿನ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ — ಎಲ್ಲಾ ಹಳ್ಳಿ ಮಾತಲ್ಲೇ ಕೇಳಿ.',
    descriptionEn:
      'Instant root-cause diagnosis ("why it happened") with both Organic and Chemical farming solutions, plus live mandi prices.',
    samplePromptsKn: [
      'ಹೊಲದಲ್ಲಿ ಎಲೆ ಎಲ್ಲಾ ಹಳದಿ ಆಗ್ತಿದೆ ಅಣ್ಣ — ಯಾಕೆ ಹಿಂಗಾಯ್ತು? ಮನೆ ಮದ್ದು ಮತ್ತೆ ಅಂಗಡಿ ಔಷಧಿ ಏನ್ ಹಾಕೋದು ಹೇಳು.',
      'ಟೊಮೇಟೊ ಎಲೆ ಸುರುಳಿ ಆಗ್ತಿದೆ, ಯಾಕೆ ಹಿಂಗಾಗುತ್ತೆ ಮತ್ತೆ ಏನ್ ಮದ್ದು ಹೊಡೀಬೇಕು?',
      'ಹನಿ ನೀರಾವರಿ ಹೇಗೆ ಹಾಕೋದು ಅಂತ ಚಿತ್ರ ಬರೆದು ತೋರ್ಸು.',
    ],
    samplePromptsEn: [
      'My crop leaves are turning yellow — why did this happen, and what are the organic and chemical solutions?',
      'Why does tomato leaf curl happen and how to treat it organically and chemically?',
      'Generate an image diagram showing how drip irrigation works.',
    ],
  },
  {
    id: 'row-crops',
    labelKn: 'ಬೆಳೆಗಳು (ಭತ್ತ, ರಾಗಿ, ಜೋಳ)',
    labelEn: 'Field Crops',
    descriptionKn:
      'ಭತ್ತ, ರಾಗಿ, ಜೋಳ, ಕಬ್ಬು, ಹತ್ತಿ, ಶೇಂಗಾ, ತೊಗರಿ — ರೋಗ ಯಾಕೆ ಬಂತು, ಮನೆ ಮದ್ದು ಮತ್ತೆ ಅಂಗಡಿ ಗೊಬ್ಬರ ಎಷ್ಟು ಹಾಕೋದು.',
    descriptionEn:
      'Paddy, ragi, maize, sugarcane, cotton, pulses — root cause, organic & chemical dosages.',
    samplePromptsKn: [
      'ಭತ್ತದ ಬೆಳೆಯಲ್ಲಿ ಬೆಂಕಿ ರೋಗ ಯಾಕೆ ಬರುತ್ತೆ ಅಣ್ಣ? ಮನೆ ಮದ್ದು ಮತ್ತೆ ಅಂಗಡಿ ಔಷಧಿ ಹೇಳು.',
      'ರಾಗಿ ಮತ್ತೆ ಜೋಳಕ್ಕೆ ಎಕರೆಗೆ ಎಷ್ಟು ಕೊಟ್ಟಿಗೆ ಗೊಬ್ಬರ ಮತ್ತೆ ಅಂಗಡಿ ಗೊಬ್ಬರ ಹಾಕಬೇಕು?',
      'ಮಳೆ ಕಡಿಮೆ ಇದ್ದಾಗ ಮಣ್ಣಲ್ಲಿ ತೇವ ಉಳಿಸಿಕೊಳ್ಳೋಕೆ ಏನ್ ಉಪಾಯ ಮಾಡೋದು?',
    ],
    samplePromptsEn: [
      'Why does blast disease occur in paddy, and what are the organic and chemical controls?',
      'Recommended organic manure and chemical NPK schedule per acre for ragi and maize?',
      'Best moisture-saving practices for dryland rainfed crops.',
    ],
  },
  {
    id: 'horticulture',
    labelKn: 'ತೋಟಗಾರಿಕೆ (ಅಡಿಕೆ, ತೆಂಗು, ತರಕಾರಿ)',
    labelEn: 'Orchards & Vegetables',
    descriptionKn:
      'ಅಡಿಕೆ, ತೆಂಗು, ಕಾಫಿ, ಮೆಣಸು, ಬಾಳೆ, ಮಾವು, ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ ತೋಟದ ರೋಗ ಮತ್ತೆ ಮನೆ ಮದ್ದು + ಅಂಗಡಿ ಔಷಧಿ.',
    descriptionEn:
      'Arecanut, coconut, coffee, pepper, banana, tomato, onion — causes and organic/chemical care.',
    samplePromptsKn: [
      'ಅಡಿಕೆ ತೋಟದಲ್ಲಿ ಕೊಳೆ ರೋಗ ಯಾಕೆ ಬರುತ್ತೆ? ಮನೆ ಮದ್ದು ಮತ್ತೆ ಬೋರ್ಡೋ/ಅಂಗಡಿ ಔಷಧಿ ಹೇಗೆ ಹೊಡೆಯೋದು?',
      'ತೆಂಗಿನ ಮರದಲ್ಲಿ ಸುಳಿ ರೋಗ ಇಲ್ಲಾ ಹುಳ ಕಾಟ ಯಾಕೆ ಬರುತ್ತೆ? ಏನ್ ಮದ್ದು ಹಾಕೋದು ಹೇಳು.',
      'ಟೊಮೇಟೊ ಹಣ್ಣು ಕೊಳೆಯೋದು ಯಾಕೆ ಮತ್ತೆ ತಡೆಯೋಕೆ ಏನ್ ಮಾಡ್ಬೇಕು?',
    ],
    samplePromptsEn: [
      'Why does koleroga affect arecanut, and what are organic vs Bordeaux/chemical sprays?',
      'Why do coconut palms drop nuts early and how to treat both organically and chemically?',
      'Why do tomatoes develop blossom end rot and how to fix it fast?',
    ],
  },
  {
    id: 'greenhouse',
    labelKn: 'ಪಾಲಿಹೌಸ್ ಮತ್ತು ಹೈಡ್ರೋಪೋನಿಕ್ಸ್',
    labelEn: 'Greenhouse & Polyhouse',
    descriptionKn:
      'ಪಾಲಿಹೌಸ್ ತರಕಾರಿ, ಹೂವಿನ ಬೆಳೆ, ನೆರಳು ಪರದೆ, ಬೂದಿ ರೋಗ ಮತ್ತೆ ಮನೆ ಮದ್ದು + ಅಂಗಡಿ ಔಷಧಿ.',
    descriptionEn:
      'Polyhouse vegetables, flowers, shade nets, powdery mildew diagnosis, and fertigation.',
    samplePromptsKn: [
      'ಪಾಲಿಹೌಸ್ ಕ್ಯಾಪ್ಸಿಕಂ ಬೆಳೆಯಲ್ಲಿ ಬೂದಿ ರೋಗ ಯಾಕೆ ಬರುತ್ತೆ? ಮನೆ ಮದ್ದು ಮತ್ತೆ ಅಂಗಡಿ ಔಷಧಿ ಹೇಳು.',
      'ಪಾಲಿಹೌಸ್ ಒಳಗೆ ಬಿಸಿಲು ಜಾಸ್ತಿ ಆದಾಗ ತಂಪು ಮಾಡೋದು ಹೇಗೆ?',
      'ಪಾಲಿಹೌಸ್ ಗಾಳಿ ಮತ್ತೆ ನೆರಳು ಪರದೆ ಹೇಗೆ ಹಾಕೋದು ಅಂತ ಚಿತ್ರ ತೋರ್ಸು.',
    ],
    samplePromptsEn: [
      'Why does powdery mildew spread inside polyhouses and how to stop it organically & chemically?',
      'How to keep polyhouse temperatures cool during peak summer heat?',
      'Generate an illustration showing polyhouse ventilation and shade-net layout.',
    ],
  },
  {
    id: 'livestock',
    labelKn: 'ಪಶುಸಂಗೋಪನೆ (ಹಸು, ಕುರಿ, ಕೋಳಿ)',
    labelEn: 'Dairy, Sheep & Poultry',
    descriptionKn:
      'ಹಸು, ಎಮ್ಮೆ, ಕುರಿ, ಮೇಕೆ, ನಾಟಿ ಕೋಳಿ ಸಾಕಾಣಿಕೆ — ಹಾಲು ಕಡಿಮೆಯಾದ್ರೆ, ಜ್ವರ-ರೋಗ ಬಂದ್ರೆ ಮನೆ ಮದ್ದು ಮತ್ತೆ ಪಶು ಡಾಕ್ಟರ್ ಔಷಧಿ.',
    descriptionEn:
      'Dairy cows, buffaloes, sheep, goats, poultry — root causes, herbal & veterinary care.',
    samplePromptsKn: [
      'ಹಸುಗಳಲ್ಲಿ ಹಾಲು ಕಡಿಮೆಯಾಗೋಕೆ ಯಾಕೆ? ಒಳ್ಳೆ ಮೇವು ಮತ್ತೆ ಮಿನರಲ್ ಮಿಕ್ಸ್‌ಚರ್ ಏನ್ ಕೊಡ್ಬೇಕು?',
      'ಬೇಸಿಗೆಯಲ್ಲಿ ಕೋಳಿ ಶೆಡ್‌ನಲ್ಲಿ ಸೆಖೆ ತಪ್ಪಿಸೋಕೆ ಏನ್ ಮಾಡ್ಬೇಕು ಅಣ್ಣ?',
      'ಕುರಿ ಮತ್ತೆ ಮೇಕೆಗಳಿಗೆ ಮಳೆಗಾಲದಲ್ಲಿ ಬರೋ ರೋಗಗಳ ಬಗ್ಗೆ ಧ್ವನಿಯಲ್ಲಿ ಹೇಳಿ.',
    ],
    samplePromptsEn: [
      'Why does dairy cow milk yield suddenly drop and how to recover with natural & mineral feed?',
      'How to prevent heat stress in poultry sheds during hot weather?',
      'Generate a voice audio guide on rainy-season care for sheep and goats.',
    ],
  },
  {
    id: 'aquaculture',
    labelKn: 'ಮೀನುಗಾರಿಕೆ (ಕೆರೆ ಮತ್ತು ಬಯೋಫ್ಲಾಕ್)',
    labelEn: 'Fisheries & Aquaculture',
    descriptionKn:
      'ಕೃಷಿ ಹೊಂಡ ಮತ್ತೆ ಕೆರೆಯಲ್ಲಿ ಕಾಟ್ಲಾ, ರೋಹು, ತಿಲಾಪಿಯಾ ಮೀನು ಸಾಕಣೆ, ನೀರು ಬದಲಾವಣೆ ಮತ್ತೆ ರೋಗದ ಮದ್ದು.',
    descriptionEn:
      'Farm pond fish farming (Catla, Rohu, Tilapia), water chemistry, causes of mortality, and treatment.',
    samplePromptsKn: [
      'ಮೀನಿನ ಕೆರೆಯಲ್ಲಿ ಮೀನುಗಳು ನೀರಿನ ಮೇಲೆ ಬಂದು ಉಸಿರಾಡೋಕೆ ಯಾಕೆ ಒದ್ದಾಡ್ತವೆ? ತಕ್ಷಣ ಏನ್ ಮಾಡೋದು?',
      'ತಿಲಾಪಿಯಾ ಮತ್ತೆ ರೋಹು ಮೀನುಗಳಿಗೆ ದಿನಕ್ಕೆ ಎಷ್ಟು ಮೇವು ಹಾಕಬೇಕು?',
      'ಮೀನು ಕೆರೆಯಲ್ಲಿ ಗಾಳಿ ಜಾಸ್ತಿ ಮಾಡೋ ವಿಧಾನದ ಚಿತ್ರ ಮತ್ತೆ ಧ್ವನಿ ಕೊಡಿ.',
    ],
    samplePromptsEn: [
      'Why do pond fish gasp at the water surface in the morning and how to fix it immediately?',
      'Daily feeding rate per kg biomass for Tilapia and Rohu?',
      'Generate a diagram and audio guide on pond water aeration and fish health.',
    ],
  },
];
