// src/services/roomGames/sugarLuckGame.service.ts
import mongoose from "mongoose";
import Room from "../../models/Room";
import RoomMessage from "../../models/RoomMessage";
import User from "../../models/User";

import {
  getFakePointPlayer,
  addFakePoints,
  subtractFakePoints,
  neutralFakePoints,
  getFakePointsLeaderboard,
  type FakePointPlayerStats,
} from "../gamePoints/fakePoints.service";

type SugarLuckCommandType =
  | "luck"
  | "million"
  | "investment"
  | "speculation"
  | "leaderboard";

type ParsedSugarLuckCommand = {
  matched: boolean;
  type?: SugarLuckCommandType;
  choice?: 1 | 2 | 3;
};

export type SugarLuckResult = {
  handled: boolean;
  success?: boolean;
  message?: any;
  messages?: any[];
  text?: string;
  reason?: string;
  meta?: Record<string, any>;
};

type GameActionResponse = {
  pointsChange: number;
  balance: number;
  player: FakePointPlayerStats;
  state: string;
  title: string;
  text: string;
};

const BOT_NAME = "سُــــــكَّــــــر";
const BOT_AT_USERNAME = "sugar_bot";

const COOLDOWN_MS = 15 * 60 * 1000;

/**
 * كولداون داخلي في الذاكرة.
 * النقاط نفسها تُدار من fakePoints.service.ts فقط.
 */
const sugarCooldowns = new Map<string, number>();

/**
 * يمنع تنفيذ نفس الأمر مرتين في نفس اللحظة لنفس المستخدم داخل نفس الغرفة.
 */
const activeLocks = new Set<string>();

function getLockKey(
  roomId: string,
  userId: string,
  commandType: SugarLuckCommandType
) {
  return `${roomId}:${userId}:${commandType}`;
}

function getCooldownKey(
  roomId: string,
  userId: string,
  commandType: SugarLuckCommandType
) {
  return `${roomId}:${userId}:${commandType}`;
}

function getCooldownLeftMs(
  roomId: string,
  userId: string,
  commandType: SugarLuckCommandType
) {
  const endAt = sugarCooldowns.get(
    getCooldownKey(roomId, userId, commandType)
  ) || 0;

  return Math.max(0, endAt - Date.now());
}

function setCooldown(
  roomId: string,
  userId: string,
  commandType: SugarLuckCommandType
) {
  sugarCooldowns.set(
    getCooldownKey(roomId, userId, commandType),
    Date.now() + COOLDOWN_MS
  );
}

function normalizeText(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted<T>(items: Array<{ weight: number; value: T }>): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }

  return items[items.length - 1].value;
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

function detectLang(text: string): "ar" | "en" {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

function getCommandLabel(commandType: SugarLuckCommandType, lang: "ar" | "en") {
  if (lang === "ar") {
    if (commandType === "luck") return "حظ";
    if (commandType === "million") return "مليون";
    if (commandType === "investment") return "استثمار";
    if (commandType === "speculation") return "مضاربة";
    if (commandType === "leaderboard") return "القائمة";
  }

  if (commandType === "luck") return "luck";
  if (commandType === "million") return "million";
  if (commandType === "investment") return "investment";
  if (commandType === "speculation") return "speculation";
  if (commandType === "leaderboard") return "leaderboard";

  return commandType;
}

function parseSugarLuckCommand(content: string): ParsedSugarLuckCommand {
  const text = normalizeText(content).toLowerCase();

  /**
   * حظ 1 / حظ1 / luck 1 / luck1
   */
  const luckMatch = text.match(/^(حظ|luck)\s*([123])$/i);
  if (luckMatch) {
    return {
      matched: true,
      type: "luck",
      choice: Number(luckMatch[2]) as 1 | 2 | 3,
    };
  }

  /**
   * مليون / million
   */
  if (/^(مليون|million)$/i.test(text)) {
    return {
      matched: true,
      type: "million",
    };
  }

  /**
   * استثمار / invest / investment
   */
  if (/^(استثمار|invest|investment)$/i.test(text)) {
    return {
      matched: true,
      type: "investment",
    };
  }

  /**
   * مضاربة / مضاربه / speculation / trade
   */
  if (/^(مضاربة|مضاربه|speculation|trade)$/i.test(text)) {
    return {
      matched: true,
      type: "speculation",
    };
  }

  /**
   * .list / قائمة / leaderboard
   */
  if (/^(\.list|list|leaderboard|قائمة|القائمة)$/i.test(text)) {
    return {
      matched: true,
      type: "leaderboard",
    };
  }

  return {
    matched: false,
  };
}

function buildCooldownMessage(
  username: string,
  commandType: SugarLuckCommandType,
  leftMs: number,
  lang: "ar" | "en"
) {
  const left = formatDuration(leftMs, lang);
  const label = getCommandLabel(commandType, lang);

  if (lang === "ar") {
    return `⏳ ${username}\nلا يمكنك استخدام أمر ${label} الآن.\nانتظر ${left}.`;
  }

  return `⏳ ${username}\nYou cannot use ${label} now.\nWait ${left}.`;
}

async function playLuck(params: {
  roomId: string;
  userId: string;
  username: string;
  choice: 1 | 2 | 3;
  lang: "ar" | "en";
}): Promise<GameActionResponse> {
  const { roomId, userId, username, choice, lang } = params;

  const winningChoice = randomInt(1, 3) as 1 | 2 | 3;

  const outcome = pickWeighted([
    { weight: 45, value: "win" as const },
    { weight: 35, value: "lose" as const },
    { weight: 20, value: "neutral" as const },
  ]);

  if (choice !== winningChoice) {
    const lost = randomInt(10, 90);

    const pointResult = await subtractFakePoints({
      roomId,
      userId,
      username,
      amount: lost,
      reason: "luck",
      meta: {
        command: "luck",
        choice,
        winningChoice,
        outcome: "wrong_choice",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "loss",
      title: lang === "ar" ? "❌ حظ غير موفق" : "❌ Bad luck",
      text:
        lang === "ar"
          ? `🎲 ${username} اختار حظ ${choice}\nالاختيار الفائز كان حظ ${winningChoice}\nخسر ${lost} نقطة وهمية.\nرصيده الآن: ${pointResult.balance}`
          : `🎲 ${username} chose Luck ${choice}\nWinning choice was Luck ${winningChoice}\nLost ${lost} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  if (outcome === "win") {
    const won = randomInt(80, 450);

    const pointResult = await addFakePoints({
      roomId,
      userId,
      username,
      amount: won,
      reason: "luck",
      meta: {
        command: "luck",
        choice,
        winningChoice,
        outcome: "win",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "win",
      title: lang === "ar" ? "✅ حظ سعيد" : "✅ Lucky",
      text:
        lang === "ar"
          ? `🎲 ${username} اختار حظ ${choice}\nالاختيار صحيح!\nكسب ${won} نقطة وهمية.\nرصيده الآن: ${pointResult.balance}`
          : `🎲 ${username} chose Luck ${choice}\nCorrect choice!\nWon ${won} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  if (outcome === "lose") {
    const lost = randomInt(20, 160);

    const pointResult = await subtractFakePoints({
      roomId,
      userId,
      username,
      amount: lost,
      reason: "luck",
      meta: {
        command: "luck",
        choice,
        winningChoice,
        outcome: "luck_turned",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "loss",
      title: lang === "ar" ? "❌ الحظ انقلب" : "❌ Luck turned",
      text:
        lang === "ar"
          ? `🎲 ${username} اختار حظ ${choice}\nكان الاختيار صحيحًا لكن النتيجة انقلبت.\nخسر ${lost} نقطة وهمية.\nرصيده الآن: ${pointResult.balance}`
          : `🎲 ${username} chose Luck ${choice}\nThe choice was correct, but luck turned.\nLost ${lost} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  const pointResult = await neutralFakePoints({
    roomId,
    userId,
    username,
    reason: "luck",
    meta: {
      command: "luck",
      choice,
      winningChoice,
      outcome: "neutral",
    },
  });

  return {
    pointsChange: pointResult.pointsChange,
    balance: pointResult.balance,
    player: pointResult.player,
    state: "neutral",
    title: lang === "ar" ? "➖ كما هو" : "➖ No change",
    text:
      lang === "ar"
        ? `🎲 ${username} اختار حظ ${choice}\nلم يكسب ولم يخسر.\nرصيده كما هو: ${pointResult.balance}`
        : `🎲 ${username} chose Luck ${choice}\nNo win and no loss.\nBalance remains: ${pointResult.balance}`,
  };
}

async function playMillion(params: {
  roomId: string;
  userId: string;
  username: string;
  lang: "ar" | "en";
}): Promise<GameActionResponse> {
  const { roomId, userId, username, lang } = params;

  /**
   * لا توجد خسارة في مليون.
   * يكسب أو لا يكسب.
   * فرصة المليون ضعيفة جدًا.
   */
  const roll = Math.random();

  if (roll <= 0.005) {
    const pointResult = await addFakePoints({
      roomId,
      userId,
      username,
      amount: 1_000_000,
      reason: "million",
      meta: {
        command: "million",
        outcome: "mega_win",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "mega_win",
      title: lang === "ar" ? "💎 مليون!" : "💎 Million!",
      text:
        lang === "ar"
          ? `💎 مستحيل يا ${username}!\nكسبت 1,000,000 نقطة وهمية.\nرصيدك الآن: ${pointResult.balance}`
          : `💎 Impossible, ${username}!\nYou won 1,000,000 fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  const smallWin = roll <= 0.18;

  if (smallWin) {
    const won = randomInt(500, 5000);

    const pointResult = await addFakePoints({
      roomId,
      userId,
      username,
      amount: won,
      reason: "million",
      meta: {
        command: "million",
        outcome: "small_win",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "small_win",
      title: lang === "ar" ? "💰 مكسب صغير" : "💰 Small win",
      text:
        lang === "ar"
          ? `💰 ${username}\nلم تربح المليون، لكن كسبت ${won} نقطة وهمية.\nرصيدك الآن: ${pointResult.balance}`
          : `💰 ${username}\nYou did not win the million, but won ${won} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  const pointResult = await neutralFakePoints({
    roomId,
    userId,
    username,
    reason: "million",
    meta: {
      command: "million",
      outcome: "nothing",
    },
  });

  return {
    pointsChange: pointResult.pointsChange,
    balance: pointResult.balance,
    player: pointResult.player,
    state: "neutral",
    title: lang === "ar" ? "😶 لا شيء" : "😶 Nothing",
    text:
      lang === "ar"
        ? `😶 ${username}\nلم تربح المليون هذه المرة.\nلا توجد خسارة.\nرصيدك: ${pointResult.balance}`
        : `😶 ${username}\nNo million this time.\nNo loss.\nBalance: ${pointResult.balance}`,
  };
}

async function playInvestment(params: {
  roomId: string;
  userId: string;
  username: string;
  lang: "ar" | "en";
}): Promise<GameActionResponse> {
  const { roomId, userId, username, lang } = params;

  /**
   * استثمار يعتمد على الرصيد.
   */
  const currentPlayer = await getFakePointPlayer({
    roomId,
    userId,
    username,
  });

  if (currentPlayer.points <= 0) {
    return {
      pointsChange: 0,
      balance: currentPlayer.points,
      player: currentPlayer,
      state: "blocked",
      title: lang === "ar" ? "⚠️ لا يوجد رصيد" : "⚠️ No balance",
      text:
        lang === "ar"
          ? `⚠️ ${username}\nلا يمكنك الاستثمار لأن رصيدك ${currentPlayer.points}.\nاجمع نقاطًا أولًا من حظ أو مليون.`
          : `⚠️ ${username}\nYou cannot invest because your balance is ${currentPlayer.points}.\nCollect points first from luck or million.`,
    };
  }

  const base = Math.min(Math.max(Math.floor(currentPlayer.points * 0.25), 50), 5000);

  const outcome = pickWeighted([
    { weight: 48, value: "win" as const },
    { weight: 42, value: "lose" as const },
    { weight: 10, value: "neutral" as const },
  ]);

  if (outcome === "win") {
    const won = randomInt(Math.floor(base * 0.5), Math.floor(base * 1.8));

    const pointResult = await addFakePoints({
      roomId,
      userId,
      username,
      amount: won,
      reason: "investment",
      meta: {
        command: "investment",
        base,
        outcome: "win",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "win",
      title: lang === "ar" ? "📈 استثمار ناجح" : "📈 Successful investment",
      text:
        lang === "ar"
          ? `📈 ${username}\nاستثمار ناجح وربحت ${won} نقطة وهمية.\nرصيدك الآن: ${pointResult.balance}`
          : `📈 ${username}\nSuccessful investment. You won ${won} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  if (outcome === "lose") {
    const lost = randomInt(Math.floor(base * 0.4), base);

    const pointResult = await subtractFakePoints({
      roomId,
      userId,
      username,
      amount: lost,
      reason: "investment",
      meta: {
        command: "investment",
        base,
        outcome: "lose",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "loss",
      title: lang === "ar" ? "📉 استثمار خاسر" : "📉 Failed investment",
      text:
        lang === "ar"
          ? `📉 ${username}\nالاستثمار خسر ${lost} نقطة وهمية.\nرصيدك الآن: ${pointResult.balance}`
          : `📉 ${username}\nInvestment failed. Lost ${lost} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  const pointResult = await neutralFakePoints({
    roomId,
    userId,
    username,
    reason: "investment",
    meta: {
      command: "investment",
      base,
      outcome: "neutral",
    },
  });

  return {
    pointsChange: pointResult.pointsChange,
    balance: pointResult.balance,
    player: pointResult.player,
    state: "neutral",
    title: lang === "ar" ? "➖ استثمار ثابت" : "➖ Stable investment",
    text:
      lang === "ar"
        ? `➖ ${username}\nالاستثمار لم يربح ولم يخسر.\nرصيدك كما هو: ${pointResult.balance}`
        : `➖ ${username}\nInvestment made no profit and no loss.\nBalance remains: ${pointResult.balance}`,
  };
}

async function playSpeculation(params: {
  roomId: string;
  userId: string;
  username: string;
  lang: "ar" | "en";
}): Promise<GameActionResponse> {
  const { roomId, userId, username, lang } = params;

  /**
   * مضاربة مختلفة عن الاستثمار:
   * مخاطرة أعلى ومكسب أعلى وخسارة أعلى.
   */
  const currentPlayer = await getFakePointPlayer({
    roomId,
    userId,
    username,
  });

  if (currentPlayer.points <= 0) {
    return {
      pointsChange: 0,
      balance: currentPlayer.points,
      player: currentPlayer,
      state: "blocked",
      title: lang === "ar" ? "⚠️ لا يوجد رصيد" : "⚠️ No balance",
      text:
        lang === "ar"
          ? `⚠️ ${username}\nلا يمكنك المضاربة لأن رصيدك ${currentPlayer.points}.\nاجمع نقاطًا أولًا.`
          : `⚠️ ${username}\nYou cannot speculate because your balance is ${currentPlayer.points}.\nCollect points first.`,
    };
  }

  const base = Math.min(Math.max(Math.floor(currentPlayer.points * 0.4), 100), 15000);

  const outcome = pickWeighted([
    { weight: 35, value: "big_win" as const },
    { weight: 50, value: "big_loss" as const },
    { weight: 15, value: "neutral" as const },
  ]);

  if (outcome === "big_win") {
    const won = randomInt(base, Math.floor(base * 3));

    const pointResult = await addFakePoints({
      roomId,
      userId,
      username,
      amount: won,
      reason: "speculation",
      meta: {
        command: "speculation",
        base,
        outcome: "big_win",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "big_win",
      title: lang === "ar" ? "🚀 مضاربة رابحة" : "🚀 Winning speculation",
      text:
        lang === "ar"
          ? `🚀 ${username}\nمضاربة قوية وربحت ${won} نقطة وهمية.\nرصيدك الآن: ${pointResult.balance}`
          : `🚀 ${username}\nStrong speculation. You won ${won} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  if (outcome === "big_loss") {
    const lost = randomInt(Math.floor(base * 0.8), Math.floor(base * 2));

    const pointResult = await subtractFakePoints({
      roomId,
      userId,
      username,
      amount: lost,
      reason: "speculation",
      meta: {
        command: "speculation",
        base,
        outcome: "big_loss",
      },
    });

    return {
      pointsChange: pointResult.pointsChange,
      balance: pointResult.balance,
      player: pointResult.player,
      state: "big_loss",
      title: lang === "ar" ? "🔥 مضاربة خاسرة" : "🔥 Losing speculation",
      text:
        lang === "ar"
          ? `🔥 ${username}\nالمضاربة كانت خطيرة وخسرت ${lost} نقطة وهمية.\nرصيدك الآن: ${pointResult.balance}`
          : `🔥 ${username}\nRisky speculation failed. Lost ${lost} fake points.\nCurrent balance: ${pointResult.balance}`,
    };
  }

  const pointResult = await neutralFakePoints({
    roomId,
    userId,
    username,
    reason: "speculation",
    meta: {
      command: "speculation",
      base,
      outcome: "neutral",
    },
  });

  return {
    pointsChange: pointResult.pointsChange,
    balance: pointResult.balance,
    player: pointResult.player,
    state: "neutral",
    title: lang === "ar" ? "➖ مضاربة بدون نتيجة" : "➖ No result",
    text:
      lang === "ar"
        ? `➖ ${username}\nالمضاربة لم تكسب ولم تخسر.\nرصيدك كما هو: ${pointResult.balance}`
        : `➖ ${username}\nSpeculation made no gain and no loss.\nBalance remains: ${pointResult.balance}`,
  };
}

async function buildLeaderboard(roomId: string, lang: "ar" | "en") {
  const top = await getFakePointsLeaderboard({
    roomId,
    limit: 10,
  });

  if (!top.length) {
    return lang === "ar"
      ? "📋 لا يوجد لاعبين في قائمة سُــــــكَّــــــر حتى الآن."
      : "📋 No players in Sugar leaderboard yet.";
  }

  const lines = top.map((player, index) => {
    const medal =
      index === 0
        ? "🥇"
        : index === 1
          ? "🥈"
          : index === 2
            ? "🥉"
            : `${index + 1}.`;

    return `${medal} ${player.username} — ${player.points} ${
      lang === "ar" ? "نقطة" : "pts"
    }`;
  });

  return lang === "ar"
    ? `📋 قائمة أغنى 10 لاعبين في لعبة سُــــــكَّــــــر:\n\n${lines.join("\n")}`
    : `📋 Top 10 Sugar players:\n\n${lines.join("\n")}`;
}

async function getSugarBotUser() {
  /**
   * لو عندك حساب حقيقي باسم سُــــــكَّــــــر سيُستخدم كـ sender.
   * لو غير موجود سنرسل senderSnapshot فقط بنفس الاسم.
   */
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
    gameType: "luck",

    content: params.content,

    senderSnapshot: {
      _id: botUser?._id ? String(botUser._id) : "sugar-bot",
      username: botUser?.username || BOT_NAME,
      atUsername: botUser?.atUsername || BOT_AT_USERNAME,
      avatar: botUser?.avatar || "",
      activeCustomization: botUser?.activeCustomization || {
        badges: [],
        verificationType: "none",
      },
      customEmojiBadge: botUser?.customEmojiBadge || undefined,
      verificationType: botUser?.verificationType || "none",
      badges: botUser?.badges || [],
    },

    game: {
      gameId: `sugar-${Date.now()}-${randomInt(1000, 9999)}`,
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

export async function executeSugarLuckCommand(params: {
  roomId: string;
  userId: string;
  username?: string;
  content: string;
}): Promise<SugarLuckResult> {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const username = String(params.username || "مستخدم");
  const content = normalizeText(params.content);
  const lang = detectLang(content);

  const parsed = parseSugarLuckCommand(content);

  if (!parsed.matched || !parsed.type) {
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
          ? "تعذر تنفيذ لعبة سُــــــكَّــــــر: رقم الغرفة غير صحيح."
          : "Cannot run Sugar game: invalid room id.",
    };
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return {
      handled: true,
      success: false,
      reason: "INVALID_USER_ID",
      text:
        lang === "ar"
          ? "تعذر تنفيذ لعبة سُــــــكَّــــــر: رقم المستخدم غير صحيح."
          : "Cannot run Sugar game: invalid user id.",
    };
  }

  const lockKey = getLockKey(roomId, userId, parsed.type);

  if (activeLocks.has(lockKey)) {
    return {
      handled: true,
      success: false,
      reason: "COMMAND_LOCKED",
      text:
        lang === "ar"
          ? "⏳ يتم تنفيذ طلبك السابق بالفعل."
          : "⏳ Your previous request is already running.",
    };
  }

  activeLocks.add(lockKey);

  try {
    const room: any = await Room.findById(roomId)
      .select("roomGames")
      .lean();

    if (!room) {
      return {
        handled: true,
        success: false,
        reason: "ROOM_NOT_FOUND",
        text:
          lang === "ar"
            ? "لم يتم العثور على الغرفة."
            : "Room was not found.",
      };
    }

    if (room?.roomGames?.luckEnabled === false) {
      return {
        handled: true,
        success: false,
        reason: "LUCK_GAME_DISABLED",
        text:
          lang === "ar"
            ? "🎮 لعبة سُــــــكَّــــــر متوقفة في هذه الغرفة."
            : "🎮 Sugar game is disabled in this room.",
      };
    }

    if (parsed.type === "leaderboard") {
      const text = await buildLeaderboard(roomId, lang);

      const message = await createBotGameMessage({
        roomId,
        content: text,
        title: lang === "ar" ? "قائمة سُــــــكَّــــــر" : "Sugar Leaderboard",
        state: "leaderboard",
        payload: {
          command: "leaderboard",
        },
      });

      return {
        handled: true,
        success: true,
        message,
        messages: [message],
        text,
        meta: {
          command: "leaderboard",
        },
      };
    }

    const leftMs = getCooldownLeftMs(roomId, userId, parsed.type);

    if (leftMs > 0) {
      const text = buildCooldownMessage(username, parsed.type, leftMs, lang);

      const message = await createBotGameMessage({
        roomId,
        content: text,
        title: lang === "ar" ? "انتظار" : "Cooldown",
        state: "cooldown",
        payload: {
          command: parsed.type,
          leftMs,
        },
      });

      return {
        handled: true,
        success: true,
        message,
        messages: [message],
        text,
        meta: {
          command: parsed.type,
          leftMs,
        },
      };
    }

    let response: GameActionResponse | null = null;

    if (parsed.type === "luck") {
      response = await playLuck({
        roomId,
        userId,
        username,
        choice: parsed.choice || 1,
        lang,
      });
    }

    if (parsed.type === "million") {
      response = await playMillion({
        roomId,
        userId,
        username,
        lang,
      });
    }

    if (parsed.type === "investment") {
      response = await playInvestment({
        roomId,
        userId,
        username,
        lang,
      });
    }

    if (parsed.type === "speculation") {
      response = await playSpeculation({
        roomId,
        userId,
        username,
        lang,
      });
    }

    if (!response) {
      return {
        handled: false,
      };
    }

    setCooldown(roomId, userId, parsed.type);

    const message = await createBotGameMessage({
      roomId,
      content: response.text,
      title: response.title,
      state: response.state,
      payload: {
        command: parsed.type,
        choice: parsed.choice || null,
        pointsChange: response.pointsChange,
        balance: response.balance,
        player: {
          userId: response.player.userId,
          username: response.player.username,
          points: response.player.points,
          wins: response.player.wins,
          losses: response.player.losses,
          neutral: response.player.neutral,
          millionWins: response.player.millionWins,
          investmentWins: response.player.investmentWins,
          speculationWins: response.player.speculationWins,
          totalWon: response.player.totalWon || 0,
          totalLost: response.player.totalLost || 0,
        },
      },
    });

    return {
      handled: true,
      success: true,
      message,
      messages: [message],
      text: response.text,
      meta: {
        command: parsed.type,
        pointsChange: response.pointsChange,
        balance: response.balance,
        state: response.state,
      },
    };
  } finally {
    activeLocks.delete(lockKey);
  }
}