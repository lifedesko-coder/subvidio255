import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Clock,
  Music,
  Mic,
  MessageSquare,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { SubtitleCue } from '../types';
import {
  secondsToTimecode,
  formatMusicalNote,
  hasMusicalNote,
  stripMusicalNotes,
} from '../utils/subtitleUtils';

interface SubtitleEditorProps {
  cues: SubtitleCue[];
  currentTime: number;
  onUpdateCue: (id: string, updated: Partial<SubtitleCue>) => void;
  onDeleteCue: (id: string) => void;
  onAddCue: (startSec: number) => void;
  onSeek: (timeSec: number) => void;
  onShiftAll: (offsetSec: number) => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  cues,
  currentTime,
  onUpdateCue,
  onDeleteCue,
  onAddCue,
  onSeek,
  onShiftAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredCues = cues.filter((cue) => {
    const matchesSearch =
      cue.arabicTranslation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cue.originalHindi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cue.speaker && cue.speaker.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === 'all' || cue.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleToggleMusicalNote = (cue: SubtitleCue) => {
    if (hasMusicalNote(cue.arabicTranslation)) {
      onUpdateCue(cue.id, {
        arabicTranslation: stripMusicalNotes(cue.arabicTranslation),
      });
    } else {
      onUpdateCue(cue.id, {
        arabicTranslation: formatMusicalNote(cue.arabicTranslation),
        type: cue.type === 'dialogue' ? 'song' : cue.type,
      });
    }
  };

  const handleTypeChange = (cue: SubtitleCue, newType: 'dialogue' | 'hinglish' | 'rap' | 'song') => {
    let newArabic = cue.arabicTranslation;
    if ((newType === 'song' || newType === 'rap') && !hasMusicalNote(newArabic)) {
      newArabic = formatMusicalNote(newArabic);
    }
    onUpdateCue(cue.id, {
      type: newType,
      arabicTranslation: newArabic,
    });
  };

  const handleFormatAllSongsWithNotes = () => {
    cues.forEach((c) => {
      if ((c.type === 'song' || c.type === 'rap') && !hasMusicalNote(c.arabicTranslation)) {
        onUpdateCue(c.id, {
          arabicTranslation: formatMusicalNote(c.arabicTranslation),
        });
      }
    });
  };

  const getTypeBadge = (cue: SubtitleCue) => {
    switch (cue.type) {
      case 'rap':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
            <Mic className="w-2.5 h-2.5" />
            <span>راب هندي ♪</span>
          </span>
        );
      case 'song':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Music className="w-2.5 h-2.5" />
            <span>أغنية ♪</span>
          </span>
        );
      case 'hinglish':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Sparkles className="w-2.5 h-2.5" />
            <span>Hinglish</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
            <MessageSquare className="w-2.5 h-2.5" />
            <span>حوار</span>
          </span>
        );
    }
  };

  const handleAdjustStart = (cue: SubtitleCue, delta: number) => {
    const newStart = Math.max(0, cue.startSeconds + delta);
    if (newStart < cue.endSeconds - 0.5) {
      onUpdateCue(cue.id, {
        startSeconds: Number(newStart.toFixed(2)),
        timecodeStart: secondsToTimecode(newStart),
      });
    }
  };

  const handleAdjustEnd = (cue: SubtitleCue, delta: number) => {
    const newEnd = Math.max(cue.startSeconds + 0.8, cue.endSeconds + delta);
    onUpdateCue(cue.id, {
      endSeconds: Number(newEnd.toFixed(2)),
      timecodeEnd: secondsToTimecode(newEnd),
    });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col h-full shadow-xl">
      {/* Header & Controls */}
      <div className="border-b border-neutral-800 pb-3 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <span>محرر شريط الترجمة المتزامن</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-400 font-mono">
                {cues.length} سطر
              </span>
            </h3>
          </div>
        </div>

        {/* Global Offset Shift & Add Button */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800 text-xs">
            <span className="text-[10px] text-neutral-400 px-2 font-mono">إزاحة كل الأسطر:</span>
            <button
              onClick={() => onShiftAll(-0.5)}
              className="px-1.5 py-0.5 hover:bg-neutral-800 rounded text-neutral-300 font-mono text-[10px]"
              title="تأخير الكل بمقدار -0.5 ثانية"
            >
              -0.5s
            </button>
            <button
              onClick={() => onShiftAll(-0.1)}
              className="px-1.5 py-0.5 hover:bg-neutral-800 rounded text-neutral-300 font-mono text-[10px]"
              title="تأخير الكل بمقدار -0.1 ثانية"
            >
              -0.1s
            </button>
            <button
              onClick={() => onShiftAll(0.1)}
              className="px-1.5 py-0.5 hover:bg-neutral-800 rounded text-neutral-300 font-mono text-[10px]"
              title="تقديم الكل بمقدار +0.1 ثانية"
            >
              +0.1s
            </button>
            <button
              onClick={() => onShiftAll(0.5)}
              className="px-1.5 py-0.5 hover:bg-neutral-800 rounded text-neutral-300 font-mono text-[10px]"
              title="تقديم الكل بمقدار +0.5 ثانية"
            >
              +0.5s
            </button>
          </div>

          <button
            onClick={handleFormatAllSongsWithNotes}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors"
            title="فحص وإضافة علامة النوتة الموسيقية ♪ على جميع أسطر الأغاني والراب تلقائياً"
          >
            <Music className="w-3.5 h-3.5 text-sky-400" />
            <span>تأكيد ♪ للأغاني والراب</span>
          </button>

          <button
            onClick={() => onAddCue(currentTime)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-450 text-neutral-950 font-bold text-xs transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة سطر عند {secondsToTimecode(currentTime)}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الترجمة أو الحوار الهندي..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pr-8 pl-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none cursor-pointer"
        >
          <option value="all">كل الأنواع</option>
          <option value="dialogue">حوارات عادية</option>
          <option value="hinglish">Hinglish</option>
          <option value="rap">راب هندي</option>
          <option value="song">أغاني خلفية</option>
        </select>
      </div>

      {/* Subtitles Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredCues.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 space-y-2">
            <Clock className="w-8 h-8 mx-auto text-neutral-600" />
            <p className="text-xs">لا توجد أسطر ترجمة مطابقة للبحث أو لم تتم الترجمة بعد.</p>
          </div>
        ) : (
          filteredCues.map((cue, index) => {
            const isActive = currentTime >= cue.startSeconds && currentTime <= cue.endSeconds;
            const duration = (cue.endSeconds - cue.startSeconds).toFixed(2);

            return (
              <div
                key={cue.id}
                className={`p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/30'
                    : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {/* Top Row: Index, Timestamps, Jump, Type, Delete */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-xs font-mono text-neutral-500 font-bold">
                      #{index + 1}
                    </span>

                    {/* Jump to time button */}
                    <button
                      onClick={() => onSeek(cue.startSeconds)}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono text-amber-400 transition-colors"
                      title="الانتقال بالفيديو إلى بداية هذا السطر"
                    >
                      <span>{cue.timecodeStart}</span>
                      <span className="text-neutral-500">→</span>
                      <span>{cue.timecodeEnd}</span>
                    </button>

                    <span className="text-[10px] text-neutral-500 font-mono">({duration}s)</span>

                    {/* Fine-tune +/- controls */}
                    <div className="flex items-center gap-0.5 text-[10px] font-mono">
                      <button
                        onClick={() => handleAdjustStart(cue, -0.1)}
                        className="px-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 rounded"
                        title="تقديم البداية 0.1s"
                      >
                        -0.1
                      </button>
                      <button
                        onClick={() => handleAdjustStart(cue, 0.1)}
                        className="px-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 rounded"
                        title="تأخير البداية 0.1s"
                      >
                        +0.1
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Cue Type Selector */}
                    <select
                      value={cue.type || 'dialogue'}
                      onChange={(e) => handleTypeChange(cue, e.target.value as any)}
                      className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-[10px] text-neutral-300 focus:outline-none cursor-pointer"
                      title="تغيير نوع السطر (حوار / راب / أغنية)"
                    >
                      <option value="dialogue">حوار عادي</option>
                      <option value="hinglish">Hinglish</option>
                      <option value="rap">راب هندي ♪</option>
                      <option value="song">أغنية ♪</option>
                    </select>

                    {/* Musical Note Quick Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleMusicalNote(cue)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                        hasMusicalNote(cue.arabicTranslation)
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-750'
                      }`}
                      title={
                        hasMusicalNote(cue.arabicTranslation)
                          ? 'حذف علامة النوتة الموسيقية ♪ من هذا السطر'
                          : 'إضافة علامة النوتة الموسيقية ♪ لهذا السطر (مقطع غنائي أو راب)'
                      }
                    >
                      <Music className={`w-3 h-3 ${hasMusicalNote(cue.arabicTranslation) ? 'text-amber-400' : 'text-neutral-500'}`} />
                      <span>{hasMusicalNote(cue.arabicTranslation) ? '♪ نوتة مفعّلة' : 'إضافة ♪'}</span>
                    </button>

                    <button
                      onClick={() => onDeleteCue(cue.id)}
                      className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="حذف هذا السطر"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Original Hindi / Hinglish editable input */}
                <div className="mb-2">
                  <input
                    type="text"
                    value={cue.originalHindi}
                    onChange={(e) => onUpdateCue(cue.id, { originalHindi: e.target.value })}
                    placeholder="النص الهندي الأصلي (Hindi / Hinglish)..."
                    dir="ltr"
                    className="w-full bg-neutral-900/80 border border-neutral-800/80 rounded px-2.5 py-1 text-xs text-amber-200/90 font-mono focus:outline-none focus:border-amber-500/40"
                  />
                </div>

                {/* Arabic Translation editable textarea */}
                <div>
                  <textarea
                    value={cue.arabicTranslation}
                    onChange={(e) => onUpdateCue(cue.id, { arabicTranslation: e.target.value })}
                    rows={2}
                    placeholder="الترجمة العربية..."
                    dir="rtl"
                    className="w-full bg-neutral-900 border border-neutral-700/80 rounded px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-neutral-100 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
