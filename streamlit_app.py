#!/usr/bin/env python3
"""
BollywoodSub AI - تطبيق Streamlit لترجمة الأفلام والمسلسلات الهندية إلى العربية
يدعم تشغيل محلي وعلى Streamlit Cloud مع خانة مخصصة لمفتاح Google AI Studio Gemini API
ومزامنة حتمية Base-60 لمنع أخطاء التوقيت وترجمة Hinglish وأغاني بوليوود.
"""

import os
import sys
import json
import re
import tempfile
import subprocess
from pathlib import Path
import streamlit as st
from dotenv import load_dotenv

# تحميل متغيرات البيئة تلقائياً إن وجدت
load_dotenv()

# ==========================================
# إعدادات صفحة Streamlit
# ==========================================
st.set_page_config(
    page_title="BollywoodSub AI - ترجمة الأفلام الهندية",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="auto"
)

# تخصيص واجهة المستخدم لدعم العربية RTL والمظهر السينمائي مع حماية كاملة لتخطيط الهواتف المحمولة
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    
    html, body, .stApp {
        font-family: 'Cairo', sans-serif !important;
    }
    
    /* ضبط اتجاه المحتوى الرئيسي */
    .main .block-container {
        direction: rtl;
        text-align: right;
    }
    
    /* القائمة الجانبية: ضبط الاتجاه ومنع تكسر النصوص رأسياً في الشاشات الصغيرة */
    [data-testid="stSidebar"] {
        direction: rtl;
        text-align: right;
    }
    
    [data-testid="stSidebar"] * {
        word-break: normal !important;
        overflow-wrap: normal !important;
    }
    
    /* منع ظهور عناصر القائمة الجانبية عند طيها على الموبايل */
    section[data-testid="stSidebar"][aria-expanded="false"] {
        display: none !important;
    }
    
    /* ضبط اتجاه حقول الإدخال */
    .stTextInput > div > div > input {
        direction: ltr !important;
        text-align: left !important;
    }
    
    .stCodeBlock, code, pre {
        direction: ltr !important;
        text-align: left !important;
    }
    
    /* شارة بوليوود الذهبية */
    .bollywood-badge {
        display: inline-block;
        padding: 4px 12px;
        background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
        color: #0F172A;
        font-weight: 800;
        border-radius: 9999px;
        font-size: 0.8rem;
        margin-bottom: 8px;
        white-space: nowrap;
    }
    
    /* بطاقة الترجمة */
    .cue-card {
        background-color: #1E293B;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 12px 16px;
        margin-bottom: 10px;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# دوال التوقيت الحتمية (Base-60 Math)
# ==========================================
def parse_timecode_to_seconds(timecode_str: str) -> float:
    """
    تحويل صيغة MM:SS.ms إلى ثوانٍ حقيقية بقاعدة Base-60 (60 ثانية للدقيقة وليست 100).
    المعادلة: Total Seconds = (Minutes * 60) + Seconds
    """
    if not timecode_str:
        return 0.0
    
    clean = str(timecode_str).strip().replace(',', '.')
    parts = clean.split(':')
    
    if len(parts) == 3:
        hours = float(parts[0])
        minutes = float(parts[1])
        seconds = float(parts[2])
        return (hours * 3600.0) + (minutes * 60.0) + seconds
    elif len(parts) == 2:
        minutes = float(parts[0])
        seconds = float(parts[1])
        return (minutes * 60.0) + seconds
    else:
        try:
            return float(clean)
        except ValueError:
            return 0.0

def seconds_to_srt_time(total_sec: float) -> str:
    """تحويل الثواني إلى صيغة SRT القياسية: HH:MM:SS,mmm"""
    total_sec = max(0.0, total_sec)
    hours = int(total_sec // 3600)
    minutes = int((total_sec % 3600) // 60)
    seconds = int(total_sec % 60)
    milliseconds = int(round((total_sec % 1) * 1000))
    if milliseconds >= 1000:
        seconds += 1
        milliseconds = 0
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

def seconds_to_vtt_time(total_sec: float) -> str:
    """تحويل الثواني إلى صيغة WebVTT: HH:MM:SS.mmm"""
    total_sec = max(0.0, total_sec)
    hours = int(total_sec // 3600)
    minutes = int((total_sec % 3600) // 60)
    seconds = int(total_sec % 60)
    milliseconds = int(round((total_sec % 1) * 1000))
    if milliseconds >= 1000:
        seconds += 1
        milliseconds = 0
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"

def seconds_to_ass_time(total_sec: float) -> str:
    """تحويل الثواني إلى صيغة ASS: H:MM:SS.cc"""
    total_sec = max(0.0, total_sec)
    hours = int(total_sec // 3600)
    minutes = int((total_sec % 3600) // 60)
    seconds = int(total_sec % 60)
    centiseconds = int(round((total_sec % 1) * 100))
    if centiseconds >= 100:
        seconds += 1
        centiseconds = 0
    return f"{hours}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}"

def check_ffmpeg_installed() -> bool:
    """التحقق من توفر ffmpeg في النظام"""
    try:
        res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return res.returncode == 0
    except Exception:
        return False

def extract_audio_zero_sync(video_path: str, output_audio_path: str) -> bool:
    """استخراج الصوت بدقة 44.1kHz ومزامنة صفرية لمنع انزياح التوقيت"""
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-vn",
            "-avoid_negative_ts", "make_zero",
            "-af", "aresample=async=1",
            "-ar", "44100",
            "-ac", "2",
            "-b:a", "128k",
            output_audio_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return res.returncode == 0
    except Exception as e:
        st.warning(f"تعذر استخراج الصوت عبر FFmpeg: {e}")
        return False



# ==========================================
# دالة تصفية المؤثرات الصوتية والأصوات البيئية
# ==========================================
def is_sound_effect_or_ambient(arabic_text: str, hindi_text: str = "") -> tuple[bool, str]:
    """
    التحقق مما إذا كان السطر يصف مؤثراً صوتياً أو صوتاً بيئياً بدلاً من كلام بشري،
    مع تنظيف الأقواس والتعليقات الصوتية من النصوص الحوارية الحقيقية.
    يرجع (True, "") إذا كان السطر بأكمله مجرد مؤثر صوتي يجب استبعاده تماماً.
    ويرجع (False, cleaned_text) إذا كان حواراً طبيعياً بعد إزالة أي أوصاف صوتية عرضية.
    """
    if not arabic_text:
        return True, ""
    
    clean_ar = arabic_text.strip()
    clean_hi = (hindi_text or "").strip().lower()

    # استثناء فوري للأغاني ومقاطع الراب الموسيقية الصريحة
    if "♪" in clean_ar or "♫" in clean_ar:
        return False, clean_ar

    # الكلمات والأنماط الدالة على المؤثرات الصوتية والبيئية (Foley / Sound Effects)
    sound_keywords = [
        "صوت دق", "صوت طرق", "صوت فتح", "صوت غلق", "صوت الباب", "دق الباب", "طرق الباب", "طرق على الباب", "فتح الباب", "إغلاق الباب",
        "صوت خطوات", "خطوات أقدام", "أصوات أقدام", "صوت بكاء", "صوت نحيب", "صوت صراخ", "صوت ضحك", "صوت قهقهة",
        "صوت تنفس", "تنهد", "أنفاس عميقة", "صوت رنين", "رنين هاتف", "رنين جرس", "صوت صفير", "صوت زامور",
        "صوت محرك", "صوت سيارة", "صوت فرامل", "صوت إطلاق نار", "صوت رصاص", "صوت انفجار", "صوت تصفيق",
        "صوت رياح", "صوت مطر", "قطرات ماء", "صوت موسيقى", "موسيقى تصويرية", "موسيقى حزينة", "موسيقى حماسية",
        "صوت صرير", "صوت سقوط", "تحطم زجاج", "صوت همس", "صوت صفارة", "عواء رياح"
    ]

    hindi_sound_keywords = [
        "darwaza kholne", "darwaze pe dastak", "door kholne", "door knock",
        "kadmon ki aawaz", "rone ki aawaz", "cheekhne ki aawaz", "hansi ki aawaz",
        "phone ki ghanti", "sound of door", "door sound", "footsteps"
    ]

    # فحص الهندية إذا كانت صراحة تصف صوتاً
    for kw in hindi_sound_keywords:
        if kw in clean_hi:
            return True, ""

    # فحص ما إذا كان النص العربي كاملاً يطابق أحد المؤثرات الصوتية
    for kw in sound_keywords:
        stripped = re.sub(r'[\(\)\[\]\{\}\*\.\-_\:!؟]', '', clean_ar).strip()
        if stripped == kw or (stripped.startswith(kw) and len(stripped) <= len(kw) + 12):
            return True, ""

    # إذا كان النص محاطاً بالكامل بأقواس مربعة أو دائرية ومحتواه يصف صوتاً
    bracket_match = re.fullmatch(r'^[\[\(\*](.*?)[\]\)\*]$', clean_ar)
    if bracket_match:
        inner = bracket_match.group(1).strip()
        if any(w in inner for w in ["صوت", "موسيقى", "طرق", "دق", "بكاء", "ضحك", "أقدام", "خطوات", "تنفس"]):
            return True, ""

    # تنظيف أي بادئة أو لاحقة تصف صوتاً بين أقواس داخل حوار حقيقي (مثال: "[صوت باب] مرحباً" -> "مرحباً")
    cleaned_ar = re.sub(r'^[\[\(][^\]\)]*صوت[^\]\)]*[\]\)]\s*', '', clean_ar).strip()
    cleaned_ar = re.sub(r'\s*[\[\(][^\]\)]*صوت[^\]\)]*[\]\)]$', '', cleaned_ar).strip()
    
    if not cleaned_ar:
        return True, ""

    return False, cleaned_ar


# ==========================================
# دالة تجزئة وتقطيع الأسطر الطويلة لراحة المشاهد
# ==========================================
def split_long_cue(cue: dict, max_duration: float = 5.5, max_words: int = 14) -> list:
    """
    تجزئة الأسطر والمونولوجات الطويلة (التي تتجاوز الحد الأقصى للمدة أو عدد الكلمات)
    إلى عدة أسطر سينمائية متتالية مريحة لعين المشاهد، مع توزيع التوقيت بذكاء نسبي.
    """
    start = cue["start"]
    end = cue["end"]
    total_dur = end - start
    arabic_text = cue.get("arabic", "").strip()
    hindi_text = cue.get("hindi", "").strip()
    cue_type = cue.get("type", "dialogue")

    arabic_words = arabic_text.split()
    
    # إذا كانت المدة مقبولة وعدد الكلمات معقولاً، نترك السطر كما هو
    if total_dur <= max_duration and len(arabic_words) <= max_words:
        return [cue]

    # محاولة التقسيم بالاعتماد على علامات الترقيم العربية (نقطة، فاصلة، علامة استفهام، تعجب، إلخ)
    sentences = [s.strip() for s in re.split(r'([.،؟!?؛…\n]+)', arabic_text) if s.strip()]
    
    # إعادة تجميع المقاطع مع علامات الترقيم
    merged_sentences = []
    curr = ""
    for piece in sentences:
        if piece in [".", "،", "؟", "!", "؟!", "!؟", "؛", "…", "\n", "..", "..."]:
            curr += piece
        else:
            if curr:
                merged_sentences.append(curr.strip())
            curr = piece
    if curr:
        merged_sentences.append(curr.strip())

    # إذا كانت الجمل المقسمة قليلة جداً لكن الكلمات كثيرة، نقسم بناءً على عدد الكلمات
    final_segments = []
    if len(merged_sentences) <= 1:
        words = arabic_words
        chunk_size = max(6, min(max_words, 10))
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk:
                final_segments.append(chunk)
    else:
        # تجميع الجمل القصيرة جداً معاً حتى لا تكون مفتتة أكثر من اللازم
        accum = ""
        for s in merged_sentences:
            if not accum:
                accum = s
            elif len(accum.split()) + len(s.split()) <= max_words:
                accum += " " + s
            else:
                final_segments.append(accum)
                accum = s
        if accum:
            final_segments.append(accum)

    if len(final_segments) <= 1:
        return [cue]

    # تقسيم النص الهندي بالتوازي إن أمكن
    hindi_words = hindi_text.split()
    hindi_segments = []
    if len(hindi_words) > 0:
        h_chunk_size = max(1, len(hindi_words) // len(final_segments))
        for i in range(len(final_segments)):
            if i == len(final_segments) - 1:
                h_part = " ".join(hindi_words[i * h_chunk_size:])
            else:
                h_part = " ".join(hindi_words[i * h_chunk_size:(i + 1) * h_chunk_size])
            hindi_segments.append(h_part)
    else:
        hindi_segments = [hindi_text] * len(final_segments)

    # توزيع التوقيت الزمني نسبياً بحسب عدد حروف كل جملة
    total_chars = sum(max(1, len(seg)) for seg in final_segments)
    current_start = start
    result_cues = []

    for i, seg in enumerate(final_segments):
        weight = max(1, len(seg)) / total_chars
        seg_dur = total_dur * weight
        seg_end = current_start + seg_dur
        
        # التأكد من عدم تجاوز النهاية الكلية في آخر مقطع
        if i == len(final_segments) - 1:
            seg_end = end

        h_seg = hindi_segments[i] if i < len(hindi_segments) else ""
        
        # الحفاظ على نوتة الأغنية إذا كانت أغنية
        clean_seg = seg
        if cue_type in ("song", "rap"):
            if not clean_seg.startswith("♪") and not clean_seg.startswith("♫"):
                clean_seg = f"♪ {clean_seg}"
            if not clean_seg.endswith("♪") and not clean_seg.endswith("♫"):
                clean_seg = f"{clean_seg} ♪"

        result_cues.append({
            "start": round(current_start, 2),
            "end": round(seg_end, 2),
            "arabic": clean_seg,
            "hindi": h_seg,
            "type": cue_type
        })
        current_start = seg_end

    return result_cues


# ==========================================
# دالة استخراج وإصلاح JSON المضاد للأخطاء والانقطاع
# ==========================================
def safe_parse_cues_json(raw_text: str) -> list:
    """
    استخراج وإصلاح بيانات JSON بمرونة فائقة:
    - إزالة كتل الماركداون والشوائب النصية.
    - إصلاح الانقطاع المفاجئ عند انتهاء التوكنات للمقاطع الطويلة (Truncation Repair).
    - تنظيف الفواصل الزائدة قبل الأقواس.
    - استخراج تدريجي مرن لكل سطر حوار حتى لو احتوى على علامات تنصيص داخلية غير مهربة أو فواصل مفقودة.
    """
    if not raw_text or not raw_text.strip():
        return []

    text = raw_text.strip()

    # 1. تنظيف كتل الماركداون
    if "```" in text:
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE).strip()

    # محاولة التحليل المباشر السليم
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            for k in ["cues", "subtitles", "translations", "data", "segments"]:
                if k in data and isinstance(data[k], list):
                    return data[k]
            return [data]
    except Exception:
        pass

    # 2. إزالة الفواصل المتأخرة الزائدة قبل [ أو {
    clean_text = re.sub(r",\s*([\]\}])", r"\1", text)
    try:
        data = json.loads(clean_text)
        if isinstance(data, list):
            return data
    except Exception:
        pass

    # 3. معالجة الانقطاع في نهاية التوليد (Truncation Fix):
    # عند وصول التوليد لحد التوكنات، ينقطع النص فجأة.
    # نحدد آخر كائن مكتمل { ... } ونغلق المصفوفة ]
    last_brace_idx = text.rfind("}")
    if last_brace_idx != -1:
        truncated_attempt = text[:last_brace_idx + 1].strip()
        first_bracket_idx = truncated_attempt.find("[")
        if first_bracket_idx != -1:
            truncated_attempt = truncated_attempt[first_bracket_idx:]
        else:
            truncated_attempt = "[" + truncated_attempt
        if not truncated_attempt.endswith("]"):
            truncated_attempt += "\n]"
        truncated_attempt = re.sub(r",\s*\]", "]", truncated_attempt)
        try:
            data = json.loads(truncated_attempt)
            if isinstance(data, list) and len(data) > 0:
                return data
        except Exception:
            pass

    # 4. الاستخراج التدريجي لكافة كائنات الحوارات حتى لو احتوت على علامات تنصيص غير مهربة
    cues = []
    # البحث عن كل كائن {...} يحتوي على timecodeStart
    obj_pattern = re.compile(r"\{[^{}]*\"timecodeStart\"[^{}]*\}", re.DOTALL)
    for m in obj_pattern.finditer(text):
        obj_str = m.group(0)
        try:
            obj = json.loads(obj_str)
            if "timecodeStart" in obj:
                cues.append(obj)
                continue
        except Exception:
            pass

        # استخراج يدوي للمفاتيح عند وجود أخطاء صياغة أو تنصيص داخلي
        tc_start = re.search(r"\"timecodeStart\"\s*:\s*\"([^\"]+)\"", obj_str)
        tc_end = re.search(r"\"timecodeEnd\"\s*:\s*\"([^\"]+)\"", obj_str)
        ar = re.search(r"\"arabicTranslation\"\s*:\s*\"(.*?)\"(?=\s*,\s*\"(?:type|speaker)\"|\s*\})", obj_str, re.DOTALL)
        hi = re.search(r"\"originalHindi\"\s*:\s*\"(.*?)\"(?=\s*,\s*\"arabicTranslation\")", obj_str, re.DOTALL)
        ctype = re.search(r"\"type\"\s*:\s*\"([^\"]+)\"", obj_str)
        if tc_start and tc_end:
            cues.append({
                "timecodeStart": tc_start.group(1),
                "timecodeEnd": tc_end.group(1),
                "arabicTranslation": ar.group(1) if ar else "",
                "originalHindi": hi.group(1) if hi else "",
                "type": ctype.group(1) if ctype else "dialogue"
            })

    if cues:
        return cues

    raise ValueError("تعذر استخراج بيانات حوارات صالحة من استجابة النموذج.")


# ==========================================
# دالة ترجمة وتحليل الكلام الهندي عبر Gemini
# ==========================================
def translate_bollywood_media(
    media_path: str,
    api_key: str,
    model_name: str = "gemini-3.8-flash",
    dialect: str = "msa",
    preserve_hinglish: bool = False,
    translate_songs: bool = True,
    min_duration: float = 1.0,
    max_duration: float = 5.0,
    ignore_sound_effects: bool = True
) -> list:
    """
    الاتصال بمكتبة google-genai الحديثة وترجمة المحتوى بدقة سينمائية
    مع دعم التبديل التلقائي الذكي للنماذج (Fallback) في حال كان النموذج متوقفاً
    واستبعاد المؤثرات الصوتية للتركيز الحصري على كلام الممثلين والأغاني.
    """
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError("مكتبة google-genai غير مثبتة. يرجى تشغيل: pip install google-genai")

    if not api_key:
        raise ValueError("يرجى إدخال مفتاح Google AI Studio Gemini API للمتابعة.")

    client = genai.Client(api_key=api_key)

    dialect_descriptions = {
        "msa": "اللغة العربية الفصحى المعاصرة السليمة (Modern Standard Arabic) بدقة سينمائية راقية. يمنع منعاً باتاً استخدام أي لهجة عامية (مثل المصرية أو غيرها). ترجم الأفعال والأسئلة بفصحى نقية (مثال: 'ماذا حدث؟'، 'يوجد شخص يتبعني' بدلاً من 'إيه اللي حصل' أو 'ماشي ورايا').",
        "egyptian": "اللهجة المصرية السينمائية السلسة الشائعة في دبلجة الأفلام والمسلسلات",
        "levantine": "اللهجة الشامية (السورية واللبنانية السينمائية)",
        "gulf": "اللهجة الخليجية المعاصرة",
        "iraqi": "اللهجة العراقية الفنية المعبرة"
    }
    target_dialect_desc = dialect_descriptions.get(dialect, dialect_descriptions["msa"])

    # قواعد استبعاد المؤثرات الصوتية والتقاط الكلام السريع
    sound_rule = ""
    if ignore_sound_effects:
        sound_rule = """
- حظر قاطع للمؤثرات الصوتية والبيئية (No Sound Effects / No SDH / Dialogue & Lyrics ONLY):
  * يمنع منعاً باتاً ترجمة أو كتابة أو وصف أي مؤثر صوتي، أو أصوات بيئية ومحيطة، أو أصوات فولي (Foley) مثل:
    (صوت دق أو طرق الباب، صوت فتح أو إغلاق الباب، خطوات أقدام، صوت بكاء، صوت ضحك، صوت تنفس أو تنهد، رنين هاتف أو جرس، أصوات محركات أو سيارات، أصوات إطلاق رصاص أو انفجار، صراخ بلا كلام، تصفيق، صرير، إلخ).
  * لا تضع أي أوصاف بين أقواس إطلاقاً مثل [صوت باب] أو (طرق على الباب) أو (صوت فتح الباب).
  * إذا كان المشهد يحتوي فقط على موسيقى تصويرية، أو صمت، أو مؤثرات صوتية محيطة دون وجود ممثلين يتكلمون أو يغنون: لا تقم أبداً بإنشاء أي سطر ترجمة (تجاوز تلك الثواني وتجاهلها تماماً).
  * الترجمة مخصصة حصراً للكلام البشري الصادر من أفواه الممثلين (Human Speech/Dialogue) وكلمات الأغاني فقط.
"""

    fast_speech_rule = """
- تغطية الخط الزمني بالكامل والتقاط كافة الحوارات من أول ثانية إلى آخر ثانية (Full Timeline Coverage):
  * ترجم المقطع بشكل شامل وكامل، بداية من الثانية 00:00.00 وحتى نهاية آخر ثانية في المقطع دون أي قفز أو اختصار أو تجزئة.
  * لا تختصر الحوارات؛ يجب استخراج وترجمة كل جملة وكل محادثة تدور بين الممثلين عبر كامل مدة الفيديو من البداية للوسط للنهاية.
- التقاط الحوارات السريعة والمتداخلة والمقتضبة (Fast & Rapid Hindi Speech):
  * المتحدثون بالهندية قد يتحدثون بسرعة عالية جداً، أو يتداخل كلامهم معاً، أو ينطقون عبارات خاطفة ومقتضبة جداً أو همساً (مثل: "لا يهم"، "حسناً"، "توقف"، "اسمعني"، "ماذا حدث؟").
  * دقق سمعياً وبصرياً في حركة شفاه الممثلين في الفيديو والصوت، والتقط كل جملة أو كلمة حوار حتى لو كانت قصيرة أو سريعة جداً دون تفويت أي كلام بشري.
"""

    sub_segmentation_rule = """
- تجزئة الجمل والمونولوجات الطويلة لراحة المشاهد (Subtitle Segmentation & Max Duration):
  * قاعدة الحد الأقصى للمدة: يمنع منعاً باتاً دمج كلام يستمر لأكثر من 5 ثوانٍ في سطر ترجمة واحد!
  * إذا واصل الممثل الكلام لأكثر من 5 ثوانٍ أو ألقى خطاباً/مونولوجاً متواصلاً (مثل 10 أو 18 ثانية):
    قسّم كلامه حتماً إلى عدة بطاقات/أسطر متتالية قصيرة ومريحة لعين المشاهد (كل سطر مدته بين 2.0 إلى 4.5 ثوانٍ، وبحد أقصى 10 إلى 12 كلمة لكل ظهور).
  * قسّم الكلام دائماً عند الفواصل الطبيعية ونهايات الجمل (نقطة، فاصلة، أداة ربط، وقفة تنفس).
  * لا تجعل المشاهد يقرأ فقرة جريدة كاملة في سطر واحد؛ التزم بمعايير منصات البث العالمية (Netflix / Shahid).
"""

    # التعليمات التوجيهية للذكاء الاصطناعي
    system_instruction = f"""
أنت المترجم السينمائي الأول المتخصص في ترجمة الأفلام والمسلسلات الهندية إلى اللغة العربية:
- الهدف الأساسي: استمع بتركيز فائق وحوّل كل الحوارات حصراً إلى: {target_dialect_desc}.
- في حال اختيار الفصحى: التزم تماماً بالقواعد النحوية والتراكيب الفصيحة الأنيقة المتداولة في ترجمة الأفلام العالمية (مثل منصات Netflix و Shahid). لا تستخدم أي تعبيرات عامية إطلاقاً.
- ابدأ من بداية المقطع (00:00.00) وحتى نهايته تماماً دون تفويت أي جملة أو كلمة أو مشهد كلامي.
{sound_rule}
{fast_speech_rule}
{sub_segmentation_rule}
- الـ Hinglish وشارع مومباي: صغ المعنى بدقة بأسلوب فصيح مفهوم ({'مفعل: احتفظ بنبرة الحوار' if preserve_hinglish else 'ترجم المعنى إلى الفصحى المباشرة'}).
- أغاني الخلفية والراب الهندي: ({'مفعل: ضع علامة النوتة الموسيقية ♪ في بداية ونهاية كل بيت شعري أو مقطع غنائي أو راب هندي' if translate_songs else 'ترجم الحوارات فقط'}).

قاعدة التوقيت الحتمية الصارمة (منع خطأ الـ 100 ثانية):
- أخرج التوقيت حصراً بصيغة نصية (MM:SS.ms) مثل "00:01.50" أو "01:25.80".
- الدقيقة تساوي 60 ثانية تماماً وليس 100 ثانية.
- قواعد سلامة بناء مصفوفة JSON الصارمة (منع أخطاء التنصيص والانقطاع):
  * لا تضع علامات اقتباس مزدوجة داخل النصوص إطلاقاً (استخدم علامات مفردة '...' أو أقواس «...» للاقتباس داخل الحوار)، لضمان صحة ملف JSON.
  * لا تترك فواصل متأخرة زائدة قبل إغلاق المصفوفة أو الكائن.
- أخرج الناتج حصراً بمصفوفة JSON صالحة ومطابقة للشكل التالي:
[
  {{
    "timecodeStart": "00:00.50",
    "timecodeEnd": "00:03.20",
    "originalHindi": "الحوار بالهندية أو Hinglish الأصلي فقط (كلام الممثلين)",
    "arabicTranslation": "الترجمة العربية (محاطة بـ ♪ إذا كانت أغنية أو راب)",
    "type": "dialogue" // "dialogue" أو "hinglish" أو "song" أو "rap"
  }}
]
"""

    prompt = (
        "حلل وترجم هذا المقطع بالكامل من بدايته (00:00.00) وحتى نهايته بدقة واحترافية سينمائية كاملة إلى العربية. "
        "ترجم كل سطر وكل حوار ينطقه الممثلون أو الأغاني عبر كامل مدة الفيديو دون إهمال أي دقيقة أو ثانية. "
        "مهم جداً: قسّم الحوارات والمونولوجات الطويلة إلى أسطر قصيرة ومريحة لعين المشاهد (كل سطر لا يتجاوز 4 إلى 5 ثوانٍ)، "
        "مع استبعاد كافة المؤثرات الصوتية والبيئية تماماً، وتجنب علامات الاقتباس المزدوجة داخل النصوص، واستخراج التوقيتات بصيغة MM:SS.ms في مصفوفة JSON."
    )

    import time

    # رفع الملف إلى Gemini Files API
    with st.spinner("⏳ جاري رفع ملف الوسائط إلى Google Gemini API..."):
        uploaded_gemini_file = client.files.upload(file=media_path)

    # انتظار معالجة الملف في خوادم Google والتأكد من حالته ACTIVE
    with st.spinner("⏳ جاري معالجة وتجهيز ملف الوسائط في خوادم Google Gemini..."):
        poll_start = time.time()
        file_ref = uploaded_gemini_file
        while hasattr(file_ref, "state") and getattr(file_ref.state, "name", None) == "PROCESSING":
            if time.time() - poll_start > 120:  # حد أقصى دقيقتين
                break
            time.sleep(2)
            try:
                file_ref = client.files.get(name=uploaded_gemini_file.name)
            except Exception:
                break
        
        if hasattr(file_ref, "state") and getattr(file_ref.state, "name", None) == "FAILED":
            raise RuntimeError(f"فشلت معالجة ملف الفيديو في Google Gemini: {getattr(file_ref, 'error', 'Unknown error')}")
        
        uploaded_gemini_file = file_ref

    # قائمة النماذج المرشحة مع تبديل تلقائي فوري (Auto-Cascade Pipeline)
    # مرتبة بدقة حسب الترتيب الصارم المطلوب من المستخدم لحماية فائقة من ضغط الخوادم والحصص:
    available_pool = [
        "gemini-3.8-flash",        # 1. أولاً: النموذج الأقوى والأحدث والأعلى دقة وشمولية
        "gemini-flash-latest",     # 2. ثانياً: أحدث إصدار رسمي من Flash
        "gemini-2.5-pro",          # 3. ثالثاً: احترافي عميق فائق الذكاء والتفاصيل
        "gemini-3.1-pro",          # 4. رابعاً: نموذج احترافي متقدم للملفات الصعبة
        "gemini-3.5-pro",          # 5. خامساً: العملاق للاستيعاب الشامل
        "gemini-3.1-flash-lite",   # 6. سادساً: فائق السرعة وخفيف كخيار بديل
        "gemini-3.5-flash",        # 7. سابعاً: متوازن وسريع
    ]

    # استخراج النموذج الأولي المختار وترتيب القائمة
    selected_clean = "gemini-3.8-flash"
    for opt in available_pool:
        if opt in str(model_name):
            selected_clean = opt
            break

    if "auto" in str(model_name).lower() or "ذكي" in str(model_name):
        models_to_try = available_pool
    else:
        # إذا اختار المستخدم نموذجاً معيناً، نبدأ به ثم بقية النماذج بالترتيب الصارم
        models_to_try = [selected_clean] + [m for m in available_pool if m != selected_clean]

    response = None
    last_err = None
    successful_model = None

    status_placeholder = st.empty()

    for idx, candidate_model in enumerate(models_to_try):
        try:
            status_placeholder.info(f"⚡ جاري تحليل وترجمة الصوت سينمائياً عبر النموذج ({idx + 1}/{len(models_to_try)}): **{candidate_model}**...")
            response = client.models.generate_content(
                model=candidate_model,
                contents=[uploaded_gemini_file, prompt],
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.1,  # درجة منخفضة جداً لمنع الهلوسة والوصف العشوائي للأصوات
                )
            )
            successful_model = candidate_model
            status_placeholder.success(f"🎉 تم الاتصال بنجاح وتوليد الترجمة عبر النموذج: **{candidate_model}**")
            break
        except Exception as e:
            last_err = e
            err_str = str(e)
            
            # إذا بقي نموذج آخر في القائمة، يتم التبديل التلقائي بسلاسة بدون إحباط المستخدم
            if idx < len(models_to_try) - 1:
                next_model = models_to_try[idx + 1]
                status_placeholder.warning(
                    f"⚠️ النموذج `{candidate_model}` واجه ضغطاً أو توقفاً مؤقتاً في خوادم Google ({err_str[:60]}...). "
                    f"جاري التحويل التلقائي فوراً إلى النموذج التالي `{next_model}` وفق الترتيب المعتمد..."
                )
                time.sleep(1.0)
                continue
            else:
                status_placeholder.error(f"❌ تعذرت الاستجابة بعد تجربة جميع النماذج ({', '.join(models_to_try)}).")
                raise e

    if response is None:
        raise last_err or RuntimeError("فشل توليد الاستجابة من جميع نماذج Gemini المتاحة.")

    raw_text = response.text or ""

    # استخراج وقراءة الـ JSON مع الإصلاح التلقائي المقاوم للانقطاع وعلامات التنصيص
    raw_cues = safe_parse_cues_json(raw_text)

    # المعالجة الزمنية الحتمية وضبط الفواصل
    processed = []
    for item in raw_cues:
        start = parse_timecode_to_seconds(item.get("timecodeStart", "00:00.00"))
        end = parse_timecode_to_seconds(item.get("timecodeEnd", "00:00.00"))

        if end <= start or (end - start) < min_duration:
            end = start + min_duration

        arabic = (item.get("arabicTranslation") or "").strip()
        hindi = (item.get("originalHindi") or "").strip()
        cue_type = item.get("type", "dialogue")

        # تصفية المؤثرات الصوتية والبيئية إذا كان الخيار مفعلاً
        if ignore_sound_effects:
            is_fx, cleaned_ar = is_sound_effect_or_ambient(arabic, hindi)
            if is_fx:
                # استبعاد تام للسطر لأنه مجرد وصف صوتي (مثل: صوت دق باب)
                continue
            arabic = cleaned_ar

        if translate_songs and cue_type in ("song", "rap") and arabic:
            if not arabic.startswith("♪") and not arabic.startswith("♫"):
                arabic = f"♪ {arabic}"
            if not arabic.endswith("♪") and not arabic.endswith("♫"):
                arabic = f"{arabic} ♪"

        if arabic or hindi:
            base_cue = {
                "start": start,
                "end": end,
                "arabic": arabic,
                "hindi": hindi,
                "type": cue_type
            }
            # تقطيع وتجزئة الأسطر الطويلة تلقائياً لراحة المشاهد
            split_cues = split_long_cue(base_cue, max_duration=max_duration, max_words=12)
            processed.extend(split_cues)

    processed.sort(key=lambda x: x["start"])

    # منع التداخل وفرض الحد الأدنى للعرض
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


def generate_srt_content(cues: list) -> str:
    lines = []
    for i, cue in enumerate(cues, start=1):
        s = seconds_to_srt_time(cue["start"])
        e = seconds_to_srt_time(cue["end"])
        lines.append(f"{i}\n{s} --> {e}\n{cue['arabic']}\n")
    return "\n".join(lines)

def generate_vtt_content(cues: list) -> str:
    lines = ["WEBVTT", ""]
    for i, cue in enumerate(cues, start=1):
        s = seconds_to_vtt_time(cue["start"])
        e = seconds_to_vtt_time(cue["end"])
        lines.append(f"{i}\n{s} --> {e}\n{cue['arabic']}\n")
    return "\n".join(lines)

def generate_ass_content(cues: list, title: str = "BollywoodSub AI") -> str:
    header = f"""[Script Info]
; Script generated by BollywoodSub AI Streamlit
Title: {title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: BollywoodGold,Cairo,52,&H0000D7FF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3.5,2.0,2,40,40,45,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for cue in cues:
        s = seconds_to_ass_time(cue["start"])
        e = seconds_to_ass_time(cue["end"])
        text = cue["arabic"].replace("\n", "\\N")
        events.append(f"Dialogue: 0,{s},{e},BollywoodGold,,0,0,0,,{text}")
    return header + "\n".join(events)


# ==========================================
# الواجهة الجانبية (Sidebar) مع خانة المفتاح
# ==========================================
st.sidebar.markdown("""
<div style="text-align: center; padding: 10px 0;">
    <h2 style="margin: 0; color: #F59E0B;">🎬 BollywoodSub AI</h2>
    <p style="margin: 2px 0; font-size: 0.85rem; color: #94A3B8;">نسخة Streamlit الاحترافية</p>
</div>
""", unsafe_allow_html=True)

st.sidebar.markdown("---")
st.sidebar.subheader("🔑 إعدادات مفتاح الذكاء الاصطناعي")

# قراءة المفتاح من البيئة إن وجد كافتراضي
env_key = os.environ.get("GEMINI_API_KEY", "")
try:
    if not env_key and hasattr(st, "secrets") and "GEMINI_API_KEY" in st.secrets:
        env_key = st.secrets["GEMINI_API_KEY"]
except Exception:
    pass

api_key_input = st.sidebar.text_input(
    "مفتاح Google AI Studio Gemini API:",
    value=env_key,
    type="password",
    placeholder="AIzaSy...",
    help="أدخل مفتاحك الخاص لتشغيل الترجمة مباشرة بدون أي حدود لسعة السيرفر أو انقطاع."
)

if api_key_input:
    st.sidebar.success("✅ مفتاح API تم إدخاله وجاهز للاستخدام")
else:
    st.sidebar.warning("⚠️ أدخل مفتاحك لتبدأ الترجمة فوراً")

st.sidebar.markdown("""
<div style="font-size: 0.8rem; background: #0F172A; padding: 8px 12px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 12px;">
    💡 <b>كيف تحصل على مفتاح مجاني؟</b><br>
    تفضل بزيارة <a href="https://aistudio.google.com/apikey" target="_blank" style="color: #38BDF8; font-weight: bold;">Google AI Studio</a> وأنشئ مفتاح API مجاناً في دقيقة واحدة.
</div>
""", unsafe_allow_html=True)

st.sidebar.markdown("---")
st.sidebar.subheader("⚙️ إعدادات الترجمة والنموذج")

model_choice = st.sidebar.selectbox(
    "نموذج Gemini ونظام التشغيل:",
    options=[
        "⚡ التبديل التلقائي الذكي (Auto-Cascade - يبدأ بـ Gemini 3.8 Flash)",
        "gemini-3.8-flash (1. الأسرع والأعلى دقة واحترافية)",
        "gemini-flash-latest (2. أحدث إصدار رسمي)",
        "gemini-2.5-pro (3. احترافي عميق فائق الذكاء والتفاصيل)",
        "gemini-3.1-pro (4. نموذج متطور للحوارات السريعة والمعقدة)",
        "gemini-3.5-pro (5. العملاق للاستيعاب الشامل)",
        "gemini-3.1-flash-lite (6. فائق السرعة وخفيف كبديل)",
        "gemini-3.5-flash (7. متوازن وسريع)",
    ],
    index=0,
    help="التبديل التلقائي الذكي يبدأ بنموذج Gemini 3.8 Flash الشامل، وينتقل تلقائياً وبأجزاء من الثانية إلى النماذج التالية وفق الترتيب الصارم للحماية من أي ضغط أو انقطاع في خوادم Google."
)

dialect_choice = st.sidebar.selectbox(
    "لغة وترجمة الحوارات المستهدفة:",
    options=[
        ("msa", "اللغة العربية الفصحى المعاصرة (الافتراضية المعتمدة)"),
        ("egyptian", "اللهجة المصرية السينمائية"),
        ("levantine", "الشامية (سورية ولبنانية)"),
        ("gulf", "الخليجية المعاصرة"),
        ("iraqi", "العراقية الفنية"),
    ],
    format_func=lambda x: x[1],
    index=0
)[0]

preserve_hinglish = st.sidebar.checkbox(
    "نقل مصطلحات الشارع و Hinglish إلى الفصحى بسلاسة",
    value=False,
    help="عند التعطيل يتم الالتزام التام بالفصحى الفصيحة وتفادي أي كلمات دارجة."
)

translate_songs = st.sidebar.checkbox(
    "ترجمة أغاني وراب الخلفية مع نوتة شعرية ♪",
    value=True,
    help="تمييز الأغاني ومقاطع الراب بعلامات موسيقية وصياغتها بإيقاع شعري جذاب."
)

ignore_sound_effects = st.sidebar.checkbox(
    "استبعاد المؤثرات الصوتية والبيئية (كلام الممثلين والأغاني فقط)",
    value=True,
    help="يمنع تماماً ظهور نصوص وصفية مثل 'صوت دق الباب' أو 'خطوات أقدام' أو 'بكاء' ويركز 100% على كلام الممثلين المنطوق وأغاني الفيلم."
)

min_duration = st.sidebar.slider(
    "الحد الأدنى لظهور الجملة (ثواني):",
    min_value=0.5,
    max_value=3.0,
    value=1.0,
    step=0.1
)

max_duration = st.sidebar.slider(
    "الحد الأقصى لظهور السطر (لمنع النصوص الطويلة):",
    min_value=3.0,
    max_value=8.0,
    value=5.0,
    step=0.5,
    help="يقوم بتقطيع المونولوجات الطويلة تلقائياً إلى أسطر سينمائية مريحة للعين (معيار Netflix هو 4-5 ثوانٍ كحد أقصى لكل سطر)."
)

ffmpeg_available = check_ffmpeg_installed()
if ffmpeg_available:
    st.sidebar.caption("🎬 FFmpeg: متوفر ونشط (دعم استخراج ومزامنة وحرق الترجمة)")
else:
    st.sidebar.caption("ℹ️ FFmpeg: غير متوفر (سيتم رفع الفيديو/الصوت مباشرة إلى Gemini API بدون عوائق)")


# ==========================================
# الصفحة الرئيسية (Main View)
# ==========================================
st.markdown("""
<div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 24px; border-radius: 16px; border: 1px solid #334155; margin-bottom: 24px;">
    <span class="bollywood-badge">⚡ BollywoodSub AI & Streamlit</span>
    <h1 style="margin: 4px 0 8px 0; color: #F8FAFC;">ترجمة الأفلام والمسلسلات الهندية إلى العربية</h1>
    <p style="margin: 0; color: #94A3B8; font-size: 1rem;">
        محرك ترجمة سينمائي متقدم مبني على Google Gemini مع معادلة مزامنة حتمية (Base-60) لمنع تراكم أخطاء التوقيت ودعم كامل لملفات الفيديو والأفلام الكبيرة.
    </p>
</div>
""", unsafe_allow_html=True)

# منطقة رفع الملفات
st.subheader("📁 اختيار ملف الفيديو أو الصوت")
uploaded_file = st.file_uploader(
    "اختر ملف فيديو (MP4, MKV, MOV, WebM) أو صوت (MP3, WAV, M4A) من جهازك:",
    type=["mp4", "mkv", "mov", "avi", "webm", "mp3", "wav", "m4a", "aac", "ogg"],
    help="في Streamlit يمكنك رفع ملفات بأي حجم تريده دون قيود المتصفحات."
)

st.caption("💡 **نصيحة لمستخدمي الهواتف:** لتفادي انقطاع الاتصال (CONNECTING)، يفضل اختيار الملف سريعاً أو استخدام متصفح Chrome بدون تجميد التبويبات.")

# تهيئة الجلسة لحفظ نتائج الترجمة والملف
if "cues" not in st.session_state:
    st.session_state.cues = []
if "processed_filename" not in st.session_state:
    st.session_state.processed_filename = ""
if "cached_file_bytes" not in st.session_state:
    st.session_state.cached_file_bytes = None
if "cached_file_name" not in st.session_state:
    st.session_state.cached_file_name = ""

# عند اختيار ملف، يتم حفظه وعرض معاينة مرئية فورية
if uploaded_file is not None:
    st.session_state.cached_file_bytes = uploaded_file.getvalue()
    st.session_state.cached_file_name = uploaded_file.name

# عينة بوليوود تجريبية إن لم يرفع ملفاً
use_demo = False
has_media = (uploaded_file is not None) or (st.session_state.cached_file_bytes is not None)

if not has_media:
    col_demo1, col_demo2 = st.columns([1, 3])
    with col_demo1:
        if st.button("✨ تجربة عينة بوليوود تجريبية فورية"):
            use_demo = True

# معاينة الفيديو أو الصوت وزر بدء الترجمة
if has_media or use_demo:
    target_name = (uploaded_file.name if uploaded_file else st.session_state.cached_file_name) if has_media else "Gully_Boy_Bollywood_Demo.mp4"
    file_size_mb = round(len(st.session_state.cached_file_bytes) / (1024 * 1024), 2) if st.session_state.cached_file_bytes else 0
    size_label = f" ({file_size_mb} MB)" if file_size_mb > 0 else ""
    
    st.success(f"🎬 تم تحميل الملف بنجاح: **{target_name}**{size_label}")

    # معاينة الفيديو أو الصوت مباشرة في المتصفح
    if has_media and st.session_state.cached_file_bytes:
        ext = Path(target_name).suffix.lower()
        if ext in [".mp4", ".mov", ".mkv", ".webm", ".avi"]:
            st.video(st.session_state.cached_file_bytes)
        elif ext in [".mp3", ".wav", ".m4a", ".aac", ".ogg"]:
            st.audio(st.session_state.cached_file_bytes)

    # اختيار لغة الترجمة المستهدفة مباشرة من الصفحة الرئيسية
    active_dialect = st.radio(
        "🌐 لغة الترجمة المطلوبة للفيلم:",
        options=["msa", "iraqi", "egyptian", "gulf", "levantine"],
        format_func=lambda x: {
            "msa": "✨ اللغة العربية الفصحى (Modern Standard Arabic)",
            "iraqi": "🇮🇶 اللهجة العراقية الفنية",
            "egyptian": "🇪🇬 اللهجة المصرية",
            "gulf": "🇸🇦 اللهجة الخليجية",
            "levantine": "🇸🇾 اللهجة الشامية"
        }.get(x, x),
        index=0,
        horizontal=True,
        help="الافتراضي هو اللغة العربية الفصحى السليمة المعتمدة في كبرى شبكات البث مثل Netflix و Shahid."
    )

    start_btn = st.button("🚀 بدء الترجمة السينمائية والمزامنة", type="primary", use_container_width=True)

    if start_btn:
        if not api_key_input and not use_demo:
            st.error("❌ يرجى إدخال مفتاح Google AI Studio Gemini API في القائمة الجانبية للمتابعة.")
        else:
            try:
                if use_demo:
                    # عينة توضيحية جاهزة
                    st.session_state.cues = [
                        {
                            "start": 0.0,
                            "end": 2.8,
                            "arabic": "♪ وقتنا آتٍ لا محالة! جئت عارياً فماذا تظن أنك ستأخذ معك؟! ♪",
                            "hindi": "Apna Time Aayega! Tu nanga hi to aaya hai kya ghanta leke jaayega!",
                            "type": "rap"
                        },
                        {
                            "start": 2.85,
                            "end": 5.6,
                            "arabic": "اسمع يا صاحبي، الموقف هنا في غاية الخطورة، لا تجازف أبداً.",
                            "hindi": "Listen bro, scene bohot hard hai yahan pe, koi chance mat lena.",
                            "type": "hinglish"
                        },
                        {
                            "start": 5.65,
                            "end": 9.2,
                            "arabic": "إذا أردت أن تكون شيئاً يُذكر في هذه الحياة، فتعلم أن تدوس خوفك تحت حذائك!",
                            "hindi": "Zindagi mein agar kuch banna hai, to darr ko apne joote ke neeche rakhna seekh!",
                            "type": "dialogue"
                        },
                        {
                            "start": 9.25,
                            "end": 14.5,
                            "arabic": "♪ أضحى العيش بدونك عذاباً أليماً، وفنيت روحي في غرامك الأبدي... ♪",
                            "hindi": "Tere bina jeena saza ho gaya, yeh ishq mera fanaa ho gaya...",
                            "type": "song"
                        }
                    ]
                    st.session_state.processed_filename = target_name
                    st.success("✅ تم تحميل العينة التجريبية بنجاح!")
                else:
                    # حفظ الملف المرفوع في مجلد مؤقت بأمان
                    effective_name = uploaded_file.name if uploaded_file else st.session_state.cached_file_name
                    suffix = Path(effective_name).suffix or ".mp4"
                    file_bytes = st.session_state.cached_file_bytes if st.session_state.cached_file_bytes else uploaded_file.getvalue()
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                        tmp_file.write(file_bytes)
                        tmp_media_path = tmp_file.name

                    media_to_translate = tmp_media_path

                    # إن كان فيديو و FFmpeg متوفر، نستخرج مسار الصوت لمزامنة صفرية وسرعة فائقة
                    if ffmpeg_available and suffix.lower() in [".mp4", ".mkv", ".mov", ".avi", ".webm"]:
                        audio_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3").name
                        with st.spinner("🎵 جاري استخراج مسار الصوت بنقاء 44.1kHz ومزامنة صفرية (-avoid_negative_ts make_zero)..."):
                            if extract_audio_zero_sync(tmp_media_path, audio_tmp):
                                media_to_translate = audio_tmp

                    # تنفيذ الترجمة
                    selected_dialect = active_dialect if 'active_dialect' in locals() else dialect_choice
                    cues = translate_bollywood_media(
                        media_path=media_to_translate,
                        api_key=api_key_input,
                        model_name=model_choice,
                        dialect=selected_dialect,
                        preserve_hinglish=preserve_hinglish,
                        translate_songs=translate_songs,
                        min_duration=min_duration,
                        max_duration=max_duration,
                        ignore_sound_effects=ignore_sound_effects
                    )

                    st.session_state.cues = cues
                    st.session_state.processed_filename = effective_name
                    st.success(f"🎉 تمت الترجمة بنجاح! تم استخراج {len(cues)} سطر ترجمة سينمائية متزامنة.")

            except Exception as ex:
                st.error(f"❌ حدث خطأ أثناء المعالجة: {ex}")

# ==========================================
# استعراض النتائج والتنزيل
# ==========================================
if st.session_state.cues:
    st.markdown("---")
    st.subheader(f"🎬 أسطر الترجمة السينمائية ({len(st.session_state.cues)} جملة)")

    # أزرار تحميل ملفات الترجمة
    srt_text = generate_srt_content(st.session_state.cues)
    vtt_text = generate_vtt_content(st.session_state.cues)
    ass_text = generate_ass_content(st.session_state.cues, title=st.session_state.processed_filename or "BollywoodSub")
    json_text = json.dumps(st.session_state.cues, ensure_ascii=False, indent=2)

    base_name = Path(st.session_state.processed_filename or "bollywood_subtitles").stem

    col_d1, col_d2, col_d3, col_d4 = st.columns(4)
    with col_d1:
        st.download_button(
            label="📥 تحميل ملف SRT القياسي",
            data=srt_text,
            file_name=f"{base_name}.srt",
            mime="text/plain",
            use_container_width=True
        )
    with col_d2:
        st.download_button(
            label="🌐 تحميل ملف WebVTT",
            data=vtt_text,
            file_name=f"{base_name}.vtt",
            mime="text/vtt",
            use_container_width=True
        )
    with col_d3:
        st.download_button(
            label="🎨 تحميل ملف ASS الذهبي",
            data=ass_text,
            file_name=f"{base_name}.ass",
            mime="text/plain",
            use_container_width=True
        )
    with col_d4:
        st.download_button(
            label="📄 تصدير JSON الخام",
            data=json_text,
            file_name=f"{base_name}.json",
            mime="application/json",
            use_container_width=True
        )

    # عرض الجمل في بطاقات تفاعلية
    tab_cards, tab_table, tab_raw_srt = st.tabs(["📋 بطاقات الحوارات", "📊 جدول منظم", "📝 نص SRT مباشر"])

    with tab_cards:
        for idx, cue in enumerate(st.session_state.cues, start=1):
            start_str = seconds_to_srt_time(cue["start"])
            end_str = seconds_to_srt_time(cue["end"])
            duration_str = f"{(cue['end'] - cue['start']):.2f} ث"

            type_badge = "🎬 حوار"
            if cue.get("type") == "song":
                type_badge = "🎵 أغنية"
            elif cue.get("type") == "rap":
                type_badge = "⚡ راب سريع"
            elif cue.get("type") == "hinglish":
                type_badge = "🇮🇳 Hinglish"

            with st.container():
                st.markdown(f"""
                <div class="cue-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: bold; color: #F59E0B;">#{idx} &nbsp; {type_badge}</span>
                        <span style="font-family: monospace; font-size: 0.85rem; color: #94A3B8; direction: ltr;">
                            {start_str} ➔ {end_str} ({duration_str})
                        </span>
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 700; color: #F8FAFC; margin-bottom: 4px;">
                        {cue['arabic']}
                    </div>
                    {f'<div style="font-size: 0.85rem; color: #64748B; direction: ltr; text-align: left;">{cue["hindi"]}</div>' if cue.get("hindi") else ''}
                </div>
                """, unsafe_allow_html=True)

    with tab_table:
        table_data = []
        for i, c in enumerate(st.session_state.cues, 1):
            table_data.append({
                "#": i,
                "البداية": seconds_to_srt_time(c["start"]),
                "النهاية": seconds_to_srt_time(c["end"]),
                "الترجمة العربية": c["arabic"],
                "النص الهندي الأصلي": c.get("hindi", ""),
                "النوع": c.get("type", "dialogue")
            })
        st.dataframe(table_data, use_container_width=True)

    with tab_raw_srt:
        st.text_area("نص SRT المكتمل:", value=srt_text, height=300)

st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #64748B; font-size: 0.85rem;">
    BollywoodSub AI • يعمل بدعم من Google Gemini و Streamlit • بدون قيود توقيت وبدقة Base-60 حتمية
</div>
""", unsafe_allow_html=True)
