import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Room, { RoomType, RoomPremiumLevel } from "../models/Room";
import RoomMessage from "../models/RoomMessage";
import User from "../models/User";

type AuthedReq = Request & { userId?: string; user?: any };

type Role = "creator" | "owner" | "admin" | "member" | "none";

/* =========================
   الأسعار (CoinZ Prices)
   عدّلها كما تريد
========================= */

const COINZ_PRICES = {
  GET_CONTROL: 0, // عرض صفحة الضبط (اختياري)
  UPDATE_INFO: 100,
  CHANGE_TYPE: 200,
  CHANGE_PREMIUM: 150,
  SET_LOCK: 20,
  SET_ANTISPAM: 50,
  SET_SLOWMODE: 30,
  SET_VOICE_SEATS: 40,
  BOOST: 1000,
  POLL_START: 60,
  POLL_VOTE: 5,
  POLL_END: 20,
  INCREASE_MAX_USERS: 120,
  DELETE_ROOM: 1000
} as const;

/* =========================
   Helpers
========================= */

function getUserId(req: AuthedReq) {
  // ✅ متوافق مع protect الحالي: req.user = { id: decoded.id }
  const uid =
    req.userId ||
    req.user?._id?.toString?.() ||
    req.user?.id?.toString?.() ||
    req.user?.userId?.toString?.();

  if (!uid) throw new Error("Unauthorized");
  return String(uid);
}

function isValidObjectId(id: any) {
  return Types.ObjectId.isValid(String(id || ""));
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function tagsToArray(v: any) {
  const arr = Array.isArray(v) ? v : String(v || "").split(",");
  const clean = arr
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  return Array.from(new Set(clean));
}

function ensureArrays(room: any) {
  room.owners ||= [];
  room.admins ||= [];
  room.members ||= [];
  room.blockeds ||= [];
  room.activeUsers ||= [];
  room.voiceQueue ||= [];
  room.raisedHands ||= [];
  room.voiceSpeakers ||= [];
  room.mutedUsers ||= [];
  room.vipUsers ||= [];
  room.tags ||= [];
}

function getRole(room: any, userId: string): Role {
  const uid = userId.toString();
  if (room.creator?.toString?.() === uid) return "creator";
  if ((room.owners || []).some((x: any) => x?.toString?.() === uid)) return "owner";
  if ((room.admins || []).some((x: any) => x?.toString?.() === uid)) return "admin";
  if ((room.members || []).some((x: any) => x?.toString?.() === uid)) return "member";
  return "none";
}

function requireRole(room: any, userId: string, roles: Role[]) {
  const r = getRole(room, userId);
  if (!roles.includes(r)) throw new Error("Not allowed");
}

const SAFE_SELECT = "-password"; // password select:false أصلاً، لكن احتياط

/**
 * خصم CoinZ من المستخدم
 * - يتم الخصم فقط إذا كان الرصيد كافي
 * - عند عدم كفاية الرصيد يرمي: "Insufficient CoinZ"
 */
async function chargeCoinZ(userId: string, amount: number, session?: mongoose.ClientSession) {
  const a = Math.max(0, Number(amount) || 0);
  if (a <= 0) return;

  const q: any = { _id: userId, CoinzBalance: { $gte: a } };
  const upd: any = { $inc: { CoinzBalance: -a } };

  const user = await User.findOneAndUpdate(q, upd, { new: true, session });
  if (!user) throw new Error("Your CoinZ balance is insufficient to complete this action. Please purchase more CoinZ and try again.");
}

/**
 * تحويل الأخطاء إلى status code موحد
 */
function mapErrorToStatus(e: any) {
  const msg = e?.message || "Server error";
  const code =
    msg === "Unauthorized"
      ? 401
      : msg === "Not allowed"
      ? 403
      : msg === "Room not found"
      ? 404
      : msg === "No active poll"
      ? 404
      : msg === "Insufficient CoinZ"
      ? 402
      : 500;

  return { code, msg };
}

/* =========================
   Controller
========================= */

export default class RoomControlController {
  /** GET /rooms/:id/control */
  static async getControl(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");

      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner", "admin", "member"]);

      // ✅ خصم سعر العملية (إن رغبت)
      await chargeCoinZ(userId, COINZ_PRICES.GET_CONTROL);

      return res.json({ room });
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    }
  }

  /** PATCH /rooms/:id/control/info */
  static async updateInfo(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let outRoom: any = null;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator", "owner"]);
        ensureArrays(room);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.UPDATE_INFO, session);

        if (typeof req.body?.name === "string") {
          const name = req.body.name.trim();
          if (!name) throw new Error("Name required");
          room.name = name;
        }

        if (typeof req.body?.description === "string") room.description = req.body.description.trim();
        if (typeof req.body?.avatar === "string") room.avatar = req.body.avatar.trim();
        if (typeof req.body?.cover === "string") room.cover = req.body.cover.trim();

        if (req.body?.tags !== undefined) room.tags = tagsToArray(req.body.tags);

        if (req.body?.maxUsers !== undefined) {
          room.maxUsers = clampInt(req.body.maxUsers, 1, 100000, room.maxUsers || 50);
        }

        if (req.body?.slowModeSeconds !== undefined) {
          room.slowModeSeconds = clampInt(req.body.slowModeSeconds, 0, 3600, room.slowModeSeconds || 0);
        }

        await room.save({ session });
        outRoom = room;
      });

      return res.json({ room: outRoom });
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code === 500 && e?.message === "Name required" ? 400 : code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/type */
  static async changeType(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let safeRoom: any = null;

      await session.withTransaction(async () => {
        // نحتاج password لأن select:false
        const room = await Room.findById(roomId).select("+password").session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator"]);
        ensureArrays(room);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.CHANGE_TYPE, session);

        const nextType: RoomType = Object.values(RoomType).includes(req.body?.type) ? req.body.type : room.type;
        room.type = nextType;

        if (nextType === RoomType.PROTECTED) {
          const pass = String(req.body?.password || "").trim();
          if (!pass) {
            // لو فشل هنا، الـ transaction هيتلغى والخصم لن يتم
            throw new Error("Password required for protected rooms");
          }
          room.password = pass;
        } else {
          room.password = undefined;
        }

        if (nextType === RoomType.SUBSCRIPTION) {
          const price = Math.max(0, Number(req.body?.subscriptionPrice || 0));
          room.subscriptionPrice = price;
        } else {
          room.subscriptionPrice = 0;
        }

        await room.save({ session });
        safeRoom = await Room.findById(roomId).select(SAFE_SELECT).session(session);
      });

      return res.json({ room: safeRoom });
    } catch (e: any) {
      const msg = e?.message || "Server error";
      const { code } = mapErrorToStatus(e);
      const finalCode =
        msg === "Password required for protected rooms" ? 400 : msg === "Invalid room id" ? 400 : code;
      return res.status(finalCode).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/premium */
  static async changePremiumLevel(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let outRoom: any = null;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator"]);

        const levelNum = Number(req.body?.premiumLevel);
        if (!Number.isFinite(levelNum) || ![0, 1, 2, 3, 4].includes(levelNum)) {
          throw new Error("Invalid premiumLevel");
        }

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.CHANGE_PREMIUM, session);

        room.premiumLevel = levelNum as RoomPremiumLevel;
        await room.save({ session });
        outRoom = room;
      });

      return res.json({ room: outRoom });
    } catch (e: any) {
      const msg = e?.message || "Server error";
      const { code } = mapErrorToStatus(e);
      return res.status(msg === "Invalid premiumLevel" ? 400 : code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/lock */
  static async setLock(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let isLocked = false;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator", "owner"]);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.SET_LOCK, session);

        room.isLocked = Boolean(req.body?.locked);
        await room.save({ session });

        isLocked = room.isLocked;
      });

      return res.json({ isLocked });
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/antispam */
  static async setAntiSpam(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let out: any = null;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator", "owner"]);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.SET_ANTISPAM, session);

        room.antiSpamEnabled = Boolean(req.body?.enabled);
        if (req.body?.maxMessagesPerMinute !== undefined) {
          room.maxMessagesPerMinute = clampInt(
            req.body.maxMessagesPerMinute,
            1,
            1000,
            room.maxMessagesPerMinute || 10
          );
        }

        await room.save({ session });

        out = {
          antiSpamEnabled: room.antiSpamEnabled,
          maxMessagesPerMinute: room.maxMessagesPerMinute
        };
      });

      return res.json(out);
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/slowmode */
  static async setSlowMode(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let slowModeSeconds = 0;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator", "owner"]);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.SET_SLOWMODE, session);

        room.slowModeSeconds = clampInt(req.body?.seconds, 0, 3600, room.slowModeSeconds || 0);
        await room.save({ session });

        slowModeSeconds = room.slowModeSeconds;
      });

      return res.json({ slowModeSeconds });
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/voice-seats */
  static async setMaxVoiceSeats(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let maxVoiceSeats = 0;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator", "owner"]);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.SET_VOICE_SEATS, session);

        room.maxVoiceSeats = clampInt(req.body?.seats, 0, 50, room.maxVoiceSeats || 4);
        await room.save({ session });

        maxVoiceSeats = room.maxVoiceSeats;
      });

      return res.json({ maxVoiceSeats });
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/boost */
  static async boost(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let out: any = null;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        // requireRole(room, userId, ["creator", "owner"]);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.BOOST, session);

        const level = clampInt(req.body?.level, 0, 10, room.boostLevel || 0);
        const hours = clampInt(req.body?.hours, 1, 720, 1);

        room.boostLevel = level;
        room.boostExpiresAt = new Date(Date.now() + hours * 3600_000);

        await room.save({ session });

        out = { boostLevel: room.boostLevel, boostExpiresAt: room.boostExpiresAt };
      });

      return res.json(out);
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }
/** PATCH /rooms/:id/control/welcome */
static async updateWelcome(req: AuthedReq, res: Response) {
  const session = await mongoose.startSession();
  try {
    const userId = getUserId(req);
    const roomId = String(req.params.id || "");
    if (!isValidObjectId(roomId)) {
      return res.status(400).json({ message: "Invalid room id" });
    }

    let out: any = null;

    await session.withTransaction(async () => {
      const room = await Room.findById(roomId).session(session);
      if (!room) throw new Error("Room not found");

      requireRole(room, userId, ["creator", "owner", "admin"]);

      room.roomBot ||= {
        enabled: true,
        welcomeEnabled: true,
        language: "ar",
        welcomeMessage: null,
      } as any;

      if (req.body?.enabled !== undefined) {
        room.roomBot.enabled = Boolean(req.body.enabled);
      }

      if (req.body?.welcomeEnabled !== undefined) {
        room.roomBot.welcomeEnabled = Boolean(req.body.welcomeEnabled);
      }

      if (req.body?.language !== undefined) {
        const lang = String(req.body.language || "").trim();
        if (!["ar", "en"].includes(lang)) {
          throw new Error("Invalid language");
        }
        room.roomBot.language = lang as "ar" | "en";
      }

      if (req.body?.welcomeMessage !== undefined) {
        const msg = String(req.body.welcomeMessage || "").trim();
        room.roomBot.welcomeMessage = msg || null;
      }

      await room.save({ session });

      out = {
        roomBot: room.roomBot,
      };
    });

    return res.json(out);
  } catch (e: any) {
    const msg = e?.message || "Server error";
    const { code } = mapErrorToStatus(e);
    return res.status(msg === "Invalid language" ? 400 : code).json({ message: msg });
  } finally {
    session.endSession();
  }
}
  /** POST /rooms/:id/control/poll/start */
  static async startPoll(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let out: any = null;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).select(SAFE_SELECT).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator", "owner", "admin", "member"]);

        const question = String(req.body?.question || "").trim();
        const options = Array.isArray(req.body?.options) ? req.body.options : [];
        const opts = options.map((o: any) => String(o || "").trim()).filter(Boolean);

        if (!question) throw new Error("Invalid question");
        if (opts.length < 2) throw new Error("Poll needs at least 2 options");

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.POLL_START, session);

        const minutes = clampInt(req.body?.minutes, 1, 1440, 10);

        room.activePoll = {
          question,
          options: opts.map((t: any) => ({ text: t, votes: 0 })),
          expiresAt: new Date(Date.now() + minutes * 60_000)
        };

        await room.save({ session });
        out = { activePoll: room.activePoll };
      });

      return res.json(out);
    } catch (e: any) {
      const msg = e?.message || "Server error";
      const { code } = mapErrorToStatus(e);
      const finalCode =
        msg === "Invalid question" || msg === "Poll needs at least 2 options" ? 400 : code;
      return res.status(finalCode).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** POST /rooms/:id/control/poll/vote */
  static async votePoll(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let out: any = null;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).session(session);
        if (!room || !room.activePoll) throw new Error("No active poll");

        const idx = Number(req.body?.optionIndex);
        if (!Number.isFinite(idx) || idx < 0 || idx >= room.activePoll.options.length) {
          throw new Error("Invalid optionIndex");
        }

        if (room.activePoll.expiresAt && new Date(room.activePoll.expiresAt).getTime() <= Date.now()) {
          throw new Error("Poll expired");
        }

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.POLL_VOTE, session);

        room.activePoll.options[idx].votes++;
        await room.save({ session });

        out = { activePoll: room.activePoll };
      });

      return res.json(out);
    } catch (e: any) {
      const msg = e?.message || "Server error";
      const { code } = mapErrorToStatus(e);
      const finalCode =
        msg === "Invalid optionIndex" || msg === "Poll expired" ? 400 : code;
      return res.status(finalCode).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** POST /rooms/:id/control/poll/end */
  static async endPoll(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator", "owner"]);
        if (!room.activePoll) throw new Error("No active poll");

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.POLL_END, session);

        room.activePoll = undefined;
        await room.save({ session });
      });

      return res.json({ success: true });
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** PATCH /rooms/:id/control/max-users/increase */
  static async increaseMaxUsers(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      let maxUsers = 0;

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator"]);

        const amount = clampInt(req.body?.amount, 1, 100000, 0);
        if (amount <= 0) throw new Error("Invalid amount");

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.INCREASE_MAX_USERS, session);

        room.maxUsers = (room.maxUsers || 50) + amount;
        await room.save({ session });

        maxUsers = room.maxUsers;
      });

      return res.json({ maxUsers });
    } catch (e: any) {
      const msg = e?.message || "Server error";
      const { code } = mapErrorToStatus(e);
      return res.status(msg === "Invalid amount" ? 400 : code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }

  /** DELETE /rooms/:id/control */
  static async deleteRoom(req: AuthedReq, res: Response) {
    const session = await mongoose.startSession();
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      await session.withTransaction(async () => {
        const room = await Room.findById(roomId).session(session);
        if (!room) throw new Error("Room not found");

        requireRole(room, userId, ["creator"]);

        // ✅ خصم
        await chargeCoinZ(userId, COINZ_PRICES.DELETE_ROOM, session);

        await RoomMessage.deleteMany({ room: room._id }).session(session);
        await Room.findByIdAndDelete(room._id).session(session);
      });

      return res.json({ success: true });
    } catch (e: any) {
      const { code, msg } = mapErrorToStatus(e);
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }
}