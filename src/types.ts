export type ArabicDialect = 'msa' | 'egyptian' | 'levantine' | 'gulf' | 'iraqi';

export type DialogueType = 'all' | 'dialogue' | 'hinglish' | 'rap_song' | 'background_song';

export type SubtitleStyle = 'netflix_white' | 'bollywood_gold' | 'boxed_classic' | 'arabic_cinematic';

export interface RawGeminiSubtitleItem {
  timecodeStart: string; // e.g. "00:01.20" or "01:05.50" (strictly MM:SS.ms)
  timecodeEnd: string;   // e.g. "00:04.80" or "01:08.20"
  originalHindi: string; // Hindi in Devanagari or Hinglish Latin transliteration
  arabicTranslation: string; // Translated Arabic in chosen dialect
  speaker?: string;      // Speaker label if identified
  type?: 'dialogue' | 'hinglish' | 'rap' | 'song';
  notes?: string;        // Cultural context or idiom explanation
}

export interface SubtitleCue {
  id: string;
  startSeconds: number; // Deterministically computed: (minutes * 60) + seconds
  endSeconds: number;   // Deterministically computed: (minutes * 60) + seconds
  timecodeStart: string; // "MM:SS.ms" (source verified)
  timecodeEnd: string;   // "MM:SS.ms" (source verified)
  originalHindi: string;
  arabicTranslation: string;
  speaker?: string;
  type?: 'dialogue' | 'hinglish' | 'rap' | 'song';
  notes?: string;
}

export interface TranslationSettings {
  dialect: ArabicDialect;
  dialogueType: DialogueType;
  model: 'gemini-3.5-flash-lite' | 'gemini-3.6-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.8-flash' | 'gemini-flash-latest';
  preserveHinglishFlavour: boolean;
  translateBackgroundSongs: boolean;
  minDurationSec: number; // default 1.0s
  subtitleStyle: SubtitleStyle;
}

export interface BurnOptions {
  style: SubtitleStyle;
  fontSize: number;
  fontColor: string;
  outlineColor: string;
  backgroundColor?: string;
  position: 'bottom' | 'top';
  marginV: number;
}
