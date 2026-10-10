import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Github,
  Download,
  Copy,
  Check,
  Server,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Terminal,
  FileCode2,
  ChevronRight
} from 'lucide-react';
import { getApiBaseUrl } from '../utils/apiFetch';

interface ApkBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkBuildModal: React.FC<ApkBuildModalProps> = ({ isOpen, onClose }) => {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('bollywood_api_server_url') || getApiBaseUrl() || '';
  });
  const [urlSaved, setUrlSaved] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, stepIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIndex);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const handleSaveServerUrl = () => {
    if (serverUrl.trim()) {
      localStorage.setItem('bollywood_api_server_url', serverUrl.trim());
    } else {
      localStorage.removeItem('bollywood_api_server_url');
    }
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2500);
  };

  const gitCommands = `# 1. تهيئة المستودع وإضافة الملفات
git init
git add .
git commit -m "feat: setup BollywoodSub AI with GitHub Actions APK build"

# 2. ربط المستودع الخاص بك على GitHub والرفع
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-neutral-950 shadow-lg shadow-emerald-500/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-neutral-100 text-base">بناء تطبيق أندرويد (APK) عبر GitHub Actions</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  جاهز 100%
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                تم تجهيز خط الأنابيب الآلي لبناء ملف APK وتثبيته فوراً على الهاتف بدون الحاجة لـ Android Studio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-neutral-300">
          {/* Quick Summary Banner */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-emerald-200">
                تم تجهيز جميع ملفات المشروع الرسمية بنجاح:
              </p>
              <ul className="list-disc list-inside text-emerald-300/90 space-y-0.5">
                <li><code className="font-mono text-amber-300">.github/workflows/build-apk.yml</code>: تجميع APK تلقائي عند الرفع</li>
                <li><code className="font-mono text-amber-300">capacitor.config.json</code>: هوية التطبيق وتصاريح أندرويد</li>
                <li><code className="font-mono text-amber-300">android/</code>: مشروع أندرويد أصلي متكامل مدمج فيه Gradle</li>
              </ul>
            </div>
          </div>

          {/* Step 1: Git Push */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-200 flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-[11px] font-bold">1</span>
                <span>رفع المشروع إلى مستودع GitHub الخاص بك:</span>
              </span>
              <button
                onClick={() => copyToClipboard(gitCommands, 1)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-xs text-neutral-300 transition-colors"
              >
                {copiedStep === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedStep === 1 ? 'تم النسخ!' : 'نسخ الأوامر'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-neutral-300 overflow-x-auto text-left" dir="ltr">
              {gitCommands}
            </pre>
          </div>

          {/* Step 2: GitHub Actions Execution */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
            <span className="font-bold text-neutral-200 flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-[11px] font-bold">2</span>
              <span>البناء والتحميل التلقائي من GitHub:</span>
            </span>
            <div className="text-xs text-neutral-400 space-y-1.5 leading-relaxed">
              <p>
                1. افتح مستودعك على GitHub واضغط على تبويب <strong className="text-neutral-200">Actions</strong> في الأعلى.
              </p>
              <p>
                2. ستجد سير العمل <strong className="text-amber-300">Build Android APK (BollywoodSub AI)</strong> يعمل ذاتياً (يستغرق حوالي دقيقتين).
              </p>
              <p>
                3. عند اكتمال البناء باللون الأخضر، انزل لقسم <strong className="text-neutral-200">Artifacts</strong> واضغط على:
              </p>
              <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between font-mono text-emerald-400">
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  BollywoodSub-AI-Debug-APK.zip
                </span>
                <span className="text-[11px] text-neutral-500">جاهز للتثبيت الفوري</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                قم بفك الضغط وتثبيت ملف <code className="text-amber-300">app-debug.apk</code> مباشرة على أي هاتف أندرويد بدون أي قيود!
              </p>
            </div>
          </div>

          {/* Step 3: Cloud Backend Connection URL (Optional) */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-neutral-200 text-xs">رابط سيرفر الذكاء الاصطناعي (Cloud Backend URL):</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              يتصل تطبيق الأندرويد تلقائياً بسيرفر السحابة لمعالجة الفيديوهات و Gemini. يمكنك تغيير الرابط هنا إذا قمت بنشر سيرفرك الخاص:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://your-cloud-run-service.app"
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 font-mono"
                dir="ltr"
              />
              <button
                onClick={handleSaveServerUrl}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shrink-0 flex items-center gap-1"
              >
                {urlSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : null}
                <span>{urlSaved ? 'تم الحفظ!' : 'حفظ'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            ملفات Gradle و GitHub Actions مجهزة ومتوافقة مع Android 14+
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-semibold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
