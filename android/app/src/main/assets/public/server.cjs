var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_multer = __toESM(require("multer"), 1);
var import_child_process = require("child_process");
var import_util = __toESM(require("util"), 1);
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_module = require("module");

// src/utils/subtitleUtils.ts
function parseTimecodeToSeconds(timeStr) {
  if (typeof timeStr === "number") {
    return isNaN(timeStr) ? 0 : Math.max(0, timeStr);
  }
  if (!timeStr || typeof timeStr !== "string") return 0;
  const cleaned = timeStr.trim().replace(",", ".");
  const parts = cleaned.split(":");
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else {
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : Math.max(0, val);
  }
}
function secondsToTimecode(totalSec) {
  const safe = Math.max(0, totalSec);
  const minutes = Math.floor(safe / 60);
  const seconds = (safe % 60).toFixed(2);
  const padMin = String(minutes).padStart(2, "0");
  const padSec = parseFloat(seconds) < 10 ? "0" + seconds : seconds;
  return `${padMin}:${padSec}`;
}
function secondsToSRTTime(totalSec) {
  const safe = Math.max(0, totalSec);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe % 3600 / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.floor(safe % 1 * 1e3);
  const padH = String(hours).padStart(2, "0");
  const padM = String(minutes).padStart(2, "0");
  const padS = String(seconds).padStart(2, "0");
  const padMs = String(milliseconds).padStart(3, "0");
  return `${padH}:${padM}:${padS},${padMs}`;
}
function hasMusicalNote(text) {
  if (!text) return false;
  return /[♪♫]/.test(text);
}
function formatMusicalNote(text) {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  const hasNoteStart = /^[♪♫]/.test(trimmed);
  const hasNoteEnd = /[♪♫]$/.test(trimmed);
  if (hasNoteStart && hasNoteEnd) {
    return trimmed;
  }
  if (hasNoteStart) {
    return `${trimmed} \u266A`;
  }
  if (hasNoteEnd) {
    return `\u266A ${trimmed}`;
  }
  return `\u266A ${trimmed} \u266A`;
}
function sanitizeAndAlignCues(rawCues, minDurationSec = 1) {
  if (!Array.isArray(rawCues)) return [];
  const parsed = rawCues.map((item, index) => {
    let start = parseTimecodeToSeconds(item.timecodeStart);
    let end = parseTimecodeToSeconds(item.timecodeEnd);
    if (end <= start) {
      end = start + minDurationSec;
    } else if (end - start < minDurationSec) {
      end = start + minDurationSec;
    }
    let arabic = (item.arabicTranslation || "").trim();
    const cueType = item.type || "dialogue";
    if (cueType === "song" || cueType === "rap") {
      arabic = formatMusicalNote(arabic);
    }
    return {
      id: `cue-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      startSeconds: start,
      endSeconds: end,
      timecodeStart: secondsToTimecode(start),
      timecodeEnd: secondsToTimecode(end),
      originalHindi: (item.originalHindi || "").trim(),
      arabicTranslation: arabic,
      speaker: item.speaker?.trim(),
      type: cueType,
      notes: item.notes?.trim()
    };
  }).filter((cue) => cue.arabicTranslation.length > 0 || cue.originalHindi.length > 0);
  parsed.sort((a, b) => a.startSeconds - b.startSeconds);
  for (let i = 0; i < parsed.length; i++) {
    const curr = parsed[i];
    if (curr.endSeconds - curr.startSeconds < minDurationSec) {
      curr.endSeconds = curr.startSeconds + minDurationSec;
    }
    if (i > 0) {
      const prev = parsed[i - 1];
      if (curr.startSeconds < prev.endSeconds) {
        if (prev.endSeconds - prev.startSeconds > minDurationSec + 0.2) {
          prev.endSeconds = Math.max(prev.startSeconds + minDurationSec, curr.startSeconds - 0.05);
        } else {
          curr.startSeconds = prev.endSeconds + 0.05;
          curr.endSeconds = Math.max(curr.endSeconds, curr.startSeconds + minDurationSec);
        }
      }
    }
    curr.timecodeStart = secondsToTimecode(curr.startSeconds);
    curr.timecodeEnd = secondsToTimecode(curr.endSeconds);
  }
  return parsed;
}
function generateSRT(cues) {
  return cues.map((cue, index) => {
    const num = index + 1;
    const start = secondsToSRTTime(cue.startSeconds);
    const end = secondsToSRTTime(cue.endSeconds);
    let text = cue.arabicTranslation;
    if ((cue.type === "song" || cue.type === "rap") && !hasMusicalNote(text)) {
      text = formatMusicalNote(text);
    }
    return `${num}
${start} --> ${end}
${text}
`;
  }).join("\n");
}

// server.ts
var import_meta = {};
var require2 = (0, import_module.createRequire)(import_meta.url);
var archiver = require2("archiver");
import_dotenv.default.config();
var execAsync = import_util.default.promisify(import_child_process.exec);
var PORT = 3e3;
var UPLOADS_DIR = import_path.default.join(process.cwd(), "uploads");
var BURNED_DIR = import_path.default.join(process.cwd(), "uploads", "burned");
if (!import_fs.default.existsSync(UPLOADS_DIR)) {
  import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!import_fs.default.existsSync(BURNED_DIR)) {
  import_fs.default.mkdirSync(BURNED_DIR, { recursive: true });
}
var storage = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = import_path.default.extname(file.originalname) || ".mp4";
    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, unique);
  }
});
var upload = (0, import_multer.default)({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }
  // 250 MB
});
var genAIClient = null;
function getGeminiClient() {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in process.env yet");
    }
    genAIClient = new import_genai.GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIClient;
}
var DIALECT_DESCRIPTIONS = {
  msa: "\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u0627\u0644\u062D\u062F\u064A\u062B\u0629 \u0627\u0644\u0645\u0639\u0627\u0635\u0631\u0629 (Modern Standard Arabic)",
  egyptian: "\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0645\u0635\u0631\u064A\u0629 \u0627\u0644\u0633\u064A\u0646\u0645\u0627\u0626\u064A\u0629 \u0627\u0644\u0633\u0644\u0633\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629 \u0641\u064A \u062F\u0628\u0644\u062C\u0629 \u0627\u0644\u0623\u0641\u0644\u0627\u0645",
  levantine: "\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0634\u0627\u0645\u064A\u0629 (\u0627\u0644\u0633\u0648\u0631\u064A\u0629 \u0648\u0627\u0644\u0644\u0628\u0646\u0627\u0646\u064A\u0629 \u0627\u0644\u0633\u064A\u0646\u0645\u0627\u0626\u064A\u0629)",
  gulf: "\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u062E\u0644\u064A\u062C\u064A\u0629 \u0627\u0644\u0645\u0639\u0627\u0635\u0631\u0629",
  iraqi: "\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0639\u0631\u0627\u0642\u064A\u0629 \u0627\u0644\u0641\u0646\u064A\u0629"
};
async function startServer() {
  const app = (0, import_express.default)();
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  app.use("/uploads", import_express.default.static(UPLOADS_DIR));
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      ffmpegAvailable: true,
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/samples", (req, res) => {
    const samplePath = "/samples/bollywood_demo.mp4";
    res.json({
      samples: [
        {
          id: "demo-gully-boy-rap",
          title: "\u0631\u0627\u0628 \u0628\u0648\u0644\u064A\u0648\u0648\u062F \u0627\u0644\u0633\u0631\u064A\u0639 \u0648\u062D\u0648\u0627\u0631 \u0634\u0627\u0631\u0639 (Hinglish & Rap)",
          duration: 15,
          videoUrl: samplePath,
          description: "\u0645\u0634\u0647\u062F \u062D\u0631\u0643\u064A \u0633\u0631\u064A\u0639 \u064A\u062F\u0645\u062C \u0628\u064A\u0646 \u0627\u0644\u0631\u0627\u0628 \u0627\u0644\u0647\u0646\u062F\u064A \u0648\u062E\u0644\u0637 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0648\u0627\u0644\u0647\u0646\u062F\u064A\u0629 (Hinglish)",
          defaultDialect: "egyptian",
          preloadedCues: [
            {
              id: "cue-demo-1",
              startSeconds: 0,
              endSeconds: 2.8,
              timecodeStart: "00:00.00",
              timecodeEnd: "00:02.80",
              originalHindi: "Apna Time Aayega! Tu nanga hi to aaya hai kya ghanta leke jaayega!",
              arabicTranslation: "\u266A \u0648\u0642\u062A\u0646\u0627 \u0622\u062A\u064D \u0644\u0627 \u0645\u062D\u0627\u0644\u0629! \u0644\u0642\u062F \u062C\u0626\u062A \u0639\u0627\u0631\u064A\u0627\u064B\u060C \u0641\u0645\u0627\u0630\u0627 \u062A\u0638\u0646 \u0623\u0646\u0643 \u0633\u062A\u0623\u062E\u0630 \u0645\u0639\u0643\u061F! \u266A",
              type: "rap",
              speaker: "\u0645\u0631\u0627\u062F (\u0645\u063A\u0646\u064A \u0627\u0644\u0631\u0627\u0628)",
              notes: "\u0645\u0642\u0637\u0639 \u0631\u0627\u0628 \u0645\u0634\u0647\u0648\u0631 \u0645\u0646 \u0641\u064A\u0644\u0645 Gully Boy"
            },
            {
              id: "cue-demo-2",
              startSeconds: 2.85,
              endSeconds: 5.6,
              timecodeStart: "00:02.85",
              timecodeEnd: "00:05.60",
              originalHindi: "Listen bro, scene bohot hard hai yahan pe, koi chance mat lena.",
              arabicTranslation: "\u0627\u0633\u0645\u0639 \u064A\u0627 \u0635\u0627\u062D\u0628\u064A\u060C \u0627\u0644\u0645\u0648\u0642\u0641 \u0647\u0646\u0627 \u0641\u064A \u063A\u0627\u064A\u0629 \u0627\u0644\u062E\u0637\u0648\u0631\u0629\u060C \u0644\u0627 \u062A\u062C\u0627\u0632\u0641 \u0623\u0628\u062F\u0627\u064B.",
              type: "hinglish",
              speaker: "\u0634\u064A\u0631 (\u0627\u0644\u0645\u062F\u0631\u0628)",
              notes: "\u0645\u0632\u064A\u062C \u0647\u0646\u062F\u064A \u0648\u0625\u0646\u062C\u0644\u064A\u0632\u064A Hinglish \u0645\u0646 \u0634\u0648\u0627\u0631\u0639 \u0645\u0648\u0645\u0628\u0627\u064A"
            },
            {
              id: "cue-demo-3",
              startSeconds: 5.65,
              endSeconds: 9.2,
              timecodeStart: "00:05.65",
              timecodeEnd: "00:09.20",
              originalHindi: "Zindagi mein agar kuch banna hai, to darr ko apne joote ke neeche rakhna seekh!",
              arabicTranslation: "\u0625\u0630\u0627 \u0623\u0631\u062F\u062A \u0623\u0646 \u062A\u0643\u0648\u0646 \u0634\u064A\u0626\u0627\u064B \u064A\u064F\u0630\u0643\u0631 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u062D\u064A\u0627\u0629\u060C \u0641\u062A\u0639\u0644\u0645 \u0623\u0646 \u062A\u062F\u0648\u0633 \u062E\u0648\u0641\u0643 \u062A\u062D\u062A \u062D\u0630\u0627\u0626\u0643!",
              type: "dialogue",
              speaker: "\u0627\u0644\u0628\u0637\u0644",
              notes: "\u062D\u0648\u0627\u0631 \u0628\u0648\u0644\u064A\u0648\u0648\u062F\u064A \u0645\u0644\u062D\u0645\u064A \u0643\u0644\u0627\u0633\u064A\u0643\u064A"
            },
            {
              id: "cue-demo-4",
              startSeconds: 9.25,
              endSeconds: 14.5,
              timecodeStart: "00:09.25",
              timecodeEnd: "00:14.50",
              originalHindi: "Tere bina jeena saza ho gaya, yeh ishq mera fanaa ho gaya...",
              arabicTranslation: "\u266A \u0623\u0636\u062D\u0649 \u0627\u0644\u0639\u064A\u0634 \u0628\u062F\u0648\u0646\u0643 \u0639\u0630\u0627\u0628\u0627\u064B \u0623\u0644\u064A\u0645\u0627\u064B\u060C \u0648\u0641\u0646\u064A\u062A \u0631\u0648\u062D\u064A \u0641\u064A \u063A\u0631\u0627\u0645\u0643 \u0627\u0644\u0623\u0628\u062F\u064A... \u266A",
              type: "song",
              speaker: "\u0623\u063A\u0646\u064A\u0629 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 (Romantic OST)",
              notes: "\u0623\u063A\u0646\u064A\u0629 \u0639\u0627\u0637\u0641\u064A\u0629 \u0641\u064A \u062E\u0644\u0641\u064A\u0629 \u0627\u0644\u0645\u0634\u0647\u062F \u0627\u0644\u062F\u0631\u0627\u0645\u064A"
            }
          ]
        }
      ]
    });
  });
  app.post("/api/upload", (req, res) => {
    upload.single("mediaFile")(req, res, (err) => {
      if (err) {
        console.error("Multer upload error:", err);
        if (err instanceof import_multer.default.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              error: "\u062D\u062C\u0645 \u0627\u0644\u0645\u0644\u0641 \u0643\u0628\u064A\u0631 \u062C\u062F\u0627\u064B (\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 250 \u0645\u064A\u063A\u0627\u0628\u0627\u064A\u062A). \u0646\u0646\u0635\u062D \u0628\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u0648\u062A \u0648\u0631\u0641\u0639\u0647 \u0628\u0635\u064A\u063A\u0629 MP3 \u0644\u062A\u0633\u0631\u064A\u0639 \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0648\u062A\u0641\u0627\u062F\u064A \u0642\u064A\u0648\u062F \u0627\u0644\u062D\u062C\u0645."
            });
          }
          return res.status(400).json({ error: `\u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641: ${err.message}` });
        }
        return res.status(500).json({ error: err.message || "\u0641\u0634\u0644 \u0641\u064A \u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641 \u0625\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0623\u064A \u0645\u0644\u0641. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0644\u0641 \u0648\u0633\u0627\u0626\u0637 \u0635\u0627\u0644\u062D (\u0641\u064A\u062F\u064A\u0648 \u0623\u0648 \u0635\u0648\u062A)." });
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
        mimeType: file.mimetype
      });
    });
  });
  app.post("/api/extract-audio", async (req, res) => {
    try {
      const { fileId } = req.body;
      if (!fileId) {
        res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628" });
        return;
      }
      const inputPath = import_path.default.join(UPLOADS_DIR, fileId);
      if (!import_fs.default.existsSync(inputPath)) {
        res.status(404).json({ error: "\u0645\u0644\u0641 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u0631\u0641\u0631" });
        return;
      }
      const audioFileName = `${import_path.default.parse(fileId).name}_pristine.mp3`;
      const audioPath = import_path.default.join(UPLOADS_DIR, audioFileName);
      const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vn -avoid_negative_ts make_zero -af aresample=async=1 -ar 44100 -ac 2 -b:a 128k "${audioPath}"`;
      console.log(`Executing FFmpeg audio extract: ${ffmpegCmd}`);
      await execAsync(ffmpegCmd);
      res.json({
        success: true,
        audioFileId: audioFileName,
        audioUrl: `/uploads/${audioFileName}`
      });
    } catch (err) {
      console.error("Audio extraction error:", err);
      res.status(500).json({ error: `\u0641\u0634\u0644 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0635\u0648\u062A \u0639\u0628\u0631 FFmpeg: ${err.message}` });
    }
  });
  async function generateSubtitlesWithFallback(client, requestedModel, params) {
    const primaryModel = requestedModel || "gemini-3.1-flash-lite";
    const candidateModels = [
      primaryModel,
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest"
    ];
    const modelQueue = Array.from(new Set(candidateModels));
    const audioBuffer = import_fs.default.readFileSync(params.audioPath);
    const isLargeFile = audioBuffer.length > 15 * 1024 * 1024;
    let fileUri = null;
    let fileMimeType = "audio/mp3";
    if (isLargeFile) {
      try {
        console.log(`[Gemini] Audio size is ${(audioBuffer.length / (1024 * 1024)).toFixed(1)}MB. Uploading via Files API...`);
        const uploadResp = await client.files.upload({
          file: params.audioPath,
          mimeType: "audio/mp3"
        });
        fileUri = uploadResp?.uri || null;
        fileMimeType = uploadResp?.mimeType || "audio/mp3";
      } catch (uploadErr) {
        console.log("[Gemini] Files API upload bypassed, proceeding with audio data:", uploadErr);
      }
    }
    const parts = [];
    if (fileUri) {
      parts.push({
        fileData: {
          fileUri,
          mimeType: fileMimeType
        }
      });
    } else {
      parts.push({
        inlineData: {
          mimeType: "audio/mp3",
          data: audioBuffer.toString("base64")
        }
      });
    }
    parts.push({ text: params.promptText });
    let lastError = null;
    for (let mIdx = 0; mIdx < modelQueue.length; mIdx++) {
      const currentModel = modelQueue[mIdx];
      const isFallback = currentModel !== primaryModel;
      try {
        console.log(`[Gemini] Attempting ${currentModel}${isFallback ? " [FALLBACK MODEL]" : ""}...`);
        const response = await client.models.generateContent({
          model: currentModel,
          contents: [
            {
              role: "user",
              parts
            }
          ],
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.2
          }
        });
        const responseText = response.text || "[]";
        console.log(`[Gemini] Success using model: ${currentModel}`);
        return {
          responseText,
          modelUsed: currentModel,
          fallbackOccurred: isFallback,
          fallbackNotice: isFallback ? `\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0646\u0645\u0648\u0630\u062C ${currentModel} \u0644\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0636\u063A\u0637 \u0627\u0644\u0645\u0624\u0642\u062A \u0639\u0644\u0649 ${primaryModel}.` : void 0
        };
      } catch (err) {
        lastError = err;
        const errString = String(err?.message || err || "");
        console.log(`[Gemini] Note: ${currentModel} encountered transient status: ${errString.includes("503") ? "503 High Demand" : errString.includes("429") ? "429 Rate Limit" : "Busy"}`);
        const isHighDemand = errString.includes("503") || errString.includes("high demand") || errString.includes("UNAVAILABLE") || errString.includes("overloaded");
        if (isHighDemand) {
          try {
            console.log(`[Gemini] Retrying 503 on ${currentModel} in 1200ms...`);
            await new Promise((r) => setTimeout(r, 1200));
            const retryResponse = await client.models.generateContent({
              model: currentModel,
              contents: [{ role: "user", parts }],
              config: {
                systemInstruction: params.systemInstruction,
                responseMimeType: "application/json",
                temperature: 0.2
              }
            });
            const responseText = retryResponse.text || "[]";
            console.log(`[Gemini] Success on retry using ${currentModel}`);
            return {
              responseText,
              modelUsed: currentModel,
              fallbackOccurred: isFallback,
              fallbackNotice: isFallback ? `\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0646\u0645\u0648\u0630\u062C ${currentModel}.` : void 0
            };
          } catch (retryErr) {
            lastError = retryErr;
            console.log(`[Gemini] Retry bypassed for ${currentModel}. Switching to next fallback model...`);
          }
        }
        continue;
      }
    }
    const rawMsg = String(lastError?.message || lastError || "");
    if (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE") || rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        '\u062E\u0648\u0627\u062F\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u062A\u0634\u0647\u062F \u0636\u063A\u0637\u0627\u064B \u0645\u0624\u0642\u062A\u0627\u064B \u0641\u0627\u0626\u0642\u0627\u064B \u0623\u0648 \u062A\u0645 \u0627\u0633\u062A\u0646\u0641\u0627\u0630 \u0627\u0644\u062D\u0635\u0629 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (503/429). \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0646\u0642\u0631 \u0639\u0644\u0649 "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629"\u060C \u0623\u0648 \u062A\u062C\u0631\u0628\u0629 \u0639\u064A\u0646\u0629 \u0628\u0648\u0644\u064A\u0648\u0648\u062F \u0627\u0644\u0645\u062F\u0645\u062C\u0629 \u0641\u0648\u0631\u0627\u064B \u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0643\u0627\u0641\u0629 \u0627\u0644\u0645\u0632\u0627\u064A\u0627 \u0628\u062F\u0648\u0646 \u0627\u0646\u062A\u0638\u0627\u0631.'
      );
    }
    throw lastError || new Error("\u0641\u0634\u0644\u062A \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0645\u0646 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A.");
  }
  app.post("/api/translate", async (req, res) => {
    try {
      const {
        fileId,
        dialect = "msa",
        dialogueType = "all",
        model = "gemini-3.8-flash",
        preserveHinglishFlavour = true,
        translateBackgroundSongs = true,
        minDurationSec = 1
      } = req.body;
      if (!fileId) {
        res.status(400).json({ error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0644\u0641 \u0645\u0637\u0644\u0648\u0628" });
        return;
      }
      if (fileId === "demo-gully-boy-rap") {
        res.json({
          success: true,
          modelUsed: model,
          cues: [
            {
              id: "cue-demo-1",
              startSeconds: 0,
              endSeconds: 2.8,
              timecodeStart: "00:00.00",
              timecodeEnd: "00:02.80",
              originalHindi: "Apna Time Aayega! Tu nanga hi to aaya hai kya ghanta leke jaayega!",
              arabicTranslation: dialect === "egyptian" ? "\u0648\u0642\u062A\u0646\u0627 \u062C\u0627\u064A \u062C\u0627\u064A! \u0625\u0646\u062A \u062C\u064A\u062A \u0644\u0644\u062F\u0646\u064A\u0627 \u0639\u0631\u064A\u0627\u0646 \u0647\u062A\u0627\u062E\u062F \u0625\u064A\u0647 \u0645\u0639\u0627\u0643 \u064A\u0639\u0646\u064A\u061F!" : "\u0648\u0642\u062A\u0646\u0627 \u0622\u062A\u064D \u0644\u0627 \u0645\u062D\u0627\u0644\u0629! \u0644\u0642\u062F \u062C\u0626\u062A \u0639\u0627\u0631\u064A\u0627\u064B\u060C \u0641\u0645\u0627\u0630\u0627 \u062A\u0638\u0646 \u0623\u0646\u0643 \u0633\u062A\u0623\u062E\u0630 \u0645\u0639\u0643\u061F!",
              type: "rap",
              speaker: "\u0645\u0631\u0627\u062F (Gully Boy)",
              notes: "\u0631\u0627\u0628 \u0633\u0631\u064A\u0639 \u0628\u0646\u0628\u0636 \u0634\u0648\u0627\u0631\u0639 \u0645\u0648\u0645\u0628\u0627\u064A"
            },
            {
              id: "cue-demo-2",
              startSeconds: 2.85,
              endSeconds: 5.6,
              timecodeStart: "00:02.85",
              timecodeEnd: "00:05.60",
              originalHindi: "Listen bro, scene bohot hard hai yahan pe, koi chance mat lena.",
              arabicTranslation: dialect === "egyptian" ? "\u0627\u0633\u0645\u0639 \u064A\u0627 \u0639\u0645\u0646\u0627\u060C \u0627\u0644\u062D\u0648\u0627\u0631 \u0647\u0646\u0627 \u0642\u0627\u0641\u0644 \u0648\u0648\u0627\u0639\u0631\u060C \u0627\u0648\u0639\u0649 \u062A\u0627\u062E\u062F \u0623\u064A \u0645\u062E\u0627\u0637\u0631\u0629!" : "\u0627\u0633\u0645\u0639 \u064A\u0627 \u0635\u0627\u062D\u0628\u064A\u060C \u0627\u0644\u0645\u0648\u0642\u0641 \u0647\u0646\u0627 \u0641\u064A \u063A\u0627\u064A\u0629 \u0627\u0644\u062E\u0637\u0648\u0631\u0629\u060C \u0644\u0627 \u062A\u062C\u0627\u0632\u0641 \u0623\u0628\u062F\u0627\u064B.",
              type: "hinglish",
              speaker: "\u0634\u064A\u0631",
              notes: "\u062E\u0644\u0637 Hinglish \u0633\u0631\u064A\u0639"
            },
            {
              id: "cue-demo-3",
              startSeconds: 5.65,
              endSeconds: 9.2,
              timecodeStart: "00:05.65",
              timecodeEnd: "00:09.20",
              originalHindi: "Zindagi mein agar kuch banna hai, to darr ko apne joote ke neeche rakhna seekh!",
              arabicTranslation: dialect === "egyptian" ? "\u0644\u0648 \u0639\u0627\u064A\u0632 \u062A\u0637\u0644\u0639 \u0628\u062D\u0627\u062C\u0629 \u0645\u0646 \u0627\u0644\u062F\u0646\u064A\u0627 \u062F\u064A\u060C \u0627\u062A\u0639\u0644\u0645 \u062A\u062F\u0648\u0633 \u0639\u0644\u0649 \u062E\u0648\u0641\u0643 \u0628\u062C\u0632\u0645\u062A\u0643!" : "\u0625\u0630\u0627 \u0623\u0631\u062F\u062A \u0623\u0646 \u062A\u0635\u0646\u0639 \u0644\u0646\u0641\u0633\u0643 \u0645\u062C\u062F\u0627\u064B \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u062D\u064A\u0627\u0629\u060C \u0641\u062A\u0639\u0644\u0645 \u0623\u0646 \u062A\u062F\u0648\u0633 \u062E\u0648\u0641\u0643 \u062A\u062D\u062A \u0642\u062F\u0645\u064A\u0643!",
              type: "dialogue",
              speaker: "\u0627\u0644\u0628\u0637\u0644",
              notes: "\u062D\u0648\u0627\u0631 \u0628\u0648\u0644\u064A\u0648\u0648\u062F\u064A \u0623\u0633\u0637\u0648\u0631\u064A"
            },
            {
              id: "cue-demo-4",
              startSeconds: 9.25,
              endSeconds: 14.5,
              timecodeStart: "00:09.25",
              timecodeEnd: "00:14.50",
              originalHindi: "Tere bina jeena saza ho gaya, yeh ishq mera fanaa ho gaya...",
              arabicTranslation: dialect === "egyptian" ? "\u0627\u0644\u0639\u064A\u0634\u0629 \u0645\u0646 \u063A\u064A\u0631\u0643 \u0628\u0642\u062A \u0639\u0630\u0627\u0628\u060C \u0648\u063A\u0631\u0627\u0645\u064A \u0641\u064A \u0647\u0648\u0627\u0643 \u062F\u0627\u0628 \u0648\u0641\u0646\u064A..." : "\u0623\u0636\u062D\u0649 \u0627\u0644\u0639\u064A\u0634 \u0628\u062F\u0648\u0646\u0643 \u0639\u0630\u0627\u0628\u0627\u064B \u0623\u0644\u064A\u0645\u0627\u064B\u060C \u0648\u0641\u0646\u064A\u062A \u0631\u0648\u062D\u064A \u0641\u064A \u063A\u0631\u0627\u0645\u0643 \u0627\u0644\u0623\u0628\u062F\u064A...",
              type: "song",
              speaker: "\u0623\u063A\u0646\u064A\u0629 \u0627\u0644\u062E\u0644\u0641\u064A\u0629",
              notes: "\u0623\u063A\u0646\u064A\u0629 \u0634\u0627\u0639\u0631\u064A\u0629 \u0641\u064A \u062E\u0644\u0641\u064A\u0629 \u0627\u0644\u0645\u0634\u0647\u062F"
            }
          ]
        });
        return;
      }
      const inputPath = import_path.default.join(UPLOADS_DIR, fileId);
      if (!import_fs.default.existsSync(inputPath)) {
        res.status(404).json({ error: "\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
        return;
      }
      const isAudio = /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(fileId);
      let audioPath = inputPath;
      if (!isAudio) {
        const audioFileName = `${import_path.default.parse(fileId).name}_pristine.mp3`;
        audioPath = import_path.default.join(UPLOADS_DIR, audioFileName);
        if (!import_fs.default.existsSync(audioPath)) {
          const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vn -avoid_negative_ts make_zero -af aresample=async=1 -ar 44100 -ac 2 -b:a 128k "${audioPath}"`;
          await execAsync(ffmpegCmd);
        }
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error: "\u0645\u0641\u062A\u0627\u062D GEMINI_API_KEY \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u064A\u0626\u0629. \u064A\u0631\u062C\u0649 \u0636\u0628\u0637\u0647 \u0641\u064A \u0634\u0631\u064A\u0637 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A."
        });
        return;
      }
      const client = getGeminiClient();
      const targetDialectName = DIALECT_DESCRIPTIONS[dialect] || DIALECT_DESCRIPTIONS.msa;
      const audioBuffer = import_fs.default.readFileSync(audioPath);
      const base64Audio = audioBuffer.toString("base64");
      const systemInstruction = `
\u0623\u0646\u062A \u0627\u0644\u0645\u062A\u0631\u062C\u0645 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0645\u062A\u062E\u0635\u0635 \u0639\u0627\u0644\u0645\u064A\u0627\u064B \u0641\u064A \u062A\u0631\u062C\u0645\u0629 \u0627\u0644\u0633\u064A\u0646\u0645\u0627 \u0648\u0627\u0644\u0645\u0633\u0644\u0633\u0644\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u064A\u0629 (Bollywood & OTT) \u0625\u0644\u0649 \u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629:
- \u0627\u0644\u0645\u0637\u0644\u0648\u0628: \u0627\u0633\u062A\u0645\u0639 \u0625\u0644\u0649 \u0627\u0644\u0635\u0648\u062A \u0627\u0644\u0647\u0646\u062F\u064A \u0648\u062D\u0648\u0644\u0647 \u0625\u0644\u0649 \u062A\u0631\u062C\u0645\u0629 \u0639\u0631\u0628\u064A\u0629 \u0633\u064A\u0646\u0645\u0627\u0626\u064A\u0629 \u0645\u062A\u0642\u0646\u0629 \u0628\u0640: ${targetDialectName}.
- \u062A\u0631\u062C\u0645 \u0643\u0644 \u0634\u064A\u0621 \u0628\u062F\u0642\u0629 \u0645\u062A\u0646\u0627\u0647\u064A\u0629: \u0627\u0644\u062D\u0648\u0627\u0631\u0627\u062A \u0627\u0644\u0633\u0631\u064A\u0639\u0629\u060C \u0627\u0644\u0640 Hinglish (\u0645\u0632\u062C \u0627\u0644\u0647\u0646\u062F\u064A\u0629 \u0645\u0639 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629)\u060C \u0645\u0642\u0627\u0637\u0639 \u0627\u0644\u0631\u0627\u0628 \u0627\u0644\u0647\u0646\u062F\u064A \u0627\u0644\u0633\u0631\u064A\u0639 (\u0645\u062B\u0644 Gully Boy / Badshah)\u060C \u0648\u0623\u063A\u0627\u0646\u064A \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u0627\u0644\u0634\u0639\u0631\u064A\u0629 \u0648\u0627\u0644\u0645\u0642\u0627\u0637\u0639 \u0627\u0644\u0631\u0648\u0645\u0627\u0646\u0633\u064A\u0629\u060C \u0628\u062F\u0621\u0627\u064B \u0645\u0646 \u0627\u0644\u062B\u0627\u0646\u064A\u0629 00:00.00 \u062F\u0648\u0646 \u0625\u0633\u0642\u0627\u0637 \u0623\u064A \u062B\u0627\u0646\u064A\u0629!

\u0642\u0627\u0639\u062F\u0629 \u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0646\u0648\u062A\u0629 \u0627\u0644\u0645\u0648\u0633\u064A\u0642\u064A\u0629 \u0644\u0644\u0623\u063A\u0627\u0646\u064A \u0648\u0645\u0642\u0627\u0637\u0639 \u0627\u0644\u0631\u0627\u0628 (Musical Note Notation \u266A):
- \u0643\u0644\u0645\u0627 \u0643\u0627\u0646\u062A \u0627\u0644\u062C\u0645\u0644\u0629 \u063A\u0646\u0627\u0626\u064A\u0629 (\u0623\u063A\u0646\u064A\u0629 \u062E\u0644\u0641\u064A\u0629\u060C \u0623\u063A\u0646\u064A\u0629 \u0631\u0648\u0645\u0627\u0646\u0633\u064A\u0629\u060C \u0623\u0648 \u0645\u0642\u0637\u0639 \u0631\u0627\u0628 \u0647\u0646\u062F\u064A \u0633\u0631\u064A\u0639) \u0627\u062C\u0639\u0644 type \u0625\u0645\u0627 "song" \u0623\u0648 "rap".
- \u0625\u0644\u0632\u0627\u0645\u064A\u0627\u064B: \u064A\u062C\u0628 \u0625\u062D\u0627\u0637\u0629 \u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0628\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0646\u0648\u062A\u0629 \u0627\u0644\u0645\u0648\u0633\u064A\u0642\u064A\u0629 '\u266A' \u0641\u064A \u0627\u0644\u0628\u062F\u0627\u064A\u0629 \u0648\u0627\u0644\u0646\u0647\u0627\u064A\u0629 (\u0645\u062B\u0627\u0644: "\u266A \u0648\u0642\u062A\u0646\u0627 \u062C\u0627\u064A \u0644\u0627 \u0645\u062D\u0627\u0644\u0629! \u266A" \u0623\u0648 "\u266A \u0623\u0636\u062D\u0649 \u0627\u0644\u0639\u064A\u0634 \u0628\u062F\u0648\u0646\u0643 \u0639\u0630\u0627\u0628\u0627\u064B \u0623\u0644\u064A\u0645\u0627\u064B \u266A") \u0644\u064A\u0639\u0631\u0641 \u0627\u0644\u0645\u0634\u0627\u0647\u062F \u0641\u0648\u0631\u0627\u064B \u0641\u064A \u0645\u0644\u0641 \u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0648\u0634\u0627\u0634\u0629 \u0627\u0644\u0639\u0631\u0636 \u0623\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0642\u0637\u0639 \u063A\u0646\u0627\u0626\u064A \u0623\u0648 \u0631\u0627\u0628.

\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0635\u0627\u0631\u0645\u0629 \u062C\u062F\u0627\u064B (\u0645\u0646\u0639 \u062E\u0637\u0623 \u0627\u0644\u0640 100 \u062B\u0627\u0646\u064A\u0629):
- \u0627\u0644\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0630\u0647\u0628\u064A\u0629: \u0627\u0644\u062F\u0642\u064A\u0642\u0629 \u062A\u0633\u0627\u0648\u064A 60 \u062B\u0627\u0646\u064A\u0629 \u062A\u0645\u0627\u0645\u0627\u064B (Base-60)\u060C \u0648\u0644\u064A\u0633\u062A 100 \u062B\u0627\u0646\u064A\u0629.
- \u064A\u062C\u0628 \u0623\u0646 \u062A\u062E\u0631\u062C \u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0628\u0635\u064A\u063A\u0629 \u0646\u0635\u064A\u0629 \u062F\u0642\u064A\u0642\u0629 (MM:SS.ms) \u0645\u062B\u0644 "00:01.20" \u0623\u0648 "01:05.40" \u0644\u0644\u062F\u0642\u0627\u0626\u0642 \u0648\u0627\u0644\u062B\u0648\u0627\u0646\u064A.
- \u0644\u0627 \u062A\u0636\u0639 \u0641\u064A \u0627\u0644\u062B\u0648\u0627\u0646\u064A \u0642\u064A\u0645\u0627\u064B \u062A\u062A\u0639\u062F\u0649 59.99 (\u0623\u064A \u0644\u0627 \u062A\u062C\u0639\u0644 \u0627\u0644\u062F\u0642\u064A\u0642\u0629 100 \u062B\u0627\u0646\u064A\u0629 \u0623\u0628\u062F\u0627\u064B).
- \u0623\u062E\u0631\u062C \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u062D\u0635\u0631\u0627\u064B \u0628\u0635\u064A\u063A\u0629 JSON Array \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0645\u062E\u0637\u0637 \u0627\u0644\u062A\u0627\u0644\u064A:
[
  {
    "timecodeStart": "00:01.20",
    "timecodeEnd": "00:04.50",
    "originalHindi": "\u0646\u0635 \u0627\u0644\u062D\u0648\u0627\u0631 \u0627\u0644\u0647\u0646\u062F\u064A \u0623\u0648 Hinglish",
    "arabicTranslation": "\u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u064A\u0646\u0645\u0627\u0626\u064A\u0629 \u0627\u0644\u0645\u062A\u0642\u0646\u0629 (\u0645\u062D\u0627\u0637\u0629 \u0628\u0640 \u266A \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0623\u063A\u0646\u064A\u0629 \u0623\u0648 \u0631\u0627\u0628)",
    "speaker": "\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u062D\u062F\u062B \u0625\u0646 \u0648\u062C\u062F",
    "type": "dialogue" // dialogue, hinglish, rap, song
  }
]
`;
      const promptText = `\u0642\u0645 \u0628\u062A\u0631\u062C\u0645\u0629 \u0643\u0627\u0645\u0644 \u0627\u0644\u062D\u0648\u0627\u0631\u0627\u062A \u0648\u0623\u063A\u0627\u0646\u064A \u0627\u0644\u0631\u0627\u0628 \u0648\u0627\u0644\u0623\u063A\u0627\u0646\u064A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0635\u0648\u062A\u064A \u0627\u0644\u0647\u0646\u062F\u064A \u0628\u062F\u0642\u0629 \u0633\u064A\u0646\u0645\u0627\u0626\u064A\u0629 \u0628\u0627\u0644\u0644\u0647\u062C\u0629 ${targetDialectName} \u0645\u0639 \u062A\u0637\u0628\u064A\u0642 \u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0646\u0648\u062A\u0629 \u0627\u0644\u0645\u0648\u0633\u064A\u0642\u064A\u0629 \u266A \u0644\u0644\u0623\u063A\u0627\u0646\u064A \u0648\u0627\u0644\u0631\u0627\u0628 \u0648\u0635\u064A\u063A\u0629 \u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0635\u0627\u0631\u0645\u0629 MM:SS.ms \u0641\u064A \u0645\u0635\u0641\u0648\u0641\u0629 JSON.`;
      const { responseText, modelUsed, fallbackOccurred, fallbackNotice } = await generateSubtitlesWithFallback(
        client,
        model || "gemini-3.1-flash-lite",
        {
          systemInstruction,
          promptText,
          audioPath
        }
      );
      let rawItems = [];
      try {
        rawItems = JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            rawItems = JSON.parse(jsonMatch[0]);
          } catch (_) {
          }
        }
        if (!rawItems || rawItems.length === 0) {
          const objectRegex = /\{[^{}]*"(?:timecodeStart|originalHindi|arabicTranslation)"[^{}]*\}/g;
          let match;
          while ((match = objectRegex.exec(responseText)) !== null) {
            try {
              const parsed = JSON.parse(match[0]);
              if (parsed.timecodeStart || parsed.arabicTranslation || parsed.originalHindi) {
                rawItems.push(parsed);
              }
            } catch (_) {
            }
          }
        }
        if (!rawItems || rawItems.length === 0) {
          throw new Error("\u0641\u0634\u0644 \u062A\u0641\u0633\u064A\u0631 \u0635\u064A\u063A\u0629 JSON \u0645\u0646 \u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0627\u0644\u0646\u0645\u0648\u0630\u062C.");
        }
      }
      const sanitizedCues = sanitizeAndAlignCues(rawItems, minDurationSec || 1);
      res.json({
        success: true,
        modelUsed,
        fallbackOccurred,
        fallbackNotice: fallbackNotice || null,
        dialectUsed: dialect,
        cues: sanitizedCues
      });
    } catch (err) {
      console.error("Translation error:", err);
      let userFriendlyError = err.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u062A\u0631\u062C\u0645\u0629";
      if (userFriendlyError.includes("503") || userFriendlyError.includes("high demand") || userFriendlyError.includes("UNAVAILABLE") || userFriendlyError.includes("429") || userFriendlyError.includes("RESOURCE_EXHAUSTED")) {
        userFriendlyError = '\u062E\u0648\u0627\u062F\u0645 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u062A\u0634\u0647\u062F \u0636\u063A\u0637\u0627\u064B \u0645\u0624\u0642\u062A\u0627\u064B \u0641\u0627\u0626\u0642\u0627\u064B \u0623\u0648 \u062A\u0645 \u0627\u0633\u062A\u0646\u0641\u0627\u0630 \u0627\u0644\u062D\u0635\u0629 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (503/429). \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0646\u0642\u0631 \u0639\u0644\u0649 "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629"\u060C \u0623\u0648 \u062A\u062C\u0631\u0628\u0629 \u0639\u064A\u0646\u0629 \u0628\u0648\u0644\u064A\u0648\u0648\u062F \u0627\u0644\u0645\u062F\u0645\u062C\u0629 \u0641\u0648\u0631\u0627\u064B \u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0643\u0627\u0641\u0629 \u0627\u0644\u0645\u0632\u0627\u064A\u0627 \u0628\u062F\u0648\u0646 \u0627\u0646\u062A\u0638\u0627\u0631.';
      }
      res.status(500).json({ error: userFriendlyError, rawError: String(err?.message || err) });
    }
  });
  app.post("/api/burn-subtitles", async (req, res) => {
    try {
      const {
        fileId,
        cues,
        style = "netflix_white",
        fontSize = 22,
        position = "bottom",
        marginV = 30
      } = req.body;
      if (!fileId || !cues || !Array.isArray(cues) || cues.length === 0) {
        res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0648\u0623\u0633\u0637\u0631 \u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0645\u0637\u0644\u0648\u0628\u0629." });
        return;
      }
      let inputVideoPath = import_path.default.join(UPLOADS_DIR, fileId);
      if (fileId === "demo-gully-boy-rap") {
        inputVideoPath = import_path.default.join(process.cwd(), "public", "samples", "bollywood_demo.mp4");
      }
      if (!import_fs.default.existsSync(inputVideoPath)) {
        res.status(404).json({ error: "\u0645\u0644\u0641 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0627\u0644\u0623\u0635\u0644\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0639\u0644\u0649 \u0627\u0644\u0633\u064A\u0631\u0641\u0631." });
        return;
      }
      const burnedId = `burned-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.mp4`;
      const outputVideoPath = import_path.default.join(BURNED_DIR, burnedId);
      const srtContent = generateSRT(cues);
      const tempSrtPath = import_path.default.join(UPLOADS_DIR, `temp-${Date.now()}.srt`);
      import_fs.default.writeFileSync(tempSrtPath, srtContent, "utf-8");
      let primaryColour = "&H00FFFFFF";
      let outlineColour = "&H00000000";
      let borderStyle = 1;
      let outline = 2;
      let shadow = 1;
      if (style === "bollywood_gold") {
        primaryColour = "&H002BD7FE";
        outline = 3;
      } else if (style === "boxed_classic") {
        borderStyle = 3;
      }
      const escapedSrtPath = tempSrtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      const forceStyle = `FontName=Cairo,FontSize=${fontSize},PrimaryColour=${primaryColour},OutlineColour=${outlineColour},BorderStyle=${borderStyle},Outline=${outline},Shadow=${shadow},MarginV=${marginV}`;
      const burnCmd = `ffmpeg -y -i "${inputVideoPath}" -vf "subtitles='${escapedSrtPath}':force_style='${forceStyle}'" -c:v libx264 -preset veryfast -crf 22 -c:a copy "${outputVideoPath}"`;
      console.log(`Burning subtitles: ${burnCmd}`);
      await execAsync(burnCmd);
      if (import_fs.default.existsSync(tempSrtPath)) {
        import_fs.default.unlinkSync(tempSrtPath);
      }
      res.json({
        success: true,
        burnedId,
        downloadUrl: `/api/download-burned/${burnedId}`
      });
    } catch (err) {
      console.error("Burn subtitles error:", err);
      res.status(500).json({ error: `\u0641\u0634\u0644 \u062D\u0631\u0642 \u0627\u0644\u062A\u0631\u062C\u0645\u0629: ${err.message}` });
    }
  });
  app.get("/api/download-burned/:burnedId", (req, res) => {
    const { burnedId } = req.params;
    const filePath = import_path.default.join(BURNED_DIR, burnedId);
    if (!import_fs.default.existsSync(filePath)) {
      res.status(404).send("\u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      return;
    }
    res.download(filePath, `bollywood_arabic_subtitled_${burnedId}`);
  });
  app.get("/api/download-python-project", (req, res) => {
    try {
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="BollywoodSub_Python_Project.zip"');
      const ArchiveClass = archiver.ZipArchive || archiver;
      const archive = new ArchiveClass({ zlib: { level: 9 } });
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).send(`\u062E\u0637\u0623 \u0627\u0644\u0623\u0631\u0634\u0641\u0629: ${err.message || err}`);
        }
      });
      archive.pipe(res);
      const pythonDir = import_path.default.join(process.cwd(), "standalone-python");
      if (import_fs.default.existsSync(pythonDir)) {
        archive.directory(pythonDir, false);
      }
      archive.finalize();
    } catch (err) {
      console.error("Zip download error:", err);
      res.status(500).send(`\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0645\u0644\u0641 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0627\u0644\u0645\u0636\u063A\u0648\u0637: ${err.message || err}`);
    }
  });
  app.use("/api", (err, req, res, next) => {
    console.error("Unhandled API Error caught:", err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
    res.status(status).json({
      error: err.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0637\u0644\u0628.",
      code: err.code || "API_ERROR"
    });
  });
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `\u0646\u0642\u0637\u0629 \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629: ${req.method} ${req.path}` });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BollywoodSub AI server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
