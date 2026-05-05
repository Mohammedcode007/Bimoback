
// import axios from "axios";
// import { downloadAudioToLocal } from "../../../utils/audioCache";


// export type RoomMusicCommandResult = {
//   handled: boolean;
//   success?: boolean;
//   text?: string;
//   meta?: Record<string, any>;
// };

// type ParsedPlayCommand = {
//   matched: boolean;
//   query: string;
//   lang: "ar" | "en";
// };

// type YoutubeFirstResult = {
//   ok: boolean;
//   title?: string;
//   videoId?: string;
//   youtubeUrl?: string;
//   channelTitle?: string;
//   thumbnail?: string;
//   error?: string;
// };

// function normalizeText(value?: string) {
//   return String(value || "").trim();
// }

// export function parsePlayCommand(raw?: string): ParsedPlayCommand {
//   const text = normalizeText(raw);
//   const lower = text.toLowerCase();

//   if (lower.startsWith("play ")) {
//     return {
//       matched: true,
//       query: text.slice("play ".length).trim(),
//       lang: "en",
//     };
//   }

//   if (text.startsWith("تشغيل ")) {
//     return {
//       matched: true,
//       query: text.replace(/^!تشغيل\s+/, "").trim(),
//       lang: "ar",
//     };
//   }

//   return {
//     matched: false,
//     query: "",
//     lang: "ar",
//   };
// }

// export async function searchYoutubeFirstResult(query: string): Promise<YoutubeFirstResult> {
//   try {
//     const apiKey = normalizeText(process.env.YOUTUBE_DATA_API_KEY);

//     if (!apiKey) {
//       return { ok: false, error: "YOUTUBE_DATA_API_KEY is missing" };
//     }

//     const q = normalizeText(query);
//     if (!q) {
//       return { ok: false, error: "Empty search query" };
//     }

//     const response = await axios.get("https://www.googleapis.com/youtube/v3/search", {
//       params: {
//         key: apiKey,
//         part: "snippet",
//         q,
//         type: "video",
//         maxResults: 1,
//         safeSearch: "moderate",
//         videoEmbeddable: true,
//       },
//       timeout: 15000,
//     });

//     const item = response.data?.items?.[0];

//     if (!item?.id?.videoId) {
//       return { ok: false, error: "No YouTube results found" };
//     }

//     const videoId = String(item.id.videoId);
//     const snippet = item.snippet || {};

//     return {
//       ok: true,
//       title: String(snippet.title || ""),
//       videoId,
//       youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
//       channelTitle: String(snippet.channelTitle || ""),
//       thumbnail:
//         snippet?.thumbnails?.high?.url ||
//         snippet?.thumbnails?.medium?.url ||
//         snippet?.thumbnails?.default?.url ||
//         "",
//     };
//   } catch (error: any) {
//     return {
//       ok: false,
//       error: error?.response?.data?.error?.message || error?.message || "YouTube search failed",
//     };
//   }
// }

// export async function executeRoomMusicCommand(raw?: string): Promise<RoomMusicCommandResult> {
//   const parsed = parsePlayCommand(raw);

//   if (!parsed.matched) {
//     return { handled: false };
//   }

//   if (!parsed.query) {
//     return {
//       handled: true,
//       success: false,
//       text: parsed.lang === "ar" ? "اكتب اسم الأغنية بعد الأمر" : "Write the song name after the command",
//     };
//   }

//   const yt = await searchYoutubeFirstResult(parsed.query);

//   if (!yt.ok || !yt.youtubeUrl) {
//     return {
//       handled: true,
//       success: false,
//       text:
//         parsed.lang === "ar"
//           ? `تعذر العثور على الأغنية: ${yt.error || "حدث خطأ"}`
//           : `Failed to find song: ${yt.error || "Unknown error"}`,
//       meta: {
//         action: "music_search_failed",
//         query: parsed.query,
//       },
//     };
//   }

//   try {
//     const saved = await downloadAudioToLocal({
//       sourceUrl: yt.youtubeUrl,
//       filename: `${yt.title || parsed.query}.mp3`,
//     });

//     return {
//       handled: true,
//       success: true,
//       text:
//         parsed.lang === "ar"
//           ? `🎵 ${yt.title}\n🔗 ${saved.publicUrl}`
//           : `🎵 ${yt.title}\n🔗 ${saved.publicUrl}`,
//       meta: {
//         action: "music_mp3_ready",
//         query: parsed.query,
//         youtubeTitle: yt.title,
//         youtubeUrl: yt.youtubeUrl,
//         thumbnail: yt.thumbnail,
//         channelTitle: yt.channelTitle,
//         mp3Url: saved.publicUrl,
//         filename: saved.filename,
//         expiresInMs: saved.expiresInMs,
//         provider: "temporary_local_cache",
//       },
//     };
//   } catch (error: any) {
//     return {
//       handled: true,
//       success: false,
//       text:
//         parsed.lang === "ar"
//           ? `تم العثور على: ${yt.title}\nلكن فشل تجهيز ملف الصوت`
//           : `Found: ${yt.title}\nBut failed to prepare the audio file`,
//       meta: {
//         action: "music_prepare_failed",
//         query: parsed.query,
//         youtubeTitle: yt.title,
//         youtubeUrl: yt.youtubeUrl,
//         error: error?.message || "unknown_error",
//       },
//     };
//   }
// }

import axios from "axios";
import fs from "fs";
import path from "path";
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

type SongLikeUserStats = {
  userId: string;
  username: string;
  atUsername?: string;
  avatar?: string;

  likesCount: number;

  lastSongTitle?: string;
  lastSongCode?: string;
  lastLikedById?: string;
  lastLikedAt?: string;

  createdAt: string;
  updatedAt: string;
};

type SongLikesStore = {
  version: number;
  updatedAt: string;
  users: Record<string, SongLikeUserStats>;
};

const SONG_LIKES_DIR = path.join(
  process.cwd(),
  "src",
  "public",
  "game-data",
  "song-likes"
);

const SONG_LIKES_FILE = path.join(SONG_LIKES_DIR, "song-likes.json");

function normalizeText(value?: string) {
  return String(value || "").trim();
}

function ensureSongLikesStore() {
  if (!fs.existsSync(SONG_LIKES_DIR)) {
    fs.mkdirSync(SONG_LIKES_DIR, { recursive: true });
  }

  if (!fs.existsSync(SONG_LIKES_FILE)) {
    const initial: SongLikesStore = {
      version: 1,
      updatedAt: new Date().toISOString(),
      users: {},
    };

    fs.writeFileSync(
      SONG_LIKES_FILE,
      JSON.stringify(initial, null, 2),
      "utf8"
    );
  }
}

function readSongLikesStore(): SongLikesStore {
  try {
    ensureSongLikesStore();

    const raw = fs.readFileSync(SONG_LIKES_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");

    return {
      version: Number(parsed?.version || 1),
      updatedAt: String(parsed?.updatedAt || new Date().toISOString()),
      users:
        parsed?.users && typeof parsed.users === "object"
          ? parsed.users
          : {},
    };
  } catch {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      users: {},
    };
  }
}

function writeSongLikesStore(store: SongLikesStore) {
  ensureSongLikesStore();

  const nextStore: SongLikesStore = {
    ...store,
    version: 1,
    updatedAt: new Date().toISOString(),
    users: store.users || {},
  };

  const tmpFile = `${SONG_LIKES_FILE}.tmp`;

  fs.writeFileSync(tmpFile, JSON.stringify(nextStore, null, 2), "utf8");
  fs.renameSync(tmpFile, SONG_LIKES_FILE);
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
      query: text.slice("تشغيل ".length).trim(),
      lang: "ar",
    };
  }

  return {
    matched: false,
    query: "",
    lang: "ar",
  };
}

export function parseSongLikesCommand(raw?: string) {
  const text = normalizeText(raw).toLowerCase();

  return {
    matched:
      text === ".likes" ||
      text === "likes" ||
      text === ".toplikes" ||
      text === "توب لايكات" ||
      text === "اكثر لايكات",
  };
}

export function recordSongLike(input: {
  targetUserId: string;
  targetName?: string;
  targetAtUsername?: string;
  targetAvatar?: string;

  likedById?: string;
  songCode?: string;
  songTitle?: string;
}) {
  const targetUserId = normalizeText(input.targetUserId);

  if (!targetUserId) {
    return {
      success: false,
      reason: "MISSING_TARGET_USER_ID",
    };
  }

  const now = new Date().toISOString();
  const store = readSongLikesStore();

  const current = store.users[targetUserId];

  const next: SongLikeUserStats = {
    userId: targetUserId,

    username:
      normalizeText(input.targetName) ||
      current?.username ||
      "مستخدم",

    atUsername:
      normalizeText(input.targetAtUsername) ||
      current?.atUsername ||
      "",

    avatar:
      normalizeText(input.targetAvatar) ||
      current?.avatar ||
      "",

    likesCount: Number(current?.likesCount || 0) + 1,

    lastSongTitle:
      normalizeText(input.songTitle) ||
      current?.lastSongTitle ||
      "",

    lastSongCode:
      normalizeText(input.songCode).toUpperCase() ||
      current?.lastSongCode ||
      "",

    lastLikedById:
      normalizeText(input.likedById) ||
      current?.lastLikedById ||
      "",

    lastLikedAt: now,

    createdAt: current?.createdAt || now,
    updatedAt: now,
  };

  store.users[targetUserId] = next;
  writeSongLikesStore(store);

  return {
    success: true,
    user: next,
  };
}

export function getTopSongLikes(limit = 10): SongLikeUserStats[] {
  const store = readSongLikesStore();

  return Object.values(store.users || {})
    .filter((u) => u?.userId)
    .sort((a, b) => {
      const likesDiff = Number(b.likesCount || 0) - Number(a.likesCount || 0);

      if (likesDiff !== 0) return likesDiff;

      const bTime = new Date(b.updatedAt || b.lastLikedAt || 0).getTime();
      const aTime = new Date(a.updatedAt || a.lastLikedAt || 0).getTime();

      return bTime - aTime;
    })
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));
}

function buildSongLikesLeaderboardText() {
  const top = getTopSongLikes(10);

  if (!top.length) {
    return "🎵 لا يوجد لايكات على الأغاني حتى الآن.";
  }

  const medals = ["🥇", "🥈", "🥉"];

  const lines = top.map((u, index) => {
    const rank = medals[index] || `${index + 1}.`;
    const name = normalizeText(u.username) || "مستخدم";
    const likes = Number(u.likesCount || 0);

    const lastSong = normalizeText(u.lastSongTitle);

    return lastSong
      ? `${rank} ${name} — ${likes} ❤️\n   آخر أغنية: ${lastSong}`
      : `${rank} ${name} — ${likes} ❤️`;
  });

  return [
    "🎵 أكثر 10 أشخاص حصلوا على لايكات للأغاني",
    "",
    ...lines,
  ].join("\n");
}

export async function executeSongLikesCommand(
  raw?: string
): Promise<RoomMusicCommandResult> {
  const parsed = parseSongLikesCommand(raw);

  if (!parsed.matched) {
    return {
      handled: false,
    };
  }

  const top = getTopSongLikes(10);

  return {
    handled: true,
    success: true,
    text: buildSongLikesLeaderboardText(),
    meta: {
      action: "song_likes_leaderboard",
      top,
    },
  };
}

export async function searchYoutubeFirstResult(
  query: string
): Promise<YoutubeFirstResult> {
  try {
    const apiKey = normalizeText(process.env.YOUTUBE_DATA_API_KEY);

    if (!apiKey) {
      return { ok: false, error: "YOUTUBE_DATA_API_KEY is missing" };
    }

    const q = normalizeText(query);

    if (!q) {
      return { ok: false, error: "Empty search query" };
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
      error:
        error?.response?.data?.error?.message ||
        error?.message ||
        "YouTube search failed",
    };
  }
}

export async function executeRoomMusicCommand(
  raw?: string
): Promise<RoomMusicCommandResult> {
  const likesCommand = await executeSongLikesCommand(raw);

  if (likesCommand.handled) {
    return likesCommand;
  }

  const parsed = parsePlayCommand(raw);

  if (!parsed.matched) {
    return { handled: false };
  }

  if (!parsed.query) {
    return {
      handled: true,
      success: false,
      text:
        parsed.lang === "ar"
          ? "اكتب اسم الأغنية بعد الأمر"
          : "Write the song name after the command",
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
    const safeTitle = String(yt.title || parsed.query || "audio")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    const saved = await downloadAudioToLocal({
      sourceUrl: yt.youtubeUrl,
      filename: `${safeTitle}.mp3`,
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