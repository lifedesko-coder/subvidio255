import React from 'react';
import { Film, Sparkles, Terminal, ShieldCheck, Clock, Download, Smartphone, Globe, ArrowUpRight } from 'lucide-react';

interface HeaderProps {
  onOpenStreamlitModal: () => void;
  onOpenPythonModal: () => void;
  onOpenTimingInfo: () => void;
  onOpenApkModal: () => void;
  onLoadDemo: () => void;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenStreamlitModal,
  onOpenPythonModal,
  onOpenTimingInfo,
  onOpenApkModal,
  onLoadDemo,
  isProcessing,
}) => {
  return (
    <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-neutral-950 font-bold">
            <Film className="w-5 h-5 text-neutral-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl text-neutral-100 tracking-tight">
                BollywoodSub <span className="text-amber-400">AI</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                PRO سینمائي
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              ترجمة الأفلام والمسلسلات الهندية إلى العربية مع منع خطأ الـ 100 ثانية وحرق الترجمة
            </p>
          </div>
        </div>

        {/* Feature Badges & Quick Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* APK Android Button */}
          <button
            onClick={onOpenApkModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 border border-emerald-500/30 transition-all shadow-sm"
            title="ملفات وتفاصيل بناء تطبيق الأندرويد APK عبر GitHub Actions"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>تطبيق Android (APK)</span>
            <span className="bg-emerald-500/25 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-mono">GitHub</span>
          </button>

          {/* Timing Rule Badge */}
          <button
            onClick={onOpenTimingInfo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-xs font-medium text-emerald-400 border border-emerald-500/30 transition-colors shadow-sm"
            title="انقر لعرض تفاصيل معادلة التوقيت الحتمية"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>مزامنة Base-60 حتمية</span>
          </button>

          {/* Quick Demo Button */}
          <button
            onClick={onLoadDemo}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تجربة مشهد بوليوود فوري</span>
          </button>

          {/* Streamlit App Button */}
          <button
            onClick={onOpenStreamlitModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-300 border border-amber-500/40 transition-all shadow-sm"
            title="تطبيق Streamlit مع خانة مفتاح Google AI Studio Gemini API ودعم الفيديوهات الضخمة"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تطبيق Streamlit</span>
            <span className="bg-amber-500/30 text-amber-200 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">1GB+</span>
          </button>

          {/* Python Standalone Button */}
          <button
            onClick={onOpenPythonModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-neutral-800 to-neutral-750 hover:from-neutral-700 hover:to-neutral-650 text-xs font-semibold text-neutral-200 border border-neutral-700 transition-all shadow-sm"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span>مشروع Python المحلي</span>
            <span className="bg-sky-500/20 text-sky-300 text-[10px] px-1.5 py-0.2 rounded font-mono">CLI</span>
          </button>

          {/* Open in External Browser Button with Arrow */}
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 border border-amber-500/40 transition-all shadow-sm group"
            title="فتح التطبيق في متصفح خارجي (Chrome)"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>فتح بالمتصفح</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </header>
  );
};
