# BollywoodSub AI - مشروع الترجمة المستقل (Python & Streamlit)

مشروع متكامل لترجمة الأفلام والمسلسلات الهندية (Bollywood & OTT) إلى العربية بدقة فائقة مع واجهة Streamlit وخانة مخصصة لمفتاح الذكاء الاصطناعي، ومزامنة Base-60 حتمية لمنع أخطاء التوقيت.

---

## 🌟 الطرق المتاحة للتشغيل

### الطريقة الأولى: واجهة الويب التفاعلية عبر Streamlit (موصى بها)
تطبيق ويب متكامل يتيح رفع الفيديوهات حتى 1GB+ مع خانة كلمة مرور لإدخال مفتاح Google AI Studio Gemini API الخاص بك:

```bash
# 1. تثبيت المتطلبات
pip install -r requirements.txt

# 2. تشغيل تطبيق Streamlit
streamlit run streamlit_app.py
```
ثم افتح متصفحك على: `http://localhost:8501` وأدخل مفتاحك في القائمة الجانبية.

---

### الطريقة الثانية: سطر الأوامر (CLI) للأفلام الضخمة ومعالجة الدُفعات
سكربت `gemini_subtitler.py` لمعالجة أوتوماتيكية سريعة:

```bash
# تعيين المفتاح في البيئة
export GEMINI_API_KEY="AIzaSy..."

# ترجمة وتوليد SRT و ASS
python gemini_subtitler.py --video "movie.mp4" --dialect egyptian

# ترجمة وحرق الترجمة فورياً داخل الفيديو (Hardcode Subtitles)
python gemini_subtitler.py --video "movie.mp4" --dialect egyptian --burn
```

---

## 🛠️ متطلبات التشغيل
1. بايثون 3.10 أو أحدث.
2. تثبيت المكتبات:
```bash
pip install -r requirements.txt
```
3. (اختياري لكن مفضل للحرق واستخراج الصوت): FFmpeg.

---

## 🔑 الحصول على مفتاح Google AI Studio مجاناً
- تفضل بزيارة: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- أنشئ مفتاح API جديد وضعه في خانة المفتاح في تطبيق Streamlit.
