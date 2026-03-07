import mongoose, { Types } from "mongoose";
import Room, { RoomType, RoomPremiumLevel } from "../models/Room";
import RoomMessage from "../models/RoomMessage";
import { getIO } from "../config/socket";
import RoomUserState from "../models/RoomUserState";
import notificationService from "./notification.service";

/**
 * ملاحظة مهمة جدًا:
 * - في RoomMessageSchema عندك يوجد Hook يقوم بزيادة messagesCount تلقائيًا عند إنشاء الرسالة.
 * - لذلك في هذا الملف لا نقوم بزيادة room.messagesCount يدويًا داخل sendMessage حتى لا يحدث تضاعف.
 */
type RoomUserStateLean = {
  clearedAt: Date | null;
  pinnedMessageIdAtClear: Types.ObjectId | null;
  pinnedMessageAtClear?: Date | null;
  lastGiftSeenAt: Date; // ✅ أضف هذا
};
type Role = "creator" | "owner" | "admin" | "member" | "none";
const USER_PUBLIC_FIELDS =
  "username atUsername avatar coverImage isOnline lastSeen role " +
  "activeCustomization verificationType avatarFrame badges ownedMessageEffects ownedGifts profileEntryAnimation " +
  "customEmojiBadge " +
  "followersCount followingCount totalLikesReceived totalRetweetsReceived profileViews";
type SendMessageInput = {
  roomId: string;
  senderId: string;
  clientId?: string;

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
    key?: string;
    icon?: string;
    count?: number;

    targetId?: string;
    targetName?: string;

    // للتوافق القديم إن وُجد
    name?: string;
    value?: number;
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
private logCustomBadge(tag: string, data: any) {
  try {
    console.log(`[CUSTOM_BADGE][${tag}]`, JSON.stringify(data, null, 2));
  } catch {
    console.log(`[CUSTOM_BADGE][${tag}]`, data);
  }
}
  private isValidObjectId(id: string) {
    return Types.ObjectId.isValid(id);
  }
  private buildMessagePreviewForNotification(message: any) {
    const msgType = String(message?.type || "text");

    // لو عندك media
    const hasMedia = Boolean(message?.media?.url);

    // حاول تمييز فيديو/صورة
    const mime = String(message?.media?.mimeType || "").toLowerCase();
    const url = String(message?.media?.url || "").toLowerCase();

    const isVideo =
      mime.startsWith("video/") ||
      url.endsWith(".mp4") ||
      url.endsWith(".mov") ||
      url.endsWith(".mkv") ||
      url.endsWith(".webm");

    const isImage =
      mime.startsWith("image/") ||
      url.endsWith(".jpg") ||
      url.endsWith(".jpeg") ||
      url.endsWith(".png") ||
      url.endsWith(".gif") ||
      url.endsWith(".webp");

    if (hasMedia || msgType === "image" || msgType === "video") {
      if (isVideo || msgType === "video") return { kind: "video", labelAr: "فيديو", preview: "" };
      return { kind: "image", labelAr: "صورة", preview: "" };
    }

    // رسالة نصية
    const text = String(message?.content || "").trim();
    const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;

    return { kind: "text", labelAr: "رسالة", preview };
  }
  // ✅ إصلاح: المقارنة تكون دائمًا عبر toString()
  private isInside(room: any, userId: string) {
    const uid = userId.toString();
    return (room.activeUsers || []).some((u: any) => u?.toString?.() === uid);
  }
  private oidOrNull(id?: string) {
    const s = String(id || "");
    return this.isValidObjectId(s) ? new Types.ObjectId(s) : null;
  }
  private async applyGiftOncePolicy(
    roomId: string,
    userId: string,
    state: any,
    messages: any[],
    pagination: { before?: string }
  ) {
    if (!Array.isArray(messages) || !messages.length) return messages;

    const lastGiftSeenAt = state?.lastGiftSeenAt ? new Date(state.lastGiftSeenAt) : new Date(0);

    // مرة واحدة = أول صفحة فقط
    const isFirstPage = !pagination?.before;

    // ✅ فلترة Boost فقط وليس كل gift
    const isBoost = (m: any) => {
      const key = String(m?.gift?.key || m?.content || "").trim();
      return key.startsWith("boost_");
    };

    // ✅ boosts unseen داخل الصفحة
    const unseenBoosts = messages
      .filter((m: any) => m?.type === "gift" && isBoost(m) && m?.createdAt && new Date(m.createdAt).getTime() > lastGiftSeenAt.getTime())
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ✅ لو لا يوجد Boost جديد: حوّل boosts القديمة فقط إلى system حتى لا تعمل overlay
    if (!unseenBoosts.length) {
      return messages.map((m: any) => {
        if (m?.type !== "gift") return m;
        if (!isBoost(m)) return m; // ✅ لا تلمس الهدايا العادية

        return {
          ...(m.toObject?.() ?? m),
          type: "system",
          content: "🚀 Boost",
          systemType: "gift"
        };
      });
    }

    // ✅ اختر Boost واحدة فقط (الأحدث unseen)
    const chosenId = String(unseenBoosts[0]._id);

    const patched = messages.map((m: any) => {
      if (m?.type !== "gift") return m;

      // ✅ لا تلمس الهدايا العادية
      if (!isBoost(m)) return m;

      const isChosen = String(m._id) === chosenId;
      if (isChosen) return m;

      // ✅ boosts الأخرى تتحول system لتمنع overlay المتكرر
      return {
        ...(m.toObject?.() ?? m),
        type: "system",
        content: "🚀 Boost",
        systemType: "gift"
      };
    });

    // ✅ تحديث lastGiftSeenAt مرة واحدة عند أول صفحة فقط
    if (isFirstPage) {
      const newestSeen = new Date(unseenBoosts[0].createdAt);
      if (!Number.isNaN(newestSeen.getTime())) {
        await RoomUserState.updateOne(
          { room: roomId, user: userId },
          { $set: { lastGiftSeenAt: newestSeen } },
          { upsert: true }
        );
      }
    }

    return patched;
  }
  private async setClearedAt(
    roomId: string,
    userId: string,
    date = new Date(),
    keepPinnedId: string | null = null
  ) {
    let pinnedId: any = null;
    let pinnedTime: Date | null = null;

    if (keepPinnedId && this.isValidObjectId(keepPinnedId)) {
      const pinned = await RoomMessage.findOne({
        _id: keepPinnedId,
        room: roomId,
        isPinned: true,
        deletedForEveryone: { $ne: true }
      }).select("_id createdAt updatedAt");

      if (pinned) {
        pinnedId = pinned._id;
        pinnedTime = (pinned.updatedAt || pinned.createdAt) as any;
      }
    }

    await RoomUserState.updateOne(
      { room: roomId, user: userId },
      {
        $set: {
          clearedAt: date,
          pinnedMessageIdAtClear: pinnedId,
          pinnedMessageAtClear: pinnedTime
        }
      },
      { upsert: true }
    );
  }
  private async getLastPinnedBefore(roomId: string, beforeAt: Date) {
    const lastPinned = await RoomMessage.findOne({
      room: roomId,
      isPinned: true,
      deletedForEveryone: { $ne: true },
      createdAt: { $lt: beforeAt }
    })
      .sort({ createdAt: -1 })
      .select("_id");

    return lastPinned?._id ? String(lastPinned._id) : null;
  }
 private async getUserPublicSnapshot(userId: string) {
  const User = mongoose.model("User");

  const u = await User.findById(userId).select(USER_PUBLIC_FIELDS);

  this.logCustomBadge("getUserPublicSnapshot:RAW_USER", {
    userId,
    found: !!u,
    username: u?.username,
    customEmojiBadge: u?.customEmojiBadge || null,
    activeCustomization: u?.activeCustomization || null,
    badges: u?.badges || []
  });

  const base = {
    _id: String(userId),
    username: "مستخدم",
    atUsername: "",
    avatar: "",
    coverImage: "",
    isOnline: false,
    lastSeen: null as any,
    role: "user",

    activeCustomization: {
      avatarFrame: "",
      messageEffect: "",
      profileEntryAnimation: "",
      badges: [],
      verificationType: "none"
    },

    verificationType: "none",
    avatarFrame: "",
    badges: [] as string[],
    ownedMessageEffects: [] as string[],
    ownedGifts: [] as string[],
    profileEntryAnimation: "",

    customEmojiBadge: {
      emoji: "",
      isActive: false,
      purchasedAt: null as any,
      expiresAt: null as any
    },

    followersCount: 0,
    followingCount: 0,
    totalLikesReceived: 0,
    totalRetweetsReceived: 0,
    profileViews: 0
  };

  if (!u) {
    this.logCustomBadge("getUserPublicSnapshot:RETURN_BASE", {
      userId,
      snapshot: base
    });
    return base;
  }

  const snapshot = {
    ...base,
    _id: String(u._id),

    username: u.username || base.username,
    atUsername: u.atUsername || base.atUsername,
    avatar: u.avatar || base.avatar,
    coverImage: u.coverImage || base.coverImage,

    isOnline: Boolean(u.isOnline),
    lastSeen: u.lastSeen || null,
    role: u.role || base.role,

    activeCustomization: u.activeCustomization || base.activeCustomization,

    verificationType: u.verificationType || base.verificationType,
    avatarFrame: u.avatarFrame || base.avatarFrame,
    badges: Array.isArray(u.badges) ? u.badges : base.badges,
    ownedMessageEffects: Array.isArray(u.ownedMessageEffects) ? u.ownedMessageEffects : base.ownedMessageEffects,
    ownedGifts: Array.isArray(u.ownedGifts) ? u.ownedGifts : base.ownedGifts,
    profileEntryAnimation: u.profileEntryAnimation || base.profileEntryAnimation,

    customEmojiBadge:
      u.customEmojiBadge && typeof u.customEmojiBadge === "object"
        ? {
            emoji: String(u.customEmojiBadge.emoji || ""),
            isActive: Boolean(u.customEmojiBadge.isActive),
            purchasedAt: u.customEmojiBadge.purchasedAt || null,
            expiresAt: u.customEmojiBadge.expiresAt || null
          }
        : base.customEmojiBadge,

    followersCount: Number(u.followersCount || 0),
    followingCount: Number(u.followingCount || 0),
    totalLikesReceived: Number(u.totalLikesReceived || 0),
    totalRetweetsReceived: Number(u.totalRetweetsReceived || 0),
    profileViews: Number(u.profileViews || 0)
  };

  this.logCustomBadge("getUserPublicSnapshot:RETURN_SNAPSHOT", {
    userId,
    username: snapshot.username,
    customEmojiBadge: snapshot.customEmojiBadge,
    activeCustomization: snapshot.activeCustomization,
    badges: snapshot.badges
  });

  return snapshot;
}
  async getUserState(roomId: string, userId: string): Promise<RoomUserStateLean> {
    const state = await RoomUserState.findOne({ room: roomId, user: userId }).lean();

    if (!state) {
      const created = await RoomUserState.create({
        room: roomId,
        user: userId,
        lastGiftSeenAt: new Date(0),
      });

      return created.toObject() as RoomUserStateLean;
    }

    return state as RoomUserStateLean;
  }
  private oid(id: string) {
    if (!this.isValidObjectId(id)) throw new Error("Invalid id");
    return new Types.ObjectId(id);
  }

  async withTx<T>(fn: (session: any) => Promise<T>) {
    const sid = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const session = await mongoose.startSession();

    console.log("🧷 withTx: session started", { sid });

    try {
      let result!: T;

      await session.withTransaction(async () => {
        console.log("🧷 withTx: transaction BEGIN", { sid });
        result = await fn(session);
        console.log("🧷 withTx: transaction FN DONE", { sid });
      });

      console.log("✅ withTx: COMMIT OK", { sid });
      return result;
    } catch (e: any) {
      console.log("❌ withTx: ABORT/ERROR", { sid, message: e?.message, e });
      throw e;
    } finally {
      session.endSession();
      console.log("🧷 withTx: session ended", { sid });
    }
  }

  /**
   * ✅ تعديل جوهري:
   * - لو المستخدم داخل activeUsers نعتبره "member"
   * - هذا يحل مشكلة require(...) بعد join مباشرة
   */
  private getRole(room: any, userId: string): Role {
    if (!room) return "none";
    const uid = userId.toString();

    if (room.creator?.toString?.() === uid) return "creator";
    if (Array.isArray(room.owners) && room.owners.some((x: any) => x?.toString?.() === uid)) return "owner";
    if (Array.isArray(room.admins) && room.admins.some((x: any) => x?.toString?.() === uid)) return "admin";
    if (Array.isArray(room.members) && room.members.some((x: any) => x?.toString?.() === uid)) return "member";

    // ✅ الأهم: الداخل للغرفة = عضو (حتى لو لم يُسجل في members)
    if (Array.isArray(room.activeUsers) && room.activeUsers.some((x: any) => x?.toString?.() === uid)) {
      return "member";
    }

    return "none";
  }

  // ================================
  // ROLES PRIORITY
  // ================================
  private roleRank(r: Role) {
    const rank: Record<Role, number> = {
      none: 0,
      member: 1,
      admin: 2,
      owner: 3,
      creator: 4
    };
    return rank[r] ?? 0;
  }

  // ================================
  // READ USER BASIC INFO (لإظهار الأسماء في رسائل النظام)
  // ================================
  private async getUserBasic(userId: string) {
    // مهم: هذا يعتمد على وجود موديل User عندك
    // لو اسم الموديل مختلف عدّله
    const User = mongoose.model("User");
    const u = await User.findById(userId).select("username avatar");
    if (!u) return { _id: userId, username: "مستخدم", avatar: "" };
    return { _id: u._id.toString(), username: u.username || "مستخدم", avatar: u.avatar || "" };
  }

  // ================================
  // PERMISSION CHECK: can actor do action on target?
  // ================================
  private assertCanModerate(room: any, actorId: string, targetId: string, action: "kick" | "ban" | "role") {
    const actorRole = this.getRole(room, actorId);
    const targetRole = this.getRole(room, targetId);

    if (actorRole === "none") throw new Error("Not allowed");

    // لا أحد يقدر يلمس الـ creator إلا الـ creator نفسه
    if (targetRole === "creator" && actorRole !== "creator") throw new Error("Cannot moderate creator");

    if (actorRole === "creator") return; // كل شيء مسموح

    if (actorRole === "owner") {
      // Owner مسموح له kick/ban + ترقية/خفض إلى admin/member فقط
      if (action === "role") {
        // سيتحقق لاحقاً من role target في الدالة
        return;
      }
      if (action === "kick" || action === "ban") {
        // Owner لا يقدر على Owner آخر
        if (targetRole === "owner") throw new Error("Owner cannot moderate another owner");
        return;
      }
    }

    if (actorRole === "admin") {
      // Admin: ban/kick فقط
      if (action === "role") throw new Error("Admin cannot change roles");
      // Admin لا يقدر على owner/admin/creator
      if (targetRole === "owner" || targetRole === "admin") throw new Error("Admin cannot moderate owner/admin");
      return;
    }

    throw new Error("Not allowed");
  }

  // ================================
  // SYSTEM MESSAGE: actor did action to target
  // ✅ تعديل: نرسل actorName/targetName/role لكي الفرونت يبني نص موحد
  // ================================
  private async systemActorTarget(
    roomId: string,
    actorId: string,
    targetId: string,
    text: string,
    type: any,
    extra: any = {}
  ) {
    const actor = await this.getUserBasic(actorId);
    const target = await this.getUserBasic(targetId);

    // نخلي sender = actor + mentions = [actor,target] لكي الفرونت يقدر يجيب الأسماء بسهولة
    return this.system(roomId, text, type, {
      sender: actorId,
      mentions: [actorId, targetId],

      // ✅ حقول إضافية للفرونت (مهمة جدًا)
      actorName: actor.username,
      targetName: target.username,

      ...extra
    });
  }

  // ================================
  // EMIT USERS LIST UPDATE (اختياري لكنه مفيد)
  // ================================
  private emitUsersUpdate(roomId: string) {
    this.io().to(`room:${roomId}`).emit("room:users:update", { roomId });
  }

  /**
   * ✅ setUserRole
   * - creator: يستطيع كل شيء
   * - owner: يستطيع تعيين admin/member فقط (لا owner ولا creator)
   * - admin: ممنوع
   *
   * newRole: "owner" | "admin" | "member"
   * (تحويل creator يتم عبر transferCreator لديك بالفعل)
   */
  async setUserRole(
    roomId: string,
    actorId: string,
    targetId: string,
    newRole: "owner" | "admin" | "member"
  ) {
    const rid = String(roomId || "");
    const aid = String(actorId || "");
    const tid = String(targetId || "");
    const sid = `role:${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const log = (msg: string, extra: any = {}) => {
      console.log(`[setUserRole][${sid}] ${msg}`, extra);
    };

    log("IN", { roomId: rid, actorId: aid, targetId: tid, newRole });

    // =========================
    // Validate IDs
    // =========================
    const validIds =
      this.isValidObjectId(rid) && this.isValidObjectId(aid) && this.isValidObjectId(tid);

    if (!validIds) {
      log("INVALID IDS", {
        valid: { roomId: this.isValidObjectId(rid), actorId: this.isValidObjectId(aid), targetId: this.isValidObjectId(tid) }
      });
      throw new Error("Invalid ids");
    }

    if (aid === tid) {
      log("BLOCKED: actorId === targetId");
      throw new Error("Cannot change your own role");
    }

    // =========================
    // Load room
    // =========================
    const room = await Room.findById(rid);
    if (!room) {
      log("ROOM NOT FOUND");
      throw new Error("Room not found");
    }

    this.ensureArrays(room);

    // =========================
    // Roles snapshot BEFORE
    // =========================
    const before = {
      creator: String(room.creator),
      owners: (room.owners || []).map((x: any) => x?.toString?.()),
      admins: (room.admins || []).map((x: any) => x?.toString?.()),
      members: (room.members || []).map((x: any) => x?.toString?.())
    };

    log("ROOM LOADED + SNAPSHOT BEFORE", before);

    // =========================
    // Permission checks
    // =========================
    const actorRole = this.getRole(room, aid);
    const targetRole = this.getRole(room, tid);

    log("ROLES DETECTED", { actorRole, targetRole });

    try {
      this.assertCanModerate(room, aid, tid, "role");
      log("PERMISSION OK");
    } catch (e: any) {
      log("PERMISSION FAIL", { message: e?.message });
      throw e;
    }

    // =========================
    // Constraints
    // =========================
    if (actorRole === "owner" && newRole === "owner") {
      log("BLOCKED: owner cannot promote to owner");
      throw new Error("Owner cannot promote to owner");
    }

    if (actorRole !== "creator" && targetRole === "owner") {
      log("BLOCKED: only creator can change owner role", { actorRole, targetRole });
      throw new Error("Only creator can change owner role");
    }

    if (targetRole === "creator") {
      log("BLOCKED: cannot change creator via setUserRole");
      throw new Error("Use transferCreator to change creator");
    }

    // =========================
    // Apply change
    // =========================
    log("REMOVE ALL ROLES (target)", { targetId: tid });
    this.removeAllRoles(room, tid);

    if (newRole === "owner") {
      if (!room.owners.some((x: any) => x?.toString?.() === tid)) {
        room.owners.push(tid as any);
        log("PUSH -> owners", { targetId: tid });
      }
    } else if (newRole === "admin") {
      if (!room.admins.some((x: any) => x?.toString?.() === tid)) {
        room.admins.push(tid as any);
        log("PUSH -> admins", { targetId: tid });
      }
    } else {
      if (!room.members.some((x: any) => x?.toString?.() === tid)) {
        room.members.push(tid as any);
        log("PUSH -> members", { targetId: tid });
      }
    }

    // =========================
    // Save
    // =========================
    log("SAVING ROOM...");
    await room.save();
    log("ROOM SAVED OK");

    // =========================
    // Roles snapshot AFTER
    // =========================
    const after = {
      creator: String(room.creator),
      owners: (room.owners || []).map((x: any) => x?.toString?.()),
      admins: (room.admins || []).map((x: any) => x?.toString?.()),
      members: (room.members || []).map((x: any) => x?.toString?.())
    };

    log("SNAPSHOT AFTER", after);

    // =========================
    // Emit roles update
    // =========================
    const rolesUpdatePayload = {
      roomId: rid,
      owners: after.owners,
      admins: after.admins,
      members: after.members
    };

    log("EMIT room:roles:update", rolesUpdatePayload);
    this.io().to(`room:${rid}`).emit("room:roles:update", rolesUpdatePayload);

    // =========================
    // System message (promotion)
    // =========================
    const actor = await this.getUserBasic(aid);
    const target = await this.getUserBasic(tid);

    const roleAr = newRole === "owner" ? "مالك" : newRole === "admin" ? "أدمن" : "عضو";

    const systemText = `⭐ تم وضع ${target.username} ${roleAr} بواسطة ${actor.username}`;

    log("SYSTEM MESSAGE PREP", {
      type: "promotion",
      text: systemText,
      actor: { id: actor._id, username: actor.username },
      target: { id: target._id, username: target.username },
      role: newRole
    });

    // مهم: الأفضل إرسال meta/action (لو أنت ضايفهم في schema)
    await this.systemActorTarget(
      rid,
      aid,
      tid,
      systemText,
      "promotion",
      {
        action: "role:set",
        meta: {
          actorId: aid,
          actorName: actor.username,
          targetId: tid,
          targetName: target.username,
          role: newRole
        },

        // للتوافق مع كودك الحالي لو يقرأ من الجذر
        actorName: actor.username,
        targetName: target.username,
        role: newRole
      }
    );

    log("SYSTEM MESSAGE SENT");

    // =========================
    // Optional users update
    // =========================
    try {
      this.emitUsersUpdate(rid);
      log("EMIT room:users:update");
    } catch (e: any) {
      log("EMIT room:users:update FAILED (ignored)", { message: e?.message });
    }

    log("OUT", { success: true });
    return { success: true };
  }

  async kickUser(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.assertCanModerate(room, actorId, targetId, "kick");

    const tid = targetId.toString();
    const wasActive = room.activeUsers.some((u: any) => u?.toString?.() === tid);

    // kick = إزالة من active فقط (بدون حظر)
    room.activeUsers = room.activeUsers.filter((u: any) => u?.toString?.() !== tid);
    if (wasActive) room.usersCount = Math.max(0, (room.usersCount || 0) - 1);

    await room.save();

    const io = this.io();
    io.to(targetId).emit("room:kicked", { roomId });
    io.to(`room:${roomId}`).emit("room:user:kicked", { roomId, targetId });

    const actor = await this.getUserBasic(actorId);
    const target = await this.getUserBasic(targetId);

    await this.systemActorTarget(
      roomId,
      actorId,
      targetId,
      `🚪 ${actor.username} طرد ${target.username}`,
      "system"
    );

    await this.emitActiveCount(roomId);
    this.emitUsersUpdate(roomId);

    return { success: true };
  }

  // ✅ إضافة لوج اختياري لمساعدتك أثناء الديباج (يمكنك حذفه لاحقًا)
  private require(room: any, userId: string, roles: Role[]) {
    const r = this.getRole(room, userId);
    // console.log("require check:", { userId, role: r, allowed: roles });
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

  /**
   * ✅ System message مع sender + populate حتى يظهر username في الواجهة
   */
  private async system(roomId: string, content: string, type: any = "system", extra: any = {}) {
    const payload: any = {
      room: roomId,
      content,
      type,
      ...extra
    };

    // لو تريد اسم الفاعل: ضع sender من mentions[0]
    if (!payload.sender && Array.isArray(payload.mentions) && payload.mentions[0]) {
      const actorId = String(payload.mentions[0]);
      if (this.isValidObjectId(actorId)) payload.sender = actorId;
    }
    if (payload.sender) {
      payload.senderSnapshot = await this.getUserPublicSnapshot(payload.sender);
    }

    const msg = await RoomMessage.create(payload);

    try {
      // await msg.populate("sender", USER_PUBLIC_FIELDS);
    } catch { }

    this.io().to(`room:${roomId}`).emit("room:message:new", msg);
    return msg;
  }

  /**
   * ✅ (جديد) بث عدد الـ activeUsers الحقيقي في الغرفة
   * - يُستخدم بعد: join / leave / kick / ban / removeMember / safeRejoin ...
   */
  private async emitActiveCount(roomId: string) {
    const room = await Room.findById(roomId).select("activeUsers");
    if (!room) return 0;

    const activeCount = (room.activeUsers || []).length;

    // ✅ event موحّد (عدّل الفرونت ليستقبل هذا الاسم)
    this.io().to(`room:${roomId}`).emit("room:activeCount:update", {
      roomId,
      activeCount
    });

    return activeCount;
  }

  public assertMethods() {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto).filter(
      (k) => k !== "constructor" && typeof (this as any)[k] === "function"
    );

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
    this.require(room, userId, ["creator", "owner", "admin", "member"]);

    const s = Math.max(0, Math.min(3600, Number(seconds) || 0));
    room.slowModeSeconds = s;

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:slowmode:update", s);
    await this.system(roomId, s > 0 ? `Slow mode enabled (${s}s)` : "Slow mode disabled", "announcement");
    return s;
  }

  /* =====================================================
     JOIN / LEAVE / REJOIN
  ===================================================== */

  /**
   * ✅ join:
   * - يدخل activeUsers
   * - (اختياري) يضاف members لو كان none
   * - ثم يبث العدد الحقيقي عبر room:activeCount:update
   */
  async joinRoom(roomId: string, userId: string, password?: string) {
    const uid = userId.toString();
    const joinAt = new Date();

    const { joined } = await this.withTx(async (session) => {
      const room = await Room.findById(roomId).session(session);
      if (!room) throw new Error("Room not found");

      this.ensureArrays(room);

      if (room.isLocked) throw new Error("Room is locked");
      if (this.isBanned(room, uid)) throw new Error("You are banned");
      if ((room.usersCount || 0) >= (room.maxUsers || 50)) throw new Error("Room is full");

      const alreadyActive = room.activeUsers.some((u: any) => u?.toString?.() === uid);
      if (alreadyActive) return { joined: false };

      // ✅ 1) احسب الدور قبل التحقق من الباسورد
      const role = this.getRole(room, uid);

      // ✅ 2) شرط الغرفة المحمية
      if (room.type === RoomType.PROTECTED) {
        const bypass = role === "creator" || role === "owner" || role === "admin";

        if (!bypass) {
          const pass = String(password || "").trim();

          // لا تقبل الدخول بدون باسورد
          if (!pass) throw new Error("Password required");

          // تحقق من التطابق (بسيطة لأنك تخزنها نصًا عندك)
          // لو عندك hashing عدلها كما بالأسفل في ملاحظة رقم (2)
          if (pass !== String(room.password || "")) throw new Error("Invalid password");
        }
      }

      // ✅ لو كان none: ضمه للأعضاء (كما عندك)
      if (role === "none") {
        const alreadyMember = room.members.some((m: any) => m?.toString?.() === uid);
        if (!alreadyMember) room.members.push(userId as any);
      }

      room.activeUsers.push(userId as any);
      room.usersCount = (room.usersCount || 0) + 1;

      await room.save({ session });
      return { joined: true };
    });

    if (!joined) return { success: true };

    const keepPinnedId = await this.getLastPinnedBefore(roomId, joinAt);

    this.io().to(`room:${roomId}`).emit("room:user:joined", { roomId, userId });

    await this.system(roomId, "دخل", "join", { sender: userId, mentions: [userId] });

    const afterJoinSystem = new Date();
    await this.setClearedAt(roomId, userId, afterJoinSystem, keepPinnedId);

    await this.emitActiveCount(roomId);

    return { success: true };
  }

  /* =====================================================
     ROOM DETAILS (FULL) - PERMISSIONED
  ===================================================== */

  async getRoomDetails(roomId: string, userId?: string) {
    if (!this.isValidObjectId(roomId)) throw new Error("Invalid roomId");

    const uid = userId && this.isValidObjectId(userId) ? String(userId) : "";

    // ✅ لا نريد إرجاع password نفسه
    // نقرأه فقط لمعرفة هل الغرفة محمية بكلمة مرور أم لا
    const room = await Room.findById(roomId).select("+password").lean();
    if (!room) throw new Error("Room not found");

    // ✅ Safe clone
    const safeRoom: any = { ...room };
    safeRoom.owners ||= [];
    safeRoom.admins ||= [];
    safeRoom.members ||= [];
    safeRoom.blockeds ||= [];
    safeRoom.activeUsers ||= [];
    safeRoom.voiceQueue ||= [];
    safeRoom.raisedHands ||= [];
    safeRoom.voiceSpeakers ||= [];
    safeRoom.vipUsers ||= [];
    safeRoom.mutedUsers ||= [];
    safeRoom.tags ||= [];

    // ✅ صلاحيات (لو userId غير موجود -> زائر)
    const myRole = uid ? this.getRole(safeRoom, uid) : ("none" as const);
    const isInside = uid ? this.isInside(safeRoom, uid) : false;

    const isManager = myRole === "creator" || myRole === "owner" || myRole === "admin";
    const isMember = isInside || myRole === "member" || isManager;

    // ✅ بيانات مشتقة
    const passwordProtected = Boolean(safeRoom.password);
    delete safeRoom.password;

    // membersCount: إجمالي الناس اللي لهم membership/roles (تقريبي)
    const membersCount =
      (safeRoom.members?.length || 0) +
      (safeRoom.owners?.length || 0) +
      (safeRoom.admins?.length || 0) +
      1; // creator

    // ✅ الجزء العام (يظهر للجميع)
    const publicRoom = {
      _id: String(safeRoom._id),
      name: safeRoom.name,
      description: safeRoom.description || "",

      avatar: safeRoom.avatar || "",
      cover: safeRoom.cover || "",

      type: safeRoom.type,
      premiumLevel: safeRoom.premiumLevel,

      maxUsers: Number(safeRoom.maxUsers || 0),
      maxVoiceSeats: Number(safeRoom.maxVoiceSeats || 0),

      isVerified: Boolean(safeRoom.isVerified),
      tags: Array.isArray(safeRoom.tags) ? safeRoom.tags : [],

      // Stats (آمنة)
      usersCount: Number(safeRoom.usersCount || 0),       // active count
      membersCount,
      messagesCount: Number(safeRoom.messagesCount || 0),

      // Boost (ممكن عرض جزء منه للعامة بدون نقاط/إيراد)
      boostLevel: Number(safeRoom.boostLevel || 0),

      createdAt: safeRoom.createdAt,
      updatedAt: safeRoom.updatedAt
    };

    // ✅ تفاصيل إضافية للأعضاء/داخل الغرفة (غير حساسة)
    const memberRoomExtra = isMember
      ? {
        isLocked: Boolean(safeRoom.isLocked),

        // لو تحب تخليها boolean فقط للأعضاء بدل الأرقام
        slowModeSeconds: Number(safeRoom.slowModeSeconds || 0),
        antiSpamEnabled: Boolean(safeRoom.antiSpamEnabled),
        maxMessagesPerMinute: Number(safeRoom.maxMessagesPerMinute || 0),

        activePoll: safeRoom.activePoll || null
      }
      : {
        // للزائر: ممكن تعرض الحالة بشكل عام فقط
        isLocked: Boolean(safeRoom.isLocked),
        activePoll: null as any
      };

    // ✅ تفاصيل الإدارة (حساسة)
    const managerRoomExtra = isManager
      ? {
        subscriptionPrice: Number(safeRoom.subscriptionPrice || 0),
        totalRevenue: Number(safeRoom.totalRevenue || 0),

        xp: Number(safeRoom.xp || 0),
        level: Number(safeRoom.level || 1),

        boostPoints: Number(safeRoom.boostPoints || 0),
        boostExpiresAt: safeRoom.boostExpiresAt || null,

        passwordProtected
      }
      : {
        // للغير إدارة: لا نعرض السعر ولا الإيراد ولا نقاط البوست ولا passwordProtected
        subscriptionPrice: safeRoom.type === "subscription" ? Number(safeRoom.subscriptionPrice || 0) : 0
      };

    // ✅ Lists بناءً على المستوى
    // creator يظهر للجميع كملف عام (آمن عادة)
    const creatorSnap = await this.getUserPublicSnapshot(String(safeRoom.creator));

    const lists: any = {
      creator: creatorSnap
    };

    // Owners/Admins: تُعرض للأعضاء فقط أو للإدارة (حسب رغبتك)
    // أنا هنا: للأعضاء نعم، للزائر لا
    if (isMember) {
      lists.owners = await Promise.all(
        (safeRoom.owners as any[]).map((id) => this.getUserPublicSnapshot(String(id)))
      );
      lists.admins = await Promise.all(
        (safeRoom.admins as any[]).map((id) => this.getUserPublicSnapshot(String(id)))
      );
    }

    // Active/Voice: للأعضاء فقط
    if (isMember) {
      lists.activeUsers = await Promise.all(
        (safeRoom.activeUsers as any[]).map((id) => this.getUserPublicSnapshot(String(id)))
      );

      lists.voiceSpeakers = await Promise.all(
        (safeRoom.voiceSpeakers as any[]).map((id) => this.getUserPublicSnapshot(String(id)))
      );
      lists.voiceQueue = await Promise.all(
        (safeRoom.voiceQueue as any[]).map((id) => this.getUserPublicSnapshot(String(id)))
      );
      lists.raisedHands = await Promise.all(
        (safeRoom.raisedHands as any[]).map((id) => this.getUserPublicSnapshot(String(id)))
      );
    }

    // VIP/Muted: للإدارة فقط
    if (isManager) {
      lists.vipUsers = await Promise.all(
        (safeRoom.vipUsers as any[]).map(async (v) => ({
          user: await this.getUserPublicSnapshot(String(v.user)),
          expiresAt: v.expiresAt
        }))
      );

      lists.mutedUsers = await Promise.all(
        (safeRoom.mutedUsers as any[]).map(async (m) => ({
          user: await this.getUserPublicSnapshot(String(m.user)),
          until: m.until,
          reason: m.reason || ""
        }))
      );
    }

    return {
      room: {
        ...publicRoom,
        ...memberRoomExtra,
        ...managerRoomExtra
      },
      lists,
      my: {
        userId: uid || null,
        role: myRole,
        isInside,
        isMember,
        canManage: isManager
      }
    };
  }
  /**
   * ✅ leave:
   * نفس الفكرة: حتى لو دخل مرة أخرى لاحقًا، لا يرى الرسائل قبل (آخر Leave)
   * ونخفي كذلك رسالة "خرج" عن نفس المستخدم مستقبلًا
   */
  async leaveRoom(roomId: string, userId: string, removeFromMembers = false) {
    const uid = userId.toString();
    const leaveAt = new Date();

    // إزالة من activeUsers
    await Room.updateOne(
      { _id: roomId, activeUsers: uid },
      { $pull: { activeUsers: uid }, $inc: { usersCount: -1 } }
    );
    await Room.updateOne({ _id: roomId, usersCount: { $lt: 0 } }, { $set: { usersCount: 0 } });

    // (اختياري) إزالة من members
    if (removeFromMembers) {
      const room = await Room.findById(roomId);
      if (room) {
        this.ensureArrays(room);
        room.members = (room.members || []).filter((x: any) => x?.toString?.() !== uid);
        await room.save();
        this.io().to(`room:${roomId}`).emit("room:roles:update", {
          roomId,
          owners: (room.owners || []).map((x: any) => x.toString()),
          admins: (room.admins || []).map((x: any) => x.toString()),
          members: (room.members || []).map((x: any) => x.toString())
        });
      }
    }

    // 1) آخر pinned قبل وقت الخروج (حتى عند الرجوع لاحقًا يظهر pinned فقط)
    const keepPinnedId = await this.getLastPinnedBefore(roomId, leaveAt);

    // 2) بث خروج المستخدم للآخرين
    this.io().to(`room:${roomId}`).emit("room:user:left", { roomId, userId });

    // 3) رسالة system "خرج" (للآخرين)
    await this.system(roomId, "خرج", "leave", { sender: userId, mentions: [userId] });

    // 4) ✅ اضبط clearedAt بعد رسالة "خرج" حتى لا يراها عند العودة
    const afterLeaveSystem = new Date();
    await this.setClearedAt(roomId, userId, afterLeaveSystem, keepPinnedId);

    const activeCount = await this.emitActiveCount(roomId);

    return { success: true, activeCount };
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

    const type: RoomType = Object.values(RoomType).includes(data?.type) ? data.type : RoomType.PUBLIC;

    const maxUsers = data?.maxUsers !== undefined ? Number(data.maxUsers) : 50;
    const slowModeSeconds = data?.slowModeSeconds !== undefined ? Number(data.slowModeSeconds) : 0;

    const passwordRaw = typeof data?.password === "string" ? data.password.trim() : "";
    const password = type === RoomType.PROTECTED ? passwordRaw : undefined;

    const subscriptionPriceRaw = data?.subscriptionPrice !== undefined ? Number(data.subscriptionPrice) : 0;
    const subscriptionPrice = type === RoomType.SUBSCRIPTION ? Math.max(0, subscriptionPriceRaw) : 0;

    const premiumLevel: RoomPremiumLevel =
      typeof data?.premiumLevel === "number" ? data.premiumLevel : RoomPremiumLevel.FREE;

    const tags = Array.isArray(data?.tags) ? data.tags : [];

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

    this.io().emit("room:created", {
      roomId: room._id,
      creator: userId,
      type: room.type,
      name: room.name
    });

    return room;
  }

  async getRoomsByType(
    type: RoomType,
    viewerId?: string,
    pagination: { limit?: number; page?: number } = {}
  ) {
    const t: RoomType = Object.values(RoomType).includes(type) ? type : RoomType.PUBLIC;

    const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 30));
    const page = Math.max(1, Number(pagination.page) || 1);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (t === RoomType.PUBLIC) {
      filter.type = { $in: [RoomType.PUBLIC, RoomType.PROTECTED] };
    } else {
      filter.type = t;
    }

    const viewerStr = viewerId ? String(viewerId).trim() : "";

    const pipeline: any[] = [
      { $match: filter },

      {
        $addFields: {
          isActive: viewerStr
            ? {
              $in: [
                viewerStr,
                {
                  $map: {
                    input: { $ifNull: ["$activeUsers", []] },
                    as: "u",
                    in: { $toString: "$$u" }
                  }
                }
              ]
            }
            : false
        }
      },

      // لا نرجع password ولا activeUsers
      { $project: { password: 0, activeUsers: 0 } },

      // ✅ يُفضّل إضافة _id لضمان ترتيب ثابت
      { $sort: { boostPoints: -1, usersCount: -1, createdAt: -1, _id: -1 } },

      { $skip: skip },
      { $limit: limit }
    ];

    const [items, total] = await Promise.all([
      Room.aggregate(pipeline),
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
  // async getRoomsByType(
  //   type: RoomType,
  //   pagination: { limit?: number; page?: number } = {}
  // ) {
  //   const t: RoomType = Object.values(RoomType).includes(type)
  //     ? type
  //     : RoomType.PUBLIC;

  //   const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 30));
  //   const page = Math.max(1, Number(pagination.page) || 1);
  //   const skip = (page - 1) * limit;

  //   const filter: any = {};

  //   // ✅ لو Public → اعرض Public + Protected فقط
  //   if (t === RoomType.PUBLIC) {
  //     filter.type = { $in: [RoomType.PUBLIC, RoomType.PROTECTED] };
  //   } else {
  //     // ✅ باقي الأنواع كما هي
  //     filter.type = t;
  //   }

  //   const [items, total] = await Promise.all([
  //     Room.find(filter)
  //       .select("-password")
  //       .sort({ boostPoints: -1, usersCount: -1, createdAt: -1 })
  //       .skip(skip)
  //       .limit(limit)
  //       .lean(),
  //     Room.countDocuments(filter),
  //   ]);

  //   return {
  //     type: t,
  //     page,
  //     limit,
  //     total,
  //     pages: Math.ceil(total / limit),
  //     items,
  //   };
  // }

  async searchRooms(query: string, viewerId?: string, type?: RoomType, limit = 30) {
    const q = String(query || "").trim();
    if (!q) return [];

    const l = Math.max(1, Math.min(100, Number(limit) || 30));
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");

    const filter: any = { $or: [{ name: rx }, { description: rx }, { tags: rx }] };
    if (type && Object.values(RoomType).includes(type)) filter.type = type;

    const viewerOid = this.oidOrNull(viewerId);

    const pipeline: any[] = [
      { $match: filter },
      ...(viewerOid
        ? [{ $addFields: { isActive: { $in: [viewerOid, "$activeUsers"] } } }]
        : [{ $addFields: { isActive: false } }]),
      { $project: { password: 0, activeUsers: 0 } },
      { $sort: { usersCount: -1, boostLevel: -1, createdAt: -1 } },
      { $limit: l }
    ];

    return Room.aggregate(pipeline);
  }

  /* =====================================================
     MESSAGES
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
      gift,
      clientId // ✅ جديد
    } = input;

    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    if (!this.isInside(room, senderId)) throw new Error("Not inside room");
    if (this.isBanned(room, senderId)) throw new Error("You are banned");
    if (this.isMuted(room, senderId)) throw new Error("You are muted");

    const cleanMentions = Array.from(
      new Set((mentions || []).filter((x) => this.isValidObjectId(x)))
    );

    const hasGift =
      Boolean(String(gift?.key || "").trim()) ||
      Boolean(String(gift?.name || "").trim());

    // ✅ نظّف clientId (مهم)
    const cid = String(clientId || "").trim();
    const hasClientId = Boolean(cid);

    // ✅ 1) DEDUP قبل الإنشاء (الأهم)
    if (hasClientId) {
      const existing = await RoomMessage.findOne({
        room: roomId,
        sender: senderId,
        clientId: cid
      });

      if (existing) {
        // ✅ لا تعيد بث socket مرة أخرى لتفادي duplicate في الفرونت
        return existing;
      }
    }

    const senderSnapshot = await this.getUserPublicSnapshot(senderId);
this.logCustomBadge("sendMessage:SENDER_SNAPSHOT", {
  roomId,
  senderId,
  username: senderSnapshot?.username,
  customEmojiBadge: senderSnapshot?.customEmojiBadge || null,
  activeCustomization: senderSnapshot?.activeCustomization || null,
  badges: senderSnapshot?.badges || []
});
    try {
      const message = await RoomMessage.create({
        room: roomId,
        sender: senderId,
        senderSnapshot,

        clientId: hasClientId ? cid : undefined, // ✅ جديد

        content,
        type,
        replyTo: replyTo && this.isValidObjectId(replyTo) ? replyTo : undefined,
        mentions: cleanMentions,
        media: media?.url ? media : undefined,
        gift: hasGift ? gift : undefined
      });
this.logCustomBadge("sendMessage:MESSAGE_CREATED", {
  messageId: String(message._id),
  sender: message.sender,
  senderSnapshot: message.senderSnapshot || null,
  customEmojiBadge: (message.senderSnapshot as any)?.customEmojiBadge || null
});
      // ✅ بث مرة واحدة فقط بعد إنشاء فعلي
      this.io().to(`room:${roomId}`).emit("room:message:new", message);

      if (cleanMentions.length) {
        for (const uid of cleanMentions) {
          this.io().to(uid).emit("room:mention", { roomId, messageId: message._id });
        }
      }

      return message;
    } catch (e: any) {
      // ✅ 2) حماية من duplicate key لو حصلت race
      // Mongo duplicate key error code = 11000
      if (hasClientId && (e?.code === 11000 || String(e?.message || "").includes("E11000"))) {
        const existing = await RoomMessage.findOne({
          room: roomId,
          sender: senderId,
          clientId: cid
        });
        if (existing) return existing;
      }
      throw e;
    }
  }
  // async sendMessage(input: SendMessageInput) {
  //   const { roomId, senderId, content = "", type = "text", replyTo, mentions = [], media, gift, clientId
  //   } = input;

  //   const room = await Room.findById(roomId);
  //   if (!room) throw new Error("Room not found");
  //   this.ensureArrays(room);

  //   if (!this.isInside(room, senderId)) throw new Error("Not inside room");
  //   if (this.isBanned(room, senderId)) throw new Error("You are banned");
  //   if (this.isMuted(room, senderId)) throw new Error("You are muted");
  //   const hasGift =
  //     Boolean(String(gift?.key || "").trim()) ||
  //     Boolean(String(gift?.name || "").trim());
  //   const cleanMentions = Array.from(new Set((mentions || []).filter((x) => this.isValidObjectId(x))));
  //   const senderSnapshot = await this.getUserPublicSnapshot(senderId);
  //   const message = await RoomMessage.create({
  //     room: roomId,
  //     sender: senderId,
  //     senderSnapshot, // ✅ هنا

  //     content,
  //     type,
  //     replyTo: replyTo && this.isValidObjectId(replyTo) ? replyTo : undefined,
  //     mentions: cleanMentions,
  //     media: media?.url ? media : undefined,


  //     gift: hasGift ? gift : undefined
  //   });

  //   try {
  //     // await message.populate("sender", USER_PUBLIC_FIELDS);
  //   } catch { }

  //   this.io().to(`room:${roomId}`).emit("room:message:new", message);

  //   if (cleanMentions.length) {
  //     for (const uid of cleanMentions) {
  //       this.io().to(uid).emit("room:mention", { roomId, messageId: message._id });
  //     }
  //   }

  //   return message;
  // }

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
    this.io().to(`room:${roomId}`).emit("room:vip:update", {
      roomId,
      vipUsers: room.vipUsers
    });
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

    this.io().to(`room:${roomId}`).emit("room:vip:update", {
      roomId,
      vipUsers: room.vipUsers
    });
    await this.system(roomId, "VIP removed", "system", { mentions: [targetId] });

    return room.vipUsers;
  }

  /* =====================================================
     POLL SYSTEM
  ===================================================== */

  async startPoll(roomId: string, userId: string, question: string, options: string[], minutes: number) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.require(room, userId, ["creator", "owner", "admin", "member"]);

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
    if (!Number.isFinite(idx) || idx < 0 || idx >= room.activePoll.options.length) throw new Error("Invalid option");

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

    if (!room.activeUsers.some((u: any) => u?.toString?.() === userId.toString())) throw new Error("Not inside room");

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

    const uid = userId.toString();
    room.raisedHands = room.raisedHands.filter((x: any) => x?.toString?.() !== uid);
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
      room.members.some((x: any) => x?.toString?.() === uid) ||
      room.admins.some((x: any) => x?.toString?.() === uid) ||
      room.owners.some((x: any) => x?.toString?.() === uid) ||
      room.creator.toString() === uid;

    if (!already) room.members.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      roomId,
      owners: room.owners.map((x: any) => x.toString()),
      admins: room.admins.map((x: any) => x.toString()),
      members: room.members.map((x: any) => x.toString())
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

    const actorRole = this.getRole(room, actorId);
    if (actorRole === "admin" && (targetRole === "owner" || targetRole === "admin")) throw new Error("Not allowed");

    const tid = targetId.toString();
    const wasActive = room.activeUsers.some((u: any) => u?.toString?.() === tid);

    this.removeAllRoles(room, targetId);

    room.activeUsers = room.activeUsers.filter((u: any) => u?.toString?.() !== tid);
    if (wasActive) room.usersCount = Math.max(0, (room.usersCount || 0) - 1);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:user:removed", { roomId, targetId });

    await this.system(roomId, "User removed from room roles", "system", { mentions: [targetId] });

    // ✅ بث العدد بعد الإزالة (لأن المستخدم قد يكون خرج من الغرفة فعليًا)
    await this.emitActiveCount(roomId);

    return { success: true };
  }

  async promoteToAdmin(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner"]);

    const tRole = this.getRole(room, targetId);
    if (tRole === "creator" || tRole === "owner") return { success: true };

    if (tRole === "none") throw new Error("Target is not a member");

    room.members = room.members.filter((x: any) => x?.toString?.() !== targetId.toString());
    if (!room.admins.some((x: any) => x?.toString?.() === targetId.toString())) room.admins.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      roomId,
      owners: (room.owners || []).map((x: any) => x.toString()),
      admins: (room.admins || []).map((x: any) => x.toString()),
      members: (room.members || []).map((x: any) => x.toString())
    });

    await this.system(roomId, "User promoted to admin", "promotion", { mentions: [targetId] });
    return { success: true };
  }

  async demoteAdmin(roomId: string, actorId: string, targetId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner"]);

    const tid = targetId.toString();
    room.admins = room.admins.filter((x: any) => x?.toString?.() !== tid);
    if (!room.members.some((x: any) => x?.toString?.() === tid)) room.members.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      roomId,
      owners: (room.owners || []).map((x: any) => x.toString()),
      admins: (room.admins || []).map((x: any) => x.toString()),
      members: (room.members || []).map((x: any) => x.toString())
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

    const tid = targetId.toString();
    room.members = room.members.filter((x: any) => x?.toString?.() !== tid);
    room.admins = room.admins.filter((x: any) => x?.toString?.() !== tid);
    if (!room.owners.some((x: any) => x?.toString?.() === tid)) room.owners.push(targetId as any);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:roles:update", {
      roomId,
      owners: (room.owners || []).map((x: any) => x.toString()),
      admins: (room.admins || []).map((x: any) => x.toString()),
      members: (room.members || []).map((x: any) => x.toString())
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

    const oldCreator = room.creator.toString();
    const tid = targetId.toString();

    room.creator = targetId as any;

    if (!room.owners.some((x: any) => x?.toString?.() === oldCreator)) room.owners.push(oldCreator as any);
    room.owners = room.owners.filter((x: any) => x?.toString?.() !== tid);
    room.admins = room.admins.filter((x: any) => x?.toString?.() !== tid);
    room.members = room.members.filter((x: any) => x?.toString?.() !== tid);

    await room.save();
    this.io().to(`room:${roomId}`).emit("room:creator:transfer", { from: oldCreator, to: targetId });

    await this.system(roomId, "Creator role transferred", "announcement", { mentions: [oldCreator, targetId] });
    return { success: true };
  }

  /* =====================================================
     MODERATION (Ban / Unban / Mute / Unmute / Kick)
  ===================================================== */
  // ✅ أضف هذه الدوال داخل class RoomService (بنفس الملف الذي أرسلته)
  // ملاحظة: الدوال تستخدم نفس أسلوبك: ensureArrays + require + systemActorTarget + emitUsersUpdate

  /* =====================================================
     ✅ BANNED USERS (Get / Unban one / many / all)
  ===================================================== */

  // ✅ جلب قائمة المحظورين (مع snapshot إن أحببت)
  async getBannedUsers(roomId: string, actorId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    // فقط الإدارة
    this.require(room, actorId, ["creator", "owner", "admin"]);

    const ids = (room.blockeds || []).map((x: any) => String(x?.toString?.() ?? x)).filter(Boolean);

    // snapshots للعرض في الفرونت
    const users = await Promise.all(
      ids
        .filter((id) => this.isValidObjectId(id))
        .map(async (id) => this.getUserPublicSnapshot(id))
    );

    return {
      roomId: String(roomId),
      total: ids.length,
      users
    };
  }

  // ✅ رفع الحظر عن مستخدم واحد
  async unbanOne(roomId: string, actorId: string, targetId: string, reason = "تم فك الحظر") {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    // unban: admin/owner/creator
    this.require(room, actorId, ["creator", "owner", "admin"]);

    const tid = String(targetId || "");
    if (!this.isValidObjectId(tid)) throw new Error("Invalid targetId");

    const before = (room.blockeds || []).length;

    room.blockeds = (room.blockeds || []).filter((x: any) => x?.toString?.() !== tid);

    const after = (room.blockeds || []).length;
    const removed = before !== after;

    await room.save();

    // events
    this.io().to(`room:${roomId}`).emit("room:user:unbanned", { roomId, targetId: tid, reason });
    this.io().to(tid).emit("room:unbanned", { roomId, reason });

    // system message
    if (removed) {
      const actor = await this.getUserBasic(actorId);
      const target = await this.getUserBasic(tid);

      await this.systemActorTarget(
        roomId,
        actorId,
        tid,
        `✅ ${actor.username} فك الحظر عن ${target.username}${reason ? ` (${reason})` : ""}`,
        "system", // ✅ بدل "unban"
        {
          systemType: "unban", // ✅ تمييز الحدث هنا
          action: "unban:one",
          meta: { actorId, targetId: tid, reason }
        }
      );
    }

    this.emitUsersUpdate(roomId);

    return {
      success: true,
      removed
    };
  }

  // ✅ رفع الحظر عن مجموعة (IDs)
  async unbanMany(
    roomId: string,
    actorId: string,
    targetIds: string[],
    reason = "تم فك الحظر"
  ) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner", "admin"]);

    const ids = Array.from(new Set((targetIds || []).map((x) => String(x || "")).filter(Boolean)));

    const valid = ids.filter((id) => this.isValidObjectId(id));
    if (!valid.length) throw new Error("No valid target ids");

    const beforeSet = new Set((room.blockeds || []).map((x: any) => x?.toString?.()));
    const removedIds = valid.filter((id) => beforeSet.has(id));

    if (!removedIds.length) {
      return { success: true, removed: 0, removedIds: [] as string[] };
    }

    room.blockeds = (room.blockeds || []).filter((x: any) => !removedIds.includes(x?.toString?.()));
    await room.save();

    // events per user
    for (const id of removedIds) {
      this.io().to(`room:${roomId}`).emit("room:user:unbanned", { roomId, targetId: id, reason });
      this.io().to(id).emit("room:unbanned", { roomId, reason });
    }

    // system message (واحدة فقط لتقليل spam)
    const actor = await this.getUserBasic(actorId);
    await this.system(
      roomId,
      `✅ ${actor.username} فك الحظر عن ${removedIds.length} مستخدم${removedIds.length === 1 ? "" : "ين"}${reason ? ` (${reason})` : ""}`,
      "unban",
      {
        sender: actorId,
        mentions: [actorId, ...removedIds],
        action: "unban:many",
        meta: { actorId, removedIds, reason }
      }
    );

    this.emitUsersUpdate(roomId);

    return {
      success: true,
      removed: removedIds.length,
      removedIds
    };
  }

  // ✅ رفع الحظر عن الجميع
  async unbanAll(roomId: string, actorId: string, reason = "تم فك الحظر عن الجميع") {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.require(room, actorId, ["creator", "owner", "admin"]);

    const removedIds = (room.blockeds || []).map((x: any) => x?.toString?.()).filter(Boolean);

    if (!removedIds.length) {
      return { success: true, removed: 0, removedIds: [] as string[] };
    }

    room.blockeds = [];
    await room.save();

    // events (broadcast + individual)
    this.io().to(`room:${roomId}`).emit("room:unban:all", { roomId, reason });

    for (const id of removedIds) {
      this.io().to(`room:${roomId}`).emit("room:user:unbanned", { roomId, targetId: id, reason });
      this.io().to(id).emit("room:unbanned", { roomId, reason });
    }

    const actor = await this.getUserBasic(actorId);
    await this.system(
      roomId,
      `✅ ${actor.username} فك الحظر عن الجميع (${removedIds.length})`,
      "unban",
      {
        sender: actorId,
        mentions: [actorId, ...removedIds],
        action: "unban:all",
        meta: { actorId, removedIdsCount: removedIds.length, reason }
      }
    );

    this.emitUsersUpdate(roomId);

    return {
      success: true,
      removed: removedIds.length,
      removedIds
    };
  }
  async unbanUser(roomId: string, actorId: string, targetId: string) {
    return this.unbanOne(roomId, actorId, targetId, "تم فك الحظر");
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

  async banUser(roomId: string, actorId: string, targetId: string, reason = "تم الحظر") {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    this.assertCanModerate(room, actorId, targetId, "ban");

    const tid = targetId.toString();
    const wasActive = room.activeUsers.some((u: any) => u?.toString?.() === tid);

    // ضع في blockeds إن لم يكن موجود
    if (!room.blockeds.some((x: any) => x?.toString?.() === tid)) {
      room.blockeds.push(targetId as any);
    }

    // خرج من الغرفة
    room.activeUsers = room.activeUsers.filter((u: any) => u?.toString?.() !== tid);
    if (wasActive) room.usersCount = Math.max(0, (room.usersCount || 0) - 1);

    // (اختياري) إزالة أدواره كذلك
    this.removeAllRoles(room, targetId);

    await room.save();

    const io = this.io();
    io.to(targetId).emit("room:banned", { roomId, reason });
    io.to(`room:${roomId}`).emit("room:user:banned", { roomId, targetId, reason });

    const actor = await this.getUserBasic(actorId);
    const target = await this.getUserBasic(targetId);

    await this.systemActorTarget(
      roomId,
      actorId,
      targetId,
      `⛔ ${actor.username} حظر ${target.username}${reason ? ` (${reason})` : ""}`,
      "ban"
    );

    await this.emitActiveCount(roomId);
    this.emitUsersUpdate(roomId);

    return { success: true };
  }

  /* =====================================================
     AUTO REJOIN
  ===================================================== */

  async autoRejoin(userId: string) {
    const rooms = await Room.find({ activeUsers: userId }).select("_id");
    return rooms.map((r: any) => r._id.toString());
  }

  async safeRejoin(roomId: string, userId: string) {
    const uid = userId.toString();

    const didJoin = await this.withTx(async (session) => {
      const room = await Room.findById(roomId).session(session);
      if (!room) return false;
      this.ensureArrays(room);

      if (this.isBanned(room, uid)) return false;

      const alreadyActive = room.activeUsers.some((u: any) => u?.toString?.() === uid);
      if (alreadyActive) return false;

      room.activeUsers.push(userId as any);
      room.usersCount = (room.usersCount || 0) + 1;
      await room.save({ session });

      this.io().to(`room:${roomId}`).emit("room:user:rejoined", { roomId, userId });
      return true;
    });

    // ✅ بث العدد بعد rejoin
    if (didJoin) await this.emitActiveCount(roomId);
  }

  /* =====================================================
     MESSAGES (Edit / Delete / Pin / Highlight / Fetch)
  ===================================================== */

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

    msg.deletedForEveryone = true;
    await msg.save();

    this.io().to(`room:${roomId}`).emit("room:message:deleted", { messageId });
    await this.system(roomId, "Message deleted", "system");

    return { success: true };
  }

  async pinMessage(roomId: string, userId: string, messageId: string, pinned = true) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner", "admin", "member"]);

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

    this.require(room, userId, ["creator", "owner", "admin", "member"]);

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
    console.log("══════════════════════════════════════");
    console.log("📩 getMessages START");
    console.log("roomId:", roomId);
    console.log("userId:", userId);
    console.log("pagination:", pagination);

    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const role = this.getRole(room, userId);
    const isInside = this.isInside(room, userId);

    console.log("role:", role);
    console.log("isInside:", isInside);

    if (!isInside && role === "none") throw new Error("Not allowed");

    const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 30));
    const state = await this.getUserState(roomId, userId);

    console.log("lastGiftSeenAt:", state?.lastGiftSeenAt);
    console.log("clearedAt:", state?.clearedAt);

    // beforeDate from cursor
    let beforeDate: Date | null = null;
    if (pagination.before && this.isValidObjectId(pagination.before)) {
      const beforeMsg = await RoomMessage.findById(pagination.before).select("createdAt");
      if (beforeMsg?.createdAt) beforeDate = beforeMsg.createdAt;
    }

    console.log("beforeDate:", beforeDate);

    const query: any = { room: roomId };
    let messages: any[] = [];

    // ✅ بدون clearedAt
    if (!state.clearedAt) {
      if (beforeDate) query.createdAt = { $lt: beforeDate };

      messages = await RoomMessage.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("replyTo");

      console.log("📦 Raw messages count:", messages.length);

      const giftCount = messages.filter((m: any) => m.type === "gift").length;
      console.log("🎁 Gifts before policy:", giftCount);

      await this.backfillSenderSnapshots(messages);

      messages = await this.applyGiftOncePolicy(roomId, userId, state, messages, pagination);

      const giftCountAfter = messages.filter((m: any) => m.type === "gift").length;
      console.log("🎁 Gifts after policy:", giftCountAfter);

      console.log("📩 getMessages END");
      console.log("══════════════════════════════════════");

      return messages;
    }

    // ✅ مع clearedAt
    const createdCond: any = { $gt: state.clearedAt };
    if (beforeDate) createdCond.$lt = beforeDate;

    const or: any[] = [{ createdAt: createdCond }];

    if (state.pinnedMessageIdAtClear) {
      const pinCond: any = { _id: state.pinnedMessageIdAtClear };
      if (beforeDate) pinCond.createdAt = { $lt: beforeDate };
      or.push(pinCond);
    }

    query.$or = or;

    messages = await RoomMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("replyTo");

    console.log("📦 Raw messages count (clearedAt mode):", messages.length);

    const giftCount = messages.filter((m: any) => m.type === "gift").length;
    console.log("🎁 Gifts before policy:", giftCount);

    await this.backfillSenderSnapshots(messages);

    messages = await this.applyGiftOncePolicy(roomId, userId, state, messages, pagination);

    const giftCountAfter = messages.filter((m: any) => m.type === "gift").length;
    console.log("🎁 Gifts after policy:", giftCountAfter);

    console.log("📩 getMessages END");
    console.log("══════════════════════════════════════");

    return messages;
  }
  /**
   * ✅ يملأ senderSnapshot للرسائل القديمة التي لا تحتويه
   * - يقلل عدد الاستعلامات: يجمع senderIds الفريدة ثم يجلب snapshots في Loop (يمكن تحسينها أكثر)
   * - لا يكسر الأداء لأن limit عندك 30/100 فقط
   */
  private async backfillSenderSnapshots(messages: any[]) {
    // اجمع الرسائل التي تحتاج backfill
    const need = messages.filter((m) => m?.sender && !m?.senderSnapshot);
    if (!need.length) return;

    // اجمع senderIds الفريدة
    const ids = Array.from(
      new Set(
        need
          .map((m) => String(m.sender))
          .filter((id) => this.isValidObjectId(id))
      )
    );

    if (!ids.length) return;

    // جيب snapshots لكل senderId
    const snapshotById = new Map<string, any>();
    for (const id of ids) {
      const snap = await this.getUserPublicSnapshot(id);
      snapshotById.set(id, snap);
    }

    // جهّز bulk update
    const ops = need
      .map((m) => {
        const sid = String(m.sender);
        const snap = snapshotById.get(sid);
        if (!snap) return null;

        // حدّث الـ document في الذاكرة (للرد للعميل)
        m.senderSnapshot = snap;

        // حدّثه في DB مرة واحدة
        return {
          updateOne: {
            filter: { _id: m._id, senderSnapshot: { $exists: false } },
            update: { $set: { senderSnapshot: snap } }
          }
        };
      })
      .filter(Boolean);

    if (ops.length) {
      await RoomMessage.bulkWrite(ops as any, { ordered: false });
    }
  }

  async searchMessages(roomId: string, userId: string, q: string, limit = 30) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const role = this.getRole(room, userId);
    const isInside = this.isInside(room, userId);
    if (!isInside && role === "none") throw new Error("Not allowed");

    const l = Math.max(1, Math.min(100, Number(limit) || 30));
    const text = String(q || "").trim();
    if (!text) return [];

    const safe = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");

    const state = await this.getUserState(roomId, userId);

    const query: any = { room: roomId };

    if (state.clearedAt) {
      const or: any[] = [
        { content: rx, createdAt: { $gt: state.clearedAt } }
      ];

      if (state.pinnedMessageIdAtClear) {
        // ✅ استثناء pinned حتى لو لا تطابق rx
        or.push({ _id: state.pinnedMessageIdAtClear });
      }

      query.$or = or;
    } else {
      query.content = rx;
    }

    const messages = await RoomMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(l)
      .populate("sender", "username avatar")
      .populate("replyTo");

    return messages;
  }
  async toggleReaction(roomId: string, messageId: string, userId: string, emoji: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const role = this.getRole(room, userId);
    const isInside = this.isInside(room, userId);

    if (!isInside && role === "none") throw new Error("Not allowed");

    const message = await RoomMessage.findById(messageId);
    if (!message) throw new Error("Message not found");
    if (message.room.toString() !== roomId) throw new Error("Invalid room message");

    const e = String(emoji || "").trim();
    if (!e) throw new Error("Invalid emoji");

    const existing = (message.reactions || []).find(
      (r: any) => r.user.toString() === userId && r.emoji === e
    );

    // ✅ سنحدد هل تمت الإضافة أم الإزالة
    let added = false;

    if (existing) {
      // إزالة
      message.reactions = message.reactions.filter(
        (r: any) => !(r.user.toString() === userId && r.emoji === e)
      );
      added = false;
    } else {
      // إضافة
      message.reactions.push({ user: userId as any, emoji: e, createdAt: new Date() });
      added = true;
    }

    await message.save();

    // بث تحديث الرياكشن للغرفة
    this.io().to(`room:${roomId}`).emit("room:reaction:update", {
      messageId,
      reactions: message.reactions
    });

    // =====================================================
    // ✅ إرسال إشعار لصاحب الرسالة (فقط عند الإضافة)
    // =====================================================
    try {
      const recipientId = message.sender?.toString?.() ? String(message.sender) : "";
      const actorId = String(userId);

      // لا ترسل لنفسه
      if (added && recipientId && recipientId !== actorId) {
        const actor = await this.getUserBasic(actorId);

        const info = this.buildMessagePreviewForNotification(message);

        // نص الإشعار
        const title = "تفاعل جديد";
        let body = "";

        if (info.kind === "text") {
          // "فلان عمل لك رياكشن 😀 على رسالتك: ...."
          body = `قام ${actor.username} بالتفاعل ${e} على رسالتك${info.preview ? `: ${info.preview}` : ""}`;
        } else {
          // "فلان عمل لك رياكشن 😀 على صورة/فيديو"
          body = `قام ${actor.username} بالتفاعل ${e} على ${info.labelAr}`;
        }

        await notificationService.create({
          recipient: recipientId,
          sender: actorId,
          type: "reaction", // أي قيمة مناسبة عندك
          title,
          body,

          // بيانات إضافية لتوجيه المستخدم عند الضغط على الإشعار
          data: {
            roomId: String(roomId),
            messageId: String(messageId),
            emoji: e,
            messageType: String(message.type || "text"),
            mediaUrl: message?.media?.url || ""
          }
        });
      }
    } catch (err) {
      // مهم: لا نكسر العملية الأساسية بسبب الإشعار
      console.error("reaction notification error:", err);
    }

    return message.reactions;
  }

  /* =====================================================
     ROOM USERS (WITH ROLES & STATUS)
  ===================================================== */

  async getRoomUsers(roomId: string) {
    const room = await Room.findById(roomId)
      .populate("creator", USER_PUBLIC_FIELDS)
      .populate("owners", USER_PUBLIC_FIELDS)
      .populate("admins", USER_PUBLIC_FIELDS)
      .populate("members", USER_PUBLIC_FIELDS);

    if (!room) throw new Error("Room not found");
    this.ensureArrays(room);

    const now = new Date();

    const formatUser = (user: any, role: Role) => {
      const vip = (room.vipUsers || []).find((v: any) => v.user.toString() === user._id.toString());
      const muted = (room.mutedUsers || []).find((m: any) => m.user.toString() === user._id.toString());

      const isActive = (room.activeUsers || []).some(
        (u: any) => u?.toString?.() === user._id.toString()
      );

      return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        role,
        isActive,

        activeCustomization: user.activeCustomization || {
          avatarFrame: "",
          messageEffect: "",
          profileEntryAnimation: "",
          badges: [],
          verificationType: "none"
        },

        customEmojiBadge:
          user?.customEmojiBadge && typeof user.customEmojiBadge === "object"
            ? {
              emoji: String(user.customEmojiBadge.emoji || ""),
              isActive: Boolean(user.customEmojiBadge.isActive),
              expiresAt: user.customEmojiBadge.expiresAt || null
            }
            : null,

        isVip: !!vip,
        vipExpiresAt: vip?.expiresAt || null,
        isMuted: !!muted && muted.until > now,
        mutedUntil: muted?.until || null
      };
    };

    // ✅ أولوية الأدوار (الأعلى يغلب)
    const rank: Record<Role, number> = {
      none: 0,
      member: 1,
      admin: 2,
      owner: 3,
      creator: 4
    };

    // ✅ خريطة فريدة حسب userId
    const byId = new Map<string, any>();

    const upsert = (user: any, role: Role) => {
      if (!user?._id) return;
      const id = user._id.toString();

      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, formatUser(user, role));
        return;
      }

      // إذا الدور الجديد أعلى، استبدله
      if (rank[role] > rank[existing.role as Role]) {
        const merged = formatUser(user, role);
        byId.set(id, { ...existing, ...merged, role });
      } else {
        // فقط حدّث flags (active/vip/muted) لو تغيرت
        const refreshed = formatUser(user, existing.role as Role);
        byId.set(id, { ...existing, ...refreshed });
      }
    };

    // ✅ أدخلهم جميعًا، وDedup سيضمن ظهورهم مرة واحدة بأعلى Role
    upsert(room.creator, "creator");
    for (const u of room.owners || []) upsert(u, "owner");
    for (const u of room.admins || []) upsert(u, "admin");
    for (const u of room.members || []) upsert(u, "member");

    // ✅ ترتيب العرض: الأعلى Role أولاً ثم الاسم
    let users = Array.from(byId.values()).sort((a, b) => {
      const diff = rank[b.role as Role] - rank[a.role as Role];
      if (diff !== 0) return diff;
      return String(a.username || "").localeCompare(String(b.username || ""));
    });

    // ✅ الحل الأول: اعرض الموجودين داخل الغرفة فقط (Active Users)
    users = users.filter((u) => u.isActive);

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

    // (اختياري) لو تحب تبث activeCount = 0 قبل/بعد الحذف:
    // this.io().to(`room:${roomId}`).emit("room:activeCount:update", { roomId, activeCount: 0 });

    return { success: true };
  }

  /* =====================================================
     BASIC ROOM STATS
  ===================================================== */

  async getRoomStats(roomId: string, userId: string) {
    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found");

    this.require(room, userId, ["creator", "owner", "admin", "member"]);

    const activeCount = (room.activeUsers || []).length;
    const totalUsersCount = room.usersCount || 0;
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

const roomService = new RoomService();
roomService.assertMethods();

export default roomService;