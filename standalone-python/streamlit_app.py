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
# دالة ترجمة وتحليل الكلام الهندي عبر Gemini
# ==========================================
def translate_bollywood_media(
    media_path: str,
    api_key: str,
    model_name: str = "gemini-3.8-flash",
    dialect: str = "msa",
    preserve_hinglish: bool = False,
    translate_songs: bool = True,
    min_duration: float = 1.0
) -> list:
    """
    الاتصال بمكتبة google-genai الحديثة وترجمة المحتوى بدقة سينمائية
    مع دعم التبديل التلقائي الذكي للنماذج (Fallback) في حال كان النموذج متوقفاً
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

    # التعليمات التوجيهية للذكاء الاصطناعي
    system_instruction = f"""
أنت المترجم السينمائي الأول المتخصص في ترجمة الأفلام والمسلسلات الهندية إلى اللغة العربية الفصحى:
- الهدف الأساسي: استمع بتركيز فائق وحوّل كل الحوارات حصراً إلى: {target_dialect_desc}.
- في حال اختيار الفصحى: التزم تماماً بالقواعد النحوية والتراكيب الفصيحة الأنيقة المتداولة في ترجمة الأفلام العالمية (مثل منصات Netflix و Shahid). لا تستخدم أي تعبيرات عامية إطلاقاً.
- ابدأ من بداية المقطع (00:00.00) دون تفويت أي جملة أو كلمة.
- الـ Hinglish وشارع مومباي: صغ المعنى بدقة بأسلوب فصيح مفهوم ({'مفعل: احتفظ بنبرة الحوار' if preserve_hinglish else 'ترجم المعنى إلى الفصحى المباشرة'}).
- أغاني الخلفية والراب الهندي: ({'مفعل: ضع علامة النوتة الموسيقية ♪ في بداية ونهاية كل بيت شعري أو مقطع غنائي أو راب هندي' if translate_songs else 'ترجم الحوارات فقط'}).

قاعدة التوقيت الحتمية الصارمة (منع خطأ الـ 100 ثانية):
- أخرج التوقيت حصراً بصيغة نصية (MM:SS.ms) مثل "00:01.50" أو "01:25.80".
- الدقيقة تساوي 60 ثانية تماماً وليس 100 ثانية.
- أخرج الناتج حصراً بمصفوفة JSON صالحة ومطابقة للشكل التالي:
[
  {{
    "timecodeStart": "00:00.50",
    "timecodeEnd": "00:03.20",
    "originalHindi": "الحوار بالهندية أو Hinglish الأصلي",
    "arabicTranslation": "الترجمة العربية الفصحى (محاطة بـ ♪ إذا كانت أغنية أو راب)",
    "type": "dialogue" // "dialogue" أو "hinglish" أو "song" أو "rap"
  }}
]
"""

    prompt = "ترجم هذا المقطع بدقة واحترافية سينمائية كاملة إلى العربية، مع استخراج التوقيتات بصيغة MM:SS.ms في مصفوفة JSON."

    # رفع الملف إلى Gemini Files API
    with st.spinner("⏳ جاري رفع ملف الوسائط إلى Google Gemini API..."):
        uploaded_gemini_file = client.files.upload(file=media_path)

    # قائمة النماذج المرشحة مع تبديل تلقائي فوري (Auto-Cascade Pipeline)
    # إذا كان خادم Google يواجه ضغطاً (503) أو أي مشكلة، يتم التحويل للنموذج التالي فوراً
    available_pool = [
        "gemini-3.5-flash-lite",   # فائق السرعة وخفيف جداً، نادر التعرض للضغط
        "gemini-3.8-flash",        # النموذج الأساسي الأكثر دقة
        "gemini-flash-latest",     # الاسم المستعار المباشر لأحدث إصدار Flash
        "gemini-3.1-flash-lite",   # نموذج بديل إضافي
    ]

    # ترتيب أولويات النماذج بناءً على اختيار المستخدم
    selected_clean = model_name
    for opt in ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"]:
        if opt in str(model_name):
            selected_clean = opt
            break

    if "auto" in str(model_name).lower() or "ذكي" in str(model_name):
        models_to_try = available_pool
    else:
        models_to_try = [selected_clean] + [m for m in available_pool if m != selected_clean]

    response = None
    last_err = None
    successful_model = None

    import time
    status_placeholder = st.empty()

    for idx, candidate_model in enumerate(models_to_try):
        try:
            status_placeholder.info(f"⚡ جاري تحليل وترجمة الصوت سينمائياً عبر النموذج: **{candidate_model}**...")
            response = client.models.generate_content(
                model=candidate_model,
                contents=[uploaded_gemini_file, prompt],
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                )
            )
            successful_model = candidate_model
            status_placeholder.success(f"🎉 تم الاتصال بنجاح وتوليد الترجمة عبر النموذج: **{candidate_model}**")
            break
        except Exception as e:
            last_err = e
            err_str = str(e)
            
            # إذا بقي نموذج آخر في القائمة، يتم التبديل التلقائي بدون إحباط المستخدم
            if idx < len(models_to_try) - 1:
                next_model = models_to_try[idx + 1]
                status_placeholder.warning(
                    f"⚠️ النموذج `{candidate_model}` واجه ضغطاً أو توقفاً مؤقتاً في خوادم Google. "
                    f"جاري التحويل التلقائي فوراً إلى النموذج البديل `{next_model}`..."
                )
                time.sleep(1.0)
                continue
            else:
                status_placeholder.error(f"❌ تعذرت الاستجابة بعد تجربة جميع النماذج ({', '.join(models_to_try)}).")
                raise e

    if response is None:
        raise last_err or RuntimeError("فشل توليد الاستجابة من جميع نماذج Gemini المتاحة.")

    raw_text = response.text or ""

    # استخراج وقراءة الـ JSON
    try:
        raw_cues = json.loads(raw_text)
    except Exception:
        match = re.search(r'\[\s*\{.*\}\s*\]', raw_text, re.DOTALL)
        if match:
            raw_cues = json.loads(match.group(0))
        else:
            raise ValueError(f"تعذر استخراج بيانات JSON صالحة من استجابة النموذج:\n{raw_text[:300]}")

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

        if translate_songs and cue_type in ("song", "rap") and arabic:
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
        "⚡ التبديل التلقائي الذكي (Auto-Cascade - مضمون ضد الضغط)",
        "gemini-3.5-flash-lite (فائق السرعة والأقل ضغطاً)",
        "gemini-3.8-flash (الأعلى دقة وسينمائية)",
        "gemini-flash-latest (الأحدث رسمياً)",
        "gemini-3.1-flash-lite (خفيف واحتياطي)",
    ],
    index=0,
    help="التبديل التلقائي الذكي يقوم بالانتقال فوراً وبدون انقطاع بين النماذج إذا واجه أي خادم ضغطاً مؤقتاً."
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

min_duration = st.sidebar.slider(
    "الحد الأدنى لظهور الجملة (ثواني):",
    min_value=0.5,
    max_value=3.0,
    value=1.0,
    step=0.1
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
                        min_duration=min_duration
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
