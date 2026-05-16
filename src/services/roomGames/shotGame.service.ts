// src/services/roomGames/shotGame.service.ts

import mongoose from "mongoose";
import RoomMessage from "../../models/RoomMessage";
import User from "../../models/User";

import {
  addFakePoints,
  neutralFakePoints,
  type FakePointPlayerStats,
} from "../gamePoints/fakePoints.service";

type ShotResult = {
  handled: boolean;
  success?: boolean;
  message?: any;
  messages?: any[];
  text?: string;
  reason?: string;
  meta?: Record<string, any>;
};

type ShotTarget = {
  name: string;
  emoji: string;
  minPoints: number;
  maxPoints: number;
  weight: number;
};

type ShotActionResponse = {
  pointsChange: number;
  balance: number;
  player: FakePointPlayerStats;
  state: string;
  title: string;
  text: string;
  target: ShotTarget;
};

const BOT_NAME = "shot";
const BOT_AT_USERNAME = "shot_bot";

const BOT_AVATAR =
  "https://res.cloudinary.com/dmejkp0m4/image/upload/v1778658281/k7pj9rdqhuipqr0ecu1v.jpg";

/**
 * كولداون داخلي في الذاكرة.
 * النقاط نفسها محفوظة في نفس نظام نقاط لعبة سُكَّر.
 */
const SHOT_COOLDOWN_MS = 5 * 60 * 1000;

const shotCooldowns = new Map<string, number>();
const activeLocks = new Set<string>();

const SHOT_TARGETS: ShotTarget[] = [
  {
    name: "غزالة",
    emoji: "🦌",
    minPoints: 120,
    maxPoints: 650,
    weight: 35,
  },
  {
    name: "أرنب",
    emoji: "🐇",
    minPoints: 60,
    maxPoints: 260,
    weight: 30,
  },
  {
    name: "ثعلب",
    emoji: "🦊",
    minPoints: 180,
    maxPoints: 750,
    weight: 22,
  },
  {
    name: "ذئب",
    emoji: "🐺",
    minPoints: 300,
    maxPoints: 1200,
    weight: 14,
  },
  {
    name: "نمر",
    emoji: "🐅",
    minPoints: 500,
    maxPoints: 1800,
    weight: 9,
  },
  {
    name: "أسد",
    emoji: "🦁",
    minPoints: 700,
    maxPoints: 2500,
    weight: 5,
  },
  {
    name: "دب",
    emoji: "🐻",
    minPoints: 600,
    maxPoints: 2200,
    weight: 6,
  },
  {
    name: "خنزير بري",
    emoji: "🐗",
    minPoints: 250,
    maxPoints: 1000,
    weight: 15,
  },
  {
    name: "جاموس",
    emoji: "🐃",
    minPoints: 450,
    maxPoints: 1600,
    weight: 10,
  },
  {
    name: "جمل بري",
    emoji: "🐪",
    minPoints: 350,
    maxPoints: 1300,
    weight: 12,
  },
  {
    name: "نسر",
    emoji: "🦅",
    minPoints: 200,
    maxPoints: 900,
    weight: 10,
  },
  {
    name: "صقر",
    emoji: "🦅",
    minPoints: 300,
    maxPoints: 1100,
    weight: 8,
  },
  {
    name: "تمساح",
    emoji: "🐊",
    minPoints: 650,
    maxPoints: 2400,
    weight: 5,
  },
  {
    name: "حية سامة",
    emoji: "🐍",
    minPoints: 100,
    maxPoints: 850,
    weight: 18,
  },
  {
    name: "عقرب",
    emoji: "🦂",
    minPoints: 80,
    maxPoints: 500,
    weight: 20,
  },
  {
    name: "وحش الغابة",
    emoji: "👹",
    minPoints: 1200,
    maxPoints: 4500,
    weight: 3,
  },
  {
    name: "ملك الصيد",
    emoji: "👑",
    minPoints: 2000,
    maxPoints: 8000,
    weight: 1,
  },
  {
    name: "كنز الصياد",
    emoji: "💰",
    minPoints: 1500,
    maxPoints: 6000,
    weight: 2,
  },
  {
    name: "الصيد الأسطوري",
    emoji: "🏆",
    minPoints: 3000,
    maxPoints: 10000,
    weight: 1,
  },
];

function normalizeText(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function detectLang(text: string): "ar" | "en" {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }

  return items[items.length - 1];
}

function formatDuration(ms: number, lang: "ar" | "en") {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (lang === "ar") {
    return `${minutes} دقيقة و ${seconds} ثانية`;
  }

  return `${minutes}m ${seconds}s`;
}

function getCooldownKey(roomId: string, userId: string) {
  return `${roomId}:${userId}:shot`;
}

function getLockKey(roomId: string, userId: string) {
  return `${roomId}:${userId}:shot`;
}

function getCooldownLeftMs(roomId: string, userId: string) {
  const endAt = shotCooldowns.get(getCooldownKey(roomId, userId)) || 0;
  return Math.max(0, endAt - Date.now());
}

function setCooldown(roomId: string, userId: string) {
  shotCooldowns.set(
    getCooldownKey(roomId, userId),
    Date.now() + SHOT_COOLDOWN_MS
  );
}

function parseShotCommand(content: string) {
  const text = normalizeText(content).toLowerCase();

  /**
   * يدعم:
   * شوت
   * shot
   * .shot
   */
  if (/^(شوت|shot|\.shot)$/i.test(text)) {
    return {
      matched: true,
    };
  }

  return {
    matched: false,
  };
}

function buildCooldownMessage(username: string, leftMs: number, lang: "ar" | "en") {
  const left = formatDuration(leftMs, lang);

  if (lang === "ar") {
    return `⏳ ${username}\nلا يمكنك استخدام أمر شوت الآن.\nانتظر ${left}.`;
  }

  return `⏳ ${username}\nYou cannot use shot now.\nWait ${left}.`;
}

async function getShotBotUser() {
  return User.findOne({
    $or: [
      { username: BOT_NAME },
      { atUsername: BOT_AT_USERNAME },
      { atUsername: `@${BOT_AT_USERNAME}` },
    ],
  }).select(
    "_id username atUsername avatar activeCustomization customEmojiBadge verificationType badges"
  );
}

async function playShot(params: {
  roomId: string;
  userId: string;
  username: string;
  lang: "ar" | "en";
}): Promise<ShotActionResponse> {
  const { roomId, userId, username, lang } = params;

  /**
   * نسبة فشل بسيطة حتى اللعبة تكون ممتعة.
   */
  const miss = Math.random() <= 0.18;

  if (miss) {
    const pointResult = await neutralFakePoints({
      roomId,
      userId,
      username,
      reason: "shot",
      meta: {
        command: "shot",
        outcome: "miss",
      },
    });

    const target: ShotTarget = {
      name: lang === "ar" ? "لا شيء" : "Nothing",
      emoji: "💨",
      minPoints: 0,
      maxPoints: 0,
      weight: 1,
    };

    return {
      pointsChange: 0,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "miss",
      title: lang === "ar" ? "💨 طلقة ضائعة" : "💨 Missed shot",
      target,
      text:
        lang === "ar"
          ? `🔫 ${username} أطلق شوت\n💨 الطلقة ضاعت ولم يصب شيئًا.\nرصيده كما هو: ${pointResult.balance}`
          : `🔫 ${username} fired a shot\n💨 Missed the target.\nBalance remains: ${pointResult.balance}`,
    };
  }

  const target = pickWeighted(SHOT_TARGETS);
  const won = randomInt(target.minPoints, target.maxPoints);

  const pointResult = await addFakePoints({
    roomId,
    userId,
    username,
    amount: won,
    reason: "shot",
    meta: {
      command: "shot",
      outcome: "kill",
      target: target.name,
      emoji: target.emoji,
      won,
    },
  });

  return {
    pointsChange: pointResult.pointsChange,
    balance: pointResult.balance,
    player: pointResult.player,
    state: "win",
    title:
      lang === "ar"
        ? `${target.emoji} صيد ناجح`
        : `${target.emoji} Successful shot`,
    target,
    text:
      lang === "ar"
        ? `🔫 ${username} أطلق شوت\n${target.emoji} قتل ${target.name} وربح ${won} نقطة.\nرصيده الآن: ${pointResult.balance}`
        : `🔫 ${username} fired a shot\n${target.emoji} Killed ${target.name} and won ${won} points.\nCurrent balance: ${pointResult.balance}`,
  };
}

async function createBotGameMessage(params: {
  roomId: string;
  content: string;
  title: string;
  state: string;
  payload?: any;
}) {
  const botUser: any = await getShotBotUser();

  const message = await RoomMessage.create({
    room: new mongoose.Types.ObjectId(params.roomId),

    sender: botUser?._id || undefined,

    type: "game",
    gameType: "shot",

    content: params.content,

    senderSnapshot: {
      _id: botUser?._id ? String(botUser._id) : "shot-bot",
      username: botUser?.username || BOT_NAME,
      atUsername: botUser?.atUsername || BOT_AT_USERNAME,
      avatar: botUser?.avatar || BOT_AVATAR,
      avatarGif: "",
      usernameColor: "#F59E0B",
      messageTextColor: "",

      activeCustomization: botUser?.activeCustomization || {
        avatarFrame: "",
        avatarGif: "",
        usernameColor: "#F59E0B",
        messageTextColor: "",
        messageEffect: "",
        profileEntryAnimation: "",
        badges: [],
        verificationType: "none",
      },

      customEmojiBadge:
        botUser?.customEmojiBadge || {
          emoji: "🔫",
          isActive: true,
          purchasedAt: null,
          expiresAt: null,
        },

      verificationType: botUser?.verificationType || "none",
      avatarFrame: "",
      badges: botUser?.badges || [],
      profileEntryAnimation: "",
    },

    game: {
      gameType: "shot",
      gameId: `shot-${Date.now()}-${randomInt(1000, 9999)}`,
      title: params.title,
      state: params.state,
      payload: {
        game: "shot_game",
        botName: botUser?.username || BOT_NAME,
        botAvatar: botUser?.avatar || BOT_AVATAR,
        ...params.payload,
      },
    },

    action: "shot_game",

    meta: {
      action: "shot_game",
      botName: botUser?.username || BOT_NAME,
      botAvatar: botUser?.avatar || BOT_AVATAR,
      ...params.payload,
    },
  } as any);

  return message;
}

export async function executeShotGameCommand(params: {
  roomId: string;
  userId: string;
  username?: string;
  content: string;
}): Promise<ShotResult> {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const username = String(params.username || "مستخدم");
  const content = normalizeText(params.content);
  const lang = detectLang(content);

  const parsed = parseShotCommand(content);

  if (!parsed.matched) {
    return {
      handled: false,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    return {
      handled: true,
      success: false,
      reason: "INVALID_ROOM_ID",
      text:
        lang === "ar"
          ? "تعذر تنفيذ لعبة شوت: رقم الغرفة غير صحيح."
          : "Cannot run Shot game: invalid room id.",
    };
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return {
      handled: true,
      success: false,
      reason: "INVALID_USER_ID",
      text:
        lang === "ar"
          ? "تعذر تنفيذ لعبة شوت: رقم المستخدم غير صحيح."
          : "Cannot run Shot game: invalid user id.",
    };
  }

  const lockKey = getLockKey(roomId, userId);

  if (activeLocks.has(lockKey)) {
    return {
      handled: true,
      success: false,
      reason: "LOCKED",
      text:
        lang === "ar"
          ? "⏳ انتظر لحظة، يتم تنفيذ أمر شوت بالفعل."
          : "⏳ Wait a moment, shot is already running.",
    };
  }

  const cooldownLeft = getCooldownLeftMs(roomId, userId);

  if (cooldownLeft > 0) {
    return {
      handled: true,
      success: false,
      reason: "COOLDOWN",
      text: buildCooldownMessage(username, cooldownLeft, lang),
      meta: {
        command: "shot",
        cooldownLeftMs: cooldownLeft,
      },
    };
  }

  activeLocks.add(lockKey);

  try {
    const result = await playShot({
      roomId,
      userId,
      username,
      lang,
    });

    setCooldown(roomId, userId);

    const message = await createBotGameMessage({
      roomId,
      content: result.text,
      title: result.title,
      state: result.state,
      payload: {
        command: "shot",
        username,
        userId,
        pointsChange: result.pointsChange,
        balance: result.balance,
        player: result.player,
        target: result.target,
        targetName: result.target.name,
        targetEmoji: result.target.emoji,
        state: result.state,
      },
    });

    return {
      handled: true,
      success: true,
      message,
      text: result.text,
      meta: {
        command: "shot",
        pointsChange: result.pointsChange,
        balance: result.balance,
        target: result.target,
        state: result.state,
      },
    };
  } catch (error: any) {
    console.log("❌ shot game error:", error);

    return {
      handled: true,
      success: false,
      reason: "SHOT_ERROR",
      text:
        lang === "ar"
          ? "حدث خطأ أثناء تنفيذ لعبة شوت."
          : "An error happened while running Shot game.",
    };
  } finally {
    activeLocks.delete(lockKey);
  }
}