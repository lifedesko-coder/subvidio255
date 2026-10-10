# 📱 دليل بناء تطبيق الأندرويد (APK) عبر GitHub Actions
### BollywoodSub AI - Android App Build Guide

تم إعداد هذا المشروع بالكامل ليدعم بناء ملف **APK** جاهز للتثبيت على هواتف وتلفزيونات أندرويد تلقائياً عبر **GitHub Actions** باستخدام إطار عمل **Capacitor Android**.

---

## 🚀 الطريقة السريعة: البناء التلقائي عبر GitHub (بدون تثبيت أي شيء في جهازك)

1. **ارفع الكود إلى مستودع GitHub خاص بك:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit for BollywoodSub AI Android"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO_NAME.git
   git push -u origin main
   ```

2. **سيبدأ البناء تلقائياً:**
   - توجه إلى تبويب **Actions** في مستودعك على GitHub.
   - ستلاحظ عملية تسمى **`Build Android APK (BollywoodSub AI)`** بدأت العمل تلقائياً.
   - يمكنك أيضاً تشغيل البناء يدوياً في أي وقت بالضغط على **Run workflow**.

3. **تحميل وتثبيت ملف الـ APK على هاتفك:**
   - بمجرد انتهاء البناء (تستغرق حوالي 2-3 دقائق)، اضغط على اسم العملية الناجحة.
   - في أسفل الصفحة ضمن قسم **Artifacts**، ستجد ملف:
     `BollywoodSub-AI-Debug-APK`
   - قم بتحميله وفك ضغطه على هاتفك، وستجد بداخله ملف `app-debug.apk`.
   - اضغط عليه لتثبيته فوراً على أي هاتف أو شاشة أندرويد (لا يتطلب شهادات أو متجر جوجل بلاي).

---

## 🛠️ تفاصيل الملفات المعدة في هذا المشروع:

| الملف | الوظيفة |
| :--- | :--- |
| `.github/workflows/build-apk.yml` | خط أنابيب GitHub Actions الآلي (تثبيت Java 21 LTS و Android SDK وبناء الـ APK) |
| `capacitor.config.json` | تكوين هوية التطبيق (`com.bollywoodsub.ai`) واسم التطبيق وإعدادات الأمان |
| `android/` | مشروع أندرويد محلي أصلي بالكامل يحتوي على `build.gradle` و `AndroidManifest.xml` |
| `src/utils/apiFetch.ts` | محول ذكي يتعرف تلقائياً على تشغيل التطبيق داخل الهاتف ويربطه بسيرفر المعالجة السحابي |

---

## 💻 البناء المحلي على جهازك (اختياري عبر Android Studio):

إذا أردت تعديل أو بناء التطبيق محلياً على جهاز الكمبيوتر:
```bash
# 1. تثبيت الحزم
npm install

# 2. بناء واجهة الويب
npm run build

# 3. مزامنة التغييرات مع مشروع أندرويد
npx cap sync android

# 4. فتح المشروع في Android Studio
npx cap open android
```
ثم اضغط في Android Studio على **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
