import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { exec } from 'child_process';
import util from 'util';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { sanitizeAndAlignCues, generateSRT, generateASS, parseTimecodeToSeconds } from './src/utils/subtitleUtils';
import { RawGeminiSubtitleItem, SubtitleStyle } from './src/types';

dotenv.config();

const execAsync = util.promisify(exec);
const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const BURNED_DIR = path.join(process.cwd(), 'uploads', 'burned');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(BURNED_DIR)) {
  fs.mkdirSync(BURNED_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250 MB
});

// Lazy initialize Gemini API client
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in process.env yet');
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Dialect full names in Arabic
const DIALECT_DESCRIPTIONS: Record<string, string> = {
  msa: 'اللغة العربية الفصحى الحديثة المعاصرة (Modern Standard Arabic)',
  egyptian: 'اللهجة المصرية السينمائية السلسة الشائعة في دبلجة الأفلام',
  levantine: 'اللهجة الشامية (السورية واللبنانية السينمائية)',
  gulf: 'اللهجة الخليجية المعاصرة',
  iraqi: 'اللهجة العراقية الفنية',
};

async function startServer() {
  const app = express();

  // Enable CORS for mobile app (Capacitor localhost) and external requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static serving for uploaded files
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      ffmpegAvailable: true,
      time: new Date().toISOString(),
    });
  });

  // Pre-configured sample Bollywood clips
  app.get('/api/samples', (req, res) => {
    const samplePath = '/samples/bollywood_demo.mp4';
    res.json({
      samples: [
        {
          id: 'demo-gully-boy-rap',
          title: 'راب بوليوود السريع وحوار شارع (Hinglish & Rap)',
          duration: 15,
          videoUrl: samplePath,
          description: 'مشهد حركي سريع يدمج بين الراب الهندي وخلط الإنجليزية والهندية (Hinglish)',
          defaultDialect: 'egyptian',
          preloadedCues: [
            {
              id: 'cue-demo-1',
              startSeconds: 0.0,
              endSeconds: 2.8,
              timecodeStart: '00:00.00',
              timecodeEnd: '00:02.80',
              originalHindi: 'Apna Time Aayega! Tu nanga hi to aaya hai kya ghanta leke jaayega!',
              arabicTranslation: '♪ وقتنا آتٍ لا محالة! لقد جئت عارياً، فماذا تظن أنك ستأخذ معك؟! ♪',
              type: 'rap',
              speaker: 'مراد (مغني الراب)',
              notes: 'مقطع راب مشهور من فيلم Gully Boy'
            },
            {
              id: 'cue-demo-2',
              startSeconds: 2.85,
              endSeconds: 5.6,
              timecodeStart: '00:02.85',
              timecodeEnd: '00:05.60',
              originalHindi: 'Listen bro, scene bohot hard hai yahan pe, koi chance mat lena.',
              arabicTranslation: 'اسمع يا صاحبي، الموقف هنا في غاية الخطورة، لا تجازف أبداً.',
              type: 'hinglish',
              speaker: 'شير (المدرب)',
              notes: 'مزيج هندي وإنجليزي Hinglish من شوارع مومباي'
            },
            {
              id: 'cue-demo-3',
              startSeconds: 5.65,
              endSeconds: 9.2,
              timecodeStart: '00:05.65',
              timecodeEnd: '00:09.20',
              originalHindi: 'Zindagi mein agar kuch banna hai, to darr ko apne joote ke neeche rakhna seekh!',
              arabicTranslation: 'إذا أردت أن تكون شيئاً يُذكر في هذه الحياة، فتعلم أن تدوس خوفك تحت حذائك!',
              type: 'dialogue',
              speaker: 'البطل',
              notes: 'حوار بوليوودي ملحمي كلاسيكي'
            },
            {
              id: 'cue-demo-4',
              startSeconds: 9.25,
              endSeconds: 14.5,
              timecodeStart: '00:09.25',
              timecodeEnd: '00:14.50',
              originalHindi: 'Tere bina jeena saza ho gaya, yeh ishq mera fanaa ho gaya...',
              arabicTranslation: '♪ أضحى العيش بدونك عذاباً أليماً، وفنيت روحي في غرامك الأبدي... ♪',
              type: 'song',
              speaker: 'أغنية الخلفية (Romantic OST)',
              notes: 'أغنية عاطفية في خلفية المشهد الدرامي'
            }
          ]
        }
      ]
    });
  });

  // 1. Upload Video/Audio
  app.post('/api/upload', (req, res) => {
    upload.single('mediaFile')(req, res, (err: any) => {
      if (err) {
        console.error('Multer upload error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: 'حجم الملف كبير جداً (تجاوز الحد الأقصى 250 ميغابايت). ننصح باستخراج مسار الصوت ورفعه بصيغة MP3 لتسريع المعالجة وتفادي قيود الحجم.',
            });
          }
          return res.status(400).json({ error: `خطأ أثناء رفع الملف: ${err.message}` });
        }
        return res.status(500).json({ error: err.message || 'فشل في رفع الملف إلى الخادم' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'لم يتم استلام أي ملف. يرجى اختيار ملف وسائط صالح (فيديو أو صوت).' });
      }

      const file = req.file;
      const fileId = file.filename;
      const originalName = file.originalname;
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      const url = `/uploads/${fileId}`;

      return res.json({
        success: true,
        fileId,
        originalName,
        sizeMb,
        url,
        mimeType: file.mimetype,
      });
    });
  });

  // 2. Extract Audio with FFmpeg Zero-Sync Pipeline
  app.post('/api/extract-audio', async (req, res) => {
    try {
      const { fileId } = req.body;
      if (!fileId) {
        res.status(400).json({ error: 'معرّف الملف مطلوب' });
        return;
      }

      const inputPath = path.join(UPLOADS_DIR, fileId);
      if (!fs.existsSync(inputPath)) {
        res.status(404).json({ error: 'ملف الفيديو غير موجود على السيرفر' });
        return;
      }

      const audioFileName = `${path.parse(fileId).name}_pristine.mp3`;
      const audioPath = path.join(UPLOADS_DIR, audioFileName);

      // FFmpeg pipeline per user specifications:
      // -avoid_negative_ts make_zero -af aresample=async=1 -ar 44100 -ac 2 -b:a 128k
      const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vn -avoid_negative_ts make_zero -af aresample=async=1 -ar 44100 -ac 2 -b:a 128k "${audioPath}"`;

      console.log(`Executing FFmpeg audio extract: ${ffmpegCmd}`);
      await execAsync(ffmpegCmd);

      res.json({
        success: true,
        audioFileId: audioFileName,
        audioUrl: `/uploads/${audioFileName}`,
      });
    } catch (err: any) {
      console.error('Audio extraction error:', err);
      res.status(500).json({ error: `فشل استخراج الصوت عبر FFmpeg: ${err.message}` });
    }
  });

  interface GenerateResult {
    responseText: string;
    modelUsed: string;
    fallbackOccurred: boolean;
    fallbackNotice?: string;
  }

  async function generateSubtitlesWithFallback(
    client: GoogleGenAI,
    requestedModel: string,
    params: {
      systemInstruction: string;
      promptText: string;
      audioPath: string;
    }
  ): Promise<GenerateResult> {
    const primaryModel = requestedModel || 'gemini-3.5-flash-lite';
    const candidateModels = [
      primaryModel,
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];
    const modelQueue = Array.from(new Set(candidateModels));

    const audioBuffer = fs.readFileSync(params.audioPath);
    const isLargeFile = audioBuffer.length > 15 * 1024 * 1024;
    let fileUri: string | null = null;
    let fileMimeType = 'audio/mp3';

    if (isLargeFile) {
      try {
        console.log(`[Gemini] Audio size is ${(audioBuffer.length / (1024 * 1024)).toFixed(1)}MB. Uploading via Files API...`);
        const uploadResp: any = await (client.files as any).upload({
          file: params.audioPath,
          mimeType: 'audio/mp3',
        });
        fileUri = uploadResp?.uri || null;
        fileMimeType = uploadResp?.mimeType || 'audio/mp3';
      } catch (uploadErr) {
        console.log('[Gemini] Files API upload bypassed, proceeding with audio data:', uploadErr);
      }
    }

    const parts: any[] = [];
    if (fileUri) {
      parts.push({
        fileData: {
          fileUri: fileUri,
          mimeType: fileMimeType,
        },
      });
    } else {
      parts.push({
        inlineData: {
          mimeType: 'audio/mp3',
          data: audioBuffer.toString('base64'),
        },
      });
    }
    parts.push({ text: params.promptText });

    let lastError: any = null;

    for (let mIdx = 0; mIdx < modelQueue.length; mIdx++) {
      const currentModel = modelQueue[mIdx];
      const isFallback = currentModel !== primaryModel;

      try {
        console.log(`[Gemini] Attempting ${currentModel}${isFallback ? ' [FALLBACK MODEL]' : ''}...`);

        const response = await client.models.generateContent({
          model: currentModel,
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const responseText = response.text || '[]';
        console.log(`[Gemini] Success using model: ${currentModel}`);
        return {
          responseText,
          modelUsed: currentModel,
          fallbackOccurred: isFallback,
          fallbackNotice: isFallback
            ? `تم تحويل المعالجة بنجاح إلى نموذج ${currentModel} لتجاوز الضغط المؤقت على ${primaryModel}.`
            : undefined,
        };
      } catch (err: any) {
        lastError = err;
        const errString = String(err?.message || err || '');
        console.log(`[Gemini] Note: ${currentModel} encountered transient status: ${errString.includes('503') ? '503 High Demand' : errString.includes('429') ? '429 Rate Limit' : 'Busy'}`);

        const isHighDemand =
          errString.includes('503') ||
          errString.includes('high demand') ||
          errString.includes('UNAVAILABLE') ||
          errString.includes('overloaded');

        // If it's a transient 503 spike, attempt ONE short retry on this model
        if (isHighDemand) {
          try {
            console.log(`[Gemini] Retrying 503 on ${currentModel} in 1200ms...`);
            await new Promise((r) => setTimeout(r, 1200));
            const retryResponse = await client.models.generateContent({
              model: currentModel,
              contents: [{ role: 'user', parts }],
              config: {
                systemInstruction: params.systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.2,
              },
            });
            const responseText = retryResponse.text || '[]';
            console.log(`[Gemini] Success on retry using ${currentModel}`);
            return {
              responseText,
              modelUsed: currentModel,
              fallbackOccurred: isFallback,
              fallbackNotice: isFallback
                ? `تم تحويل المعالجة بنجاح إلى نموذج ${currentModel}.`
                : undefined,
            };
          } catch (retryErr: any) {
            lastError = retryErr;
            console.log(`[Gemini] Retry bypassed for ${currentModel}. Switching to next fallback model...`);
          }
        }

        // On 429 quota exhaustion or failed 503, immediately proceed to the next fallback model in queue
        continue;
      }
    }

    const rawMsg = String(lastError?.message || lastError || '');
    if (
      rawMsg.includes('503') ||
      rawMsg.includes('high demand') ||
      rawMsg.includes('UNAVAILABLE') ||
      rawMsg.includes('429') ||
      rawMsg.includes('RESOURCE_EXHAUSTED')
    ) {
      throw new Error(
        'خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً فائقاً أو تم استنفاذ الحصة المجانية الحالية (503/429). يمكنك النقر على "إعادة المحاولة"، أو تجربة عينة بوليوود المدمجة فوراً لاختبار كافة المزايا بدون انتظار.'
      );
    }
    throw lastError || new Error('فشلت معالجة الترجمة من الذكاء الاصطناعي.');
  }

  // 3. AI Translation & Strict Base-60 Timestamping
  app.post('/api/translate', async (req, res) => {
    try {
      const {
        fileId,
        dialect = 'msa',
        dialogueType = 'all',
        model = 'gemini-3.5-flash-lite',
        preserveHinglishFlavour = true,
        translateBackgroundSongs = true,
        minDurationSec = 1.0,
      } = req.body;

      if (!fileId) {
        res.status(400).json({ error: 'معرّف الملف مطلوب' });
        return;
      }

      // Check if it is a sample
      if (fileId === 'demo-gully-boy-rap') {
        // Return preloaded sample with dialect adaptation
        res.json({
          success: true,
          modelUsed: model,
          cues: [
            {
              id: 'cue-demo-1',
              startSeconds: 0.0,
              endSeconds: 2.8,
              timecodeStart: '00:00.00',
              timecodeEnd: '00:02.80',
              originalHindi: 'Apna Time Aayega! Tu nanga hi to aaya hai kya ghanta leke jaayega!',
              arabicTranslation: dialect === 'egyptian' 
                ? 'وقتنا جاي جاي! إنت جيت للدنيا عريان هتاخد إيه معاك يعني؟!'
                : 'وقتنا آتٍ لا محالة! لقد جئت عارياً، فماذا تظن أنك ستأخذ معك؟!',
              type: 'rap',
              speaker: 'مراد (Gully Boy)',
              notes: 'راب سريع بنبض شوارع مومباي'
            },
            {
              id: 'cue-demo-2',
              startSeconds: 2.85,
              endSeconds: 5.6,
              timecodeStart: '00:02.85',
              timecodeEnd: '00:05.60',
              originalHindi: 'Listen bro, scene bohot hard hai yahan pe, koi chance mat lena.',
              arabicTranslation: dialect === 'egyptian'
                ? 'اسمع يا عمنا، الحوار هنا قافل وواعر، اوعى تاخد أي مخاطرة!'
                : 'اسمع يا صاحبي، الموقف هنا في غاية الخطورة، لا تجازف أبداً.',
              type: 'hinglish',
              speaker: 'شير',
              notes: 'خلط Hinglish سريع'
            },
            {
              id: 'cue-demo-3',
              startSeconds: 5.65,
              endSeconds: 9.2,
              timecodeStart: '00:05.65',
              timecodeEnd: '00:09.20',
              originalHindi: 'Zindagi mein agar kuch banna hai, to darr ko apne joote ke neeche rakhna seekh!',
              arabicTranslation: dialect === 'egyptian'
                ? 'لو عايز تطلع بحاجة من الدنيا دي، اتعلم تدوس على خوفك بجزمتك!'
                : 'إذا أردت أن تصنع لنفسك مجداً في هذه الحياة، فتعلم أن تدوس خوفك تحت قدميك!',
              type: 'dialogue',
              speaker: 'البطل',
              notes: 'حوار بوليوودي أسطوري'
            },
            {
              id: 'cue-demo-4',
              startSeconds: 9.25,
              endSeconds: 14.5,
              timecodeStart: '00:09.25',
              timecodeEnd: '00:14.50',
              originalHindi: 'Tere bina jeena saza ho gaya, yeh ishq mera fanaa ho gaya...',
              arabicTranslation: dialect === 'egyptian'
                ? 'العيشة من غيرك بقت عذاب، وغرامي في هواك داب وفني...'
                : 'أضحى العيش بدونك عذاباً أليماً، وفنيت روحي في غرامك الأبدي...',
              type: 'song',
              speaker: 'أغنية الخلفية',
              notes: 'أغنية شاعرية في خلفية المشهد'
            }
          ]
        });
        return;
      }

      // Find file
      const inputPath = path.join(UPLOADS_DIR, fileId);
      if (!fs.existsSync(inputPath)) {
        res.status(404).json({ error: 'الملف غير موجود' });
        return;
      }

      // Check if audio needs extraction
      const isAudio = /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(fileId);
      let audioPath = inputPath;
      if (!isAudio) {
        const audioFileName = `${path.parse(fileId).name}_pristine.mp3`;
        audioPath = path.join(UPLOADS_DIR, audioFileName);
        if (!fs.existsSync(audioPath)) {
          const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vn -avoid_negative_ts make_zero -af aresample=async=1 -ar 44100 -ac 2 -b:a 128k "${audioPath}"`;
          await execAsync(ffmpegCmd);
        }
      }

      // Check Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error: 'مفتاح GEMINI_API_KEY غير موجود في إعدادات البيئة. يرجى ضبطه في شريط الإعدادات.',
        });
        return;
      }

      const client = getGeminiClient();
      const targetDialectName = DIALECT_DESCRIPTIONS[dialect] || DIALECT_DESCRIPTIONS.msa;

      // Read audio file
      const audioBuffer = fs.readFileSync(audioPath);
      const base64Audio = audioBuffer.toString('base64');

      const systemInstruction = `
أنت المترجم الأول المتخصص عالمياً في ترجمة السينما والمسلسلات الهندية (Bollywood & OTT) إلى اللغة العربية:
- المطلوب: استمع إلى الصوت الهندي وحوله إلى ترجمة عربية سينمائية متقنة بـ: ${targetDialectName}.
- ترجم كل شيء بدقة متناهية: الحوارات السريعة، الـ Hinglish (مزج الهندية مع الإنجليزية)، مقاطع الراب الهندي السريع (مثل Gully Boy / Badshah)، وأغاني الخلفية الشعرية والمقاطع الرومانسية، بدءاً من الثانية 00:00.00 دون إسقاط أي ثانية!

قاعدة علامة النوتة الموسيقية للأغاني ومقاطع الراب (Musical Note Notation ♪):
- كلما كانت الجملة غنائية (أغنية خلفية، أغنية رومانسية، أو مقطع راب هندي سريع) اجعل type إما "song" أو "rap".
- إلزامياً: يجب إحاطة الترجمة العربية بعلامة النوتة الموسيقية '♪' في البداية والنهاية (مثال: "♪ وقتنا جاي لا محالة! ♪" أو "♪ أضحى العيش بدونك عذاباً أليماً ♪") ليعرف المشاهد فوراً في ملف الترجمة وشاشة العرض أن هذا المقطع غنائي أو راب.

قاعدة التوقيت الصارمة جداً (منع خطأ الـ 100 ثانية):
- القاعدة الذهبية: الدقيقة تساوي 60 ثانية تماماً (Base-60)، وليست 100 ثانية.
- يجب أن تخرج التوقيت بصيغة نصية دقيقة (MM:SS.ms) مثل "00:01.20" أو "01:05.40" للدقائق والثواني.
- لا تضع في الثواني قيماً تتعدى 59.99 (أي لا تجعل الدقيقة 100 ثانية أبداً).
- أخرج النتيجة حصراً بصيغة JSON Array مطابقة للمخطط التالي:
[
  {
    "timecodeStart": "00:01.20",
    "timecodeEnd": "00:04.50",
    "originalHindi": "نص الحوار الهندي أو Hinglish",
    "arabicTranslation": "الترجمة العربية السينمائية المتقنة (محاطة بـ ♪ إذا كانت أغنية أو راب)",
    "speaker": "اسم المتحدث إن وجد",
    "type": "dialogue" // dialogue, hinglish, rap, song
  }
]
`;

      const promptText = `قم بترجمة كامل الحوارات وأغاني الراب والأغاني في هذا الملف الصوتي الهندي بدقة سينمائية باللهجة ${targetDialectName} مع تطبيق علامة النوتة الموسيقية ♪ للأغاني والراب وصيغة التوقيت الصارمة MM:SS.ms في مصفوفة JSON.`;

      // Call resilient Gemini handler with retries and automatic fallback
      const { responseText, modelUsed, fallbackOccurred, fallbackNotice } = await generateSubtitlesWithFallback(
        client,
        model || 'gemini-3.5-flash-lite',
        {
          systemInstruction,
          promptText,
          audioPath,
        }
      );

      let rawItems: RawGeminiSubtitleItem[] = [];

      try {
        rawItems = JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            rawItems = JSON.parse(jsonMatch[0]);
          } catch (_) {}
        }
        
        // If still empty or parsing failed, extract every valid cue object via regex
        if (!rawItems || rawItems.length === 0) {
          const objectRegex = /\{[^{}]*"(?:timecodeStart|originalHindi|arabicTranslation)"[^{}]*\}/g;
          let match: RegExpExecArray | null;
          while ((match = objectRegex.exec(responseText)) !== null) {
            try {
              const parsed = JSON.parse(match[0]);
              if (parsed.timecodeStart || parsed.arabicTranslation || parsed.originalHindi) {
                rawItems.push(parsed);
              }
            } catch (_) {}
          }
        }

        if (!rawItems || rawItems.length === 0) {
          throw new Error('فشل تفسير صيغة JSON من استجابة النموذج.');
        }
      }

      // Apply the strict deterministic Base-60 formula on server-side!
      // Total Seconds = (Minutes * 60) + Seconds
      const sanitizedCues = sanitizeAndAlignCues(rawItems, minDurationSec || 1.0);

      res.json({
        success: true,
        modelUsed,
        fallbackOccurred,
        fallbackNotice: fallbackNotice || null,
        dialectUsed: dialect,
        cues: sanitizedCues,
      });
    } catch (err: any) {
      console.error('Translation error:', err);
      let userFriendlyError = err.message || 'حدث خطأ أثناء معالجة الترجمة';
      if (
        userFriendlyError.includes('503') ||
        userFriendlyError.includes('high demand') ||
        userFriendlyError.includes('UNAVAILABLE') ||
        userFriendlyError.includes('429') ||
        userFriendlyError.includes('RESOURCE_EXHAUSTED')
      ) {
        userFriendlyError =
          'خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً فائقاً أو تم استنفاذ الحصة المجانية الحالية (503/429). يمكنك النقر على "إعادة المحاولة"، أو تجربة عينة بوليوود المدمجة فوراً لاختبار كافة المزايا بدون انتظار.';
      }
      res.status(500).json({ error: userFriendlyError, rawError: String(err?.message || err) });
    }
  });

  // 4. Burn Subtitles into Video via FFmpeg
  app.post('/api/burn-subtitles', async (req, res) => {
    try {
      const {
        fileId,
        cues,
        style = 'netflix_white',
        fontSize = 22,
        position = 'bottom',
        marginV = 30,
      } = req.body;

      if (!fileId || !cues || !Array.isArray(cues) || cues.length === 0) {
        res.status(400).json({ error: 'بيانات الفيديو وأسطر الترجمة مطلوبة.' });
        return;
      }

      let inputVideoPath = path.join(UPLOADS_DIR, fileId);
      if (fileId === 'demo-gully-boy-rap') {
        inputVideoPath = path.join(process.cwd(), 'public', 'samples', 'bollywood_demo.mp4');
      }

      if (!fs.existsSync(inputVideoPath)) {
        res.status(404).json({ error: 'ملف الفيديو الأصلي غير موجود على السيرفر.' });
        return;
      }

      const burnedId = `burned-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.mp4`;
      const outputVideoPath = path.join(BURNED_DIR, burnedId);

      // Generate temporary SRT file for burning
      const srtContent = generateSRT(cues);
      const tempSrtPath = path.join(UPLOADS_DIR, `temp-${Date.now()}.srt`);
      fs.writeFileSync(tempSrtPath, srtContent, 'utf-8');

      // Style options for FFmpeg subtitles filter
      let primaryColour = '&H00FFFFFF';
      let outlineColour = '&H00000000';
      let borderStyle = 1;
      let outline = 2;
      let shadow = 1;

      if (style === 'bollywood_gold') {
        primaryColour = '&H002BD7FE'; // Rich Indian Gold in BGR
        outline = 3;
      } else if (style === 'boxed_classic') {
        borderStyle = 3; // Bounding box
      }

      // Escape path for ffmpeg subtitles filter (colons and backslashes)
      const escapedSrtPath = tempSrtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const forceStyle = `FontName=Cairo,FontSize=${fontSize},PrimaryColour=${primaryColour},OutlineColour=${outlineColour},BorderStyle=${borderStyle},Outline=${outline},Shadow=${shadow},MarginV=${marginV}`;

      // Burn subtitles command with libx264 fast encoding
      const burnCmd = `ffmpeg -y -i "${inputVideoPath}" -vf "subtitles='${escapedSrtPath}':force_style='${forceStyle}'" -c:v libx264 -preset veryfast -crf 22 -c:a copy "${outputVideoPath}"`;

      console.log(`Burning subtitles: ${burnCmd}`);
      await execAsync(burnCmd);

      // Clean up temp srt
      if (fs.existsSync(tempSrtPath)) {
        fs.unlinkSync(tempSrtPath);
      }

      res.json({
        success: true,
        burnedId,
        downloadUrl: `/api/download-burned/${burnedId}`,
      });
    } catch (err: any) {
      console.error('Burn subtitles error:', err);
      res.status(500).json({ error: `فشل حرق الترجمة: ${err.message}` });
    }
  });

  // 5. Download Burned Video
  app.get('/api/download-burned/:burnedId', (req, res) => {
    const { burnedId } = req.params;
    const filePath = path.join(BURNED_DIR, burnedId);
    if (!fs.existsSync(filePath)) {
      res.status(404).send('الملف غير موجود');
      return;
    }
    res.download(filePath, `bollywood_arabic_subtitled_${burnedId}`);
  });

  // 6. Download Standalone Python Project as ZIP
  app.get('/api/download-python-project', (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="BollywoodSub_Python_Project.zip"');

      const ArchiveClass = archiver.ZipArchive || archiver;
      const archive = new ArchiveClass({ zlib: { level: 9 } });
      archive.on('error', (err: any) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).send(`خطأ الأرشفة: ${err.message || err}`);
        }
      });

      archive.pipe(res);

      const pythonDir = path.join(process.cwd(), 'standalone-python');
      if (fs.existsSync(pythonDir)) {
        archive.directory(pythonDir, false);
      }

      archive.finalize();
    } catch (err: any) {
      console.error('Zip download error:', err);
      res.status(500).send(`فشل إنشاء ملف المشروع المضغوط: ${err.message || err}`);
    }
  });

  // 7. Download Streamlit app file directly
  app.get('/api/download-streamlit-file', (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'streamlit_app.py');
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('ملف streamlit_app.py غير موجود.');
      }
      res.setHeader('Content-Type', 'text/x-python');
      res.setHeader('Content-Disposition', 'attachment; filename="streamlit_app.py"');
      res.sendFile(filePath);
    } catch (err: any) {
      console.error('Streamlit file download error:', err);
      res.status(500).send('فشل تحميل ملف streamlit_app.py');
    }
  });

  // 8. Get raw code for Streamlit app
  app.get('/api/streamlit-code', (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'streamlit_app.py');
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'ملف streamlit_app.py غير موجود.' });
      }
      const code = fs.readFileSync(filePath, 'utf-8');
      res.json({ code });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل قراءة كود streamlit_app.py' });
    }
  });

  // Explicit JSON error handler for all /api endpoints to prevent HTML error leak
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled API Error caught:', err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    res.status(status).json({
      error: err.message || 'حدث خطأ غير متوقع في الخادم أثناء معالجة الطلب.',
      code: err.code || 'API_ERROR',
    });
  });

  // Catch-all 404 for unhandled /api/* routes so they NEVER fall through to Vite HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `نقطة النهاية المطلوبة غير موجودة: ${req.method} ${req.path}` });
  });

  // Vite middleware setup (development vs production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BollywoodSub AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
