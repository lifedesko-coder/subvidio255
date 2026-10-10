import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileVideo,
  Languages,
  Radio,
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  Loader2,
  FileAudio,
  ShieldAlert,
  Flame,
  Clock,
  Mic,
  Music,
  X,
  Play,
  Globe,
  ArrowUpRight,
  Zap
} from 'lucide-react';
import { ArabicDialect, DialogueType, TranslationSettings } from '../types';
import { safeFetchJson } from '../utils/apiFetch';
import { extractAudioFromVideoInBrowser, isAudioExtractionSupported } from '../utils/browserAudioExtractor';

interface UploadAndConfigProps {
  currentFileId: string | null;
  currentFileName: string | null;
  onFileUploaded: (fileId: string, fileName: string, videoUrl: string) => void;
  settings: TranslationSettings;
  onUpdateSettings: (newSettings: Partial<TranslationSettings>) => void;
  onStartTranslation: () => void;
  onOpenStreamlitModal?: () => void;
  isProcessing: boolean;
  processingStep: string | null;
}

export const UploadAndConfig: React.FC<UploadAndConfigProps> = ({
  currentFileId,
  currentFileName,
  onFileUploaded,
  settings,
  onUpdateSettings,
  onStartTranslation,
  onOpenStreamlitModal,
  isProcessing,
  processingStep,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [pendingLocalFile, setPendingLocalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setPendingLocalFile(file);
    setUploadError(null);

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(file.name);
    const rawFileSizeMb = file.size / (1024 * 1024);

    // Provide immediate local preview for videos
    const localPreviewUrl = isVideo ? URL.createObjectURL(file) : null;

    let fileToUpload: File = file;

    // Intelligent Client-Side Audio Extraction for Video Files
    // Shrinks 50-200MB video to 1-3MB WAV, bypassing Cloud Run 32MB payload limit completely!
    if (isVideo && isAudioExtractionSupported() && rawFileSizeMb > 15) {
      try {
        setIsUploading(true);
        setUploadStatusMsg('جاري استخراج مسار الصوت خفيف الحجم داخل المتصفح لتسريع الرفع وتفادي حدود الحجم...');
        const extractedAudio = await extractAudioFromVideoInBrowser(file, (msg) => {
          setUploadStatusMsg(msg);
        });
        fileToUpload = extractedAudio;
      } catch (extractErr: any) {
        console.warn('Browser audio extraction skipped or failed, uploading original:', extractErr);
        fileToUpload = file;
      }
    }

    const uploadSizeMb = fileToUpload.size / (1024 * 1024);
    if (uploadSizeMb > 30) {
      setIsUploading(false);
      setUploadStatusMsg(null);
      setUploadError(
        `حجم الملف (${uploadSizeMb.toFixed(1)} ميغابايت) يتجاوز الحد المسموح للرفع المباشر عبر السحابة (30 ميغابايت). ` +
        'للأفلام والملفات الكبيرة: نوصي بفتح تطبيق Streamlit المخصص المزود بخانة مفتاح Google AI Studio الذي يدعم حتى 1GB+ دون أي حدود، أو استخراج مسار الصوت بصيغة MP3.'
      );
      if (localPreviewUrl) {
        onFileUploaded(`local-${Date.now()}`, file.name, localPreviewUrl);
      }
      return;
    }

    setIsUploading(true);
    setUploadStatusMsg(`جاري رفع الملف إلى السيرفر السحابي (${uploadSizeMb.toFixed(1)} ميغابايت)...`);

    const formData = new FormData();
    formData.append('mediaFile', fileToUpload);

    try {
      const data = await safeFetchJson<{
        success: boolean;
        fileId: string;
        originalName: string;
        sizeMb: string;
        url: string;
        mimeType: string;
      }>('/api/upload', {
        method: 'POST',
        body: formData,
      });

      // Keep local preview for video player if available for silky smooth native playback
      const finalMediaUrl = localPreviewUrl || data.url;

      onFileUploaded(data.fileId, file.name, finalMediaUrl);
      setPendingLocalFile(null);
    } catch (err: any) {
      console.warn('Upload failed gracefully:', err.message);
      const actualError = err.message || 'تعذر الاتصال بالسيرفر السحابي.';
      setUploadError(actualError);
      if (localPreviewUrl) {
        onFileUploaded(`local-${Date.now()}`, file.name, localPreviewUrl);
      }
    } finally {
      setIsUploading(false);
      setUploadStatusMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* 1. Upload Section */}
      <div>
        <label className="block text-xs font-bold text-neutral-300 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-amber-400" />
            <span>رفع فيديو أو مسار صوتي هندي:</span>
          </span>
          <span className="text-[11px] text-neutral-500 font-normal">MP4, MKV, WebM, MP3, WAV</span>
        </label>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-amber-500 bg-amber-500/10'
              : currentFileId
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-neutral-800 hover:border-neutral-700 bg-neutral-950/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,.mkv,.mp4,.avi,.mov,.webm,.mp3,.wav,.m4a"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-neutral-300 py-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-xs font-semibold text-amber-300">
                {uploadStatusMsg || 'جاري رفع الملف إلى السيرفر ومعالجة الصوت...'}
              </p>
              <span className="text-[10px] text-neutral-400">يتم ضغط واستخراج الصوت لسرعة النقل دون استهلاك البيانات</span>
            </div>
          ) : currentFileId ? (
            <div className="flex items-center justify-center gap-3 py-2 text-emerald-400">
              <FileVideo className="w-6 h-6 shrink-0" />
              <div className="text-right">
                <p className="text-xs font-bold text-neutral-200 truncate max-w-xs">{currentFileName}</p>
                <p className="text-[10px] text-emerald-400">الملف جاهز ومحمل بالكامل - انقر لتغييره</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-3 text-neutral-400">
              <UploadCloud className="w-8 h-8 text-neutral-500 mb-1" />
              <p className="text-xs font-semibold text-neutral-200">
                اسحب وأفلت ملف الفيلم أو الحلقة هنا، أو <span className="text-amber-400 underline">اختر ملفاً</span>
              </p>
              <p className="text-[10px] text-neutral-400">
                يدعم MP4، MKV ومسارات الصوت MP3 (استخراج فوري للصوت محلياً لتفادي أي حدود للحجم)
              </p>
            </div>
          )}
        </div>

        {/* Streamlit Callout Banner */}
        <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-neutral-300 leading-snug">
              <strong>تريد ترجمة أفلام ومسلسلات ضخمة (حتى 1GB)؟</strong> شغّل تطبيق <span className="text-amber-400 font-semibold">Streamlit</span> الجديد مع خانة مخصصة لمفتاح الذكاء الاصطناعي.
            </span>
          </div>
          {onOpenStreamlitModal && (
            <button
              type="button"
              onClick={onOpenStreamlitModal}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-auto shadow-sm"
            >
              <span>فتح تطبيق Streamlit</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {uploadError && (
          <div className="mt-2.5 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-right flex-1">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span className="leading-relaxed">{uploadError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
              {onOpenStreamlitModal && (
                <button
                  type="button"
                  onClick={onOpenStreamlitModal}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تطبيق Streamlit (1GB)</span>
                </button>
              )}
              <a
                href="https://ais-dev-bw6j7pmuiyh2semyrvfxzz-90618466889.europe-west2.run.app"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  try {
                    if ((window as any).Capacitor?.Plugins?.Browser?.open) {
                      e.preventDefault();
                      (window as any).Capacitor.Plugins.Browser.open({ url: 'https://ais-dev-bw6j7pmuiyh2semyrvfxzz-90618466889.europe-west2.run.app' });
                      return;
                    }
                    window.open('https://ais-dev-bw6j7pmuiyh2semyrvfxzz-90618466889.europe-west2.run.app', '_system');
                  } catch (_) {}
                }}
                className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-semibold transition-colors flex items-center gap-1 group"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>فتح بالمتصفح</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
              {pendingLocalFile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const localUrl = URL.createObjectURL(pendingLocalFile);
                    onFileUploaded(`local-${Date.now()}`, pendingLocalFile.name, localUrl);
                    setUploadError(null);
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition-colors flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>استخدام الفيديو محلياً</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[11px] font-semibold transition-colors"
              >
                إعادة المحاولة
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadError(null);
                }}
                className="p-1 rounded text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-colors"
                title="إغلاق التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Dialect Selection */}
      <div>
        <label className="block text-xs font-bold text-neutral-300 mb-2 flex items-center gap-1.5">
          <Languages className="w-4 h-4 text-amber-400" />
          <span>اللهجة العربية المستهدفة:</span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { id: 'msa', name: 'الفصحى الحديثة', desc: 'لغة سينمائية رصينة فصيحة' },
            { id: 'egyptian', name: 'اللهجة المصرية', desc: 'سلسة، محبوبة، وأقرب للدراما' },
            { id: 'levantine', name: 'اللهجة الشامية', desc: 'سورية ولبنانية معبرة' },
            { id: 'gulf', name: 'اللهجة الخليجية', desc: 'أصيلة ومعاصرة' },
            { id: 'iraqi', name: 'اللهجة العراقية', desc: 'عميقة وشاعرية' },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onUpdateSettings({ dialect: d.id as ArabicDialect })}
              className={`p-2.5 rounded-xl border text-right transition-all ${
                settings.dialect === d.id
                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold shadow-sm'
                  : 'bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-bold text-xs">{d.name}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Dialogue Specialization Mode */}
      <div>
        <label className="block text-xs font-bold text-neutral-300 mb-2 flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4 text-amber-400" />
          <span>نوع وسياق الكلام الهندي:</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            {
              id: 'all',
              title: 'ترجمة شاملة (كل شيء)',
              desc: 'حوارات، Hinglish، راب، وأغاني الخلفية',
              icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            },
            {
              id: 'hinglish',
              title: 'تركيز على الـ Hinglish السريع',
              desc: 'خلط الهندية بالإنجليزية مع ترجمة ذكية للمصطلحات',
              icon: <Radio className="w-3.5 h-3.5 text-orange-400" />
            },
            {
              id: 'rap_song',
              title: 'راب بوليوود وأغاني الاستعراض',
              desc: 'Gully Boy، راب سريع مع علامة النوتة الموسيقية ♪',
              icon: <Mic className="w-3.5 h-3.5 text-red-400" />
            },
            {
              id: 'background_song',
              title: 'أغاني الخلفية الشعرية (OST)',
              desc: 'الأغاني الرومانسية والشعر مع علامة النوتة ♪',
              icon: <Music className="w-3.5 h-3.5 text-sky-400" />
            },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onUpdateSettings({ dialogueType: mode.id as DialogueType })}
              className={`p-2.5 rounded-xl border text-right flex items-start gap-2 transition-all ${
                settings.dialogueType === mode.id
                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                  : 'bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="mt-0.5">{mode.icon}</div>
              <div>
                <div className="font-bold text-xs">{mode.title}</div>
                <div className="text-[10px] text-neutral-500">{mode.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Model Selection & Base-60 Enforcer */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">نموذج الذكاء الاصطناعي:</span>
          <select
            value={settings.model}
            onChange={(e) => onUpdateSettings({ model: e.target.value as any })}
            className="bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-neutral-200 font-mono focus:outline-none cursor-pointer"
          >
            <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (نشط ومستقر وسريع - موصى به)</option>
            <option value="gemini-3.6-flash">gemini-3.6-flash (دقة عالية وسريع)</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
            <option value="gemini-3.8-flash">gemini-3.8-flash</option>
            <option value="gemini-flash-latest">gemini-flash-latest</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          <div className="flex items-center gap-1.5 text-sky-400 font-medium" title="إحاطة أسطر الأغاني والرّاب تلقائياً بعلامة النوتة الموسيقية ♪">
            <Music className="w-3.5 h-3.5" />
            <span>نوتة غنائية (♪) للراب والأغاني</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 font-medium" title="نظام تكرار المحاولة والتبديل التلقائي الاحتياطي عند ضغط الخوادم">
            <Sparkles className="w-3.5 h-3.5" />
            <span>حماية من ضغط الخوادم (Auto-Retry)</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>قاعدة Base-60 الحتمية</span>
          </div>
        </div>
      </div>

      {/* 5. Start Translation Button & Progress */}
      <div>
        <button
          type="button"
          onClick={onStartTranslation}
          disabled={!currentFileId || isProcessing}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-450 hover:to-orange-450 text-neutral-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري التحليل والترجمة بدقة فائقة...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>بدء الترجمة وتوليد التوقيت المتزامن (SRT/ASS)</span>
            </>
          )}
        </button>

        {isProcessing && processingStep && (
          <div className="mt-3 p-3 rounded-xl bg-neutral-950 border border-amber-500/30 text-xs text-amber-300 space-y-1 animate-pulse">
            <div className="flex items-center gap-2 font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>الخطوة الحالية: {processingStep}</span>
            </div>
            <p className="text-[10px] text-neutral-400">
              يتم استخراج الصوت عبر FFmpeg (-avoid_negative_ts make_zero) وتطبيق خوارزمية (Minutes * 60) + Seconds لمنع أي تأخير زمني.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
