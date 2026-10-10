import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Terminal,
  FileCode,
  Globe,
  Key,
  Sparkles,
  ExternalLink,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Laptop
} from 'lucide-react';

interface StreamlitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StreamlitModal: React.FC<StreamlitModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'cloud' | 'colab' | 'code'>('quickstart');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [fullCode, setFullCode] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen && activeTab === 'code' && !fullCode) {
      setIsLoadingCode(true);
      fetch('/api/streamlit-code')
        .then((res) => res.json())
        .then((data) => {
          if (data?.code) setFullCode(data.code);
        })
        .catch((err) => console.error('Failed to fetch code:', err))
        .finally(() => setIsLoadingCode(false));
    }
  }, [isOpen, activeTab, fullCode]);

  if (!isOpen) return null;

  const copyText = (text: string, isCode = false) => {
    navigator.clipboard.writeText(text);
    if (isCode) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  const sampleSnippet = `# تشغيل تطبيق Streamlit لترجمة الأفلام الهندية
pip install streamlit google-genai python-dotenv
streamlit run streamlit_app.py`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-neutral-100">
                  تطبيق Streamlit مع خانة مفتاح الذكاء الاصطناعي
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  يدعم فيديوهات حتى 1GB+
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                تشغيل عبر منصة Streamlit مع خانة مخصصة لمفتاح Google AI Studio Gemini API الخاص بك
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/download-streamlit-file"
              download="streamlit_app.py"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
              title="تحميل ملف streamlit_app.py الفردي"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل streamlit_app.py</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature highlight banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>خانة مفتاح مخصصة:</strong> تم تضمين حقل كلمة المرور في الشريط الجانبي لـ Streamlit لإدخال مفتاح Gemini API وتجاوز أي قيود للحجم.
            </span>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline shrink-0"
          >
            <span>الحصول على مفتاح مجاني (Google AI Studio)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-4 pt-2 gap-2 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'quickstart'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>التشغيل المحلي السريع</span>
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'cloud'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>النشر على موقع Streamlit Cloud</span>
          </button>
          <button
            onClick={() => setActiveTab('colab')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'colab'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>التشغيل عبر Google Colab</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'code'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>عرض وتحميل الكود المصدري</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-amber-400 text-sm">خطوة 1: تثبيت المكتبات وتشغيل التطبيق</h4>
                  <button
                    onClick={() => copyText(sampleSnippet, false)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px]"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? 'تم النسخ!' : 'نسخ الأوامر'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-neutral-900 font-mono text-neutral-200 text-xs leading-relaxed" dir="ltr">
                  pip install streamlit google-genai python-dotenv<br />
                  streamlit run streamlit_app.py
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <h4 className="font-bold text-amber-400 text-sm">خطوة 2: إدخال مفتاح Google AI Studio</h4>
                <p className="text-neutral-300 leading-relaxed">
                  عندما يفتح متصفحك على الرابط <code className="text-amber-400 font-mono" dir="ltr">http://localhost:8501</code>،
                  ستجد في القائمة الجانبية (Sidebar) خانة واضحة ومخصصة لإدخال مفتاح الذكاء الاصطناعي الخاص بك:
                </p>
                <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-neutral-200">Google AI Studio Gemini API Key</span>
                  </div>
                  <span className="font-mono text-neutral-400 text-[11px]">••••••••••••••••••••••••</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <h4 className="font-bold text-amber-400 text-sm">خطوة 3: رفع الفيلم أو المسلسل وتنزيل الترجمة</h4>
                <p className="text-neutral-300 leading-relaxed">
                  تطبيق Streamlit يدعم رفع ملفات حتى <strong>1024 ميغابايت (1 جيجابايت)</strong> مباشرة دون وسيط،
                  ويقوم باستخراج الصوت والترجمة بالـ Hinglish والموسيقى الشعرية وتصدير ملفات <strong>SRT / VTT / ASS</strong> بنقرة واحدة!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <h4 className="font-bold text-amber-400 text-sm">كيف تنشر التطبيق على موقع Streamlit Cloud مجاناً؟</h4>
                <ol className="list-decimal list-inside space-y-2 text-neutral-300 leading-relaxed">
                  <li>قم بتحميل ملفات المشروع عبر زر <strong>تحميل المشروع كاملاً (.ZIP)</strong> بالأسفل.</li>
                  <li>ارفع محتويات المجلد إلى مستودع GitHub خاص بك (أو عام).</li>
                  <li>
                    تفضل بزيارة{' '}
                    <a
                      href="https://share.streamlit.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 font-bold hover:underline inline-flex items-center gap-0.5"
                    >
                      share.streamlit.io <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    وسجل الدخول بحساب GitHub الخاص بك.
                  </li>
                  <li>اختر <strong>New app</strong>، ثم حدد المستودع واكتب الملف الرئيسي: <code className="text-amber-400 font-mono" dir="ltr">streamlit_app.py</code>.</li>
                  <li>في خيار <strong>Advanced settings / Secrets</strong>، يمكنك وضع مفتاحك:</li>
                </ol>
                <div className="p-2.5 rounded bg-neutral-900 font-mono text-neutral-300 text-xs" dir="ltr">
                  GEMINI_API_KEY = "AIzaSy..."
                </div>
                <p className="text-[11px] text-neutral-400">
                  وحتى لو لم تضعه في الإعدادات، ستجد خانة إدخال المفتاح متاحة في واجهة التطبيق لكل زائر مباشرة!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'colab' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <h4 className="font-bold text-amber-400 text-sm">تشغيل Streamlit مباشرة على Google Colab (مجاناً)</h4>
                <p className="text-neutral-300 leading-relaxed">
                  يمكنك تشغيل التطبيق بالكامل داخل بيئة Google Colab السحابية والاستفادة من معالجة سريعة وفتح التطبيق عبر نفق محلي (Localtunnel أو ngrok):
                </p>
                <div className="p-3 rounded-lg bg-neutral-900 font-mono text-neutral-200 text-xs leading-relaxed overflow-x-auto" dir="ltr">
                  !pip install -q streamlit google-genai python-dotenv<br />
                  !wget -q https://raw.githubusercontent.com/.../streamlit_app.py # أو رفع الملف إلى Colab<br />
                  !npx localtunnel --port 8501 &amp; streamlit run streamlit_app.py
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-xs text-neutral-400 font-mono">streamlit_app.py (النسخة المتوافقة مع أحدث نماذج Google)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(fullCode, true)}
                    disabled={!fullCode || isLoadingCode}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors shadow"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'تم النسخ بنجاح!' : 'نسخ الكود بالكامل'}</span>
                  </button>
                  <a
                    href="/api/download-streamlit-file"
                    download="streamlit_app.py"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors border border-neutral-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل الملف</span>
                  </a>
                  <a
                    href="/api/download-python-project"
                    download="BollywoodSub_Python_Project.zip"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors border border-neutral-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل ZIP</span>
                  </a>
                </div>
              </div>
              <p className="text-neutral-400 text-xs">
                انسخ هذا الكود واستبدله في ملف <code className="text-amber-400 font-mono" dir="ltr">streamlit_app.py</code> على GitHub لحل أي ضغط خوادم أو أخطاء توقف تلقائياً:
              </p>
              <div className="relative">
                <pre
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto whitespace-pre select-all"
                  dir="ltr"
                >
                  {isLoadingCode ? 'جاري تحميل الكود الأحدث...' : fullCode || '# افتح التبويب لتحميل الكود المحدث'}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>مفتاحك يبقى آمناً ومحلياً في جلستك الخاصة على Streamlit</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/download-python-project"
              download="BollywoodSub_Python_Project.zip"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل الحزمة الكاملة (.ZIP)</span>
            </a>
            <a
              href="/api/download-streamlit-file"
              download="streamlit_app.py"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل streamlit_app.py</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
