// src/services/bot/room-bot/roomGlobalSong.command.ts

import axios from "axios";
import { downloadAudioToLocal } from "../../../utils/audioCache";

export type GlobalSongCommandResult = {
  handled: boolean;
  success?: boolean;
  action?: "global_song_ready" | "global_song_love";
  text?: string;
  meta?: Record<string, any>;
};

type ParsedGlobalSongCommand = {
  matched: boolean;
  query: string;
  lang: "ar" | "en";
};

type ParsedGlobalSongLoveCommand = {
  matched: boolean;
  songCode: string;
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

function cleanFilename(value: string) {
  return String(value || "audio")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function createSongCode(length = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";

  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }

  return out;
}

/**
 * أوامر تشغيل أغنية في كل الغرف:
 * .so song name
 * .sh song name
 */
export function parseGlobalSongCommand(raw?: string): ParsedGlobalSongCommand {
  const text = normalizeText(raw);
  const lower = text.toLowerCase();

  if (lower.startsWith(".so ")) {
    return {
      matched: true,
      query: text.slice(".so ".length).trim(),
      lang: "en",
    };
  }

  if (lower.startsWith(".sh ")) {
    return {
      matched: true,
      query: text.slice(".sh ".length).trim(),
      lang: "en",
    };
  }

  return {
    matched: false,
    query: "",
    lang: "ar",
  };
}

/**
 * أمر love:
 * love@A7K9P
 */
export function parseGlobalSongLoveCommand(
  raw?: string
): ParsedGlobalSongLoveCommand {
  const text = normalizeText(raw);
  const lower = text.toLowerCase();

  if (!lower.startsWith("love@")) {
    return {
      matched: false,
      songCode: "",
    };
  }

  const code = text.slice("love@".length).trim().toUpperCase();

  return {
    matched: true,
    songCode: code,
  };
}

export async function searchYoutubeFirstGlobalSong(
  query: string
): Promise<YoutubeFirstResult> {
  try {
    const apiKey = normalizeText(process.env.YOUTUBE_DATA_API_KEY);

    if (!apiKey) {
      return {
        ok: false,
        error: "YOUTUBE_DATA_API_KEY is missing",
      };
    }

    const q = normalizeText(query);

    if (!q) {
      return {
        ok: false,
        error: "Empty search query",
      };
    }

    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
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
      }
    );

    const item = response.data?.items?.[0];

    if (!item?.id?.videoId) {
      return {
        ok: false,
        error: "No YouTube results found",
      };
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
      error:
        error?.response?.data?.error?.message ||
        error?.message ||
        "YouTube search failed",
    };
  }
}

/**
 * هذه الدالة لا ترسل الرسالة بنفسها.
 * فقط تجهز الأغنية وترجع meta.
 * الإرسال لكل الغرف يتم من room.service.ts
 */
export async function executeGlobalSongCommand(
  raw?: string
): Promise<GlobalSongCommandResult> {
  const parsed = parseGlobalSongCommand(raw);

  if (!parsed.matched) {
    return {
      handled: false,
    };
  }

  if (!parsed.query) {
    return {
      handled: true,
      success: false,
      text: "اكتب اسم الأغنية بعد الأمر. مثال: .so amr diab",
      meta: {
        action: "global_song_empty_query",
      },
    };
  }

  const yt = await searchYoutubeFirstGlobalSong(parsed.query);

  if (!yt.ok || !yt.youtubeUrl) {
    return {
      handled: true,
      success: false,
      text: `تعذر العثور على الأغنية: ${yt.error || "حدث خطأ"}`,
      meta: {
        action: "global_song_search_failed",
        query: parsed.query,
      },
    };
  }

  try {
    const safeTitle = cleanFilename(yt.title || parsed.query || "audio");

    const saved = await downloadAudioToLocal({
      sourceUrl: yt.youtubeUrl,
      filename: `${safeTitle}.mp3`,
    });

    const songCode = createSongCode(5);

    return {
      handled: true,
      success: true,
      action: "global_song_ready",
      text: `🎵 ${yt.title}\n🆔 ${songCode}\n🔗 ${saved.publicUrl}`,
      meta: {
        action: "global_song_ready",

        songCode,

        query: parsed.query,

        youtubeTitle: yt.title,
        youtubeUrl: yt.youtubeUrl,
        videoId: yt.videoId,

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
      text: `تم العثور على: ${yt.title}\nلكن فشل تجهيز ملف الصوت`,
      meta: {
        action: "global_song_prepare_failed",
        query: parsed.query,
        youtubeTitle: yt.title,
        youtubeUrl: yt.youtubeUrl,
        error: error?.message || "unknown_error",
      },
    };
  }
}