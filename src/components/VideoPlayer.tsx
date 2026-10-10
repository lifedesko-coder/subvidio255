import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  RotateCw,
  Eye,
  EyeOff,
  Palette,
  Sliders,
  Type,
  Music
} from 'lucide-react';
import { SubtitleCue, SubtitleStyle } from '../types';
import { secondsToTimecode, hasMusicalNote, formatMusicalNote } from '../utils/subtitleUtils';

interface VideoPlayerProps {
  videoUrl: string | null;
  cues: SubtitleCue[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  subtitleStyle: SubtitleStyle;
  onStyleChange: (style: SubtitleStyle) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  cues,
  currentTime,
  onTimeUpdate,
  onSeek,
  subtitleStyle,
  onStyleChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showHindi, setShowHindi] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Sync external seek with video
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    onTimeUpdate(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    videoRef.current.currentTime = newTime;
    onSeek(newTime);
  };

  const skipSeconds = (seconds: number) => {
    if (!videoRef.current) return;
    const nextTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = nextTime;
    onSeek(nextTime);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  // Find currently active subtitle cue
  const activeCue = cues.find(
    (c) => currentTime >= c.startSeconds && currentTime <= c.endSeconds
  );

  // Subtitle styling classes
  const getSubtitleClasses = () => {
    switch (subtitleStyle) {
      case 'bollywood_gold':
        return 'text-amber-300 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] [text-shadow:_0_2px_4px_#000000,_0_0_8px_#000000]';
      case 'boxed_classic':
        return 'bg-neutral-950/85 text-white px-4 py-1.5 rounded-md border border-neutral-700/50 shadow-xl';
      case 'arabic_cinematic':
        return 'text-neutral-50 font-extrabold tracking-wide drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)] [text-shadow:_0_2px_5px_#000000,_0_0_10px_#000000]';
      case 'netflix_white':
      default:
        return 'text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] [text-shadow:_0_1px_3px_#000000,_0_0_6px_#000000]';
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col group select-none"
    >
      {/* Video Stage */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
            className="w-full h-full object-contain cursor-pointer"
            playsInline
          />
        ) : (
          <div className="text-center p-8 text-neutral-500 space-y-2">
            <p className="text-sm font-medium">لم يتم تحميل أي فيديو بعد</p>
            <p className="text-xs">قم برفع ملف فيديو أو انقر على "تجربة مشهد بوليوود فوري" بالأعلى</p>
          </div>
        )}

        {/* Live Subtitle Overlay */}
        {showSubtitles && activeCue && (
          <div className="absolute bottom-12 inset-x-0 flex flex-col items-center pointer-events-none px-6 z-20">
            {/* Original Hindi / Hinglish (optional toggle) */}
            {showHindi && activeCue.originalHindi && (
              <div className="text-xs sm:text-sm font-medium text-amber-200/90 mb-1 px-3 py-0.5 rounded bg-black/60 backdrop-blur-xs border border-white/10 flex items-center gap-1.5" dir="ltr">
                {activeCue.type === 'rap' && <span className="text-red-400 font-bold flex items-center gap-0.5"><Music className="w-3 h-3" />[RAP]</span>}
                {activeCue.type === 'song' && <span className="text-sky-400 font-bold flex items-center gap-0.5"><Music className="w-3 h-3" />[OST]</span>}
                <span>{activeCue.originalHindi}</span>
              </div>
            )}

            {/* Arabic Translation Subtitle */}
            <div
              className={`text-center text-lg sm:text-2xl md:text-3xl max-w-3xl leading-relaxed transition-all duration-100 ${getSubtitleClasses()}`}
              dir="rtl"
            >
              {(activeCue.type === 'song' || activeCue.type === 'rap') && !hasMusicalNote(activeCue.arabicTranslation)
                ? formatMusicalNote(activeCue.arabicTranslation)
                : activeCue.arabicTranslation}
            </div>
          </div>
        )}
      </div>

      {/* Video Control Bar */}
      <div className="bg-gradient-to-t from-neutral-950 via-neutral-900 to-neutral-900/90 border-t border-neutral-800/80 p-3 flex flex-col gap-2">
        {/* Timeline Scrubber */}
        <div
          onClick={handleTimelineClick}
          className="relative h-3 w-full bg-neutral-800 rounded-full cursor-pointer group/scrubber flex items-center"
        >
          {/* Progress Bar */}
          <div
            className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full relative group-hover/scrubber:h-2.5 transition-all"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover/scrubber:scale-100 transition-transform" />
          </div>

          {/* Subtitle markers on timeline */}
          {duration > 0 &&
            cues.map((cue) => {
              const leftPercent = (cue.startSeconds / duration) * 100;
              const widthPercent = Math.max(0.5, ((cue.endSeconds - cue.startSeconds) / duration) * 100);
              let markerColor = 'bg-amber-400/40';
              if (cue.type === 'rap') markerColor = 'bg-red-400/60';
              if (cue.type === 'song') markerColor = 'bg-sky-400/60';
              return (
                <div
                  key={cue.id}
                  title={`${cue.timecodeStart}: ${cue.arabicTranslation}`}
                  className={`absolute top-0 bottom-0 pointer-events-none rounded-sm ${markerColor}`}
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                />
              );
            })}
        </div>

        {/* Action Controls & Timestamps */}
        <div className="flex items-center justify-between gap-3 text-neutral-300 text-xs">
          {/* Left Controls: Play, Skips, Timers */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition-transform active:scale-95 shadow-md shadow-amber-500/20"
              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => skipSeconds(-2)}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 transition-colors"
              title="تراجع ثانيتين"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => skipSeconds(2)}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 transition-colors"
              title="تقدم ثانيتين"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Timecode display */}
            <div className="font-mono text-[11px] text-neutral-400 px-2 py-1 rounded bg-neutral-950 border border-neutral-800 flex items-center gap-1.5">
              <span className="text-amber-400 font-semibold">{secondsToTimecode(currentTime)}</span>
              <span>/</span>
              <span>{secondsToTimecode(duration)}</span>
              <span className="text-[10px] text-neutral-500">({currentTime.toFixed(2)}s)</span>
            </div>
          </div>

          {/* Right Controls: Styling, Dual-language toggle, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Style Selector */}
            <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded-lg border border-neutral-800">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={subtitleStyle}
                onChange={(e) => onStyleChange(e.target.value as SubtitleStyle)}
                className="bg-transparent text-[11px] text-neutral-200 outline-none cursor-pointer"
                title="نمط ظهور الترجمة"
              >
                <option value="bollywood_gold" className="bg-neutral-900 text-amber-300">ذهبي بوليوودي (Gold)</option>
                <option value="arabic_cinematic" className="bg-neutral-900 text-white">سينمائي أنيق (Cairo)</option>
                <option value="netflix_white" className="bg-neutral-900 text-white">أبيض ناصع (Netflix)</option>
                <option value="boxed_classic" className="bg-neutral-900 text-white">شريط أسود كلاسيكي (Boxed)</option>
              </select>
            </div>

            {/* Toggle Hindi Text */}
            <button
              onClick={() => setShowHindi(!showHindi)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                showHindi
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
              }`}
              title="إظهار/إخفاء النص الهندي الأصلي (Hinglish)"
            >
              <Type className="w-3 h-3" />
              <span>هندي/Hinglish</span>
            </button>

            {/* Toggle Subtitles On/Off */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showSubtitles
                  ? 'bg-neutral-800 text-neutral-200 border-neutral-700'
                  : 'bg-neutral-900 text-neutral-500 border-neutral-800'
              }`}
              title="تشغيل/إخفاء الترجمة"
            >
              {showSubtitles ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            {/* Volume Control */}
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 transition-colors"
              title="ملء الشاشة"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
