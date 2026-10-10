import React from 'react';
import { X, Clock, ShieldCheck, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

interface TimingRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TimingRuleModal: React.FC<TimingRuleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-neutral-100">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100">قاعدة التوقيت الحتمية ومنع خطأ الـ 100 ثانية</h3>
              <p className="text-xs text-neutral-400">Strict Base-60 vs Base-100 Timecode Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          {/* Problem Explanation */}
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-300 mb-1">المشكلة الشائعة في الذكاء الاصطناعي:</h4>
                <p className="text-neutral-300 text-xs">
                  كثيراً ما تخلط نماذج الذكاء الاصطناعي بين النظام الستيني (Base-60 حيث الدقيقة 60 ثانية) والنظام العشري (Base-100)، فتتعامل مع الدقيقة الواحدة 01:00 على أنها 100 ثانية، مما يُحدث تأخيراً فادحاً بمقدار 40 ثانية كاملة وتظهر الترجمة في 1:40 بدلاً من 1:00!
                </p>
              </div>
            </div>
          </div>

          {/* Implemented Solution */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-300 mb-1">الحل الحتمي الصارم المطبق في BollywoodSub AI:</h4>
                <div className="space-y-2 text-xs text-neutral-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>1. إلزام النموذج بصيغة MM:SS.ms الصريحة:</strong> يتم توجيه Google Gemini لإخراج التوقيت كنص دقيق بالدقائق والثواني (مثل <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">01:00.25</code>) دون أي تداخل عشري.
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>2. معادلة السيرفر الحتمية:</strong> يتم حساب الثواني بصرامة برمجية:
                      <div className="my-1.5 p-2 bg-neutral-900 border border-neutral-700 rounded text-center font-mono text-xs text-amber-400 font-bold">
                        المجموع بالثواني = (الدقائق × 60) + الثواني
                      </div>
                      وبذلك تتحول <code className="text-emerald-400">01:00.25</code> حتماً إلى <code className="text-emerald-400">(1 × 60) + 0.25 = 60.25 ثانية</code> دائماً وأبداً.
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>3. منع التداخل الزمني والحد الأدنى للظهور:</strong> يتم فرز كل سطر وضمان حد أدنى للظهور لا يقل عن 1.0 ثانية لمنع وميض الترجمة السريعة، مع إزاحة حتمية تمنع أي سطرين من الاصطدام.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FFmpeg zero-sync pipeline */}
          <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-500/30">
            <div className="flex items-start gap-2.5">
              <Cpu className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sky-300 mb-1">خط معالجة الصوت في FFmpeg (Zero-Sync Pipeline):</h4>
                <p className="text-xs text-neutral-300 mb-2">
                  يتم استخراج مسار الصوت بنقاء استريو 44.1kHz و 128k لضمان وضوح نطق الراب الهندي ولهجات مومباي، مع تطبيق الفلاتر:
                </p>
                <div className="p-2 bg-neutral-900 font-mono text-[11px] text-sky-300 rounded border border-neutral-700 select-all" dir="ltr">
                  ffmpeg -i input.mp4 -vn -avoid_negative_ts make_zero -af aresample=async=1 -ar 44100 -ac 2 -b:a 128k audio.mp3
                </div>
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  هذا يضمن تطابق أول فريم صوتي تماماً مع الثانية 00:00.00 دون أي انزياح زمني طوال مدة الفيلم.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-450 text-neutral-950 font-bold text-xs transition-colors"
          >
            فهمت، إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
