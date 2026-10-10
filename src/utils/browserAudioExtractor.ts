/**
 * Client-Side Audio Extractor for Web & Mobile Browsers
 * يستخرج مسار الصوت من ملفات الفيديو مباشرة في متصفح المستخدم (بدون استهلاك باقة الإنترنت)
 * ويحوله إلى ملف WAV خفيف الحجم (16kHz Mono) مما يقلل حجم الملف بنسبة 95%
 * ويتجاوز أي حدود لحجم الرفع السحابي (Cloud Run 32MB limit).
 */

export function isAudioExtractionSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || (window as any).webkitAudioContext);
}

/**
 * تحويل AudioBuffer إلى Blob بتنسيق WAV أحادي (Mono 16kHz)
 * مثالي لنماذج التعرف على الكلام مثل Gemini Audio
 */
function audioBufferToWavBlob(buffer: AudioBuffer, targetSampleRate = 16000): Blob {
  const numChannels = 1; // Mono for voice recognition
  const sourceRate = buffer.sampleRate;
  const ratio = sourceRate / targetSampleRate;
  const sourceData = buffer.getChannelData(0);
  const targetLength = Math.round(sourceData.length / ratio);
  const targetData = new Float32Array(targetLength);

  // Linear interpolation resampling
  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const indexFloor = Math.floor(srcIndex);
    const indexCeil = Math.min(indexFloor + 1, sourceData.length - 1);
    const weight = srcIndex - indexFloor;
    targetData[i] = sourceData[indexFloor] * (1 - weight) + sourceData[indexCeil] * weight;
  }

  // Create WAV header & PCM data
  const bytesPerSample = 2; // 16-bit PCM
  const dataByteLength = targetLength * bytesPerSample;
  const bufferArray = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(bufferArray);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, targetSampleRate, true); // SampleRate
  view.setUint32(28, targetSampleRate * numChannels * bytesPerSample, true); // ByteRate
  view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Write PCM samples (clamp -1.0 to 1.0 to 16-bit signed integer)
  let offset = 44;
  for (let i = 0; i < targetLength; i++) {
    const sample = Math.max(-1, Math.min(1, targetData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * استخراج الصوت محلياً من ملف الفيديو
 */
export async function extractAudioFromVideoInBrowser(
  videoFile: File,
  onStatus?: (statusText: string) => void
): Promise<File> {
  if (!isAudioExtractionSupported()) {
    throw new Error('المتصفح الحالي لا يدعم Web Audio API لاستخراج الصوت محلياً.');
  }

  onStatus?.('قراءة مسار الوسائط محلياً...');
  const arrayBuffer = await videoFile.arrayBuffer();

  onStatus?.('تفكيك المسار الصوتي بدقة عالية...');
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  let decodedAudio: AudioBuffer;
  try {
    decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    try {
      await audioCtx.close();
    } catch (_) {}
  }

  onStatus?.('ضغط الصوت الصوتي للترجمة السحابية (16kHz Mono)...');
  const wavBlob = audioBufferToWavBlob(decodedAudio, 16000);

  const cleanName = videoFile.name.replace(/\.[^/.]+$/, '') + '_audio.wav';
  return new File([wavBlob], cleanName, { type: 'audio/wav' });
}
