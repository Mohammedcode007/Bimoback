
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const AUDIO_TEMP_DIR = path.join(process.cwd(), "public", "uploads", "audio-temp");
const AUDIO_TTL_MS = 60 * 60 * 1000; // 60 دقيقة

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildBaseUrl() {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;

  console.log("🌐 buildBaseUrl raw:", raw);

  return raw.replace(/\/+$/, "");
}

export async function downloadAudioToLocal(params: {
  sourceUrl: string;
  filename?: string;
}) {
  const { sourceUrl } = params;

  if (!sourceUrl) {
    throw new Error("sourceUrl is required");
  }

  ensureDirExists(AUDIO_TEMP_DIR);

  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outputTemplate = path.join(AUDIO_TEMP_DIR, `${fileId}.%(ext)s`);

  const cookiesPath =
    process.env.YT_DLP_COOKIES_PATH ||
    path.join(process.cwd(), "cookies.txt");

  const env = {
    ...process.env,
    PATH: `/root/.deno/bin:${process.env.PATH || ""}`,
  };

  console.log("🎧 yt-dlp sourceUrl:", sourceUrl);
  console.log("🎧 yt-dlp outputTemplate:", outputTemplate);
  console.log("🍪 yt-dlp cookiesPath:", cookiesPath);
  console.log("🧠 yt-dlp PATH:", env.PATH);

  try {
    const { stdout, stderr } = await execFileAsync(
      "yt-dlp",
      [
        "--cookies",
        cookiesPath,
        "--js-runtimes",
        "deno",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--no-playlist",
        "--restrict-filenames",
        "-o",
        outputTemplate,
        sourceUrl,
      ],
      { env }
    );

    if (stdout) console.log("🎧 yt-dlp stdout:", stdout);
    if (stderr) console.log("🎧 yt-dlp stderr:", stderr);
  } catch (error: any) {
    console.error("❌ yt-dlp failed:", error?.message || error);
    console.error("❌ yt-dlp stderr:", error?.stderr || "");
    throw new Error(`yt-dlp failed: ${error?.stderr || error?.message || "unknown error"}`);
  }

  const files = fs.readdirSync(AUDIO_TEMP_DIR);
  const matched = files.find((f) => f.startsWith(fileId) && f.endsWith(".mp3"));

  if (!matched) {
    throw new Error("Downloaded mp3 file not found");
  }

  const absolutePath = path.join(AUDIO_TEMP_DIR, matched);
  const publicUrl = `${buildBaseUrl()}/uploads/audio-temp/${matched}`;

  console.log("🎧 FINAL publicUrl:", publicUrl);

  scheduleDeleteFile(absolutePath, AUDIO_TTL_MS);

  return {
    filename: matched,
    absolutePath,
    publicUrl,
    expiresInMs: AUDIO_TTL_MS,
  };
}

export function scheduleDeleteFile(filePath: string, delayMs: number) {
  setTimeout(() => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("❌ Failed to delete temp audio:", filePath, err.message);
        return;
      }
      console.log("🗑️ Temp audio deleted:", filePath);
    });
  }, delayMs);
}

export function cleanupExpiredAudioFiles() {
  ensureDirExists(AUDIO_TEMP_DIR);

  const now = Date.now();
  const files = fs.readdirSync(AUDIO_TEMP_DIR);

  for (const file of files) {
    try {
      const filePath = path.join(AUDIO_TEMP_DIR, file);
      const stat = fs.statSync(filePath);

      if (now - stat.mtimeMs >= AUDIO_TTL_MS) {
        fs.unlinkSync(filePath);
        console.log("🧹 Removed expired audio:", file);
      }
    } catch (error: any) {
      console.error("❌ Cleanup error for audio file:", file, error?.message || error);
    }
  }
}