// src/services/roomGames/fakePointsRankCommand.service.ts

import {
  getFakePointPlayer,
  getFakePointsLeaderboard,
} from "../gamePoints/fakePoints.service";

type FakePointsRankCommandType = "my_points" | "top" | "next";

type ExecuteFakePointsRankInput = {
  roomId: string;
  userId: string;
  username: string;
  content: string;
};

type ExecuteFakePointsRankResult = {
  handled: boolean;
  success?: boolean;
  text?: string;
  reason?: string;
  meta?: Record<string, any>;
};

type RankSession = {
  roomId: string;
  userId: string;
  page: number;
  expiresAt: number;
};

const PAGE_SIZE = 10;
const SESSION_TTL_MS = 60 * 1000;

const rankSessions = new Map<string, RankSession>();

function normalizeText(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function detectLang(text: string): "ar" | "en" {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

function getSessionKey(roomId: string, userId: string) {
  return `${roomId}:${userId}:fake_points_rank`;
}

function parseCommand(content: string): {
  matched: boolean;
  type?: FakePointsRankCommandType;
} {
  const text = normalizeText(content).toLowerCase();

  if (/^(نقاطي|نقطي|رصيدي|my\s*points|points)$/i.test(text)) {
    return {
      matched: true,
      type: "my_points",
    };
  }

if (/^(\.top|ترتيب_النقاط|نقاط_توب)$/i.test(text)) {
  return {
    matched: true,
    type: "top",
  };
}
  if (/^(\.nx|nx|next|التالي)$/i.test(text)) {
    return {
      matched: true,
      type: "next",
    };
  }

  return {
    matched: false,
  };
}

function getRankIcon(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}.`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("en-US");
}

async function buildMyPoints(params: {
  roomId: string;
  userId: string;
  username: string;
  lang: "ar" | "en";
}) {
  const { roomId, userId, username, lang } = params;

  const player = await getFakePointPlayer({
    roomId,
    userId,
    username,
  });

  const points = Number(player?.points || 0);

  if (lang === "ar") {
    return `💰 ${username}\nنقاطك الحالية: ${formatNumber(points)} نقطة`;
  }

  return `💰 ${username}\nYour current points: ${formatNumber(points)} pts`;
}

async function buildTopPage(params: {
  roomId: string;
  page: number;
  lang: "ar" | "en";
}) {
  const { roomId, page, lang } = params;

  const safePage = Math.max(1, Number(page) || 1);
  const limit = safePage * PAGE_SIZE;

  /**
   * ملاحظة:
   * لو getFakePointsLeaderboard عندك لا يدعم skip،
   * نجلب حتى الصفحة المطلوبة ثم نعمل slice هنا.
   */
  const all = await getFakePointsLeaderboard({
    roomId,
    limit,
  });

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageItems = Array.isArray(all)
    ? all.slice(startIndex, startIndex + PAGE_SIZE)
    : [];

  if (!pageItems.length) {
    if (lang === "ar") {
      return `📋 لا يوجد المزيد من اللاعبين في الترتيب.\nالصفحة: ${safePage}`;
    }

    return `📋 No more players in the ranking.\nPage: ${safePage}`;
  }

  const lines = pageItems.map((player: any, index: number) => {
    const globalIndex = startIndex + index;
    const icon = getRankIcon(globalIndex);
    const username = String(player?.username || "User");
    const points = formatNumber(Number(player?.points || 0));

    return `${icon} ${username} — ${points} ${lang === "ar" ? "نقطة" : "pts"}`;
  });

  if (lang === "ar") {
    return `📋 ترتيب النقاط الوهمية\nالصفحة ${safePage}\n\n${lines.join("\n")}\n\nاكتب .nx للصفحة التالية خلال دقيقة.`;
  }

  return `📋 Fake Points Ranking\nPage ${safePage}\n\n${lines.join("\n")}\n\nSend .nx for the next page within 1 minute.`;
}

function getNextPageForUser(roomId: string, userId: string) {
  const key = getSessionKey(roomId, userId);
  const existing = rankSessions.get(key);
  const now = Date.now();

  /**
   * لو لا توجد جلسة أو انتهت الدقيقة:
   * يبدأ من الصفحة الأولى.
   */
  if (!existing || existing.expiresAt <= now) {
    const session: RankSession = {
      roomId,
      userId,
      page: 1,
      expiresAt: now + SESSION_TTL_MS,
    };

    rankSessions.set(key, session);
    return 1;
  }

  /**
   * نفس المستخدم خلال دقيقة:
   * يذهب للصفحة التالية.
   */
  const nextPage = existing.page + 1;

  rankSessions.set(key, {
    ...existing,
    page: nextPage,
    expiresAt: now + SESSION_TTL_MS,
  });

  return nextPage;
}

function resetTopSession(roomId: string, userId: string) {
  const key = getSessionKey(roomId, userId);

  rankSessions.set(key, {
    roomId,
    userId,
    page: 1,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export async function executeFakePointsRankCommand(
  input: ExecuteFakePointsRankInput
): Promise<ExecuteFakePointsRankResult> {
  const roomId = String(input.roomId || "").trim();
  const userId = String(input.userId || "").trim();
  const username = String(input.username || "User").trim();
  const content = normalizeText(input.content);
  const lang = detectLang(content);

  if (!roomId || !userId || !content) {
    return {
      handled: false,
    };
  }

  const parsed = parseCommand(content);

  if (!parsed.matched || !parsed.type) {
    return {
      handled: false,
    };
  }

  try {
    if (parsed.type === "my_points") {
      const text = await buildMyPoints({
        roomId,
        userId,
        username,
        lang,
      });

      return {
        handled: true,
        success: true,
        text,
        meta: {
          command: "my_points",
        },
      };
    }

    if (parsed.type === "top") {
      resetTopSession(roomId, userId);

      const text = await buildTopPage({
        roomId,
        page: 1,
        lang,
      });

      return {
        handled: true,
        success: true,
        text,
        meta: {
          command: "top",
          page: 1,
          pageSize: PAGE_SIZE,
        },
      };
    }

    if (parsed.type === "next") {
      const page = getNextPageForUser(roomId, userId);

      const text = await buildTopPage({
        roomId,
        page,
        lang,
      });

      return {
        handled: true,
        success: true,
        text,
        meta: {
          command: "next",
          page,
          pageSize: PAGE_SIZE,
        },
      };
    }

    return {
      handled: false,
    };
  } catch (error: any) {
    console.log("❌ fake points rank command error:", error);

    return {
      handled: true,
      success: false,
      reason: "FAKE_POINTS_RANK_ERROR",
      text:
        lang === "ar"
          ? "حدث خطأ أثناء جلب ترتيب النقاط."
          : "Failed to load points ranking.",
      meta: {
        command: parsed.type,
        error: error?.message || String(error),
      },
    };
  }
}