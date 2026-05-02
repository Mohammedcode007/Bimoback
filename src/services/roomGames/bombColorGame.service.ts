// src/services/roomGames/bombColorGame.service.ts

import mongoose, { Types } from "mongoose";
import Room from "../../models/Room";
import RoomMessage from "../../models/RoomMessage";
import User from "../../models/User";
import { getIO } from "../../config/socket";

import {
  getFakePointPlayer,
  addFakePoints,
  subtractFakePoints,
} from "../gamePoints/fakePoints.service";

type BombColor = "red" | "green" | "blue";

type BombChallenge = {
  id: string;

  sourceRoomId: string;
  targetRoomId: string;
  targetRoomName: string;

  attackerId: string;
  attackerName: string;

  targetId: string;
  targetName: string;

  stake: number;
  correctColor: BombColor;

  createdAt: number;
  expiresAt: number;

  reminderTimers: NodeJS.Timeout[];
  timeoutTimer: NodeJS.Timeout;
};

export type BombColorGameResult = {
  handled: boolean;
  success?: boolean;
  message?: any;
  messages?: any[];
  text?: string;
  reason?: string;
  meta?: Record<string, any>;
};

const BOT_NAME = "💣 Bomb";
const BOT_AT_USERNAME = "bomb_bot";

const COLORS: BombColor[] = ["red", "green", "blue"];

const LOCAL_BOMB_COST = 10_000;
const ROOM_BOMB_COST = 50_000;

const CHOOSE_TIME_MS = 30_000;

const activeBombs = new Map<string, BombChallenge>();

function createChallengeId() {
  return `bomb_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function getChallengeKey(roomId: string, targetId: string) {
  return `${roomId}:${targetId}`;
}

function pickColor(): BombColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function escapeRegExp(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function colorLabel(color: BombColor) {
  if (color === "red") return "أحمر";
  if (color === "green") return "أخضر";
  return "أزرق";
}

function normalizeColor(value?: string): BombColor | null {
  const text = normalizeText(value).toLowerCase();

  if (
    [
      "red",
      "r",
      "احمر",
      "أحمر",
      "الأحمر",
      "الاحمر",
      "🔴",
    ].includes(text)
  ) {
    return "red";
  }

  if (
    [
      "green",
      "g",
      "اخضر",
      "أخضر",
      "الأخضر",
      "الاخضر",
      "🟢",
    ].includes(text)
  ) {
    return "green";
  }

  if (
    [
      "blue",
      "b",
      "ازرق",
      "أزرق",
      "الأزرق",
      "الازرق",
      "🔵",
    ].includes(text)
  ) {
    return "blue";
  }

  return null;
}

function parseBombCommand(content?: string) {
  const text = normalizeText(content);

  /**
   * الصيغ:
   * bomb@username
   * bomb@username@roomname
   */
  const match = text.match(/^bomb@([^@\s]+)(?:@(.+))?$/i);

  if (!match) return null;

  const targetUsername = String(match[1] || "").trim();
  const targetRoomName = String(match[2] || "").trim();

  if (!targetUsername) return null;

  return {
    targetUsername,
    targetRoomName,
    hasRoomTarget: Boolean(targetRoomName),
  };
}

async function getUserBasic(userId: string) {
  const u: any = await User.findById(userId)
    .select("_id username atUsername avatar")
    .lean();

  if (!u?._id) {
    return {
      _id: userId,
      username: "مستخدم",
      atUsername: "",
      avatar: "",
    };
  }

  return {
    _id: String(u._id),
    username: String(u.username || u.atUsername || "مستخدم"),
    atUsername: String(u.atUsername || ""),
    avatar: String(u.avatar || ""),
  };
}

async function getBombBotUser() {
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

async function createGameMessage(params: {
  roomId: string;
  content: string;
  state?: string;
  challenge?: Partial<BombChallenge> | null;
}) {
  const { roomId, content, state = "info", challenge = null } = params;

  const botUser: any = await getBombBotUser();

  const message = await RoomMessage.create({
    room: new mongoose.Types.ObjectId(roomId),

    sender: botUser?._id || undefined,

    type: "game",

    /**
     * ✅ المهم هنا:
     * لا تستخدم duel.
     * الفرونت سيقرأها كقنبلة من gameType === "bomb"
     */
    gameType: "bomb",

    content,

    senderSnapshot: {
      _id: botUser?._id ? String(botUser._id) : "bomb-bot",
      username: botUser?.username || BOT_NAME,
      atUsername: botUser?.atUsername || BOT_AT_USERNAME,
      avatar: botUser?.avatar || "",
      activeCustomization: botUser?.activeCustomization || {
        avatarFrame: "",
        messageEffect: "",
        profileEntryAnimation: "",
        badges: [],
        verificationType: "none",
      },
      customEmojiBadge: botUser?.customEmojiBadge || {
        emoji: "",
        isActive: false,
        purchasedAt: null,
        expiresAt: null,
      },
      verificationType: botUser?.verificationType || "none",
      avatarFrame: "",
      badges: botUser?.badges || [],
      profileEntryAnimation: "",
    },

    game: {
      gameId: String(challenge?.id || createChallengeId()),
      title: "Bomb Color",
      state,
      turnUserId: String(challenge?.targetId || ""),
      winnerUserId: "",
      payload: {
        game: "bomb_color",
        challengeId: String(challenge?.id || ""),
        attackerId: String(challenge?.attackerId || ""),
        attackerName: String(challenge?.attackerName || ""),
        targetId: String(challenge?.targetId || ""),
        targetName: String(challenge?.targetName || ""),
        stake: Number(challenge?.stake || 0),
        colors: ["أحمر", "أخضر", "أزرق"],
        expiresAt: challenge?.expiresAt || null,
      },
    },
  } as any);

  return message;
}

async function createAndEmitGameMessage(params: {
  roomId: string;
  content: string;
  state?: string;
  challenge?: Partial<BombChallenge> | null;
}) {
  const msg = await createGameMessage(params);

  getIO().to(`room:${params.roomId}`).emit("room:message:new", msg);

  return msg;
}

async function emitActiveCount(roomId: string) {
  const room = await Room.findById(roomId).select("activeUsers");
  if (!room) return;

  const activeCount = Array.isArray(room.activeUsers)
    ? room.activeUsers.length
    : 0;

  getIO().to(`room:${roomId}`).emit("room:activeCount:update", {
    roomId,
    activeCount,
  });

  getIO().to(`room:${roomId}`).emit("room:users:update", {
    roomId,
  });
}

async function kickUserFromRoom(params: {
  roomId: string;
  targetId: string;
  targetName: string;
  attackerId: string;
  attackerName: string;
}) {
  const { roomId, targetId, targetName, attackerId, attackerName } = params;

  await Room.updateOne(
    {
      _id: roomId,
      activeUsers: new Types.ObjectId(targetId),
    },
    {
      $pull: {
        activeUsers: new Types.ObjectId(targetId),
      },
      $inc: {
        usersCount: -1,
      },
    }
  );

  await Room.updateOne(
    {
      _id: roomId,
      usersCount: { $lt: 0 },
    },
    {
      $set: {
        usersCount: 0,
      },
    }
  );

  const io = getIO();

  io.to(targetId).emit("room:kicked", {
    roomId,
    reason: "bomb_color_failed",
    actorId: attackerId,
    actorName: attackerName,
    targetId,
    targetName,
    message: `تم طردك بواسطة ${attackerName} لأنك اخترت لون القنبلة بشكل خاطئ.`,
  });

  io.to(`room:${roomId}`).emit("room:user:kicked", {
    roomId,
    targetId,
    targetName,
    actorId: attackerId,
    actorName: attackerName,
    reason: "bomb_color_failed",
    message: `🚪 تم طرد ${targetName} بواسطة ${attackerName}`,
  });

  await emitActiveCount(roomId);
}

function clearChallengeTimers(challenge: BombChallenge) {
  for (const timer of challenge.reminderTimers || []) {
    clearTimeout(timer);
  }

  if (challenge.timeoutTimer) {
    clearTimeout(challenge.timeoutTimer);
  }
}

async function resolveChallenge(params: {
  challengeKey: string;
  chosenColor: BombColor | null;
  timeout?: boolean;
}) {
  const { challengeKey, chosenColor, timeout = false } = params;

  const challenge = activeBombs.get(challengeKey);
  if (!challenge) return null;

  activeBombs.delete(challengeKey);
  clearChallengeTimers(challenge);

  const correct = chosenColor === challenge.correctColor;

  if (correct) {
    /**
     * الهدف اختار اللون الصحيح:
     * يخصم من المهاجم ويضاف للهدف.
     */
    await subtractFakePoints({
      roomId: challenge.targetRoomId,
      userId: challenge.attackerId,
      username: challenge.attackerName,
      amount: challenge.stake,
      reason: "bomb_color_attacker_lost" as any,
      meta: {
        challengeId: challenge.id,
        targetId: challenge.targetId,
        targetName: challenge.targetName,
        correctColor: challenge.correctColor,
        chosenColor,
      },
    });

    const winResult = await addFakePoints({
      roomId: challenge.targetRoomId,
      userId: challenge.targetId,
      username: challenge.targetName,
      amount: challenge.stake,
      reason: "bomb_color_target_win" as any,
      meta: {
        challengeId: challenge.id,
        attackerId: challenge.attackerId,
        attackerName: challenge.attackerName,
        correctColor: challenge.correctColor,
        chosenColor,
      },
    });

    return createGameMessage({
      roomId: challenge.targetRoomId,
      state: "success",
      challenge: {
        ...challenge,
        targetId: "",
      },
      content:
        `🛡️ نجا ${challenge.targetName} من القنبلة!\n` +
        `✅ اختار اللون الصحيح: ${colorLabel(chosenColor!)}\n` +
        `💰 تم خصم ${challenge.stake.toLocaleString()} نقطة من ${challenge.attackerName} وإضافتها إلى ${challenge.targetName}.\n` +
        `رصيد ${challenge.targetName} الآن: ${winResult.balance}`,
    });
  }

  /**
   * الهدف أخطأ أو انتهى الوقت:
   * يخصم منه ويضاف للمهاجم، ثم يتم طرده من الغرفة.
   */
  await subtractFakePoints({
    roomId: challenge.targetRoomId,
    userId: challenge.targetId,
    username: challenge.targetName,
    amount: challenge.stake,
    reason: timeout
      ? ("bomb_color_timeout_loss" as any)
      : ("bomb_color_wrong_loss" as any),
    meta: {
      challengeId: challenge.id,
      attackerId: challenge.attackerId,
      attackerName: challenge.attackerName,
      correctColor: challenge.correctColor,
      chosenColor: chosenColor || "",
      timeout,
    },
  });

  const attackerWin = await addFakePoints({
    roomId: challenge.targetRoomId,
    userId: challenge.attackerId,
    username: challenge.attackerName,
    amount: challenge.stake,
    reason: timeout
      ? ("bomb_color_timeout_win" as any)
      : ("bomb_color_attacker_win" as any),
    meta: {
      challengeId: challenge.id,
      targetId: challenge.targetId,
      targetName: challenge.targetName,
      correctColor: challenge.correctColor,
      chosenColor: chosenColor || "",
      timeout,
    },
  });

  await kickUserFromRoom({
    roomId: challenge.targetRoomId,
    targetId: challenge.targetId,
    targetName: challenge.targetName,
    attackerId: challenge.attackerId,
    attackerName: challenge.attackerName,
  });

  const resultText = timeout
    ? `⏰ انتهى الوقت ولم يختر ${challenge.targetName} أي لون.`
    : `💥 اختار ${challenge.targetName} لونًا خطأ: ${
        chosenColor ? colorLabel(chosenColor) : "غير معروف"
      }`;

  return createGameMessage({
    roomId: challenge.targetRoomId,
    state: "failed",
    challenge: {
      ...challenge,
      targetId: "",
    },
    content:
      `${resultText}\n` +
      `🎯 اللون الصحيح كان: ${colorLabel(challenge.correctColor)}\n` +
      `🚪 تم طرد ${challenge.targetName} بواسطة ${challenge.attackerName}.\n` +
      `💰 تم خصم ${challenge.stake.toLocaleString()} نقطة من ${challenge.targetName} وإضافتها إلى ${challenge.attackerName}.\n` +
      `رصيد ${challenge.attackerName} الآن: ${attackerWin.balance}`,
  });
}

async function findTargetUser(username: string) {
  const clean = String(username || "").trim().replace(/^@/, "");
  const rx = new RegExp(`^${escapeRegExp(clean)}$`, "i");

  return User.findOne({
    $or: [{ username: rx }, { atUsername: rx }],
  })
    .select("_id username atUsername avatar")
    .lean();
}

async function findTargetRoom(params: {
  currentRoomId: string;
  targetRoomName?: string;
}) {
  const { currentRoomId, targetRoomName } = params;

  if (!targetRoomName) {
    return Room.findById(currentRoomId);
  }

  const rx = new RegExp(`^${escapeRegExp(targetRoomName)}$`, "i");

  return Room.findOne({
    name: rx,
  });
}

function isUserInsideRoom(room: any, userId: string) {
  const uid = String(userId);

  return (
    Array.isArray(room?.activeUsers) &&
    room.activeUsers.some((x: any) => String(x?._id || x) === uid)
  );
}

export async function executeBombColorCommand(params: {
  roomId: string;
  userId: string;
  username: string;
  content: string;
}): Promise<BombColorGameResult> {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const username = String(params.username || "مستخدم");
  const content = normalizeText(params.content);

  if (!content) {
    return { handled: false };
  }

  /**
   * أولًا: هل هذه إجابة لون على قنبلة نشطة؟
   */
  const chosenColor = normalizeColor(content);
  const answerKey = getChallengeKey(roomId, userId);

  if (chosenColor && activeBombs.has(answerKey)) {
    const resultMessage = await resolveChallenge({
      challengeKey: answerKey,
      chosenColor,
      timeout: false,
    });

    return {
      handled: true,
      success: true,
      message: resultMessage,
      meta: {
        action: "bomb_color_answer",
        chosenColor,
      },
    };
  }

  /**
   * ثانيًا: هل هذا أمر bomb@username أو bomb@username@roomname ؟
   */
  const parsed = parseBombCommand(content);

  if (!parsed) {
    return { handled: false };
  }

  const attacker = await getUserBasic(userId);

  const target: any = await findTargetUser(parsed.targetUsername);

  if (!target?._id) {
    const msg = await createGameMessage({
      roomId,
      state: "error",
      content: `❌ لم يتم العثور على المستخدم @${parsed.targetUsername}.`,
    });

    return {
      handled: true,
      success: false,
      message: msg,
      reason: "USER_NOT_FOUND",
    };
  }

  const targetId = String(target._id);
  const targetName = String(target.username || parsed.targetUsername);

  if (targetId === userId) {
    const msg = await createGameMessage({
      roomId,
      state: "error",
      content: "❌ لا يمكنك تفجير نفسك.",
    });

    return {
      handled: true,
      success: false,
      message: msg,
      reason: "SELF_BOMB",
    };
  }

  const targetRoom: any = await findTargetRoom({
    currentRoomId: roomId,
    targetRoomName: parsed.targetRoomName,
  });

  if (!targetRoom?._id) {
    const msg = await createGameMessage({
      roomId,
      state: "error",
      content: `❌ لم يتم العثور على الغرفة: ${parsed.targetRoomName}`,
    });

    return {
      handled: true,
      success: false,
      message: msg,
      reason: "ROOM_NOT_FOUND",
    };
  }

  const targetRoomId = String(targetRoom._id);
  const targetRoomName = String(targetRoom.name || "الغرفة");

  const stake = parsed.hasRoomTarget ? ROOM_BOMB_COST : LOCAL_BOMB_COST;

  const targetInside = isUserInsideRoom(targetRoom, targetId);

  if (!targetInside) {
    const msg = await createGameMessage({
      roomId,
      state: "error",
      content: `❌ ${targetName} غير موجود داخل غرفة ${targetRoomName}.`,
    });

    return {
      handled: true,
      success: false,
      message: msg,
      reason: "TARGET_NOT_INSIDE_ROOM",
    };
  }

  const challengeKey = getChallengeKey(targetRoomId, targetId);

  if (activeBombs.has(challengeKey)) {
    const msg = await createGameMessage({
      roomId,
      state: "error",
      content: `⚠️ يوجد تحدي قنبلة نشط بالفعل على ${targetName} داخل ${targetRoomName}.`,
    });

    return {
      handled: true,
      success: false,
      message: msg,
      reason: "ALREADY_ACTIVE",
    };
  }

  /**
   * ✅ شرط اللعب الوحيد: النقاط.
   * لا يوجد أي استثناء للصانع / الأونر / الأدمن.
   *
   * لازم المهاجم يملك قيمة القنبلة لأنه قد يخسرها لو الهدف اختار صح.
   * ولازم الهدف يملك قيمة القنبلة لأنه قد يخسرها لو اختار خطأ أو انتهى الوقت.
   */
  const attackerPoints = await getFakePointPlayer({
    roomId: targetRoomId,
    userId,
    username: attacker.username,
  });

  const attackerBalance = Number(attackerPoints.points || 0);

  if (attackerBalance < stake) {
    const msg = await createGameMessage({
      roomId,
      state: "error",
      content:
        `❌ لا يمكنك لعب البومب لأن نقاطك غير كافية.\n` +
        `المطلوب: ${stake.toLocaleString()} نقطة.\n` +
        `رصيدك الحالي: ${attackerBalance.toLocaleString()} نقطة.`,
    });

    return {
      handled: true,
      success: false,
      message: msg,
      reason: "INSUFFICIENT_ATTACKER_POINTS",
    };
  }

  const targetPoints = await getFakePointPlayer({
    roomId: targetRoomId,
    userId: targetId,
    username: targetName,
  });

  const targetBalance = Number(targetPoints.points || 0);

  if (targetBalance < stake) {
    const msg = await createGameMessage({
      roomId,
      state: "error",
      content:
        `❌ لا يمكن تفجير ${targetName} لأنه لا يملك نقاطًا كافية للعب البومب.\n` +
        `المطلوب: ${stake.toLocaleString()} نقطة.\n` +
        `رصيد ${targetName} الحالي: ${targetBalance.toLocaleString()} نقطة.`,
    });

    return {
      handled: true,
      success: false,
      message: msg,
      reason: "INSUFFICIENT_TARGET_POINTS",
    };
  }

  const correctColor = pickColor();

  const challengeId = createChallengeId();
  const now = Date.now();

  const challenge: BombChallenge = {
    id: challengeId,

    sourceRoomId: roomId,
    targetRoomId,
    targetRoomName,

    attackerId: userId,
    attackerName: attacker.username || username,

    targetId,
    targetName,

    stake,
    correctColor,

    createdAt: now,
    expiresAt: now + CHOOSE_TIME_MS,

    reminderTimers: [],
    timeoutTimer: null as any,
  };

  /**
   * رسائل التذكير كل 10 ثواني.
   * عند 10 ثواني من البداية = باقي 20
   * عند 20 ثانية من البداية = باقي 10
   */
  for (const leftSeconds of [20, 10]) {
    const timer = setTimeout(async () => {
      if (!activeBombs.has(challengeKey)) return;

      await createAndEmitGameMessage({
        roomId: targetRoomId,
        state: "reminder",
        challenge,
        content:
          `⏳ تذكير إلى ${targetName}\n` +
          `عليك اختيار لون قبل انفجار القنبلة.\n` +
          `الألوان: أحمر / أخضر / أزرق\n` +
          `الوقت المتبقي: ${leftSeconds} ثانية`,
      });
    }, CHOOSE_TIME_MS - leftSeconds * 1000);

    challenge.reminderTimers.push(timer);
  }

  /**
   * انتهاء الوقت بعد 30 ثانية.
   */
  challenge.timeoutTimer = setTimeout(async () => {
    try {
      const resultMessage = await resolveChallenge({
        challengeKey,
        chosenColor: null,
        timeout: true,
      });

      if (resultMessage) {
        getIO()
          .to(`room:${targetRoomId}`)
          .emit("room:message:new", resultMessage);
      }
    } catch (err: any) {
      console.log("❌ [BombColor] timeout resolve error:", err?.message || err);
    }
  }, CHOOSE_TIME_MS);

  activeBombs.set(challengeKey, challenge);

  const startText =
    `💣 ${attacker.username} زرع قنبلة لـ ${targetName} داخل ${targetRoomName}!\n` +
    `🎨 أمام ${targetName} ثلاث ألوان: أحمر / أخضر / أزرق\n` +
    `⏳ يجب اختيار اللون الصحيح خلال 30 ثانية.\n` +
    `💰 قيمة التحدي: ${stake.toLocaleString()} نقطة.\n\n` +
    `اكتب فقط: أحمر أو أخضر أو أزرق`;

  const msg = await createGameMessage({
    roomId: targetRoomId,
    state: "started",
    challenge,
    content: startText,
  });

  return {
    handled: true,
    success: true,
    message: msg,
    meta: {
      action: "bomb_color_started",
      challengeId,
      targetRoomId,
      targetRoomName,
      attackerId: userId,
      targetId,
      stake,
    },
  };
}