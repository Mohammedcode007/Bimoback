// src/services/roomGames/globalHitDuelGame.service.ts
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import Room from "../../models/Room";
import RoomMessage from "../../models/RoomMessage";
import User from "../../models/User";
import { applyFakePointDuelResult } from "../gamePoints/fakePoints.service";

type DuelCommand = "slap" | "hit" | "box";

type DuelLang = "ar" | "en";

type DuelPlayer = {
  userId: string;
  username: string;
  roomId: string;
  joinedAt: number;
};

type ActiveDuel = {
  gameId: string;
  command: DuelCommand;
  lang: DuelLang;
  status: "waiting";
  starter: DuelPlayer;
  createdAt: number;
  expiresAt: number;
};

type DuelStateDb = {
  version: number;
  active: Partial<Record<DuelCommand, ActiveDuel>>;
  cooldowns: Record<string, Partial<Record<DuelCommand, number>>>;
};

type DuelResult = {
  handled: boolean;
  success?: boolean;
  message?: any;
  messages?: any[];
  text?: string;
  reason?: string;
};

const DUEL_DATA_DIR = path.join(
  process.cwd(),
  "src",
  "public",
  "game-data",
  "global-hit-duel"
);

const DUEL_DATA_FILE = path.join(DUEL_DATA_DIR, "global-hit-duel.json");

const BOT_NAME = "سُــــــكَّــــــر";
const BOT_AT_USERNAME = "sugar_bot";

const COOLDOWN_MS = 15 * 60 * 1000;
const WAITING_DUEL_TTL_MS = 60 * 1000;

const activeLocks = new Set<string>();
const BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:5000";

const publicUrl = (file: string) => {
  return `${BASE_URL}/lottie/games/${file}`;
};
const DUEL_ANIMATION = {
  slap: {
    key: "slap",
    type: "lottie",
    titleAr: "لعبة كف",
    titleEn: "Slap duel",
    lottieUrl: publicUrl("slap.json"),
  },
  hit: {
    key: "hit",
    type: "lottie",
    titleAr: "لعبة ضرب",
    titleEn: "Hit duel",
    lottieUrl: publicUrl("hit.json"),
  },
  box: {
    key: "box",
    type: "lottie",
    titleAr: "لعبة بوكس",
    titleEn: "Boxing duel",
    lottieUrl: publicUrl("box.json"),
  },
} as const;
function normalizeText(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function detectLang(text: string): DuelLang {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createGameId(command: DuelCommand) {
  return `${command}-${Date.now()}-${randomInt(1000, 9999)}`;
}

function getLockKey(command: DuelCommand) {
  return `global-duel:${command}`;
}

function getPointReason(command: DuelCommand) {
  if (command === "slap") return "duel_slap";
  if (command === "hit") return "duel_hit";
  return "duel_box";
}

function parseDuelCommand(content: string): {
  matched: boolean;
  command?: DuelCommand;
  lang: DuelLang;
} {
  const text = normalizeText(content).toLowerCase();
  const lang = detectLang(text);

  if (["كف", "slap"].includes(text)) {
    return {
      matched: true,
      command: "slap",
      lang,
    };
  }

  if (["ضرب", "hit"].includes(text)) {
    return {
      matched: true,
      command: "hit",
      lang,
    };
  }

  if (["بوكس", "box", "boxing"].includes(text)) {
    return {
      matched: true,
      command: "box",
      lang,
    };
  }

  return {
    matched: false,
    lang,
  };
}

async function ensureDuelDb(): Promise<DuelStateDb> {
  await fs.mkdir(DUEL_DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DUEL_DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid duel db");
    }

    parsed.version ||= 1;
    parsed.active ||= {};
    parsed.cooldowns ||= {};

    return parsed as DuelStateDb;
  } catch {
    const initial: DuelStateDb = {
      version: 1,
      active: {},
      cooldowns: {},
    };

    await fs.writeFile(DUEL_DATA_FILE, JSON.stringify(initial, null, 2), "utf8");

    return initial;
  }
}

async function saveDuelDb(db: DuelStateDb) {
  await fs.mkdir(DUEL_DATA_DIR, { recursive: true });

  const tmp = `${DUEL_DATA_FILE}.tmp`;

  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DUEL_DATA_FILE);
}

function getCooldownLeftMs(
  db: DuelStateDb,
  userId: string,
  command: DuelCommand
) {
  const endAt = db.cooldowns?.[userId]?.[command] || 0;
  return Math.max(0, endAt - Date.now());
}

function setCooldown(
  db: DuelStateDb,
  userId: string,
  command: DuelCommand
) {
  if (!db.cooldowns[userId]) {
    db.cooldowns[userId] = {};
  }

  db.cooldowns[userId][command] = Date.now() + COOLDOWN_MS;
}

function formatDuration(ms: number, lang: DuelLang) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  if (lang === "ar") {
    return `${minutes} دقيقة و ${seconds} ثانية`;
  }

  return `${minutes}m ${seconds}s`;
}

function getCommandLabel(command: DuelCommand, lang: DuelLang) {
  if (lang === "ar") {
    if (command === "slap") return "كف";
    if (command === "hit") return "ضرب";
    if (command === "box") return "بوكس";
  }

  if (command === "slap") return "slap";
  if (command === "hit") return "hit";
  return "box";
}

async function getUsername(userId: string, fallback = "Player") {
  const user: any = await User.findById(userId)
    .select("username atUsername")
    .lean();

  return String(user?.username || user?.atUsername || fallback);
}

async function getActiveRoomIds() {
  const rooms = await Room.find({
    activeUsers: {
      $exists: true,
      $ne: [],
    },
  })
    .select("_id")
    .lean();

  return rooms.map((room: any) => String(room._id));
}

async function getSugarBotUser() {
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

async function createBotGameMessage(params: {
  roomId: string;
  content: string;
  title: string;
  state: string;
  payload?: any;
}) {
  const botUser: any = await getSugarBotUser();

  const message = await RoomMessage.create({
    room: new mongoose.Types.ObjectId(params.roomId),

    sender: botUser?._id || undefined,

    type: "game",
    gameType: "duel",

    content: params.content,

    senderSnapshot: {
      _id: botUser?._id ? String(botUser._id) : "sugar-bot",
      username: botUser?.username || BOT_NAME,
      atUsername: botUser?.atUsername || BOT_AT_USERNAME,
      avatar: botUser?.avatar || "",

      activeCustomization: botUser?.activeCustomization || {
        avatarFrame: "",
        avatarGif: "",
        usernameColor: "",
        messageTextColor: "",
        messageEffect: "",
        profileEntryAnimation: "",
        badges: [],
        verificationType: "none",
      },

      customEmojiBadge: botUser?.customEmojiBadge || {
        emoji: "🥊",
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
      gameId: String(params.payload?.gameId || createGameId("hit")),
      title: params.title,
      state: params.state,
      payload: {
        botName: BOT_NAME,
        ...params.payload,
      },
    },
  });

  return message;
}

function buildWaitingText(params: {
  command: DuelCommand;
  starterName: string;
  lang: DuelLang;
}) {
  const label = getCommandLabel(params.command, params.lang);
  const anim = DUEL_ANIMATION[params.command];

  if (params.lang === "ar") {
    return [
      `🥊 ${anim.titleAr}`,
      "",
      `${params.starterName} بدأ تحدي ${label}.`,
      `من يريد الدخول يرسل: ${label}`,
      "",
      "سيتم اختيار الفائز عشوائيًا.",
    ].join("\n");
  }

  return [
    `🥊 ${anim.titleEn}`,
    "",
    `${params.starterName} started a ${label} duel.`,
    `To join, send: ${label}`,
    "",
    "Winner will be selected randomly.",
  ].join("\n");
}

function buildCooldownText(params: {
  command: DuelCommand;
  username: string;
  leftMs: number;
  lang: DuelLang;
}) {
  const label = getCommandLabel(params.command, params.lang);
  const left = formatDuration(params.leftMs, params.lang);

  if (params.lang === "ar") {
    return `⏳ ${params.username}\nلا يمكنك لعب ${label} الآن.\nانتظر ${left}.`;
  }

  return `⏳ ${params.username}\nYou cannot play ${label} now.\nWait ${left}.`;
}

function buildResultText(params: {
  command: DuelCommand;
  p1: DuelPlayer;
  p2: DuelPlayer;
  winner: DuelPlayer;
  loser: DuelPlayer;
  points: number;
  winnerPoints: number;
  loserPoints: number;
  lang: DuelLang;
}) {
  const anim = DUEL_ANIMATION[params.command];

  if (params.lang === "ar") {
    return [
      `🥊 ${anim.titleAr}`,
      "",
      `${params.p1.username} ضد ${params.p2.username}`,
      "",
      `🏆 الفائز: ${params.winner.username}`,
      `💥 الخاسر: ${params.loser.username}`,
      "",
      `✅ ${params.winner.username} كسب ${params.points} نقطة وهمية.`,
      `❌ ${params.loser.username} خسر ${params.points} نقطة وهمية.`,
      "",
      `رصيد الفائز: ${params.winnerPoints}`,
      `رصيد الخاسر: ${params.loserPoints}`,
    ].join("\n");
  }

  return [
    `🥊 ${anim.titleEn}`,
    "",
    `${params.p1.username} vs ${params.p2.username}`,
    "",
    `🏆 Winner: ${params.winner.username}`,
    `💥 Loser: ${params.loser.username}`,
    "",
    `✅ ${params.winner.username} won ${params.points} fake points.`,
    `❌ ${params.loser.username} lost ${params.points} fake points.`,
    "",
    `Winner balance: ${params.winnerPoints}`,
    `Loser balance: ${params.loserPoints}`,
  ].join("\n");
}

async function createWaitingMessagesInAllRooms(params: {
  gameId: string;
  command: DuelCommand;
  starterRoomId: string;
  starterName: string;
  lang: DuelLang;
}) {
  const activeRoomIds = await getActiveRoomIds();

  /**
   * مهم:
   * نضمن إضافة غرفة اللاعب الذي بدأ التحدي حتى لو لم تكن activeUsers محدثة لحظيًا.
   */
  const roomIds = Array.from(
    new Set([params.starterRoomId, ...activeRoomIds].filter(Boolean))
  );

  const messages: any[] = [];
  const anim = DUEL_ANIMATION[params.command];

  const content = buildWaitingText({
    command: params.command,
    starterName: params.starterName,
    lang: params.lang,
  });

  for (const roomId of roomIds) {
    const msg = await createBotGameMessage({
      roomId,
      content,
      title: params.lang === "ar" ? anim.titleAr : anim.titleEn,
      state: "waiting",
      payload: {
        gameId: params.gameId,
        command: params.command,
        phase: "waiting",
        starterRoomId: params.starterRoomId,
        animation: {
          type: anim.type,
          key: anim.key,
          lottieUrl: anim.lottieUrl,
        },
      },
    });

    messages.push(msg);
  }

  return messages;
}

async function createResultMessages(params: {
  gameId: string;
  command: DuelCommand;
  p1: DuelPlayer;
  p2: DuelPlayer;
  winner: DuelPlayer;
  loser: DuelPlayer;
  points: number;
  winnerPoints: number;
  loserPoints: number;
  lang: DuelLang;
}) {
  const roomIds = Array.from(new Set([params.p1.roomId, params.p2.roomId]));
  const messages: any[] = [];
  const anim = DUEL_ANIMATION[params.command];

  const content = buildResultText(params);

  for (const roomId of roomIds) {
    const msg = await createBotGameMessage({
      roomId,
      content,
      title: params.lang === "ar" ? anim.titleAr : anim.titleEn,
      state: "finished",
      payload: {
        gameId: params.gameId,
        command: params.command,
        phase: "finished",
        points: params.points,

        winner: {
          userId: params.winner.userId,
          username: params.winner.username,
          roomId: params.winner.roomId,
          points: params.winnerPoints,
        },

        loser: {
          userId: params.loser.userId,
          username: params.loser.username,
          roomId: params.loser.roomId,
          points: params.loserPoints,
        },

        players: [
          {
            userId: params.p1.userId,
            username: params.p1.username,
            roomId: params.p1.roomId,
          },
          {
            userId: params.p2.userId,
            username: params.p2.username,
            roomId: params.p2.roomId,
          },
        ],

        animation: {
          type: anim.type,
          key: anim.key,
          lottieUrl: anim.lottieUrl,
        },
      },
    });

    messages.push(msg);
  }

  return messages;
}

function cleanupExpiredDuels(db: DuelStateDb) {
  const now = Date.now();

  for (const command of Object.keys(db.active) as DuelCommand[]) {
    const duel = db.active[command];

    if (!duel) continue;

    if (duel.expiresAt <= now) {
      delete db.active[command];
    }
  }
}

export async function executeGlobalHitDuelCommand(params: {
  roomId: string;
  userId: string;
  username?: string;
  content: string;
}): Promise<DuelResult> {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const content = normalizeText(params.content);

  const parsed = parseDuelCommand(content);

  if (!parsed.matched || !parsed.command) {
    return {
      handled: false,
    };
  }

  const command = parsed.command;
  const lang = parsed.lang;
  const lockKey = getLockKey(command);

  if (activeLocks.has(lockKey)) {
    return {
      handled: true,
      success: false,
      reason: "LOCKED",
      text:
        lang === "ar"
          ? "⏳ انتظر لحظة، يتم تجهيز اللعبة."
          : "⏳ Wait a moment, game is being prepared.",
    };
  }

  activeLocks.add(lockKey);

  try {
    const username = String(
      params.username ||
        (await getUsername(userId, lang === "ar" ? "لاعب" : "Player"))
    );

    const duelDb = await ensureDuelDb();

    cleanupExpiredDuels(duelDb);

    const cooldownLeft = getCooldownLeftMs(duelDb, userId, command);

    if (cooldownLeft > 0) {
      const text = buildCooldownText({
        command,
        username,
        leftMs: cooldownLeft,
        lang,
      });

      const msg = await createBotGameMessage({
        roomId,
        content: text,
        title: lang === "ar" ? "انتظار" : "Cooldown",
        state: "cooldown",
        payload: {
          command,
          phase: "cooldown",
          leftMs: cooldownLeft,
          animation: {
            type: DUEL_ANIMATION[command].type,
            key: DUEL_ANIMATION[command].key,
            lottieUrl: DUEL_ANIMATION[command].lottieUrl,
          },
        },
      });

      await saveDuelDb(duelDb);

      return {
        handled: true,
        success: true,
        message: msg,
        messages: [msg],
        text,
      };
    }

    const current = duelDb.active[command];

    /**
     * لا توجد لعبة منتظرة، إذن اللاعب يبدأ تحديًا عالميًا.
     */
    if (!current) {
      const gameId = createGameId(command);

      duelDb.active[command] = {
        gameId,
        command,
        lang,
        status: "waiting",
        starter: {
          userId,
          username,
          roomId,
          joinedAt: Date.now(),
        },
        createdAt: Date.now(),
        expiresAt: Date.now() + WAITING_DUEL_TTL_MS,
      };

      /**
       * اللاعب الذي يبدأ اللعبة يأخذ كولداون فورًا.
       */
      setCooldown(duelDb, userId, command);

      await saveDuelDb(duelDb);

      const messages = await createWaitingMessagesInAllRooms({
        gameId,
        command,
        starterRoomId: roomId,
        starterName: username,
        lang,
      });

      return {
        handled: true,
        success: true,
        messages,
        message: messages[0],
        text:
          lang === "ar"
            ? `تم بدء تحدي ${getCommandLabel(command, lang)}.`
            : `${command} duel started.`,
      };
    }

    /**
     * نفس اللاعب يحاول الدخول ضد نفسه.
     */
    if (current.starter.userId === userId) {
      const text =
        lang === "ar"
          ? "⚠️ لا يمكنك الدخول ضد نفسك. انتظر لاعبًا آخر."
          : "⚠️ You cannot join against yourself. Wait for another player.";

      const msg = await createBotGameMessage({
        roomId,
        content: text,
        title: lang === "ar" ? "تحدي موجود" : "Duel already started",
        state: "self_join_blocked",
        payload: {
          gameId: current.gameId,
          command,
          phase: "self_join_blocked",
          animation: {
            type: DUEL_ANIMATION[command].type,
            key: DUEL_ANIMATION[command].key,
            lottieUrl: DUEL_ANIMATION[command].lottieUrl,
          },
        },
      });

      await saveDuelDb(duelDb);

      return {
        handled: true,
        success: true,
        message: msg,
        messages: [msg],
        text,
      };
    }

    /**
     * لاعب ثانٍ دخل التحدي.
     * نختار الفائز عشوائيًا.
     */
    const secondPlayer: DuelPlayer = {
      userId,
      username,
      roomId,
      joinedAt: Date.now(),
    };

    const p1 = current.starter;
    const p2 = secondPlayer;

    const winner = Math.random() >= 0.5 ? p1 : p2;
    const loser = winner.userId === p1.userId ? p2 : p1;

    const points = randomInt(30, 250);

    /**
     * هنا التعديل المهم:
     * لا نكتب في sugar-luck.json من هذا الملف مباشرة.
     * نستخدم fakePoints.service.ts فقط.
     */
    const pointResult = await applyFakePointDuelResult({
      winner: {
        roomId: winner.roomId,
        userId: winner.userId,
        username: winner.username,
      },
      loser: {
        roomId: loser.roomId,
        userId: loser.userId,
        username: loser.username,
      },
      amount: points,
      reason: getPointReason(command),
      meta: {
        gameId: current.gameId,
        command,
        p1,
        p2,
      },
    });

    /**
     * اللاعب الثاني يأخذ كولداون بعد دخوله.
     */
    setCooldown(duelDb, userId, command);

    /**
     * إنهاء التحدي العالمي.
     */
    delete duelDb.active[command];

    await saveDuelDb(duelDb);

    const resultMessages = await createResultMessages({
      gameId: current.gameId,
      command,
      p1,
      p2,
      winner,
      loser,
      points,
      winnerPoints: pointResult.winnerBalance,
      loserPoints: pointResult.loserBalance,
      lang: current.lang || lang,
    });

    return {
      handled: true,
      success: true,
      messages: resultMessages,
      message: resultMessages[0],
      text:
        (current.lang || lang) === "ar"
          ? `انتهى تحدي ${getCommandLabel(command, "ar")}.`
          : `${command} duel finished.`,
    };
  } finally {
    activeLocks.delete(lockKey);
  }
}