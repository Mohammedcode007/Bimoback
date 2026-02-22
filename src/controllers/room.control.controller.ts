import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Room, { RoomType, RoomPremiumLevel } from "../models/Room";
import RoomMessage from "../models/RoomMessage";

type AuthedReq = Request & { userId?: string; user?: any };

type Role = "creator" | "owner" | "admin" | "member" | "none";

/* =========================
   Helpers
========================= */

function getUserId(req: AuthedReq) {
  const uid = req.userId || req.user?._id?.toString?.();
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

/* =========================
   Controller
========================= */

export default class RoomControlController {
  /** GET /rooms/:id/control
   * عرض بيانات التحكم للغرفة (لصفحة الضبط)
   */
  static async getControl(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");

      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      // مسموح لأي عضو/أدمن/مالك/منشئ (حسب رغبتك)
      requireRole(room, userId, ["creator", "owner", "admin", "member"]);

      return res.json({ room });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/info
   * تعديل بيانات الغرفة الأساسية + tags + maxUsers + slowMode
   * صلاحية: creator/owner
   */
  static async updateInfo(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner"]);
      ensureArrays(room);

      if (typeof req.body?.name === "string") {
        const name = req.body.name.trim();
        if (!name) return res.status(400).json({ message: "Name required" });
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

      await room.save();
      return res.json({ room });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/type
   * تغيير نوع الغرفة + password/subscriptionPrice حسب النوع
   * صلاحية: creator
   */
  static async changeType(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      // نحتاج password لأن select:false
      const room = await Room.findById(roomId).select("+password");
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator"]);
      ensureArrays(room);

      const nextType: RoomType = Object.values(RoomType).includes(req.body?.type)
        ? req.body.type
        : room.type;

      room.type = nextType;

      if (nextType === RoomType.PROTECTED) {
        const pass = String(req.body?.password || "").trim();
        if (!pass) return res.status(400).json({ message: "Password required for protected rooms" });
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

      await room.save();
      const safe = await Room.findById(roomId).select(SAFE_SELECT);
      return res.json({ room: safe });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/premium
   * صلاحية: creator
   */
  static async changePremiumLevel(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator"]);

      const levelNum = Number(req.body?.premiumLevel);
      if (!Number.isFinite(levelNum) || ![0, 1, 2, 3, 4].includes(levelNum)) {
        return res.status(400).json({ message: "Invalid premiumLevel" });
      }

      room.premiumLevel = levelNum as RoomPremiumLevel;
      await room.save();

      return res.json({ room });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/lock
   * صلاحية: creator/owner
   */
  static async setLock(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner"]);

      room.isLocked = Boolean(req.body?.locked);
      await room.save();

      return res.json({ isLocked: room.isLocked });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/antispam
   * صلاحية: creator/owner
   */
  static async setAntiSpam(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner"]);

      room.antiSpamEnabled = Boolean(req.body?.enabled);
      if (req.body?.maxMessagesPerMinute !== undefined) {
        room.maxMessagesPerMinute = clampInt(req.body.maxMessagesPerMinute, 1, 1000, room.maxMessagesPerMinute || 10);
      }

      await room.save();
      return res.json({
        antiSpamEnabled: room.antiSpamEnabled,
        maxMessagesPerMinute: room.maxMessagesPerMinute
      });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/slowmode
   * صلاحية: creator/owner
   */
  static async setSlowMode(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner"]);

      room.slowModeSeconds = clampInt(req.body?.seconds, 0, 3600, room.slowModeSeconds || 0);
      await room.save();

      return res.json({ slowModeSeconds: room.slowModeSeconds });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/voice-seats
   * صلاحية: creator/owner
   */
  static async setMaxVoiceSeats(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner"]);

      room.maxVoiceSeats = clampInt(req.body?.seats, 0, 50, room.maxVoiceSeats || 4);
      await room.save();

      return res.json({ maxVoiceSeats: room.maxVoiceSeats });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/boost
   * صلاحية: creator/owner
   */
  static async boost(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner"]);

      const level = clampInt(req.body?.level, 0, 10, room.boostLevel || 0);
      const hours = clampInt(req.body?.hours, 1, 720, 1);

      room.boostLevel = level;
      room.boostExpiresAt = new Date(Date.now() + hours * 3600_000);

      await room.save();
      return res.json({ boostLevel: room.boostLevel, boostExpiresAt: room.boostExpiresAt });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** POST /rooms/:id/control/poll/start
   * صلاحية: creator/owner/admin/member
   */
  static async startPoll(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId).select(SAFE_SELECT);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner", "admin", "member"]);

      const question = String(req.body?.question || "").trim();
      const options = Array.isArray(req.body?.options) ? req.body.options : [];
      const opts = options.map((o: any) => String(o || "").trim()).filter(Boolean);

      if (!question) return res.status(400).json({ message: "Invalid question" });
      if (opts.length < 2) return res.status(400).json({ message: "Poll needs at least 2 options" });

      const minutes = clampInt(req.body?.minutes, 1, 1440, 10);

      room.activePoll = {
        question,
        options: opts.map((t: any) => ({ text: t, votes: 0 })),
        expiresAt: new Date(Date.now() + minutes * 60_000)
      };

      await room.save();
      return res.json({ activePoll: room.activePoll });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** POST /rooms/:id/control/poll/vote
   * body: { optionIndex }
   */
  static async votePoll(req: AuthedReq, res: Response) {
    try {
      getUserId(req); // يكفي تحقق auth
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId);
      if (!room || !room.activePoll) return res.status(404).json({ message: "No active poll" });

      const idx = Number(req.body?.optionIndex);
      if (!Number.isFinite(idx) || idx < 0 || idx >= room.activePoll.options.length) {
        return res.status(400).json({ message: "Invalid optionIndex" });
      }

      if (room.activePoll.expiresAt && new Date(room.activePoll.expiresAt).getTime() <= Date.now()) {
        return res.status(400).json({ message: "Poll expired" });
      }

      room.activePoll.options[idx].votes++;
      await room.save();

      return res.json({ activePoll: room.activePoll });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** POST /rooms/:id/control/poll/end
   * صلاحية: creator/owner
   */
  static async endPoll(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator", "owner"]);

      room.activePoll = undefined;
      await room.save();

      return res.json({ success: true });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** PATCH /rooms/:id/control/max-users/increase
   * صلاحية: creator
   * body: { amount }
   */
  static async increaseMaxUsers(req: AuthedReq, res: Response) {
    try {
      const userId = getUserId(req);
      const roomId = String(req.params.id || "");
      if (!isValidObjectId(roomId)) return res.status(400).json({ message: "Invalid room id" });

      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ message: "Room not found" });

      requireRole(room, userId, ["creator"]);

      const amount = clampInt(req.body?.amount, 1, 100000, 0);
      if (amount <= 0) return res.status(400).json({ message: "Invalid amount" });

      room.maxUsers = (room.maxUsers || 50) + amount;
      await room.save();

      return res.json({ maxUsers: room.maxUsers });
    } catch (e: any) {
      const code = e?.message === "Unauthorized" ? 401 : e?.message === "Not allowed" ? 403 : 500;
      return res.status(code).json({ message: e?.message || "Server error" });
    }
  }

  /** DELETE /rooms/:id/control
   * صلاحية: creator
   * يحذف الغرفة ورسائلها (بدون Socket)
   */
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

        await RoomMessage.deleteMany({ room: room._id }).session(session);
        await Room.findByIdAndDelete(room._id).session(session);
      });

      return res.json({ success: true });
    } catch (e: any) {
      const msg = e?.message || "Server error";
      const code =
        msg === "Unauthorized" ? 401 : msg === "Not allowed" ? 403 : msg === "Room not found" ? 404 : 500;
      return res.status(code).json({ message: msg });
    } finally {
      session.endSession();
    }
  }
}