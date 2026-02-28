// room.controller.ts
import { Request, Response, NextFunction } from "express";
import { RoomType, RoomPremiumLevel } from "../models/Room";
import roomService from "../services/room.service";

/**
 * Controller فقط (بدون Routes).
 * ملف الروت سيكون منفصل ويستخدم: protect
 */

type AuthedRequest = Request & {
  user?: { id?: string; _id?: string } | any;
  userId?: string;
};

/* =====================================================
   SAFE CAST HELPERS (Fix: string | string[])
===================================================== */

const asString = (v: unknown): string => {
  if (Array.isArray(v)) return v[0] ?? "";
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
};

const param = (req: AuthedRequest, key: string): string => {
  return asString((req.params as any)?.[key]);
};

const getUserId = (req: AuthedRequest): string => {
  return (
    asString(req.userId) ||
    asString(req.user?.id) ||
    asString(req.user?._id?.toString?.()) ||
    asString(req.headers["x-user-id"])
  );
};

/* =====================================================
   UTILS
===================================================== */

const asyncHandler =
  (fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<any>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

const send = (res: Response, data: any = null, message = "OK") => {
  return res.json({ success: true, message, data });
};

/* =====================================================
   ROOM SETTINGS
===================================================== */

export const updateRoomInfo = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const room = await roomService.updateInfo(roomId, userId, req.body);
  return send(res, room, "Room updated");
});

export const changeRoomType = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const type = req.body?.type as RoomType;
  const room = await roomService.changeType(roomId, userId, type);
  return send(res, room, "Room type updated");
});
// room.controller.ts (ADD)

export const getRoomDetails = asyncHandler(async (req, res) => {
  // ✅ roomId من params
  const roomId = param(req, "roomId");
console.log(roomId,'roomId');

  // ✅ userId من التوكن عبر protect فقط
  const userId =
    asString(req.user?.id) ||
    asString(req.user?._id?.toString?.());

  if (!userId) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  const data = await roomService.getRoomDetails(roomId, userId);
  return send(res, data, "Room details");
});

export const changeRoomPremium = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const level = req.body?.level as RoomPremiumLevel;
  const room = await roomService.changePremiumLevel(roomId, userId, level);
  return send(res, room, "Room premium updated");
});

export const toggleAntiSpam = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const enabled = Boolean(req.body?.enabled);
  const max = req.body?.max !== undefined ? Number(req.body.max) : undefined;

  const room = await roomService.toggleAntiSpam(roomId, userId, enabled, max);
  return send(res, room, "Anti-spam updated");
});

/* =====================================================
   VIP
===================================================== */

export const addVip = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const { targetId, days } = req.body || {};
  const list = await roomService.addVip(roomId, userId, asString(targetId), Number(days));
  return send(res, list, "VIP added");
});

export const removeVip = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const targetId = param(req, "targetId");

  const list = await roomService.removeVip(roomId, userId, targetId);
  return send(res, list, "VIP removed");
});

/* =====================================================
   POLL
===================================================== */

export const startPoll = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const { question, options, minutes } = req.body || {};

  const poll = await roomService.startPoll(
    roomId,
    userId,
    asString(question),
    Array.isArray(options) ? options.map((x: any) => asString(x)) : [],
    Number(minutes)
  );

  return send(res, poll, "Poll started");
});

export const votePoll = asyncHandler(async (req, res) => {
  const roomId = param(req, "roomId");
  const optionIndex = Number(req.body?.optionIndex);

  const poll = await roomService.vote(roomId, optionIndex);
  return send(res, poll, "Vote submitted");
});

export const endPoll = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  await roomService.endPoll(roomId, userId);
  return send(res, null, "Poll ended");
});

/* =====================================================
   VOICE
===================================================== */

export const setMaxVoiceSeats = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const seats = Number(req.body?.seats);

  const result = await roomService.setMaxVoiceSeats(roomId, userId, seats);
  return send(res, { seats: result }, "Voice seats updated");
});

export const raiseHand = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const list = await roomService.raiseHand(roomId, userId);
  return send(res, list, "Hand raised");
});

export const clearRaisedHand = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const list = await roomService.clearRaisedHand(roomId, userId);
  return send(res, list, "Hand cleared");
});

/* =====================================================
   LEVEL / XP
===================================================== */

export const addXP = asyncHandler(async (req, res) => {
  const roomId = param(req, "roomId");
  const amount = Number(req.body?.amount);

  const result = await roomService.addXP(roomId, amount);
  return send(res, result, "XP updated");
});

/* =====================================================
   BOOST
===================================================== */

export const boostRoom = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const level = Number(req.body?.level);
  const hours = Number(req.body?.hours);

  const room = await roomService.boost(roomId, userId, level, hours);
  return send(res, room, "Room boosted");
});

/* =====================================================
   MEMBERSHIP
===================================================== */

export const joinRoom = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");



  try {
    const result = await roomService.joinRoom(roomId, userId);

 

    return send(res, result, "Joined");
  } catch (err: any) {
  
    throw err; // مهم: لإرجاع نفس الخطأ للـ asyncHandler
  }
});

export const getRoomMessages = asyncHandler(async (req, res) => {
  const userId = getUserId(req);              // ✅ مهم للتحقق من الدور داخل getMessages
  const roomId = param(req, "roomId");

  const limit = req.query?.limit !== undefined ? Number(req.query.limit) : 30;
  const before = req.query?.before ? asString(req.query.before) : undefined;

  const messages = await roomService.getMessages(roomId, userId, { limit, before });

  return send(res, messages, "Room messages");
});
/* =====================================================
   CREATE / GET / SEARCH ROOMS
===================================================== */

export const createRoom = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const room = await roomService.createRoom(userId, req.body);
  return send(res, room, "Room created");
});

export const getRoomsByType = asyncHandler(async (req, res) => {
  const type = String(req.query?.type || "public") as any;

  const limit = req.query?.limit !== undefined ? Number(req.query.limit) : 30;
  const page = req.query?.page !== undefined ? Number(req.query.page) : 1;

  const viewerId = getUserId(req); // ✅ يلتقط من protect أو x-user-id
 
  const data = await roomService.getRoomsByType(type as RoomType, viewerId, { limit, page });
  return send(res, data, "Rooms fetched");
});

export const searchRooms = asyncHandler(async (req, res) => {
  // مثال: /rooms/search?q=chat&type=public&limit=30
  const q = asString(req.query?.q);
  const type = req.query?.type as any;
  const limit = req.query?.limit !== undefined ? Number(req.query.limit) : 30;

const viewerId = getUserId(req);
const rooms = await roomService.searchRooms(q, viewerId, type as RoomType, limit);
  return send(res, rooms, "Rooms search results");
});
export const leaveRoom = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const result = await roomService.leaveRoom(roomId, userId);
  return send(res, result, "Left");
});

export const autoRejoin = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const rooms = await roomService.autoRejoin(userId);
  return send(res, rooms, "Rooms returned");
});

/* =====================================================
   MODERATION
===================================================== */

export const kickUser = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const targetId = param(req, "targetId");

  const result = await roomService.kickUser(roomId, userId, targetId);
  return send(res, result, "User kicked");
});

/* =====================================================
   MESSAGES
===================================================== */

export const sendMessage = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const message = await roomService.sendMessage({
    roomId,
    senderId: userId,
    content: req.body?.content,
    type: req.body?.type,
    replyTo: req.body?.replyTo,
    mentions: req.body?.mentions,
    media: req.body?.media,
    gift: req.body?.gift
  });

  return send(res, message, "Message sent");
});

export const pinMessage = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const messageId = param(req, "messageId");
  const pinned = req.body?.pinned !== undefined ? Boolean(req.body.pinned) : true;

  const msg = await roomService.pinMessage(roomId, userId, messageId, pinned);
  return send(res, msg, "Pin updated");
});

export const toggleReaction = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");
  const messageId = param(req, "messageId");
  const emoji = asString(req.body?.emoji || "");

  const reactions = await roomService.toggleReaction(roomId, messageId, userId, emoji);
  return send(res, reactions, "Reaction updated");
});

export const getRoomUsers = asyncHandler(async (req, res) => {
  const roomId = param(req, "roomId");
  const data = await roomService.getRoomUsers(roomId);
  return send(res, data, "Room users");
});

export const getRoomStats = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const data = await roomService.getRoomStats(roomId, userId);
  return send(res, data, "Room stats");
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const result = await roomService.deleteRoom(roomId, userId);
  return send(res, result, "Room deleted");
});
// ✅ room.controller.ts
// أضف/الصق هذه الدوال في نفس الملف (أسفل قسم MODERATION أو في أي مكان مناسب)
// لا تنسَ إضافة Routes لاحقًا في ملف routes مع protect

/* =====================================================
   MODERATION: BANNED (Get / Unban one / many / all)
===================================================== */

export const getBannedUsers = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const data = await roomService.getBannedUsers(roomId, userId);
  return send(res, data, "Banned users");
});

export const unbanOne = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const targetId = asString(req.body?.targetId);
  const reason = asString(req.body?.reason || "تم فك الحظر");

  const data = await roomService.unbanOne(roomId, userId, targetId, reason);
  return send(res, data, "Unbanned");
});

export const unbanMany = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const raw = req.body?.targetIds;
  const targetIds = Array.isArray(raw) ? raw.map((x: any) => asString(x)).filter(Boolean) : [];
  const reason = asString(req.body?.reason || "تم فك الحظر");

  const data = await roomService.unbanMany(roomId, userId, targetIds, reason);
  return send(res, data, "Unbanned many");
});

export const unbanAll = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const roomId = param(req, "roomId");

  const reason = asString(req.body?.reason || "تم فك الحظر عن الجميع");

  const data = await roomService.unbanAll(roomId, userId, reason);
  return send(res, data, "Unbanned all");
});