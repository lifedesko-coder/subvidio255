import React, { useState } from 'react';
import { Download, Flame, FileText, Sparkles, Copy, Check, Share2 } from 'lucide-react';
import { SubtitleCue, SubtitleStyle } from '../types';
import { generateSRT, generateASS } from '../utils/subtitleUtils';

interface ExportToolbarProps {
  cues: SubtitleCue[];
  fileName: string | null;
  subtitleStyle: SubtitleStyle;
  onOpenBurnModal: () => void;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  cues,
  fileName,
  subtitleStyle,
  onOpenBurnModal,
}) => {
  const [copiedSRT, setCopiedSRT] = useState(false);
  const [copiedASS, setCopiedASS] = useState(false);

  const baseTitle = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Bollywood_Arabic_Subtitles';

  const handleDownloadSRT = () => {
    if (cues.length === 0) return;
    const content = generateSRT(cues);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseTitle}_arabic.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadASS = () => {
    if (cues.length === 0) return;
    const content = generateASS(cues, subtitleStyle, baseTitle);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseTitle}_arabic.ass`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySRT = () => {
    if (cues.length === 0) return;
    const content = generateSRT(cues);
    navigator.clipboard.writeText(content);
    setCopiedSRT(true);
    setTimeout(() => setCopiedSRT(false), 2000);
  };

  const handleCopyASS = () => {
    if (cues.length === 0) return;
    const content = generateASS(cues, subtitleStyle, baseTitle);
    navigator.clipboard.writeText(content);
    setCopiedASS(true);
    setTimeout(() => setCopiedASS(false), 2000);
  };

  if (cues.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-850 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
      {/* Summary Info */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-neutral-100">تصدير وتنزيل ملفات الترجمة</h4>
          <p className="text-xs text-neutral-400">
            جاهز للاستخدام في جميع المشغلات وبرامج المونتاج أو الحرق المباشر على الفيديو
          </p>
        </div>
      </div>

      {/* Export Action Buttons */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Copy SRT */}
        <button
          onClick={handleCopySRT}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-semibold text-neutral-300 border border-neutral-700 transition-colors"
          title="نسخ نص SRT إلى الحافظة"
        >
          {copiedSRT ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>نسخ SRT</span>
        </button>

        {/* Download SRT */}
        <button
          onClick={handleDownloadSRT}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-bold text-neutral-100 border border-neutral-700 transition-all hover:border-amber-500/50 shadow-sm"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>تحميل SRT قياسي</span>
        </button>

        {/* Download ASS */}
        <button
          onClick={handleDownloadASS}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-xs font-bold text-neutral-100 border border-neutral-700 transition-all hover:border-sky-500/50 shadow-sm"
        >
          <FileText className="w-4 h-4 text-sky-400" />
          <span>تحميل ASS سينمائي</span>
        </button>

        {/* Burn Subtitles on Video */}
        <button
          onClick={onOpenBurnModal}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-neutral-950 font-extrabold text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Flame className="w-4 h-4" />
          <span>حرق الترجمة داخل الفيديو (MP4)</span>
        </button>
      </div>
    </div>
  );
};
