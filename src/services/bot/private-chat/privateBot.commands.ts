

import {
  BotLang,
  BotReplyPayload,
  CreateUserPayload,
  JoinRoomByCredentialsPayload,
  LeaveRoomByCredentialsPayload,
  TransferCoinzPayload,
} from "../core/bot.types";
import fs from "fs";
import path from "path";



import {
  getCreateUserExistsReply,
  getCreateUserFailedReply,
  getCreateUserInvalidPasswordReply,
  getCreateUserInvalidUsernameReply,
  getCreateUserSuccessReply,
  getJoinRoomFailedReply,
  getJoinRoomLoginFailedReply,
  getJoinRoomRoomNotFoundReply,
  getJoinRoomSuccessReply,
  getJoinRoomUserNotFoundReply,
  getLeaveRoomFailedReply,
  getLeaveRoomRoomNotFoundReply,
  getLeaveRoomSuccessReply,
  getLeaveRoomUserNotFoundReply,
} from "../core/bot.replies";
import { comparePassword, hashPassword } from "../../../utils/hash";
import User from "../../../models/User";
import roomService from "../../room.service";
import Room from "../../../models/Room";

/* =====================================================
   HELPERS
===================================================== */

function normalizeText(value?: string) {
  return String(value || "").trim();
}

function normalizeAtUsername(value?: string) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function escapeRegex(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isEnglishUsername(username: string) {
  return /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/.test(username);
}

/* =====================================================
   CREATE USER
===================================================== */

export async function executeCreateUserCommand(
  payload: CreateUserPayload,
  lang: BotLang
): Promise<BotReplyPayload> {
  try {
    const username = normalizeAtUsername(payload.username);
    const password = normalizeText(payload.password);

    if (!isEnglishUsername(username)) {
      return {
        handled: true,
        intent: "create_user",
        text: getCreateUserInvalidUsernameReply(lang),
      };
    }

    if (password.length < 6) {
      return {
        handled: true,
        intent: "create_user",
        text: getCreateUserInvalidPasswordReply(lang),
      };
    }

    const existing = await User.findOne({ atUsername: username }).lean();
    if (existing) {
      return {
        handled: true,
        intent: "create_user",
        text: getCreateUserExistsReply(lang, username),
      };
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      username,
      atUsername: username,
      password: hashedPassword,
      role: "user",
      provider: "local",
      isOnline: false,
      isInvisible: false,
      lastSeen: null,
    });

    return {
      handled: true,
      intent: "create_user",
      text: getCreateUserSuccessReply(lang, user.username),
      meta: {
        userId: String(user._id),
        username: user.username,
      },
    };
  } catch (error: any) {
    return {
      handled: true,
      intent: "create_user",
      text: getCreateUserFailedReply(lang, error?.message),
    };
  }
}




/* =====================================================
   TRANSFER COINZ LOGIC
===================================================== */

const DAILY_TRANSFER_LIMIT = 1_000_000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const LOG_DIR = path.join(process.cwd(), "storage", "logs");
const LOG_FILE = path.join(LOG_DIR, "coinz-transfer-log.json");

type CoinzTransferLogItem = {
  id: string;
  createdAt: string;
  createdAtMs: number;

  commandRaw?: string;

  sender: {
    userId: string;
    username?: string;
    atUsername?: string;
    role?: string;
    isUnlimited: boolean;
  };

  target: {
    userId?: string;
    username?: string;
    atUsername?: string;
  };

  transfer: {
    requestedAmount: number;
    appliedAmount: number;
    targetBalanceBefore?: number;
    targetBalanceAfter?: number;
  };

  dailyWindow: {
    limit: number;
    sentLast24hBefore: number;
    sentLast24hAfter: number;
    remainingBefore: number;
    remainingAfter: number;
  };

  status: "success" | "rejected" | "error";

  reason?: string;

  meta?: Record<string, any>;
};

function ensureLogFileExists() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function readTransferLogs(): CoinzTransferLogItem[] {
  try {
    ensureLogFileExists();
    const raw = fs.readFileSync(LOG_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeTransferLogs(logs: CoinzTransferLogItem[]) {
  ensureLogFileExists();
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), "utf8");
}

function appendTransferLog(item: CoinzTransferLogItem) {
  const logs = readTransferLogs();
  logs.push(item);
  writeTransferLogs(logs);
}
function canTransferCoinz(role?: string | null) {
  return role === "admin";
}
function isUnlimitedSender(atUsername?: string | null, role?: string | null) {
  const normalized = String(atUsername || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  return role === "admin" && normalized === "admin";
}

function getSentLast24Hours(logs: CoinzTransferLogItem[], senderUserId: string) {
  const now = Date.now();
  const from = now - WINDOW_MS;

  return logs
    .filter((log) => {
      if (log.status !== "success") return false;
      if (String(log.sender.userId) !== String(senderUserId)) return false;
      return log.createdAtMs >= from;
    })
    .reduce((sum, log) => sum + Number(log.transfer.appliedAmount || 0), 0);
}

function makeLogId() {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function executeTransferCoinzCommand(
  payload: TransferCoinzPayload,
  lang: BotLang,
  senderId: string,
  rawCommand?: string
): Promise<BotReplyPayload> {
  const now = Date.now();
  const logs = readTransferLogs();

  let senderUser:
    | {
        _id: any;
        username?: string;
        atUsername?: string;
        role?: string;
        CoinzBalance?: number;
      }
    | null = null;

  let targetUser:
    | {
        _id: any;
        username?: string;
        atUsername?: string;
        CoinzBalance?: number;
        save: () => Promise<any>;
      }
    | null = null;

  try {
    const { username, amount } = payload;

    senderUser = await User.findById(senderId).select(
      "_id username atUsername role CoinzBalance"
    );

    if (!senderUser) {
      const logItem: CoinzTransferLogItem = {
        id: makeLogId(),
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
        commandRaw: rawCommand,
        sender: {
          userId: String(senderId),
          isUnlimited: false,
        },
        target: {
          atUsername: username,
        },
        transfer: {
          requestedAmount: amount,
          appliedAmount: 0,
        },
        dailyWindow: {
          limit: DAILY_TRANSFER_LIMIT,
          sentLast24hBefore: 0,
          sentLast24hAfter: 0,
          remainingBefore: DAILY_TRANSFER_LIMIT,
          remainingAfter: DAILY_TRANSFER_LIMIT,
        },
        status: "rejected",
        reason: "sender_not_found",
      };

      // appendTransferLog(logItem);

      return {
        handled: true,
        intent: "transfer_coinz",
        text: lang === "ar" ? "تعذر العثور على المرسل." : "Sender not found.",
      };
    }

 const normalizedSenderAt = String(senderUser.atUsername || "")
  .trim()
  .replace(/^@+/, "")
  .toLowerCase();

const senderRole = String(senderUser.role || "").toLowerCase();

const allowed = canTransferCoinz(senderRole);
const unlimited = isUnlimitedSender(normalizedSenderAt, senderRole);
if (!allowed) {
  const logItem: CoinzTransferLogItem = {
    id: makeLogId(),
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    commandRaw: rawCommand,
    sender: {
      userId: String(senderUser._id),
      username: senderUser.username,
      atUsername: senderUser.atUsername,
      role: senderUser.role,
      isUnlimited: false,
    },
    target: {
      atUsername: username,
    },
    transfer: {
      requestedAmount: amount,
      appliedAmount: 0,
    },
    dailyWindow: {
      limit: DAILY_TRANSFER_LIMIT,
      sentLast24hBefore: 0,
      sentLast24hAfter: 0,
      remainingBefore: DAILY_TRANSFER_LIMIT,
      remainingAfter: DAILY_TRANSFER_LIMIT,
    },
    status: "rejected",
    reason: "sender_not_admin",
    meta: {
      requiredRole: "admin",
      actualRole: senderRole,
    },
  };

  // appendTransferLog(logItem);

  return {
    handled: true,
    intent: "transfer_coinz",
    text:
      lang === "ar"
        ? "هذا الأمر متاح فقط للمستخدمين الذين رولهم admin."
        : "This command is available only for users whose role is admin.",
    meta: {
      requiredRole: "admin",
      actualRole: senderRole,
    },
  };
}
    const normalizedTargetUsername = String(username || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();

    if (!normalizedTargetUsername || !Number.isFinite(amount) || amount <= 0) {
      const sentLast24hBefore = unlimited ? 0 : getSentLast24Hours(logs, String(senderUser._id));
      const remainingBefore = unlimited
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, DAILY_TRANSFER_LIMIT - sentLast24hBefore);

      const logItem: CoinzTransferLogItem = {
        id: makeLogId(),
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
        commandRaw: rawCommand,
        sender: {
          userId: String(senderUser._id),
          username: senderUser.username,
          atUsername: senderUser.atUsername,
          role: senderUser.role,
          isUnlimited: unlimited,
        },
        target: {
          atUsername: normalizedTargetUsername,
        },
        transfer: {
          requestedAmount: amount,
          appliedAmount: 0,
        },
        dailyWindow: {
          limit: DAILY_TRANSFER_LIMIT,
          sentLast24hBefore,
          sentLast24hAfter: sentLast24hBefore,
          remainingBefore,
          remainingAfter: remainingBefore,
        },
        status: "rejected",
        reason: "invalid_command_or_amount",
      };

      // appendTransferLog(logItem);

      return {
        handled: true,
        intent: "transfer_coinz",
        text:
          lang === "ar"
            ? "صيغة الأمر غير صحيحة. استخدم: transfercoinz@username@5000"
            : "Invalid command format. Use: transfercoinz@username@5000",
      };
    }

    targetUser = await User.findOne({
      atUsername: normalizedTargetUsername,
    }).select("_id username atUsername CoinzBalance");

    const sentLast24hBefore = unlimited ? 0 : getSentLast24Hours(logs, String(senderUser._id));
    const remainingBefore = unlimited
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, DAILY_TRANSFER_LIMIT - sentLast24hBefore);

    if (!targetUser) {
      const logItem: CoinzTransferLogItem = {
        id: makeLogId(),
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
        commandRaw: rawCommand,
        sender: {
          userId: String(senderUser._id),
          username: senderUser.username,
          atUsername: senderUser.atUsername,
          role: senderUser.role,
          isUnlimited: unlimited,
        },
        target: {
          atUsername: normalizedTargetUsername,
        },
        transfer: {
          requestedAmount: amount,
          appliedAmount: 0,
        },
        dailyWindow: {
          limit: DAILY_TRANSFER_LIMIT,
          sentLast24hBefore,
          sentLast24hAfter: sentLast24hBefore,
          remainingBefore,
          remainingAfter: remainingBefore,
        },
        status: "rejected",
        reason: "target_not_found",
      };

      // appendTransferLog(logItem);

      return {
        handled: true,
        intent: "transfer_coinz",
        text:
          lang === "ar"
            ? `لم يتم العثور على المستخدم @${normalizedTargetUsername}.`
            : `User @${normalizedTargetUsername} was not found.`,
      };
    }

    if (String(targetUser._id) === String(senderUser._id)) {
      const logItem: CoinzTransferLogItem = {
        id: makeLogId(),
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
        commandRaw: rawCommand,
        sender: {
          userId: String(senderUser._id),
          username: senderUser.username,
          atUsername: senderUser.atUsername,
          role: senderUser.role,
          isUnlimited: unlimited,
        },
        target: {
          userId: String(targetUser._id),
          username: targetUser.username,
          atUsername: targetUser.atUsername,
        },
        transfer: {
          requestedAmount: amount,
          appliedAmount: 0,
          targetBalanceBefore: Number(targetUser.CoinzBalance || 0),
          targetBalanceAfter: Number(targetUser.CoinzBalance || 0),
        },
        dailyWindow: {
          limit: DAILY_TRANSFER_LIMIT,
          sentLast24hBefore,
          sentLast24hAfter: sentLast24hBefore,
          remainingBefore,
          remainingAfter: remainingBefore,
        },
        status: "rejected",
        reason: "self_transfer_not_allowed",
      };

      // appendTransferLog(logItem);

      return {
        handled: true,
        intent: "transfer_coinz",
        text:
          lang === "ar"
            ? "لا يمكنك التحويل لنفسك."
            : "You cannot transfer to yourself.",
      };
    }

    if (!unlimited && amount > remainingBefore) {
      const logItem: CoinzTransferLogItem = {
        id: makeLogId(),
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
        commandRaw: rawCommand,
        sender: {
          userId: String(senderUser._id),
          username: senderUser.username,
          atUsername: senderUser.atUsername,
          role: senderUser.role,
          isUnlimited: unlimited,
        },
        target: {
          userId: String(targetUser._id),
          username: targetUser.username,
          atUsername: targetUser.atUsername,
        },
        transfer: {
          requestedAmount: amount,
          appliedAmount: 0,
          targetBalanceBefore: Number(targetUser.CoinzBalance || 0),
          targetBalanceAfter: Number(targetUser.CoinzBalance || 0),
        },
        dailyWindow: {
          limit: DAILY_TRANSFER_LIMIT,
          sentLast24hBefore,
          sentLast24hAfter: sentLast24hBefore,
          remainingBefore,
          remainingAfter: remainingBefore,
        },
        status: "rejected",
        reason: "daily_limit_exceeded",
      };

      // appendTransferLog(logItem);

      return {
        handled: true,
        intent: "transfer_coinz",
        text:
          lang === "ar"
            ? `لا يمكنك إرسال أكثر من 1000000 كوينز خلال 24 ساعة. المتبقي لك الآن: ${remainingBefore}`
            : `You cannot send more than 1000000 coinz within 24 hours. Remaining available: ${remainingBefore}`,
        meta: {
          dailyLimit: DAILY_TRANSFER_LIMIT,
          remaining: remainingBefore,
          sentLast24h: sentLast24hBefore,
        },
      };
    }

    const targetBalanceBefore = Number(targetUser.CoinzBalance || 0);
    targetUser.CoinzBalance = targetBalanceBefore + amount;
    await targetUser.save();

    const sentLast24hAfter = unlimited ? 0 : sentLast24hBefore + amount;
    const remainingAfter = unlimited
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, DAILY_TRANSFER_LIMIT - sentLast24hAfter);

    const logItem: CoinzTransferLogItem = {
      id: makeLogId(),
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
      commandRaw: rawCommand,
      sender: {
        userId: String(senderUser._id),
        username: senderUser.username,
        atUsername: senderUser.atUsername,
        role: senderUser.role,
        isUnlimited: unlimited,
      },
      target: {
        userId: String(targetUser._id),
        username: targetUser.username,
        atUsername: targetUser.atUsername,
      },
      transfer: {
        requestedAmount: amount,
        appliedAmount: amount,
        targetBalanceBefore,
        targetBalanceAfter: Number(targetUser.CoinzBalance || 0),
      },
      dailyWindow: {
        limit: DAILY_TRANSFER_LIMIT,
        sentLast24hBefore,
        sentLast24hAfter,
        remainingBefore,
        remainingAfter,
      },
      status: "success",
      reason: unlimited ? "unlimited_sender" : "ok",
  meta: {
  senderNameBypass: senderRole === "admin" && normalizedSenderAt === "admin",
  senderRole,
},
    };

    // appendTransferLog(logItem);

   if (unlimited) {
  return {
    handled: true,
    intent: "transfer_coinz",
    text:
      lang === "ar"
        ? `تم تحويل ${amount} كوينز إلى @${targetUser.atUsername} بنجاح. لأن الرول admin والاسم admin فالتحويل لهذا الحساب مفتوح بدون حد يومي.`
        : `${amount} coinz transferred successfully to @${targetUser.atUsername}. Since the sender role is admin and username is admin, this sender is exempt from the daily limit.`,
    meta: {
      unlimited: true,
      senderRole,
      senderAtUsername: normalizedSenderAt,
      targetBalance: targetUser.CoinzBalance,
    },
  };
}

    return {
      handled: true,
      intent: "transfer_coinz",
      text:
        lang === "ar"
          ? `تم تحويل ${amount} كوينز إلى @${targetUser.atUsername} بنجاح. المتبقي لك من حد 24 ساعة: ${remainingAfter}`
          : `${amount} coinz transferred successfully to @${targetUser.atUsername}. Remaining from your 24h limit: ${remainingAfter}`,
      meta: {
        dailyLimit: DAILY_TRANSFER_LIMIT,
        sentLast24h: sentLast24hAfter,
        remaining: remainingAfter,
        targetBalance: targetUser.CoinzBalance,
      },
    };
  } catch (error: any) {
    const senderAt = senderUser?.atUsername;
    const unlimited = isUnlimitedSender(senderAt);

    const sentLast24hBefore =
      senderUser && !unlimited ? getSentLast24Hours(readTransferLogs(), String(senderUser._id)) : 0;

    const remainingBefore = unlimited
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, DAILY_TRANSFER_LIMIT - sentLast24hBefore);

    const logItem: CoinzTransferLogItem = {
      id: makeLogId(),
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
      commandRaw: rawCommand,
      sender: {
        userId: String(senderUser?._id || senderId || ""),
        username: senderUser?.username,
        atUsername: senderUser?.atUsername,
        role: senderUser?.role,
        isUnlimited: unlimited,
      },
      target: {
        userId: targetUser?._id ? String(targetUser._id) : undefined,
        username: targetUser?.username,
        atUsername: targetUser?.atUsername || payload?.username,
      },
      transfer: {
        requestedAmount: Number(payload?.amount || 0),
        appliedAmount: 0,
        targetBalanceBefore: targetUser?.CoinzBalance,
        targetBalanceAfter: targetUser?.CoinzBalance,
      },
      dailyWindow: {
        limit: DAILY_TRANSFER_LIMIT,
        sentLast24hBefore,
        sentLast24hAfter: sentLast24hBefore,
        remainingBefore,
        remainingAfter: remainingBefore,
      },
      status: "error",
      reason: error?.message || "unknown_error",
    };

    // appendTransferLog(logItem);

    return {
      handled: true,
      intent: "transfer_coinz",
      text:
        lang === "ar"
          ? "حدث خطأ أثناء تنفيذ التحويل."
          : "An error occurred while processing the transfer.",
      meta: {
        error: error?.message || "unknown_error",
      },
    };
  }
}
/* =====================================================
   BOT JOIN ROOM
   bot@username@password@room
===================================================== */

export async function executeBotJoinRoomCommand(
  payload: JoinRoomByCredentialsPayload,
  lang: BotLang
): Promise<BotReplyPayload> {
  try {
    const username = normalizeAtUsername(payload.username);
    const password = normalizeText(payload.password);
    const roomName = normalizeText(payload.roomName);

    const user = await User.findOne({ atUsername: username }).select(
      "_id username atUsername password provider"
    );

    if (!user) {
      return {
        handled: true,
        intent: "join_room_by_credentials",
        text: getJoinRoomUserNotFoundReply(lang, username),
      };
    }

    if (!user.password) {
      return {
        handled: true,
        intent: "join_room_by_credentials",
        text: getJoinRoomLoginFailedReply(lang),
      };
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return {
        handled: true,
        intent: "join_room_by_credentials",
        text: getJoinRoomLoginFailedReply(lang),
      };
    }

    const room = await Room.findOne({
      name: {
        $regex: `^${escapeRegex(roomName)}$`,
        $options: "i",
      },
    }).select("_id name");

    if (!room) {
      return {
        handled: true,
        intent: "join_room_by_credentials",
        text: getJoinRoomRoomNotFoundReply(lang, roomName),
      };
    }

    await roomService.joinRoom(
      String(room._id),
      String(user._id),
      password
    );

    return {
      handled: true,
      intent: "join_room_by_credentials",
      text: getJoinRoomSuccessReply(lang, room.name),
      meta: {
        roomId: String(room._id),
        roomName: room.name,
        loggedInUserId: String(user._id),
        loggedInUsername: user.username,
        source: "bot",
      },
    };
  } catch (error: any) {
    return {
      handled: true,
      intent: "join_room_by_credentials",
      text: getJoinRoomFailedReply(lang, error?.message),
    };
  }
}

/* =====================================================
   BOT LEAVE ROOM
   botleave@username@room
===================================================== */

export async function executeBotLeaveRoomCommand(
  payload: LeaveRoomByCredentialsPayload,
  lang: BotLang
): Promise<BotReplyPayload> {
  try {
    const username = normalizeAtUsername(payload.username);
    const roomName = normalizeText(payload.roomName);

    const user = await User.findOne({ atUsername: username }).select(
      "_id username atUsername"
    );

    if (!user) {
      return {
        handled: true,
        intent: "leave_room_by_credentials",
        text: getLeaveRoomUserNotFoundReply(lang, username),
      };
    }

    const room = await Room.findOne({
      name: {
        $regex: `^${escapeRegex(roomName)}$`,
        $options: "i",
      },
    }).select("_id name");

    if (!room) {
      return {
        handled: true,
        intent: "leave_room_by_credentials",
        text: getLeaveRoomRoomNotFoundReply(lang, roomName),
      };
    }

    await roomService.leaveRoom(
      String(room._id),
      String(user._id),
      false
    );

    return {
      handled: true,
      intent: "leave_room_by_credentials",
      text: getLeaveRoomSuccessReply(lang, room.name),
      meta: {
        roomId: String(room._id),
        roomName: room.name,
        userId: String(user._id),
        username: user.username,
        source: "bot",
      },
    };
  } catch (error: any) {
    return {
      handled: true,
      intent: "leave_room_by_credentials",
      text: getLeaveRoomFailedReply(lang, error?.message),
    };
  }
}