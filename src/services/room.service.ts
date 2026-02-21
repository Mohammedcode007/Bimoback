import mongoose, { ClientSession, Types } from "mongoose";
import Room, { RoomType, RoomPremiumLevel } from "../models/Room";
import RoomMessage from "../models/RoomMessage";
import { getIO } from "../config/socket";

/**
 * ملاحظة مهمة جدًا:
 * - في RoomMessageSchema عندك يوجد Hook يقوم بزيادة messagesCount تلقائيًا عند إنشاء الرسالة.
 * - لذلك في هذا الملف لا نقوم بزيادة room.messagesCount يدويًا داخل sendMessage حتى لا يحدث تضاعف.
 */

type Role = "creator" | "owner" | "admin" | "member" | "none";

type SendMessageInput = {
  roomId: string;
  senderId: string;
  content?: string;
  type?: string;
  replyTo?: string;
  mentions?: string[];
  media?: {
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
  gift?: {
    name: string;
    value: number;
    animation?: string;
  };
};

type Pagination = {
  limit?: number;
  before?: string; // messageId (cursor)
};

class RoomService {
  /* =====================================================
     INTERNAL HELPERS
  ===================================================== */

  private io() {
    return getIO();
  }

  private isValidObjectId(id: string) {
    return Types.ObjectId.isValid(id);
  }

  private oid(id: string) {
    if (!this.isValidObjectId(id)) throw new Error("Invalid id");
    return new Types.ObjectId(id);
  }

  private async withTx<T>(fn: (session: ClientSession) => Promise<T>) {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } finally {
      session.endSession();
    }
  }

  private getRole(room: any, userId: string): Role {
    if (!room) return "none";
    const uid = userId.toString();

    if (room.creator?.toString?.() === uid) return "creator";
    if (Array.isArray(room.owners) && room.owners.some((x: any) => x?.toString?.() === uid)) return "owner";
    if (Array.isArray(room.admins) && room.admins.some((x: any) => x?.toString?.() === uid)) return "admin";
    if (Array.isArray(room.members) && room.members.some((x: any) => x?.toString?.() === uid)) return "member";
    return "none";
  }

  private require(room: any, userId: string, roles: Role[]) {
    const r = this.getRole(room, userId);
    if (!roles.includes(r)) throw new Error("Not allowed");
  }

  private removeAllRoles(room: any, userId: string) {
    const uid = userId.toString();
    room.owners = (room.owners || []).filter((x: any) => x?.toString?.() !== uid);
    room.admins = (room.admins || []).filter((x: any) => x?.toString?.() !== uid);
    room.members = (room.members || []).filter((x: any) => x?.toString?.() !== uid);
  }

  private ensureArrays(room: any) {
    room.owners ||= [];
    room.admins ||= [];
    room.members ||= [];
    room.activeUsers ||= [];
    room.blockeds ||= [];
    room.vipUsers ||= [];
    room.mutedUsers ||= [];
    room.raisedHands ||= [];
  }

  private isBanned(room: any, userId: string) {
    const uid = userId.toString();
    return (room.blockeds || []).some((x: any) => x?.toString?.() === uid);
  }

  private isMuted(room: any, userId: string) {
    const uid = userId.toString();
    const now = new Date();
    const entry = (room.mutedUsers || []).find((m: any) => m?.user?.toString?.() === uid);
    if (!entry) return false;
    return entry.until && new Date(entry.until).getTime() > now.getTime();
  }

  private async system(roomId: string, content: string, type: any = "system", extra: any = {}) {
    const msg = await RoomMessage.create({
      room: roomId,
      content,
      type,
      ...extra
    });
    this.io().to(`room:${roomId}`).emit("room:message:new", msg);
    return msg;
  }

  /* =====================================================
     ROOM SETTINGS
  ===================================================== */

  async updateInfo(roomId: string, userId: string, data: any) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner"]);

    if (typeof data?.name === "string") room.name = data.name;
    if (typeof data?.description === "string") room.description = data.description;
    if (typeof data?.avatar === "string") room.avatar = data.avatar;
    if (typeof data?.cover === "string") room.cover = data.cover;

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:update", room);
    return room;
  }

  async changeType(roomId: string, userId: string, type: RoomType) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator"]);

    room.type = type;
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:type:update", type);
    await this.system(roomId, `Room type changed`, "announcement");
    return room;
  }

  async changePremiumLevel(roomId: string, userId: string, level: RoomPremiumLevel) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator"]);

    room.premiumLevel = level;
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:premium:update", level);
    await this.system(roomId, `Premium level updated`, "announcement");
    return room;
  }

  async toggleAntiSpam(roomId: string, userId: string, enabled: boolean, max?: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner"]);

    room.antiSpamEnabled = Boolean(enabled);
    if (typeof max === "number" && max > 0) room.maxMessagesPerMinute = max;

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:antispam:update", {
      enabled: room.antiSpamEnabled,
      max: room.maxMessagesPerMinute
    });

    return room;
  }

  async setRoomLock(roomId: string, userId: string, locked: boolean) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner"]);

    room.isLocked = Boolean(locked);
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:lock:update", room.isLocked);
    await this.system(roomId, room.isLocked ? "Room locked" : "Room unlocked", "announcement");
    return room.isLocked;
  }

  async setSlowMode(roomId: string, userId: string, seconds: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner", "admin"]);

    const s = Math.max(0, Math.min(3600, Number(seconds) || 0));
    room.slowModeSeconds = s;

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:slowmode:update", s);
    await this.system(roomId, s > 0 ? `Slow mode enabled (${s}s)` : "Slow mode disabled", "announcement");
    return s;
  }

  /* =====================================================
     VIP SYSTEM
  ===================================================== */

  async addVip(roomId: string, userId: string, targetId: string, days: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);
    this.require(room, userId, ["creator", "owner"]);

    const d = Math.max(1, Math.min(3650, Number(days) || 0));
    const expiresAt = new Date(Date.now() + d * 86400000);

    room.vipUsers = room.vipUsers.filter((v: any) => v.user.toString() !== targetId);
    room.vipUsers.push({ user: targetId as any, expiresAt });

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:vip:update", room.vipUsers);

    await this.system(roomId, "VIP granted", "promotion", { mentions: [targetId] });

    return room.vipUsers;
  }

  async removeVip(roomId: string, userId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);
    this.require(room, userId, ["creator", "owner"]);

    room.vipUsers = room.vipUsers.filter((v: any) => v.user.toString() !== targetId);
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:vip:update", room.vipUsers);
    await this.system(roomId, "VIP removed", "system", { mentions: [targetId] });

    return room.vipUsers;
  }

  /* =====================================================
     POLL SYSTEM
  ===================================================== */

  async startPoll(roomId: string, userId: string, question: string, options: string[], minutes: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner", "admin"]);

    if (!question?.trim()) throw new Error("Invalid question");
    const opts = (options || []).map((o) => String(o || "").trim()).filter(Boolean);
    if (opts.length < 2) throw new Error("Poll needs at least 2 options");

    const m = Math.max(1, Math.min(1440, Number(minutes) || 0));
    room.activePoll = {
      question: question.trim(),
      options: opts.map((o) => ({ text: o, votes: 0 })),
      expiresAt: new Date(Date.now() + m * 60000)
    };

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:poll:start", room.activePoll);

    await this.system(roomId, `Poll started: ${question.trim()}`, "announcement");

    return room.activePoll;
  }

  async vote(roomId: string, optionIndex: number) {
    const room = await Room.findById(roomId);
    if (!room || !room.activePoll) throw new Error("No poll");

    const idx = Number(optionIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= room.activePoll.options.length)
      throw new Error("Invalid option");

    // إذا انتهت صلاحية التصويت
    if (room.activePoll.expiresAt && new Date(room.activePoll.expiresAt).getTime() <= Date.now())
      throw new Error("Poll expired");

    room.activePoll.options[idx].votes++;
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:poll:update", room.activePoll);
    return room.activePoll;
  }

  async endPoll(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner"]);

    room.activePoll = undefined;
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:poll:end");
    await this.system(roomId, "Poll ended", "announcement");
  }

  /* =====================================================
     VOICE SYSTEM
  ===================================================== */

  async setMaxVoiceSeats(roomId: string, userId: string, seats: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner"]);

    const s = Math.max(0, Math.min(50, Number(seats) || 0));
    room.maxVoiceSeats = s;
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:voice:seats", s);
    return s;
  }

  async raiseHand(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    if (!room.activeUsers.some((u: any) => u.toString() === userId))
      throw new Error("Not inside room");

    if (!room.raisedHands.includes(userId as any)) {
      room.raisedHands.push(userId as any);
      await room.save();
    }

    this.io().to(`room:${roomId}`).emit("room:hand:update", room.raisedHands);
    return room.raisedHands;
  }

  async clearRaisedHand(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    room.raisedHands = room.raisedHands.filter((x: any) => x.toString() !== userId);
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:hand:update", room.raisedHands);
    return room.raisedHands;
  }

  /* =====================================================
     LEVEL & XP
  ===================================================== */

  async addXP(roomId: string, amount: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    const inc = Math.max(0, Number(amount) || 0);
    room.xp += inc;

    if (room.xp >= room.level * 100) {
      room.level += 1;
      room.xp = 0;
      await this.system(roomId, `Room leveled up to ${room.level}`, "announcement");
    }

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:xp:update", { level: room.level, xp: room.xp });

    return { level: room.level, xp: room.xp };
  }

  /* =====================================================
     BOOST
  ===================================================== */

  async boost(roomId: string, userId: string, level: number, hours: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner"]);

    room.boostLevel = Math.max(0, Math.min(10, Number(level) || 0));
    room.boostExpiresAt = new Date(Date.now() + Math.max(1, Math.min(720, Number(hours) || 0)) * 3600000);
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:boost:update", {
      boostLevel: room.boostLevel,
      boostExpiresAt: room.boostExpiresAt
    });

    await this.system(roomId, "Room boosted", "announcement");
    return room;
  }

  /* =====================================================
     ROLES MANAGEMENT (Promote / Demote / Membership)
  ===================================================== */

  async addMember(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner", "admin"]);

    if (this.isBanned(room, targetId)) throw new Error("User is banned");

    const uid = targetId.toString();
    const already =
      room.members.some((x: any) => x.toString() === uid) ||
      room.admins.some((x: any) => x.toString() === uid) ||
      room.owners.some((x: any) => x.toString() === uid) ||
      room.creator.toString() === uid;

    if (!already) room.members.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      owners: room.owners,
      admins: room.admins,
      members: room.members
    });

    await this.system(roomId, "User added as member", "promotion", { mentions: [targetId] });

    return { success: true };
  }

  async removeMember(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner", "admin"]);

    const targetRole = this.getRole(room, targetId);
    if (targetRole === "creator") throw new Error("Cannot remove creator");

    // admin لا يستطيع إزالة owner/admin
    const actorRole = this.getRole(room, actorId);
    if (actorRole === "admin" && (targetRole === "owner" || targetRole === "admin"))
      throw new Error("Not allowed");

    this.removeAllRoles(room, targetId);

    // أيضًا أخرجه من activeUsers إن كان موجودًا
    room.activeUsers = room.activeUsers.filter((u: any) => u.toString() !== targetId);

    room.usersCount = Math.max(0, (room.usersCount || 0) - 1);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:user:removed", { roomId, targetId });

    await this.system(roomId, "User removed from room roles", "system", { mentions: [targetId] });

    return { success: true };
  }

  async promoteToAdmin(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner"]);

    const tRole = this.getRole(room, targetId);
    if (tRole === "creator" || tRole === "owner") return { success: true };

    // لازم يكون عضو
    if (tRole === "none") throw new Error("Target is not a member");

    room.members = room.members.filter((x: any) => x.toString() !== targetId);
    if (!room.admins.some((x: any) => x.toString() === targetId)) room.admins.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      owners: room.owners,
      admins: room.admins,
      members: room.members
    });

    await this.system(roomId, "User promoted to admin", "promotion", { mentions: [targetId] });
    return { success: true };
  }

  async demoteAdmin(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner"]);

    room.admins = room.admins.filter((x: any) => x.toString() !== targetId);
    if (!room.members.some((x: any) => x.toString() === targetId)) room.members.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      owners: room.owners,
      admins: room.admins,
      members: room.members
    });

    await this.system(roomId, "Admin demoted to member", "system", { mentions: [targetId] });
    return { success: true };
  }

  async promoteToOwner(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator"]);

    const tRole = this.getRole(room, targetId);
    if (tRole === "creator") return { success: true };
    if (tRole === "none") throw new Error("Target is not a member");

    room.members = room.members.filter((x: any) => x.toString() !== targetId);
    room.admins = room.admins.filter((x: any) => x.toString() !== targetId);
    if (!room.owners.some((x: any) => x.toString() === targetId)) room.owners.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      owners: room.owners,
      admins: room.admins,
      members: room.members
    });

    await this.system(roomId, "User promoted to owner", "promotion", { mentions: [targetId] });
    return { success: true };
  }

  async transferCreator(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator"]);
    const tRole = this.getRole(room, targetId);
    if (tRole === "none") throw new Error("Target is not a member");

    // اجعل المبدل owner للحفاظ على صلاحياته
    const oldCreator = room.creator.toString();

    room.creator = targetId as any;

    // القديم يصبح owner
    if (!room.owners.some((x: any) => x.toString() === oldCreator)) room.owners.push(oldCreator as any);
    // الجديد لا يكون في قوائم أخرى
    room.owners = room.owners.filter((x: any) => x.toString() !== targetId);
    room.admins = room.admins.filter((x: any) => x.toString() !== targetId);
    room.members = room.members.filter((x: any) => x.toString() !== targetId);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:creator:transfer", { from: oldCreator, to: targetId });

    await this.system(roomId, "Creator role transferred", "announcement", { mentions: [oldCreator, targetId] });
    return { success: true };
  }

  /* =====================================================
     MODERATION (Ban / Unban / Mute / Unmute / Kick)
  ===================================================== */

  async banUser(roomId: string, actorId: string, targetId: string, reason = "Banned") {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const actorRole = this.getRole(room, actorId);
    const targetRole = this.getRole(room, targetId);

    if (targetRole === "creator") throw new Error("Cannot ban creator");

    if (actorRole === "creator") {
      // full access
    } else if (actorRole === "owner") {
      if (targetRole === "owner") throw new Error("Owner cannot ban another owner");
    } else if (actorRole === "admin") {
      if (targetRole === "owner" || targetRole === "admin") throw new Error("Admin cannot ban owner or admin");
    } else {
      throw new Error("Not allowed");
    }

    if (!room.blockeds.some((x: any) => x.toString() === targetId)) {
      room.blockeds.push(targetId as any);
    }

    // remove roles + active
    this.removeAllRoles(room, targetId);
    room.activeUsers = room.activeUsers.filter((u: any) => u.toString() !== targetId);

    await room.save();

    const io = this.io();
    io.to(targetId).emit("room:banned", { roomId, reason });
    io.to(`room:${roomId}`).emit("room:user:banned", { roomId, targetId, reason });

    await this.system(roomId, reason, "ban", { mentions: [targetId] });

    return { success: true };
  }

  async unbanUser(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);
    this.require(room, actorId, ["creator", "owner", "admin"]);

    room.blockeds = room.blockeds.filter((x: any) => x.toString() !== targetId);
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:user:unbanned", { roomId, targetId });
    await this.system(roomId, "User unbanned", "system", { mentions: [targetId] });

    return { success: true };
  }

  async muteUser(roomId: string, actorId: string, targetId: string, minutes: number, reason = "Muted") {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const actorRole = this.getRole(room, actorId);
    const targetRole = this.getRole(room, targetId);

    if (targetRole === "creator") throw new Error("Cannot mute creator");

    if (actorRole === "creator") {
      // ok
    } else if (actorRole === "owner") {
      if (targetRole === "owner") throw new Error("Owner cannot mute another owner");
    } else if (actorRole === "admin") {
      if (targetRole === "owner" || targetRole === "admin") throw new Error("Admin cannot mute owner/admin");
    } else {
      throw new Error("Not allowed");
    }

    const m = Math.max(1, Math.min(10080, Number(minutes) || 0));
    const until = new Date(Date.now() + m * 60000);

    room.mutedUsers = room.mutedUsers.filter((x: any) => x.user.toString() !== targetId);
    room.mutedUsers.push({ user: targetId as any, until, reason });

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:user:muted", { roomId, targetId, until, reason });

    await this.system(roomId, reason, "system", { mentions: [targetId] });

    return { success: true, until };
  }

  async unmuteUser(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);
    this.require(room, actorId, ["creator", "owner", "admin"]);

    room.mutedUsers = room.mutedUsers.filter((x: any) => x.user.toString() !== targetId);
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:user:unmuted", { roomId, targetId });
    await this.system(roomId, "User unmuted", "system", { mentions: [targetId] });

    return { success: true };
  }

  async kickUser(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const actorRole = this.getRole(room, actorId);
    const targetRole = this.getRole(room, targetId);

    if (targetRole === "creator") throw new Error("Cannot kick creator");

    if (actorRole === "creator") {
      // ok
    } else if (actorRole === "owner") {
      if (targetRole === "owner") throw new Error("Owner cannot kick another owner");
    } else if (actorRole === "admin") {
      if (targetRole === "owner" || targetRole === "admin") throw new Error("Admin cannot kick owner or admin");
    } else {
      throw new Error("Not allowed");
    }

    this.removeAllRoles(room, targetId);

    room.activeUsers = room.activeUsers.filter((u: any) => u.toString() !== targetId);
    room.usersCount = Math.max(0, (room.usersCount || 0) - 1);

    await room.save();

    const io = this.io();

    io.to(targetId).emit("room:kicked", { roomId });
    io.to(`room:${roomId}`).emit("room:user:kicked", { roomId, targetId });

    await this.system(roomId, "User was removed from the room", "system", { mentions: [targetId] });

    return { success: true };
  }

  /* =====================================================
     JOIN / LEAVE / REJOIN
  ===================================================== */

async joinRoom(roomId: string, userId: string) {
  // 1) DB فقط داخل transaction
  const { joined } = await this.withTx(async (session) => {
    const room = await Room.findById(roomId).session(session);
    if (!room) throw new Error("Room not found");

    this.ensureArrays(room);

    if (room.isLocked) throw new Error("Room is locked");
    if (this.isBanned(room, userId)) throw new Error("You are banned");
    if ((room.usersCount || 0) >= (room.maxUsers || 50))
      throw new Error("Room is full");

    // ✅ لا نمنع الدخول لو role === "none"
    const role = this.getRole(room, userId);
    console.log("User role on join:", role); // Debug اختياري

    // لو موجود بالفعل
    const alreadyActive = room.activeUsers.some(
      (u: any) => u.toString() === userId
    );

    if (alreadyActive) return { joined: false };

    // يدخل كـ active user فقط
    room.activeUsers.push(userId as any);
    room.usersCount = (room.usersCount || 0) + 1;

    await room.save({ session });

    return { joined: true };
  });

  // 2) side effects خارج transaction
  if (joined) {
    this.io().to(`room:${roomId}`).emit("room:user:joined", {
      roomId,
      userId
    });

    await this.system(roomId, "User joined", "join", {
      mentions: [userId]
    });
  }

  return { success: true };
}
    /* =====================================================
     CREATE ROOM / GET ROOMS / SEARCH ROOMS
  ===================================================== */

  async createRoom(userId: string, data: any) {
    const name = String(data?.name || "").trim();
    if (!name) throw new Error("Room name is required");

    const description = typeof data?.description === "string" ? data.description.trim() : undefined;
    const avatar = typeof data?.avatar === "string" ? data.avatar.trim() : undefined;
    const cover = typeof data?.cover === "string" ? data.cover.trim() : undefined;

    const type: RoomType = Object.values(RoomType).includes(data?.type)
      ? data.type
      : RoomType.PUBLIC;

    const maxUsers = data?.maxUsers !== undefined ? Number(data.maxUsers) : 50;
    const slowModeSeconds = data?.slowModeSeconds !== undefined ? Number(data.slowModeSeconds) : 0;

    // PROTECTED
    const passwordRaw = typeof data?.password === "string" ? data.password.trim() : "";
    const password = type === RoomType.PROTECTED ? passwordRaw : undefined;

    // SUBSCRIPTION
    const subscriptionPriceRaw =
      data?.subscriptionPrice !== undefined ? Number(data.subscriptionPrice) : 0;
    const subscriptionPrice = type === RoomType.SUBSCRIPTION ? Math.max(0, subscriptionPriceRaw) : 0;

    // Premium
    const premiumLevel: RoomPremiumLevel =
      typeof data?.premiumLevel === "number" ? data.premiumLevel : RoomPremiumLevel.FREE;

    // tags (سيتم تنظيفها أيضًا في pre-validate عندك)
    const tags = Array.isArray(data?.tags) ? data.tags : [];

    // إنشاء الغرفة مع جعل المنشئ هو creator + owner + member (اختياري admin)
    const room = await Room.create({
      name,
      description,
      avatar,
      cover,

      creator: userId,

      type,
      maxUsers: Math.max(1, Number.isFinite(maxUsers) ? maxUsers : 50),

      password,
      subscriptionPrice,

      isLocked: false,
      slowModeSeconds: Math.max(0, Math.min(3600, Number.isFinite(slowModeSeconds) ? slowModeSeconds : 0)),

      owners: [userId],
      admins: [],
      members: [userId],
      blockeds: [],
      activeUsers: [],

      mutedUsers: [],
      vipUsers: [],

      maxVoiceSeats: 4,
      voiceQueue: [],
      raisedHands: [],
      voiceSpeakers: [],

      antiSpamEnabled: false,
      maxMessagesPerMinute: 10,

      level: 1,
      xp: 0,

      boostLevel: 0,

      usersCount: 0,
      messagesCount: 0,

      totalRevenue: 0,

      premiumLevel,
      tags,
      isVerified: false
    });

    // بث تحديث (اختياري)
    this.io().emit("room:created", {
      roomId: room._id,
      creator: userId,
      type: room.type,
      name: room.name
    });

    return room;
  }

  async getRoomsByType(type: RoomType, pagination: { limit?: number; page?: number } = {}) {
    const t: RoomType = Object.values(RoomType).includes(type) ? type : RoomType.PUBLIC;

    const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 30));
    const page = Math.max(1, Number(pagination.page) || 1);
    const skip = (page - 1) * limit;

    // ملاحظة: إذا تريد إخفاء غرف PRIVATE عن غير الأعضاء، سنضيف فلترة لاحقًا حسب متطلباتك
    const filter: any = { type: t };

    const [items, total] = await Promise.all([
      Room.find(filter)
        .select("-password") // احتياطي (مع select:false لن تظهر غالبًا)
        .sort({ boostLevel: -1, usersCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Room.countDocuments(filter)
    ]);

    return {
      type: t,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items
    };
  }

  async searchRooms(query: string, type?: RoomType, limit = 30) {
    const q = String(query || "").trim();
    if (!q) return [];

    const l = Math.max(1, Math.min(100, Number(limit) || 30));

    // بحث بالاسم/الوصف/التاجز
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");

    const filter: any = {
      $or: [{ name: rx }, { description: rx }, { tags: rx }]
    };

    if (type && Object.values(RoomType).includes(type)) {
      filter.type = type;
    }

    const rooms = await Room.find(filter)
      .select("-password")
      .sort({ usersCount: -1, boostLevel: -1, createdAt: -1 })
      .limit(l);

    return rooms;
  }
  async leaveRoom(roomId: string, userId: string) {
    return this.withTx(async (session) => {
      const room = await Room.findById(roomId).session(session);
      if (!room) throw new Error("Room not found");
      this.ensureArrays(room);

      const wasActive = room.activeUsers.some((u: any) => u.toString() === userId);
      room.activeUsers = room.activeUsers.filter((u: any) => u.toString() !== userId);

      if (wasActive) room.usersCount = Math.max(0, (room.usersCount || 0) - 1);

      await room.save({ session });

      this.io().to(`room:${roomId}`).emit("room:user:left", { roomId, userId });
      await this.system(roomId, "User left", "leave", { mentions: [userId] });

      return { success: true };
    });
  }

  async autoRejoin(userId: string) {
    const rooms = await Room.find({ activeUsers: userId }).select("_id");
    return rooms.map((r: any) => r._id.toString());
  }

  async safeRejoin(roomId: string, userId: string) {
    return this.withTx(async (session) => {
      const room = await Room.findById(roomId).session(session);
      if (!room) return;
      this.ensureArrays(room);

      if (this.isBanned(room, userId)) return;

      const alreadyActive = room.activeUsers.some((u: any) => u.toString() === userId);
      if (!alreadyActive) {
        room.activeUsers.push(userId as any);
        room.usersCount = (room.usersCount || 0) + 1;
        await room.save({ session });
        this.io().to(`room:${roomId}`).emit("room:user:rejoined", { roomId, userId });
      }
    });
  }

  /* =====================================================
     MESSAGES (Send / Edit / Delete / Pin / Highlight / Fetch)
  ===================================================== */

async sendMessage(input: SendMessageInput) {
  const {
    roomId,
    senderId,
    content = "",
    type = "text",
    replyTo,
    mentions = [],
    media,
    gift
  } = input;

  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");
  this.ensureArrays(room);

  if (!room.activeUsers.includes(senderId as any)) throw new Error("Not inside room");
  if (this.isBanned(room, senderId)) throw new Error("You are banned");
  if (this.isMuted(room, senderId)) throw new Error("You are muted");

  // ✅ تم إلغاء فكرة lastMessageAt بالكامل كما طلبت

  const cleanMentions = Array.from(
    new Set((mentions || []).filter((x) => this.isValidObjectId(x)))
  );

  const message = await RoomMessage.create({
    room: roomId,
    sender: senderId,
    content,
    type,
    replyTo: replyTo && this.isValidObjectId(replyTo) ? replyTo : undefined,
    mentions: cleanMentions,
    media: media?.url ? media : undefined,
    gift: gift?.name ? gift : undefined
  });

  this.io().to(`room:${roomId}`).emit("room:message:new", message);

  // Mention Notifications
  if (cleanMentions.length) {
    for (const uid of cleanMentions) {
      this.io().to(uid).emit("room:mention", {
        roomId,
        messageId: message._id
      });
    }
  }

  return message;
}
  async editMessage(roomId: string, userId: string, messageId: string, newContent: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    const msg = await RoomMessage.findById(messageId);
    if (!msg) throw new Error("Message not found");
    if (msg.room.toString() !== roomId) throw new Error("Invalid room message");

    const role = this.getRole(room, userId);
    const isOwner = msg.sender?.toString?.() === userId;

    if (!isOwner && !["creator", "owner", "admin"].includes(role)) throw new Error("Not allowed");

    msg.content = String(newContent || "");
    await msg.save();

    this.io().to(`room:${roomId}`).emit("room:message:edited", msg);
    return msg;
  }

  async deleteMessageForEveryone(roomId: string, userId: string, messageId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    const msg = await RoomMessage.findById(messageId);
    if (!msg) throw new Error("Message not found");
    if (msg.room.toString() !== roomId) throw new Error("Invalid room message");

    const role = this.getRole(room, userId);
    const isOwner = msg.sender?.toString?.() === userId;

    if (!isOwner && !["creator", "owner", "admin"].includes(role)) throw new Error("Not allowed");

    // Soft delete
    msg.deletedForEveryone = true;
    await msg.save();

    this.io().to(`room:${roomId}`).emit("room:message:deleted", { messageId });
    await this.system(roomId, "Message deleted", "system");

    return { success: true };
  }

  async pinMessage(roomId: string, userId: string, messageId: string, pinned = true) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner", "admin"]);

    const message = await RoomMessage.findById(messageId);
    if (!message) throw new Error("Message not found");
    if (message.room.toString() !== roomId) throw new Error("Invalid room message");

    message.isPinned = Boolean(pinned);
    await message.save();

    this.io().to(`room:${roomId}`).emit("room:message:pinned", message);
    await this.system(roomId, pinned ? "Message pinned" : "Message unpinned", "system");

    return message;
  }

  async highlightMessage(roomId: string, userId: string, messageId: string, highlighted = true) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner", "admin"]);

    const message = await RoomMessage.findById(messageId);
    if (!message) throw new Error("Message not found");
    if (message.room.toString() !== roomId) throw new Error("Invalid room message");

    message.isHighlighted = Boolean(highlighted);
    await message.save();

    this.io().to(`room:${roomId}`).emit("room:message:highlighted", message);
    await this.system(roomId, highlighted ? "Message highlighted" : "Message unhighlighted", "system");

    return message;
  }

  async getMessages(roomId: string, userId: string, pagination: Pagination = {}) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    // يجب أن يكون عضوًا على الأقل
    this.require(room, userId, ["creator", "owner", "admin", "member"]);

    const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 30));

    const query: any = { room: roomId };

    // cursor pagination: before messageId
    if (pagination.before && this.isValidObjectId(pagination.before)) {
      const beforeMsg = await RoomMessage.findById(pagination.before).select("createdAt");
      if (beforeMsg?.createdAt) {
        query.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await RoomMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "username avatar")
      .populate("replyTo");

    return messages;
  }

  async searchMessages(roomId: string, userId: string, q: string, limit = 30) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner", "admin", "member"]);

    const l = Math.max(1, Math.min(100, Number(limit) || 30));
    const text = String(q || "").trim();
    if (!text) return [];

    // يعتمد على وجود text index في RoomMessage (إن لم يوجد، سيعمل لكنه بدون استخدام فهرس)
    const messages = await RoomMessage.find({
      room: roomId,
      content: { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }
    })
      .sort({ createdAt: -1 })
      .limit(l);

    return messages;
  }

  async toggleReaction(roomId: string, messageId: string, userId: string, emoji: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    // يجب أن يكون داخل الغرفة (أو عضو)
    const role = this.getRole(room, userId);
    if (role === "none") throw new Error("Not allowed");

    const message = await RoomMessage.findById(messageId);
    if (!message) throw new Error("Message not found");
    if (message.room.toString() !== roomId) throw new Error("Invalid room message");

    const e = String(emoji || "").trim();
    if (!e) throw new Error("Invalid emoji");

    const existing = message.reactions.find(
      (r) => r.user.toString() === userId && r.emoji === e
    );

    if (existing) {
      message.reactions = message.reactions.filter(
        (r) => !(r.user.toString() === userId && r.emoji === e)
      );
    } else {
      message.reactions.push({
        user: userId as any,
        emoji: e,
        createdAt: new Date()
      });
    }

    await message.save();

    this.io().to(`room:${roomId}`).emit("room:reaction:update", {
      messageId,
      reactions: message.reactions
    });

    return message.reactions;
  }

  /* =====================================================
     ROOM USERS (WITH ROLES & STATUS)
  ===================================================== */

  async getRoomUsers(roomId: string) {
    const room = await Room.findById(roomId)
      .populate("creator", "username avatar")
      .populate("owners", "username avatar")
      .populate("admins", "username avatar")
      .populate("members", "username avatar");

    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const now = new Date();

    const formatUser = (user: any, role: Role) => {
      const vip = (room.vipUsers || []).find((v: any) => v.user.toString() === user._id.toString());
      const muted = (room.mutedUsers || []).find((m: any) => m.user.toString() === user._id.toString());

      const isActive = (room.activeUsers || []).some((u: any) => u.toString() === user._id.toString());

      return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        role,
        isActive,
        isVip: !!vip,
        vipExpiresAt: vip?.expiresAt || null,
        isMuted: !!muted && muted.until > now,
        mutedUntil: muted?.until || null
      };
    };

    const users = [
      formatUser(room.creator, "creator"),
      ...(room.owners || []).map((u: any) => formatUser(u, "owner")),
      ...(room.admins || []).map((u: any) => formatUser(u, "admin")),
      ...(room.members || []).map((u: any) => formatUser(u, "member"))
    ];

    return { total: users.length, users };
  }

  /* =====================================================
     INCREASE MAX USERS LIMIT
  ===================================================== */

  async increaseMaxUsers(roomId: string, userId: string, amount: number) {
    if (amount <= 0) throw new Error("Invalid increase amount");

    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    const role = this.getRole(room, userId);
    if (role !== "creator") throw new Error("Only creator can increase limit");

    room.maxUsers += amount;

    await room.save();

    this.io().to(`room:${roomId}`).emit("room:maxUsers:update", room.maxUsers);
    await this.system(roomId, `Room capacity increased to ${room.maxUsers}`, "announcement");

    return room.maxUsers;
  }

  /* =====================================================
     DELETE ROOM
  ===================================================== */

  async deleteRoom(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    if (room.creator.toString() !== userId) throw new Error("Only creator can delete");

    await Room.findByIdAndDelete(roomId);
    this.io().to(`room:${roomId}`).emit("room:deleted", { roomId });
    return { success: true };
  }

  /* =====================================================
     BASIC ROOM STATS
  ===================================================== */

  async getRoomStats(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner", "admin"]);

    const activeCount = (room.activeUsers || []).length;
    const totalUsersCount = room.usersCount || 0;

    // messagesCount موجود عندك في Room
    const messagesCount = room.messagesCount || 0;

    return {
      roomId,
      activeCount,
      totalUsersCount,
      messagesCount,
      level: room.level,
      xp: room.xp,
      boostLevel: room.boostLevel,
      boostExpiresAt: room.boostExpiresAt
    };
  }
}

export default new RoomService();