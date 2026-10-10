import React, { useState } from 'react';
import { X, Flame, Download, CheckCircle2, AlertCircle, Loader2, Play, Settings2 } from 'lucide-react';
import { SubtitleCue, SubtitleStyle } from '../types';
import { safeFetchJson } from '../utils/apiFetch';

interface BurnModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
  cues: SubtitleCue[];
  currentStyle: SubtitleStyle;
}

export const BurnModal: React.FC<BurnModalProps> = ({
  isOpen,
  onClose,
  fileId,
  cues,
  currentStyle,
}) => {
  const [style, setStyle] = useState<SubtitleStyle>(currentStyle || 'bollywood_gold');
  const [fontSize, setFontSize] = useState<number>(22);
  const [marginV, setMarginV] = useState<number>(30);
  const [isBurning, setIsBurning] = useState(false);
  const [burnedUrl, setBurnedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartBurn = async () => {
    if (!fileId) {
      setError('يرجى رفع ملف فيديو أولاً أو اختيار المشهد التجريبي.');
      return;
    }
    if (cues.length === 0) {
      setError('لا توجد أسطر ترجمة لحرقها.');
      return;
    }

    setIsBurning(true);
    setError(null);
    setBurnedUrl(null);

    try {
      const data = await safeFetchJson<{
        success: boolean;
        downloadUrl: string;
      }>('/api/burn-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          cues,
          style,
          fontSize,
          marginV,
        }),
      });

      setBurnedUrl(data.downloadUrl);
    } catch (err: any) {
      console.warn('Burn error handled gracefully:', err.message);
      setError(err.message || 'حدث خطأ أثناء حرق الترجمة عبر FFmpeg.');
    } finally {
      setIsBurning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-lg w-full shadow-2xl p-6 text-neutral-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Flame className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold">حرق الترجمة المباشر داخل الفيديو (Hardcode)</h3>
              <p className="text-xs text-neutral-400">دمج الترجمة العربية بشكل نهائي بواسطة FFmpeg</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings */}
        {!burnedUrl && (
          <div className="space-y-4 text-xs">
            {/* Style Selection */}
            <div>
              <label className="block font-semibold text-neutral-300 mb-1.5">نمط الترجمة المحروقة:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStyle('bollywood_gold')}
                  className={`p-2.5 rounded-xl border text-right transition-all ${
                    style === 'bollywood_gold'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="font-bold">ذهبي بوليوود (Gold)</div>
                  <div className="text-[10px] text-neutral-400">أصفر سينمائي مع حدود سوداء</div>
                </button>

                <button
                  type="button"
                  onClick={() => setStyle('arabic_cinematic')}
                  className={`p-2.5 rounded-xl border text-right transition-all ${
                    style === 'arabic_cinematic'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="font-bold">سينمائي أنيق (Cairo)</div>
                  <div className="text-[10px] text-neutral-400">خط كايرو ناصع مع ظل ملحمي</div>
                </button>

                <button
                  type="button"
                  onClick={() => setStyle('netflix_white')}
                  className={`p-2.5 rounded-xl border text-right transition-all ${
                    style === 'netflix_white'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="font-bold">أبيض نيتفلكس (Clean)</div>
                  <div className="text-[10px] text-neutral-400">أبيض عصري بدون تشتيت</div>
                </button>

                <button
                  type="button"
                  onClick={() => setStyle('boxed_classic')}
                  className={`p-2.5 rounded-xl border text-right transition-all ${
                    style === 'boxed_classic'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="font-bold">صندوق معتم (Boxed)</div>
                  <div className="text-[10px] text-neutral-400">شريط أسود لضمان القراءة 100%</div>
                </button>
              </div>
            </div>

            {/* Font Size Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-neutral-300">حجم الخط:</span>
                <span className="font-mono text-amber-400 font-bold">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="16"
                max="32"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Margin from bottom */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-neutral-300">المسافة من أسفل الشاشة (Margin):</span>
                <span className="font-mono text-amber-400 font-bold">{marginV}px</span>
              </div>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={marginV}
                onChange={(e) => setMarginV(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Pipeline Notice */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-neutral-300">
                <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                <span>محرك الحرق عبر FFmpeg:</span>
              </div>
              <p>
                يقوم السيرفر بحرق ملف أسطر الترجمة مباشرة على كل إطار فيديو بصيغة H.264 عالية الجودة، بحيث يمكن تشغيل الفيديو على أي تلفاز، هاتف، أو شاشة دون الحاجة لتحميل ملف ترجمة خارجي.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Result Ready View */}
        {burnedUrl && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-300 text-sm">تم حرق الترجمة بنجاح!</h4>
              <p className="text-xs text-neutral-300 mt-0.5">
                الفيديو جاهز للمشاهدة مع الترجمة العربية المدمجة والمزامنة الحتمية.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <a
                href={burnedUrl}
                download
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-neutral-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                <span>تحميل الفيديو المترجم (MP4)</span>
              </a>

              <a
                href={burnedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 underline"
              >
                <Play className="w-3 h-3" />
                <span>معاينة الفيديو في تبويب جديد</span>
              </a>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 border-t border-neutral-800 flex justify-end gap-2">
          {!burnedUrl ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isBurning}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleStartBurn}
                disabled={isBurning}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-neutral-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {isBurning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حرق الترجمة عبر FFmpeg...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    <span>بدء حرق الترجمة داخل الفيديو</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors"
            >
              إغلاق
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
