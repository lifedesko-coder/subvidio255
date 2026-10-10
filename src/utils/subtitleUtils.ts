import { RawGeminiSubtitleItem, SubtitleCue, SubtitleStyle } from '../types';

/**
 * Deterministic Base-60 timecode parser.
 * Eliminates the common AI error where 1:00 is mistaken for 100 seconds (base-100 error).
 * Formula: Total Seconds = (Minutes * 60) + Seconds
 */
export function parseTimecodeToSeconds(timeStr: string | number): number {
  if (typeof timeStr === 'number') {
    return isNaN(timeStr) ? 0 : Math.max(0, timeStr);
  }
  if (!timeStr || typeof timeStr !== 'string') return 0;

  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    // HH:MM:SS.mmm
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS.mmm (Standard required format)
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    // Guaranteed Base-60 conversion:
    // e.g. "01:00.25" -> (1 * 60) + 0.25 = 60.25 seconds!
    return minutes * 60 + seconds;
  } else {
    // Plain seconds string
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : Math.max(0, val);
  }
}

/**
 * Convert seconds back to MM:SS.ms
 */
export function secondsToTimecode(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const minutes = Math.floor(safe / 60);
  const seconds = (safe % 60).toFixed(2);
  const padMin = String(minutes).padStart(2, '0');
  const padSec = parseFloat(seconds) < 10 ? '0' + seconds : seconds;
  return `${padMin}:${padSec}`;
}

/**
 * Convert seconds to SubRip SRT format: HH:MM:SS,mmm
 */
export function secondsToSRTTime(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe % 1) * 1000);

  const padH = String(hours).padStart(2, '0');
  const padM = String(minutes).padStart(2, '0');
  const padS = String(seconds).padStart(2, '0');
  const padMs = String(milliseconds).padStart(3, '0');

  return `${padH}:${padM}:${padS},${padMs}`;
}

/**
 * Convert seconds to Advanced SubStation Alpha (ASS) format: H:MM:SS.cc
 */
export function secondsToASSTime(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const centiseconds = Math.floor(((safe % 1) * 100));

  const padH = String(hours);
  const padM = String(minutes).padStart(2, '0');
  const padS = String(seconds).padStart(2, '0');
  const padCs = String(centiseconds).padStart(2, '0');

  return `${padH}:${padM}:${padS}.${padCs}`;
}

/**
 * Checks if text already contains musical notes (♪ or ♫)
 */
export function hasMusicalNote(text: string): boolean {
  if (!text) return false;
  return /[♪♫]/.test(text);
}

/**
 * Ensures text has musical note symbols (♪ ... ♪) for song or rap lines.
 * Standard in international and cinematic subtitling.
 */
export function formatMusicalNote(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  
  const hasNoteStart = /^[♪♫]/.test(trimmed);
  const hasNoteEnd = /[♪♫]$/.test(trimmed);

  if (hasNoteStart && hasNoteEnd) {
    return trimmed;
  }
  if (hasNoteStart) {
    return `${trimmed} ♪`;
  }
  if (hasNoteEnd) {
    return `♪ ${trimmed}`;
  }
  return `♪ ${trimmed} ♪`;
}

/**
 * Removes musical note symbols if the user wants to remove them.
 */
export function stripMusicalNotes(text: string): string {
  if (!text) return '';
  return text.replace(/[♪♫]/g, '').trim();
}

/**
 * Validates, aligns, sorts and enforces non-overlapping cues and minimum display duration.
 */
export function sanitizeAndAlignCues(
  rawCues: RawGeminiSubtitleItem[],
  minDurationSec: number = 1.0
): SubtitleCue[] {
  if (!Array.isArray(rawCues)) return [];

  // 1. Initial parse using strict Base-60 conversion
  const parsed = rawCues
    .map((item, index) => {
      let start = parseTimecodeToSeconds(item.timecodeStart);
      let end = parseTimecodeToSeconds(item.timecodeEnd);

      // If end is less than or equal to start, set minimum duration
      if (end <= start) {
        end = start + minDurationSec;
      } else if (end - start < minDurationSec) {
        end = start + minDurationSec;
      }

      let arabic = (item.arabicTranslation || '').trim();
      const cueType = item.type || 'dialogue';

      // Automatically add musical note symbol ♪ for rap and song lines
      if (cueType === 'song' || cueType === 'rap') {
        arabic = formatMusicalNote(arabic);
      }

      return {
        id: `cue-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        startSeconds: start,
        endSeconds: end,
        timecodeStart: secondsToTimecode(start),
        timecodeEnd: secondsToTimecode(end),
        originalHindi: (item.originalHindi || '').trim(),
        arabicTranslation: arabic,
        speaker: item.speaker?.trim(),
        type: cueType,
        notes: item.notes?.trim()
      } as SubtitleCue;
    })
    .filter((cue) => cue.arabicTranslation.length > 0 || cue.originalHindi.length > 0);

  // 2. Sort chronologically by startSeconds
  parsed.sort((a, b) => a.startSeconds - b.startSeconds);

  // 3. Strict overlap prevention and minimum duration enforcement
  for (let i = 0; i < parsed.length; i++) {
    const curr = parsed[i];

    // Guarantee minimum duration
    if (curr.endSeconds - curr.startSeconds < minDurationSec) {
      curr.endSeconds = curr.startSeconds + minDurationSec;
    }

    // Check with previous cue for overlap
    if (i > 0) {
      const prev = parsed[i - 1];
      if (curr.startSeconds < prev.endSeconds) {
        // Option: if overlap, push current cue start slightly after previous end, or clamp previous end
        if (prev.endSeconds - prev.startSeconds > minDurationSec + 0.2) {
          prev.endSeconds = Math.max(prev.startSeconds + minDurationSec, curr.startSeconds - 0.05);
        } else {
          curr.startSeconds = prev.endSeconds + 0.05;
          curr.endSeconds = Math.max(curr.endSeconds, curr.startSeconds + minDurationSec);
        }
      }
    }

    // Refresh timecode text representations after math adjustments
    curr.timecodeStart = secondsToTimecode(curr.startSeconds);
    curr.timecodeEnd = secondsToTimecode(curr.endSeconds);
  }

  return parsed;
}

/**
 * Generate standard compliant SRT format.
 */
export function generateSRT(cues: SubtitleCue[]): string {
  return cues
    .map((cue, index) => {
      const num = index + 1;
      const start = secondsToSRTTime(cue.startSeconds);
      const end = secondsToSRTTime(cue.endSeconds);
      let text = cue.arabicTranslation;
      if ((cue.type === 'song' || cue.type === 'rap') && !hasMusicalNote(text)) {
        text = formatMusicalNote(text);
      }
      return `${num}\n${start} --> ${end}\n${text}\n`;
    })
    .join('\n');
}

/**
 * Generate Advanced SubStation Alpha (.ass) format with custom cinematic Arabic styling.
 */
export function generateASS(
  cues: SubtitleCue[],
  style: SubtitleStyle = 'netflix_white',
  videoTitle: string = 'Bollywood Arabic Translation'
): string {
  // Styles definitions:
  // Color format in ASS is &HAABBGGRR (Hex Alpha, Blue, Green, Red)
  let primaryColor = '&H00FFFFFF'; // White
  let outlineColor = '&H00000000'; // Black
  let backColor = '&H80000000';    // Semi-transparent black shadow
  let fontSize = 48;
  let fontName = 'Cairo';
  let bold = 1;
  let outline = 2.5;
  let shadow = 1.5;
  let marginV = 35;
  let borderStyle = 1; // 1 = outline + drop shadow, 3 = opaque box

  if (style === 'bollywood_gold') {
    primaryColor = '&H002BD7FE'; // Rich Golden Yellow in BGR: B=2B, G=D7, R=FE
    outlineColor = '&H000F0F1A';
    fontSize = 50;
    outline = 3.0;
  } else if (style === 'boxed_classic') {
    primaryColor = '&H00FFFFFF';
    backColor = '&H60000000';
    borderStyle = 3; // Opaque/Translucent bounding box
    outline = 0;
    shadow = 0;
  } else if (style === 'arabic_cinematic') {
    fontName = 'Cairo';
    primaryColor = '&H00F5F5F5';
    outlineColor = '&H00111111';
    fontSize = 46;
    outline = 2.2;
    shadow = 2.0;
    marginV = 45;
  }

  const header = `[Script Info]
; Script generated by BollywoodSub AI (Strict Base-60 Timestamping)
Title: ${videoTitle}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ArabicCinema,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},${bold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = cues
    .map((cue) => {
      const start = secondsToASSTime(cue.startSeconds);
      const end = secondsToASSTime(cue.endSeconds);
      let text = cue.arabicTranslation;
      if ((cue.type === 'song' || cue.type === 'rap') && !hasMusicalNote(text)) {
        text = formatMusicalNote(text);
      }
      // Clean up text for ASS (replace newlines with \N)
      const cleanText = text.replace(/\r?\n/g, ' \\N ');
      return `Dialogue: 0,${start},${end},ArabicCinema,,0,0,0,,${cleanText}`;
    })
    .join('\n');

  return header + events;
}
