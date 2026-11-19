export function pickMaleLocalVoice(isEn: boolean): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const targetLangPrefix = isEn ? 'en' : 'kn';
  const langVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(targetLangPrefix)
  );
  const pool =
    langVoices.length > 0
      ? langVoices
      : voices.filter((v) => v.lang.toLowerCase().includes('-in'));
  if (pool.length === 0) return null;

  const maleVoice = pool.find((v) =>
    /\b(male|man|ravi|prabhat|rishi|hemant|gagan|sagar|madhav|arjun|vikram|kiran)\b/i.test(
      v.name
    )
  );
  if (maleVoice) return maleVoice;

  const nonFemale = pool.find(
    (v) =>
      !/\b(female|woman|kalpana|heera|swara|sapna|veena|lekha|priya|aditi|raveena)\b/i.test(
        v.name
      )
  );
  return nonFemale ?? pool[0] ?? null;
}

export function cleanTextForSpeechFallback(rawText: string): string {
  return rawText
    .replace(/\/[A-Za-z &?/-]+(?=\n|$)/g, ' ')
    .replace(/\([^)]*%[^)]*\)/g, ' ')
    .replace(/[#*_`>~]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 750);
}

export function speakMaleBrowserFallback(
  rawText: string,
  isEn: boolean,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  const clean = cleanTextForSpeechFallback(rawText);
  if (!clean) return false;

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = isEn ? 'en-IN' : 'kn-IN';
  utter.rate = 0.88;
  utter.pitch = 0.82;

  const chosenVoice = pickMaleLocalVoice(isEn);
  if (chosenVoice) {
    utter.voice = chosenVoice;
  }

  utter.onstart = () => callbacks?.onStart?.();
  utter.onend = () => callbacks?.onEnd?.();
  utter.onerror = () => callbacks?.onError?.();

  window.speechSynthesis.speak(utter);
  return true;
}
