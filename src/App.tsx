import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitleEditor } from './components/SubtitleEditor';
import { UploadAndConfig } from './components/UploadAndConfig';
import { ExportToolbar } from './components/ExportToolbar';
import { TimingRuleModal } from './components/TimingRuleModal';
import { PythonProjectModal } from './components/PythonProjectModal';
import { StreamlitModal } from './components/StreamlitModal';
import { BurnModal } from './components/BurnModal';
import { ApkBuildModal } from './components/ApkBuildModal';
import { SubtitleCue, TranslationSettings, SubtitleStyle } from './types';
import { secondsToTimecode } from './utils/subtitleUtils';
import { safeFetchJson } from './utils/apiFetch';
import { AlertCircle, CheckCircle2, ShieldCheck, Film, Sparkles, Clock, Music, RotateCcw, Info, Globe, ArrowUpRight, Copy, Check } from 'lucide-react';

export default function App() {
  const [fileId, setFileId] = useState<string | null>('demo-gully-boy-rap');
  const [fileName, setFileName] = useState<string | null>('Gully_Boy_Bollywood_Sample.mp4');
  const [videoUrl, setVideoUrl] = useState<string | null>('/samples/bollywood_demo.mp4');
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Modals state
  const [isTimingModalOpen, setIsTimingModalOpen] = useState<boolean>(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState<boolean>(false);
  const [isStreamlitModalOpen, setIsStreamlitModalOpen] = useState<boolean>(false);
  const [isBurnModalOpen, setIsBurnModalOpen] = useState<boolean>(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<TranslationSettings>({
    dialect: 'egyptian',
    dialogueType: 'all',
    model: 'gemini-3.5-flash-lite',
    preserveHinglishFlavour: true,
    translateBackgroundSongs: true,
    minDurationSec: 1.0,
    subtitleStyle: 'bollywood_gold',
  });

  // Load sample on mount
  useEffect(() => {
    loadDemoSample();
  }, []);

  const loadDemoSample = async () => {
    try {
      const data = await safeFetchJson<{ samples?: any[] }>('/api/samples');
      if (data.samples && data.samples.length > 0) {
        const sample = data.samples[0];
        setFileId(sample.id);
        setFileName('Gully_Boy_Bollywood_Sample.mp4');
        setVideoUrl(sample.videoUrl);
        setCues(sample.preloadedCues || []);
      }
    } catch (e) {
      console.warn('Failed to load sample:', e);
    }
  };

  const handleFileUploaded = (newFileId: string, newFileName: string, newVideoUrl: string) => {
    setFileId(newFileId);
    setFileName(newFileName);
    setVideoUrl(newVideoUrl);
    setCues([]); // Reset cues for new file
    setError(null);
  };

  const handleUpdateSettings = (newSettings: Partial<TranslationSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleStartTranslation = async () => {
    if (!fileId) {
      setError('يرجى رفع ملف فيديو أو صوت أولاً.');
      return;
    }

    if (fileId.startsWith('local-')) {
      setError('⚠️ الفيديو معروض محلياً على الهاتف فقط. لترجمة الكلام الهندي بالذكاء الاصطناعي، يلزم فتح التطبيق عبر متصفح الهاتف (Chrome) للاتصال بالسيرفر السحابي، أو استيراد ملف ترجمة SRT جاهز.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsProcessing(true);
    setError(null);
    setFallbackNotice(null);

    try {
      setProcessingStep('1/3: استخراج مسار الصوت بنقاء 44.1kHz ومزامنة صفرية (-avoid_negative_ts make_zero)...');
      await new Promise((r) => setTimeout(r, 400));

      setProcessingStep('2/3: تحليل الحوار وترجمته عبر Gemini (مع حماية تلقائية من ضغط الخوادم)...');
      const data = await safeFetchJson<{
        success: boolean;
        cues: SubtitleCue[];
        modelUsed?: string;
        fallbackNotice?: string;
      }>('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          dialect: settings.dialect,
          dialogueType: settings.dialogueType,
          model: settings.model,
          preserveHinglishFlavour: settings.preserveHinglishFlavour,
          translateBackgroundSongs: settings.translateBackgroundSongs,
          minDurationSec: settings.minDurationSec,
        }),
      });

      setProcessingStep('3/3: تطبيق معادلة Base-60 الحتمية لمنع خطأ الـ 100 ثانية وضبط التداخلات...');
      await new Promise((r) => setTimeout(r, 400));

      setCues(data.cues || []);
      if (data.fallbackNotice) {
        setFallbackNotice(data.fallbackNotice);
      }
    } catch (err: any) {
      console.error('Translation error:', err);
      setError(err.message || 'حدث خطأ أثناء معالجة الترجمة.');
    } finally {
      setIsProcessing(false);
      setProcessingStep(null);
    }
  };

  const handleUpdateCue = (id: string, updated: Partial<SubtitleCue>) => {
    setCues((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );
  };

  const handleDeleteCue = (id: string) => {
    setCues((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCue = (startSec: number) => {
    const endSec = startSec + settings.minDurationSec;
    const newCue: SubtitleCue = {
      id: `cue-user-${Date.now()}`,
      startSeconds: Number(startSec.toFixed(2)),
      endSeconds: Number(endSec.toFixed(2)),
      timecodeStart: secondsToTimecode(startSec),
      timecodeEnd: secondsToTimecode(endSec),
      originalHindi: '',
      arabicTranslation: 'ترجمة جديدة...',
      type: 'dialogue',
    };

    const nextCues = [...cues, newCue].sort((a, b) => a.startSeconds - b.startSeconds);
    setCues(nextCues);
  };

  const handleShiftAll = (offsetSec: number) => {
    setCues((prev) =>
      prev.map((c) => {
        const nextStart = Math.max(0, c.startSeconds + offsetSec);
        const nextEnd = Math.max(nextStart + 0.8, c.endSeconds + offsetSec);
        return {
          ...c,
          startSeconds: Number(nextStart.toFixed(2)),
          endSeconds: Number(nextEnd.toFixed(2)),
          timecodeStart: secondsToTimecode(nextStart),
          timecodeEnd: secondsToTimecode(nextEnd),
        };
      })
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <Header
        onOpenStreamlitModal={() => setIsStreamlitModalOpen(true)}
        onOpenPythonModal={() => setIsPythonModalOpen(true)}
        onOpenTimingInfo={() => setIsTimingModalOpen(true)}
        onOpenApkModal={() => setIsApkModalOpen(true)}
        onLoadDemo={loadDemoSample}
        isProcessing={isProcessing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Info Banner: Base-60 Mathematical Guarantee */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-neutral-200">نظام المزامنة الصارمة:</span>
              <span className="text-neutral-400">
                يتم حساب الثواني برمجياً بمعادلة حتمية:
              </span>
              <code className="bg-neutral-950 px-2 py-0.5 rounded text-amber-300 font-mono font-bold border border-neutral-800" dir="ltr">
                (Minutes × 60) + Seconds
              </code>
              <span className="text-neutral-400 hidden sm:inline">
                لإلغاء خطأ الـ 100 ثانية وتأخير الـ 40 ثانية نهائياً.
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsTimingModalOpen(true)}
            className="text-amber-400 hover:text-amber-300 underline font-semibold text-[11px]"
          >
            تفاصيل الخوارزمية والفلاتر
          </button>
        </div>

        {/* Automatic Fallback Notice Banner */}
        {fallbackNotice && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{fallbackNotice}</span>
            </div>
            <button
              onClick={() => setFallbackNotice(null)}
              className="text-neutral-400 hover:text-neutral-200 text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Global Error Banner with Actionable Remedies */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleStartTranslation}
                className="px-3 py-1.5 rounded-lg bg-red-800/60 hover:bg-red-700/80 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
              <button
                onClick={() => {
                  setError(null);
                  loadDemoSample();
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-medium text-xs transition-colors"
              >
                تجربة العينة المدمجة فوراً
              </button>
              <button
                onClick={() => setError(null)}
                className="text-neutral-400 hover:text-neutral-200 text-xs font-bold px-2 py-1"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* Workspace 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Player & Subtitle Editor (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* 1. Video Player */}
            <VideoPlayer
              videoUrl={videoUrl}
              cues={cues}
              currentTime={currentTime}
              onTimeUpdate={(t) => setCurrentTime(t)}
              onSeek={(t) => setCurrentTime(t)}
              subtitleStyle={settings.subtitleStyle}
              onStyleChange={(s) => handleUpdateSettings({ subtitleStyle: s })}
            />

            {/* 2. Export & Burning Toolbar */}
            <ExportToolbar
              cues={cues}
              fileName={fileName}
              subtitleStyle={settings.subtitleStyle}
              onOpenBurnModal={() => setIsBurnModalOpen(true)}
            />

            {/* 3. Synchronized Interactive Subtitle Editor */}
            <div className="min-h-[480px]">
              <SubtitleEditor
                cues={cues}
                currentTime={currentTime}
                onUpdateCue={handleUpdateCue}
                onDeleteCue={handleDeleteCue}
                onAddCue={handleAddCue}
                onSeek={(t) => setCurrentTime(t)}
                onShiftAll={handleShiftAll}
              />
            </div>
          </div>

          {/* Right Column: Upload & Translation Config (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <UploadAndConfig
              currentFileId={fileId}
              currentFileName={fileName}
              onFileUploaded={handleFileUploaded}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onStartTranslation={handleStartTranslation}
              onOpenStreamlitModal={() => setIsStreamlitModalOpen(true)}
              isProcessing={isProcessing}
              processingStep={processingStep}
            />

            {/* Quick Feature Highlights Card */}
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 space-y-3 shadow-md">
              <h4 className="font-bold text-neutral-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>مواصفات الترجمة السينمائية:</span>
              </h4>
              <ul className="space-y-2 text-[11px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>فلاتر FFmpeg الصفرية:</strong> استخراج الصوت بـ 44.1kHz وتطابق فوري مع أول فريم عند 00:00.00.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>ترجمة الـ Hinglish وراب مومباي:</strong> فهم ذكي للمصطلحات الهندية الممزوجة بالإنجليزية بدون أخطاء حرفية.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>حرق مباشر (Hardcode):</strong> دمج الترجمة بخط Cairo والألوان السينمائية داخل ملف MP4 جاهز للتحميل والمشاهدة.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span><strong>مشروع بايثون كامل:</strong> تشغيل سحابي أو محلي عبر كود بايثون متوفر للتحميل المباشر.</span>
                </li>
              </ul>
            </div>

            {/* زر الفتح في صفحة خارجية من داخل التطبيق (مع سهم) */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-neutral-900 to-amber-500/10 border-2 border-amber-500/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2 font-bold text-neutral-100 text-sm sm:text-base">
                  <Globe className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>فتح التطبيق في صفحة خارجية (متصفح الهاتف / Chrome)</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-2xl">
                  لرفع الفيديوهات وترجمتها بالذكاء الاصطناعي مباشرة دون قيود تطبيقات الهاتف المحلية، اضغط على زر السهم بالأسفل لفتح الرابط في متصفحك الخارجي.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-center">
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
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 group"
                >
                  <span>فتح في صفحة خارجية</span>
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5] text-neutral-950 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('https://ais-dev-bw6j7pmuiyh2semyrvfxzz-90618466889.europe-west2.run.app');
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-semibold transition-colors"
                  title="نسخ رابط الموقع"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right text-xs text-neutral-500">
          <div>
            BollywoodSub AI © 2026 — ترجمة احترافية للأفلام والمسلسلات الهندية إلى العربية بمزامنة حتمية وحرق للفيديو عبر Google Gemini & FFmpeg.
          </div>
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
            className="inline-flex items-center gap-1 text-amber-400/90 hover:text-amber-300 font-semibold transition-colors"
          >
            <span>فتح في المتصفح الخارجي</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </footer>

      {/* Modals */}
      <TimingRuleModal
        isOpen={isTimingModalOpen}
        onClose={() => setIsTimingModalOpen(false)}
      />

      <PythonProjectModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
      />

      <StreamlitModal
        isOpen={isStreamlitModalOpen}
        onClose={() => setIsStreamlitModalOpen(false)}
      />

      <BurnModal
        isOpen={isBurnModalOpen}
        onClose={() => setIsBurnModalOpen(false)}
        fileId={fileId}
        cues={cues}
        currentStyle={settings.subtitleStyle}
      />

      <ApkBuildModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </div>
  );
}
