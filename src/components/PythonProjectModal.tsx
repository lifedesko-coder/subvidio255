import React, { useState } from 'react';
import { X, Download, Copy, Check, Terminal, FileCode, BookOpen, Layers } from 'lucide-react';

interface PythonProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonProjectModal: React.FC<PythonProjectModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'commands' | 'readme'>('code');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const pythonScript = `#!/usr/bin/env python3
"""
BollywoodSub AI - Standalone Local Translator
ترجمة الأفلام والمسلسلات الهندية إلى العربية بمزامنة حتمية بدون أخطاء التوقيت
"""
import os, sys, json, re, argparse, subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def parse_timecode_to_seconds(timecode_str: str) -> float:
    """Base-60 Formula: Total Seconds = (Minutes * 60) + Seconds"""
    if not timecode_str: return 0.0
    clean = str(timecode_str).strip().replace(',', '.')
    parts = clean.split(':')
    if len(parts) == 3:
        return (float(parts[0]) * 3600.0) + (float(parts[1]) * 60.0) + float(parts[2])
    elif len(parts) == 2:
        return (float(parts[0]) * 60.0) + float(parts[1])
    return float(clean)

def extract_audio_ffmpeg(input_video_path: str, output_audio_path: str):
    """FFmpeg Zero-Sync Pipeline: -avoid_negative_ts make_zero -af aresample=async=1"""
    cmd = [
        "ffmpeg", "-y", "-i", input_video_path, "-vn",
        "-avoid_negative_ts", "make_zero", "-af", "aresample=async=1",
        "-ar", "44100", "-ac", "2", "-b:a", "128k", output_audio_path
    ]
    subprocess.run(cmd, check=True)

def call_gemini_translation(audio_file_path: str, dialect="msa", model="gemini-3.8-flash"):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    uploaded_file = client.files.upload(file=audio_file_path)
    # Strict prompt enforcing MM:SS.ms in JSON format
    # ... See full script in project download
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">مشروع Python المستقل للأجهزة المحلية</h3>
              <p className="text-xs text-neutral-400">
                تشغيل محلي بالكامل لمعالجة الأفلام الطويلة ومسلسلات OTT دون قيود المتصفح
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/download-python-project"
              download="BollywoodSub_Python_Project.zip"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-450 text-neutral-950 font-bold text-xs transition-colors shadow-lg shadow-sky-500/20"
            >
              <Download className="w-4 h-4" />
              <span>تحميل المشروع كاملاً (.ZIP)</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/50 px-5 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 transition-all ${
              activeTab === 'code'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>كود بايثون الرئيسي (gemini_subtitler.py)</span>
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 transition-all ${
              activeTab === 'commands'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>أوامر التشغيل والـ CLI</span>
          </button>
          <button
            onClick={() => setActiveTab('readme')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-semibold border-b-2 transition-all ${
              activeTab === 'readme'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>دليل التثبيت (README)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'code' && (
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-neutral-400 font-mono">standalone-python/gemini_subtitler.py</span>
                <button
                  onClick={() => copyToClipboard(pythonScript)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 font-mono text-xs overflow-x-auto leading-relaxed" dir="ltr">
                {pythonScript}
              </pre>
            </div>
          )}

          {activeTab === 'commands' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <h4 className="font-bold text-sky-400 text-sm">1. تثبيت المتطلبات:</h4>
                <div className="p-2.5 rounded bg-neutral-900 font-mono text-neutral-200" dir="ltr">
                  pip install google-genai python-dotenv
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <h4 className="font-bold text-sky-400 text-sm">2. تعيين مفتاح API:</h4>
                <div className="p-2.5 rounded bg-neutral-900 font-mono text-neutral-200" dir="ltr">
                  export GEMINI_API_KEY="AIzaSy..."
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <h4 className="font-bold text-sky-400 text-sm">3. ترجمة وحرق الترجمة فورياً على الفيديو:</h4>
                <div className="p-2.5 rounded bg-neutral-900 font-mono text-neutral-200" dir="ltr">
                  python gemini_subtitler.py --video "Path/To/Bollywood_Movie.mp4" --dialect egyptian --burn
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <h4 className="font-bold text-sky-400 text-sm">4. توليد ملفات SRT و ASS فقط دون حرق:</h4>
                <div className="p-2.5 rounded bg-neutral-900 font-mono text-neutral-200" dir="ltr">
                  python gemini_subtitler.py --video "episode_01.mkv" --dialect msa
                </div>
              </div>
            </div>
          )}

          {activeTab === 'readme' && (
            <div className="space-y-3 text-xs leading-relaxed text-neutral-300 p-2">
              <h4 className="font-bold text-neutral-100 text-sm">دليل تشغيل سكريبت بايثون المستقل:</h4>
              <p>
                تم إعداد هذا المشروع ليعمل بشكل مستقل تماماً على أي نظام تشغيل (ويندوز، ماك، لينكس) لمعالجة الفيديوهات الضخمة (4K / 1080p) ومسلسلات منصات البث (Netflix, Prime Video, Hotstar).
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-neutral-300">
                <li>يعتمد على مكتبة <code className="text-amber-400 font-mono">google-genai</code> الرسمية الحديثة.</li>
                <li>يطبق معادلة التوقيت الحتمية <code className="text-emerald-400 font-mono">(Minutes * 60) + Seconds</code> لمنع أي انزياح زمني.</li>
                <li>يستخرج الصوت بمزامنة صفرية عبر FFmpeg مع فلتر <code className="text-sky-300 font-mono">-avoid_negative_ts make_zero -af aresample=async=1</code>.</li>
                <li>يولد ملفات ASS بتنسيق سينمائي عالي الجودة متوافق مع كافة برامج المشاهدة والمونتاج.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900 flex justify-between items-center">
          <span className="text-xs text-neutral-400">يتضمن الملف المضغوط كافة ملفات الكود والتعليمات وملف requirements.txt جاهز للعمل</span>
          <a
            href="/api/download-python-project"
            download="BollywoodSub_Python_Project.zip"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-450 text-neutral-950 font-bold text-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>تحميل ZIP الآن</span>
          </a>
        </div>
      </div>
    </div>
  );
};
