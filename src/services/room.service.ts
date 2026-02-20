import mongoose from "mongoose";
import Room, { RoomType, RoomPremiumLevel } from "../models/Room";
import RoomMessage from "../models/RoomMessage";
import { getIO } from "../config/socket";

type Role = "creator" | "owner" | "admin" | "member" | "none";

class RoomService {

  /* =====================================================
     INTERNAL HELPERS
  ===================================================== */

  private io() {
    return getIO();
  }

  private async system(roomId: string, content: string, type: any = "system") {
    const msg = await RoomMessage.create({ room: roomId, content, type });
    this.io().to(`room:${roomId}`).emit("room:message:new", msg);
  }

  private getRole(room: any, userId: string): Role {

    if (room.creator.toString() === userId) return "creator";
    if (room.owners.some((x: any) => x.toString() === userId)) return "owner";
    if (room.admins.some((x: any) => x.toString() === userId)) return "admin";
    if (room.members.some((x: any) => x.toString() === userId)) return "member";
    return "none";
  }

  private require(room: any, userId: string, roles: Role[]) {
    const r = this.getRole(room, userId);
    if (!roles.includes(r)) throw new Error("Not allowed");
  }

  private removeAllRoles(room: any, userId: string) {
    room.owners = room.owners.filter((x: any) => x.toString() !== userId);
    room.admins = room.admins.filter((x: any) => x.toString() !== userId);
    room.members = room.members.filter((x: any) => x.toString() !== userId);
  }

  /* =====================================================
     ROOM SETTINGS
  ===================================================== */

  async updateInfo(roomId: string, userId: string, data: any) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner"]);

    if (data.name) room.name = data.name;
    if (data.description) room.description = data.description;
    if (data.avatar) room.avatar = data.avatar;
    if (data.cover) room.cover = data.cover;

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
    return room;
  }

  async changePremiumLevel(roomId: string, userId: string, level: RoomPremiumLevel) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator"]);

    room.premiumLevel = level;
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:premium:update", level);
    return room;
  }

  /* =====================================================
     VIP SYSTEM
  ===================================================== */

  async addVip(roomId: string, userId: string, targetId: string, days: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner"]);

    const expiresAt = new Date(Date.now() + days * 86400000);

    room.vipUsers = room.vipUsers.filter(v => v.user.toString() !== targetId);
    room.vipUsers.push({ user: targetId as any, expiresAt });

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:vip:update", room.vipUsers);

    return room.vipUsers;
  }

  async removeVip(roomId: string, userId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner"]);

    room.vipUsers = room.vipUsers.filter(v => v.user.toString() !== targetId);
    await room.save();

    this.io().to(`room:${roomId}`).emit("room:vip:update", room.vipUsers);
    return room.vipUsers;
  }

  /* =====================================================
     ANTI SPAM
  ===================================================== */

  async toggleAntiSpam(roomId: string, userId: string, enabled: boolean, max?: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner"]);

    room.antiSpamEnabled = enabled;
    if (max) room.maxMessagesPerMinute = max;

    await room.save();
    return room;
  }

  /* =====================================================
     POLL SYSTEM
  ===================================================== */

  async startPoll(roomId: string, userId: string, question: string, options: string[], minutes: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner", "admin"]);

    room.activePoll = {
      question,
      options: options.map(o => ({ text: o, votes: 0 })),
      expiresAt: new Date(Date.now() + minutes * 60000)
    };

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:poll:start", room.activePoll);
    return room.activePoll;
  }

  async vote(roomId: string, optionIndex: number) {
    const room = await Room.findById(roomId);
    if (!room || !room.activePoll) throw new Error("No poll");

    room.activePoll.options[optionIndex].votes++;
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
  }

  /* =====================================================
     VOICE SYSTEM
  ===================================================== */

  async setMaxVoiceSeats(roomId: string, userId: string, seats: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner"]);

    room.maxVoiceSeats = seats;
    await room.save();
    return seats;
  }

  async raiseHand(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

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

    room.raisedHands = room.raisedHands.filter(x => x.toString() !== userId);
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

    room.xp += amount;

    if (room.xp >= room.level * 100) {
      room.level += 1;
      room.xp = 0;
      await this.system(roomId, `Room leveled up to ${room.level}`);
    }

    await room.save();
    return { level: room.level, xp: room.xp };
  }

  /* =====================================================
     BOOST
  ===================================================== */

  async boost(roomId: string, level: number, hours: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    room.boostLevel = level;
    room.boostExpiresAt = new Date(Date.now() + hours * 3600000);
    await room.save();

    return room;
  }

  /* =====================================================
     DELETE ROOM
  ===================================================== */

  async deleteRoom(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    if (room.creator.toString() !== userId)
      throw new Error("Only creator can delete");

    await Room.findByIdAndDelete(roomId);
    return { success: true };
  }
/* =====================================================
   KICK USER (Temporary Remove - Can Rejoin)
===================================================== */

async kickUser(
  roomId: string,
  actorId: string,
  targetId: string
) {

  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");

  const actorRole = this.getRole(room, actorId);
  const targetRole = this.getRole(room, targetId);

  if (targetRole === "creator")
    throw new Error("Cannot kick creator");

  /* ================= PERMISSION MATRIX ================= */

  if (actorRole === "creator") {
    // يستطيع طرد أي شخص
  }
  else if (actorRole === "owner") {
    if (targetRole === "owner")
      throw new Error("Owner cannot kick another owner");
  }
  else if (actorRole === "admin") {
    if (targetRole === "owner" || targetRole === "admin")
      throw new Error("Admin cannot kick owner or admin");
  }
  else {
    throw new Error("Not allowed");
  }

  /* ================= REMOVE USER ================= */

  this.removeAllRoles(room, targetId);

  room.usersCount = Math.max(0, room.usersCount - 1);

  await room.save();

  /* ================= SOCKET FORCE REMOVE ================= */

  const io = this.io();

  io.to(targetId).emit("room:kicked", {
    roomId
  });

  io.to(`room:${roomId}`).emit("room:user:kicked", {
    roomId,
    targetId
  });

  await this.system(
    roomId,
    "User was removed from the room",
    "system"
  );

  return { success: true };
}

/* =====================================================
   JOIN ROOM
===================================================== */

/* =====================================================
   JOIN ROOM (ADVANCED)
===================================================== */

/* =====================================================
   JOIN ROOM (SEPARATED ROLES)
===================================================== */
/* =====================================================
   LEAVE ROOM (ROLES PRESERVED)
===================================================== */

async leaveRoom(roomId: string, userId: string) {

  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");

  room.activeUsers = room.activeUsers.filter(
    u => u.toString() !== userId
  );

  room.usersCount = Math.max(0, room.usersCount - 1);

  await room.save();

  await this.system(roomId, "User left", "leave");

  return { success: true };
}
async joinRoom(roomId: string, userId: string) {

  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");

  if (room.blockeds.includes(userId as any))
    throw new Error("You are banned");

  if (room.usersCount >= (room.maxUsers || 50))
    throw new Error("Room is full");

  // إذا لم يكن لديه أي دور = لا يدخل
  const role = this.getRole(room, userId);
  if (role === "none")
    throw new Error("You are not a member of this room");

  // إذا موجود بالفعل
  if (room.activeUsers.some(u => u.toString() === userId))
    return { success: true };

  room.activeUsers.push(userId as any);
  room.usersCount += 1;

  await room.save();

  await this.system(roomId, "User joined", "join");

  return { success: true };
}
/* =====================================================
   AUTO REJOIN ROOMS
===================================================== */

async autoRejoin(userId: string) {

  // الغرف التي كان المستخدم متواجدًا بها فعليًا
  const rooms = await Room.find({
    activeUsers: userId
  }).select("_id");

  return rooms.map(r => r._id.toString());
}
/* =====================================================
   SAFE REJOIN (NO DUPLICATION)
===================================================== */

async safeRejoin(roomId: string, userId: string) {

  const room = await Room.findById(roomId);
  if (!room) return;

  const alreadyActive =
    room.activeUsers.some(u => u.toString() === userId);

  if (!alreadyActive) {
    room.activeUsers.push(userId as any);
    room.usersCount += 1;
    await room.save();
  }
}
/* =====================================================
   PIN MESSAGE
===================================================== */

async pinMessage(roomId: string, userId: string, messageId: string) {

  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");

  this.require(room, userId, ["creator", "owner", "admin"]);

  const message = await RoomMessage.findById(messageId);
  if (!message) throw new Error("Message not found");

  message.isPinned = true;
  await message.save();

  this.io().to(`room:${roomId}`).emit("room:message:pinned", message);

  await this.system(roomId, "Message pinned");

  return message;
}
/* =====================================================
   SEND MESSAGE WITH REPLY
===================================================== */

async sendMessage(
  roomId: string,
  senderId: string,
  content: string,
  type: string = "text",
  replyTo?: string,
  mentions: string[] = []
) {

  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");

  if (!room.activeUsers.includes(senderId as any))
    throw new Error("Not inside room");

  const message = await RoomMessage.create({
    room: roomId,
    sender: senderId,
    content,
    type,
    replyTo,
    mentions
  });

  room.messagesCount += 1;
  await room.save();

  this.io().to(`room:${roomId}`).emit("room:message:new", message);

  /* ===== Mention Notifications ===== */
  if (mentions.length) {
    for (const userId of mentions) {
      this.io().to(userId).emit("room:mention", {
        roomId,
        messageId: message._id
      });
    }
  }

  return message;
}
/* =====================================================
   TOGGLE REACTION
===================================================== */

async toggleReaction(
  roomId: string,
  messageId: string,
  userId: string,
  emoji: string
) {

  const message = await RoomMessage.findById(messageId);
  if (!message) throw new Error("Message not found");

  const existing = message.reactions.find(
    r => r.user.toString() === userId && r.emoji === emoji
  );

  if (existing) {
    message.reactions = message.reactions.filter(
      r => !(r.user.toString() === userId && r.emoji === emoji)
    );
  } else {
    message.reactions.push({
      user: userId as any,
      emoji,
      createdAt: new Date()
    });
  }

  await message.save();

  this.io().to(`room:${roomId}`).emit(
    "room:reaction:update",
    {
      messageId,
      reactions: message.reactions
    }
  );

  return message.reactions;
}
/* =====================================================
   GET ROOM USERS (WITH ROLES & STATUS)
===================================================== */

async getRoomUsers(roomId: string) {

  const room = await Room.findById(roomId)
    .populate("creator", "username avatar")
    .populate("owners", "username avatar")
    .populate("admins", "username avatar")
    .populate("members", "username avatar");

  if (!room) throw new Error("Room not found");

  const now = new Date();

  /* ================= FORMAT USER ================= */

  const formatUser = (user: any, role: Role) => {

    const vip = room.vipUsers.find(
      v => v.user.toString() === user._id.toString()
    );

    const muted = room.mutedUsers.find(
      m => m.user.toString() === user._id.toString()
    );

    return {
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      role,
      isVip: !!vip,
      vipExpiresAt: vip?.expiresAt || null,
      isMuted: !!muted && muted.until > now,
      mutedUntil: muted?.until || null
    };
  };

  /* ================= BUILD LIST ================= */

  const users = [

    // Creator
    formatUser(room.creator, "creator"),

    // Owners
    ...room.owners.map((u: any) =>
      formatUser(u, "owner")
    ),

    // Admins
    ...room.admins.map((u: any) =>
      formatUser(u, "admin")
    ),

    // Members
    ...room.members.map((u: any) =>
      formatUser(u, "member")
    )

  ];

  return {
    total: users.length,
    users
  };
}

/* =====================================================
   INCREASE MAX USERS LIMIT
===================================================== */

async increaseMaxUsers(
  roomId: string,
  userId: string,
  amount: number
) {

  if (amount <= 0)
    throw new Error("Invalid increase amount");

  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");

  const role = this.getRole(room, userId);

  // فقط Creator يمكنه زيادة الحد
  if (role !== "creator")
    throw new Error("Only creator can increase limit");

  room.maxUsers += amount;

  await room.save();

  this.io().to(`room:${roomId}`).emit(
    "room:maxUsers:update",
    room.maxUsers
  );

  await this.system(
    roomId,
    `Room capacity increased to ${room.maxUsers}`
  );

  return room.maxUsers;
}
}

export default new RoomService();