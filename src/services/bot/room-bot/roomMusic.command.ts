
import axios from "axios";
import { downloadAudioToLocal } from "../../../utils/audioCache";


export type RoomMusicCommandResult = {
  handled: boolean;
  success?: boolean;
  text?: string;
  meta?: Record<string, any>;
};

type ParsedPlayCommand = {
  matched: boolean;
  query: string;
  lang: "ar" | "en";
};

type YoutubeFirstResult = {
  ok: boolean;
  title?: string;
  videoId?: string;
  youtubeUrl?: string;
  channelTitle?: string;
  thumbnail?: string;
  error?: string;
};

function normalizeText(value?: string) {
  return String(value || "").trim();
}

export function parsePlayCommand(raw?: string): ParsedPlayCommand {
  const text = normalizeText(raw);
  const lower = text.toLowerCase();

  if (lower.startsWith("play ")) {
    return {
      matched: true,
      query: text.slice("play ".length).trim(),
      lang: "en",
    };
  }

  if (text.startsWith("تشغيل ")) {
    return {
      matched: true,
      query: text.replace(/^!تشغيل\s+/, "").trim(),
      lang: "ar",
    };
  }

  return {
    matched: false,
    query: "",
    lang: "ar",
  };
}

export async function searchYoutubeFirstResult(query: string): Promise<YoutubeFirstResult> {
  try {
    const apiKey = normalizeText(process.env.YOUTUBE_DATA_API_KEY);

    if (!apiKey) {
      return { ok: false, error: "YOUTUBE_DATA_API_KEY is missing" };
    }

    const q = normalizeText(query);
    if (!q) {
      return { ok: false, error: "Empty search query" };
    }

    const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: apiKey,
        part: "snippet",
        q,
        type: "video",
        maxResults: 1,
        safeSearch: "moderate",
        videoEmbeddable: true,
      },
      timeout: 15000,
    });

    const item = response.data?.items?.[0];

    if (!item?.id?.videoId) {
      return { ok: false, error: "No YouTube results found" };
    }

    const videoId = String(item.id.videoId);
    const snippet = item.snippet || {};

    return {
      ok: true,
      title: String(snippet.title || ""),
      videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      channelTitle: String(snippet.channelTitle || ""),
      thumbnail:
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        "",
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.response?.data?.error?.message || error?.message || "YouTube search failed",
    };
  }
}

export async function executeRoomMusicCommand(raw?: string): Promise<RoomMusicCommandResult> {
  const parsed = parsePlayCommand(raw);

  if (!parsed.matched) {
    return { handled: false };
  }

  if (!parsed.query) {
    return {
      handled: true,
      success: false,
      text: parsed.lang === "ar" ? "اكتب اسم الأغنية بعد الأمر" : "Write the song name after the command",
    };
  }

  const yt = await searchYoutubeFirstResult(parsed.query);

  if (!yt.ok || !yt.youtubeUrl) {
    return {
      handled: true,
      success: false,
      text:
        parsed.lang === "ar"
          ? `تعذر العثور على الأغنية: ${yt.error || "حدث خطأ"}`
          : `Failed to find song: ${yt.error || "Unknown error"}`,
      meta: {
        action: "music_search_failed",
        query: parsed.query,
      },
    };
  }

  try {
    const saved = await downloadAudioToLocal({
      sourceUrl: yt.youtubeUrl,
      filename: `${yt.title || parsed.query}.mp3`,
    });

    return {
      handled: true,
      success: true,
      text:
        parsed.lang === "ar"
          ? `🎵 ${yt.title}\n🔗 ${saved.publicUrl}`
          : `🎵 ${yt.title}\n🔗 ${saved.publicUrl}`,
      meta: {
        action: "music_mp3_ready",
        query: parsed.query,
        youtubeTitle: yt.title,
        youtubeUrl: yt.youtubeUrl,
        thumbnail: yt.thumbnail,
        channelTitle: yt.channelTitle,
        mp3Url: saved.publicUrl,
        filename: saved.filename,
        expiresInMs: saved.expiresInMs,
        provider: "temporary_local_cache",
      },
    };
  } catch (error: any) {
    return {
      handled: true,
      success: false,
      text:
        parsed.lang === "ar"
          ? `تم العثور على: ${yt.title}\nلكن فشل تجهيز ملف الصوت`
          : `Found: ${yt.title}\nBut failed to prepare the audio file`,
      meta: {
        action: "music_prepare_failed",
        query: parsed.query,
        youtubeTitle: yt.title,
        youtubeUrl: yt.youtubeUrl,
        error: error?.message || "unknown_error",
      },
    };
  }
}