#!/usr/bin/env python3
"""
BollywoodSub AI - Standalone Local Translator
ترجمة الأفلام والمسلسلات الهندية إلى العربية بمزامنة حتمية بدون أخطاء التوقيت

Author: BollywoodSub AI
Requirements:
    pip install google-genai python-dotenv
    ffmpeg (installed on system PATH)
"""

import os
import sys
import json
import re
import argparse
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables (API key)
load_dotenv()

# Strict Base-60 Timecode Calculation
def parse_timecode_to_seconds(timecode_str: str) -> float:
    """
    Solves the classic Base-100 vs Base-60 AI error.
    Enforces: Total Seconds = (Minutes * 60) + Seconds.
    Example: '01:00.25' -> (1 * 60) + 0.25 = 60.25 seconds.
    """
    if not timecode_str:
        return 0.0
    
    clean = str(timecode_str).strip().replace(',', '.')
    parts = clean.split(':')
    
    if len(parts) == 3:
        # HH:MM:SS.ms
        hours = float(parts[0])
        minutes = float(parts[1])
        seconds = float(parts[2])
        return (hours * 3600.0) + (minutes * 60.0) + seconds
    elif len(parts) == 2:
        # MM:SS.ms
        minutes = float(parts[0])
        seconds = float(parts[1])
        return (minutes * 60.0) + seconds
    else:
        try:
            return float(clean)
        except ValueError:
            return 0.0

def seconds_to_srt_time(total_sec: float) -> str:
    """Convert seconds to standard SubRip time: HH:MM:SS,mmm"""
    total_sec = max(0.0, total_sec)
    hours = int(total_sec // 3600)
    minutes = int((total_sec % 3600) // 60)
    seconds = int(total_sec % 60)
    milliseconds = int(round((total_sec % 1) * 1000))
    if milliseconds >= 1000:
        seconds += 1
        milliseconds = 0
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

def seconds_to_ass_time(total_sec: float) -> str:
    """Convert seconds to ASS time format: H:MM:SS.cc"""
    total_sec = max(0.0, total_sec)
    hours = int(total_sec // 3600)
    minutes = int((total_sec % 3600) // 60)
    seconds = int(total_sec % 60)
    centiseconds = int(round((total_sec % 1) * 100))
    if centiseconds >= 100:
        seconds += 1
        centiseconds = 0
    return f"{hours}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}"

def extract_audio_ffmpeg(input_video_path: str, output_audio_path: str):
    """
    FFmpeg Pipeline:
    - High-fidelity 44.1kHz stereo 128k
    - Zero-timestamp synchronization: -avoid_negative_ts make_zero -af aresample=async=1
    Ensures voice starts from exact 00:00.00 without any frame drift.
    """
    print(f"[*] جاري استخراج الصوت بدقة 44.1kHz ومزامنة صفرية: {input_video_path}")
    cmd = [
        "ffmpeg", "-y",
        "-i", input_video_path,
        "-vn",
        "-avoid_negative_ts", "make_zero",
        "-af", "aresample=async=1",
        "-ar", "44100",
        "-ac", "2",
        "-b:a", "128k",
        output_audio_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {res.stderr}")
    print(f"[+] تم استخراج الصوت بنجاح: {output_audio_path}")

def call_gemini_translation(audio_file_path: str, dialect: str = "msa", model_name: str = "gemini-3.8-flash") -> list:
    """
    Calls Google Gemini API using the modern @google/genai SDK.
    Enforces MM:SS.ms timecodes and Hindi/Hinglish to Arabic translation.
    """
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("يرجى تعيين متغير البيئة GEMINI_API_KEY")

    client = genai.Client(api_key=api_key)

    dialect_names = {
        "msa": "اللغة العربية الفصحى الحديثة (Modern Standard Arabic)",
        "egyptian": "اللهجة المصرية السينمائية السلسة",
        "levantine": "اللهجة الشامية (سورية/لبنانية)",
        "gulf": "اللهجة الخليجية المعاصرة",
        "iraqi": "اللهجة العراقية"
    }
    target_dialect = dialect_names.get(dialect, dialect_names["msa"])

    print(f"[*] رفع ملف الصوت إلى Gemini API...")
    uploaded_file = client.files.upload(file=audio_file_path)

    system_instruction = f"""
أنت المترجم الأول والمتخصص عالمياً في ترجمة السينما والمسلسلات الهندية (Bollywood & OTT) إلى اللغة العربية:
- الهدف: استمع إلى الصوت الهندي وحوله إلى ترجمة عربية متقنة بـ {target_dialect}.
- ترجم كل شيء: الحوارات السريعة، الـ Hinglish (مزج الهندي والإنجليزي)، مقاطع الراب الهندي السريع، وأغاني الخلفية الشعرية.
- ابدأ من الثانية 00:00.00 دون إسقاط أي ثانية.

قاعدة علامة النوتة الموسيقية للأغاني ومقاطع الراب (Musical Note Notation ♪):
- إذا كانت الجملة غنائية أو مقطع راب هندي سريع، ضع نوعها "song" أو "rap".
- إلزامياً: يجب إحاطة الترجمة العربية بعلامة النوتة الموسيقية '♪' من البداية والنهاية (مثال: "♪ وقتنا جاي لا محالة! ♪").

قاعدة التوقيت الصارمة جداً (منع خطأ الـ 100 ثانية):
- يجب أن تخرج التوقيت بصيغة نصية دقيقة (MM:SS.ms) مثل "00:01.20" أو "01:05.40".
- الدقيقة تساوي 60 ثانية تماماً وليست 100 ثانية.
- أخرج النتيجة حصراً بصيغة JSON Array:
[
  {{
    "timecodeStart": "00:01.20",
    "timecodeEnd": "00:04.50",
    "originalHindi": "نص الحوار الهندي أو Hinglish",
    "arabicTranslation": "الترجمة العربية الدقيقة هنا (محاطة بـ ♪ إذا كانت أغنية أو راب)",
    "type": "dialogue" // dialogue, hinglish, rap, song
  }}
]
"""

    prompt = "ترجم كل حوارات وأغاني هذا المقطع الصوتي الهندي بدقة سينمائية مع وضع علامة النوتة ♪ للأغاني والراب وصيغة التوقيت MM:SS.ms في JSON."

    print(f"[*] جاري تحليل الصوت وتوليد الترجمة عبر النموذج {model_name}...")
    response = client.models.generate_content(
        model=model_name,
        contents=[uploaded_file, prompt],
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json"
        )
    )

    raw_text = response.text
    # Parse JSON
    try:
        cues_data = json.loads(raw_text)
    except Exception:
        # Fallback regex extraction if wrapped in markdown
        match = re.search(r'\[\s*\{.*\}\s*\]', raw_text, re.DOTALL)
        if match:
            cues_data = json.loads(match.group(0))
        else:
            raise ValueError(f"فشل قراءة الـ JSON من استجابة النموذج: {raw_text[:200]}")

    return cues_data

def sanitize_and_align_cues(raw_cues: list, min_duration: float = 1.0) -> list:
    """
    Applies the deterministic Base-60 formula and fixes overlaps/minimum durations.
    Total Seconds = (Minutes * 60) + Seconds
    """
    processed = []
    for item in raw_cues:
        start = parse_timecode_to_seconds(item.get("timecodeStart", "00:00.00"))
        end = parse_timecode_to_seconds(item.get("timecodeEnd", "00:00.00"))
        
        if end <= start or (end - start) < min_duration:
            end = start + min_duration
            
        arabic = (item.get("arabicTranslation") or "").strip()
        hindi = (item.get("originalHindi") or "").strip()
        cue_type = item.get("type", "dialogue")
        
        # Enforce musical notes for songs and rap
        if cue_type in ("song", "rap") and arabic:
            if not arabic.startswith("♪") and not arabic.startswith("♫"):
                arabic = f"♪ {arabic}"
            if not arabic.endswith("♪") and not arabic.endswith("♫"):
                arabic = f"{arabic} ♪"

        if arabic or hindi:
            processed.append({
                "start": start,
                "end": end,
                "arabic": arabic,
                "hindi": hindi,
                "type": cue_type
            })

    # Sort chronologically
    processed.sort(key=lambda x: x["start"])

    # Prevent overlaps and enforce minimum duration
    for i in range(len(processed)):
        curr = processed[i]
        if (curr["end"] - curr["start"]) < min_duration:
            curr["end"] = curr["start"] + min_duration

        if i > 0:
            prev = processed[i - 1]
            if curr["start"] < prev["end"]:
                if (prev["end"] - prev["start"]) > (min_duration + 0.2):
                    prev["end"] = max(prev["start"] + min_duration, curr["start"] - 0.05)
                else:
                    curr["start"] = prev["end"] + 0.05
                    curr["end"] = max(curr["end"], curr["start"] + min_duration)

    return processed

def export_srt(cues: list, filepath: str):
    """Save SRT file"""
    lines = []
    for i, cue in enumerate(cues, start=1):
        s = seconds_to_srt_time(cue["start"])
        e = seconds_to_srt_time(cue["end"])
        lines.append(f"{i}\n{s} --> {e}\n{cue['arabic']}\n")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"[+] تم إنشاء ملف SRT: {filepath}")

def export_ass(cues: list, filepath: str, title: str = "BollywoodSub"):
    """Save cinematic ASS file with Cairo font & Arabic styling"""
    header = f"""[Script Info]
; Script generated by BollywoodSub AI (Deterministic Base-60)
Title: {title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ArabicCinema,Cairo,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2.5,1.5,2,40,40,35,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for cue in cues:
        s = seconds_to_ass_time(cue["start"])
        e = seconds_to_ass_time(cue["end"])
        text = cue["arabic"].replace("\n", " \\N ")
        events.append(f"Dialogue: 0,{s},{e},ArabicCinema,,0,0,0,,{text}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(events) + "\n")
    print(f"[+] تم إنشاء ملف ASS السينمائي: {filepath}")

def burn_subtitles_ffmpeg(video_path: str, sub_path: str, output_video_path: str):
    """Hardcodes/burns subtitles onto the video using FFmpeg"""
    print(f"[*] جاري حرق الترجمة مباشرة على الفيديو: {output_video_path} ...")
    # Subtitles filter requires escaped backslashes and colons
    escaped_sub = sub_path.replace("\\", "/").replace(":", "\\:")
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles='{escaped_sub}':force_style='FontName=Cairo,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=25'",
        "-c:a", "copy",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        output_video_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg burning error: {res.stderr}")
    print(f"[+] اكتمل حرق الترجمة بنجاح! الفيديو جاهز: {output_video_path}")

def main():
    parser = argparse.ArgumentParser(description="BollywoodSub AI - ترجمة الأفلام والمسلسلات الهندية إلى العربية")
    parser.add_argument("--video", "-v", required=True, help="مسار ملف الفيديو (MP4, MKV, etc.)")
    parser.add_argument("--dialect", "-d", default="msa", choices=["msa", "egyptian", "levantine", "gulf", "iraqi"], help="اللهجة العربية المستهدفة")
    parser.add_argument("--model", "-m", default="gemini-3.8-flash", help="نموذج Gemini")
    parser.add_argument("--burn", "-b", action="store_true", help="حرق الترجمة داخل الفيديو مباشرة")
    parser.add_argument("--output-dir", "-o", default="./output", help="مجلد حفظ الملفات")

    args = parser.parse_args()

    video_path = Path(args.video)
    if not video_path.exists():
        print(f"[-] الملف غير موجود: {video_path}")
        sys.exit(1)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    base_name = video_path.stem
    audio_path = out_dir / f"{base_name}_audio.mp3"
    srt_path = out_dir / f"{base_name}_arabic.srt"
    ass_path = out_dir / f"{base_name}_arabic.ass"
    burned_path = out_dir / f"{base_name}_translated.mp4"

    # 1. Extract audio
    extract_audio_ffmpeg(str(video_path), str(audio_path))

    # 2. Translate with Gemini
    raw_cues = call_gemini_translation(str(audio_path), dialect=args.dialect, model_name=args.model)

    # 3. Deterministic Base-60 calculation & alignment
    aligned_cues = sanitize_and_align_cues(raw_cues)
    print(f"[+] تم استخراج وضبط {len(aligned_cues)} سطر ترجمة بدقة توقيت حتمية.")

    # 4. Save SRT and ASS
    export_srt(aligned_cues, str(srt_path))
    export_ass(aligned_cues, str(ass_path), title=base_name)

    # 5. Burn subtitles if requested
    if args.burn:
        burn_subtitles_ffmpeg(str(video_path), str(srt_path), str(burned_path))

    print("\n========================================================")
    print("✅ اكتملت العملية بنجاح!")
    print(f"📁 SRT: {srt_path}")
    print(f"📁 ASS: {ass_path}")
    if args.burn:
        print(f"🎬 Video: {burned_path}")
    print("========================================================")

if __name__ == "__main__":
    main()
