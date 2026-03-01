// rooms.socket.ts
import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import roomService from "../services/room.service";

/**
 * Rooms Socket
 * - يعتمد على socketAuth الذي يضع socket.data.userId
 * - البث على قناة: room:{roomId}
 * - أحداث خاصة بالمستخدم على قناة: userId
 *
 * ✅ ملاحظات:
 * 1) لا تبث room:user:joined / room:user:left هنا (الخدمة RoomService تبثها)
 * 2) join للقناة قبل joinRoom لضمان استلام room:message:new ورسالة "دخل" التي تبثها الخدمة
 * 3) rollback: لو joinRoom فشل نخرج socket من القناة
 * 4) عند disconnect نعمل leaveRoom لكل الغرف التي دخلها هذا السوكيت لضمان تحديث العدد (room:activeCount:update)
 * 5) لا داعي لأي emit للعدد هنا لأن RoomService يبث room:activeCount:update في كل الحالات
 */

const roomKey = (roomId: string) => `room:${roomId}`;

export const roomsSocket = (socket: Socket) => {
  const userId: string = socket.data.userId;
  if (!userId) return;

  const io: Server = socket.nsp.server;

  const joinedRooms = new Set<string>();

  const ensureJoinChannel = (roomId: string) => {
    socket.join(roomKey(roomId));
    joinedRooms.add(roomId);
  };

  const safeError = (action: string, error: any, fallback: string) => {
    console.error(`${action} error:`, error);
    socket.emit("room:error", {
      action,
      message: error?.message || fallback
    });
  };

  /* =====================================================
     JOIN ROOM
  ===================================================== */

  socket.on("room:join", async (roomId: string) => {
    if (!mongoose.Types.ObjectId.isValid(roomId)) return;

    ensureJoinChannel(roomId);

    try {
      await roomService.joinRoom(roomId, userId);
    } catch (error) {
      // rollback
      joinedRooms.delete(roomId);
      socket.leave(roomKey(roomId));
      safeError("join", error, "Join failed");
    }
  });

  /* =====================================================
     LEAVE ROOM
  ===================================================== */

  socket.on("room:leave", async (roomId: string) => {
    if (!mongoose.Types.ObjectId.isValid(roomId)) return;

    try {
      await roomService.leaveRoom(roomId, userId);

      joinedRooms.delete(roomId);
      socket.leave(roomKey(roomId));
    } catch (error) {
      safeError("leave", error, "Leave failed");
    }
  });

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  socket.on(
    "room:message:send",
    async (payload: {
      roomId: string;
      content?: string;
      type?: string;
      replyTo?: string;
      mentions?: string[];
      media?: { url: string; fileName?: string; fileSize?: number; mimeType?: string };
      gift?: { name: string; value: number; animation?: string };
    }) => {
      try {
        const roomId = payload?.roomId;
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;

        ensureJoinChannel(roomId);

        await roomService.sendMessage({
          roomId,
          senderId: userId,
          content: payload?.content,
          type: payload?.type,
          replyTo: payload?.replyTo,
          mentions: Array.isArray(payload?.mentions) ? payload.mentions : [],
          media: payload?.media,
          gift: payload?.gift
        });
      } catch (error) {
        safeError("message:send", error, "Send failed");
      }
    }
  );

  /* =====================================================
     EDIT MESSAGE
  ===================================================== */

  socket.on(
    "room:message:edit",
    async (payload: { roomId: string; messageId: string; content: string }) => {
      try {
        const { roomId, messageId, content } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        ensureJoinChannel(roomId);

        const msg = await roomService.editMessage(roomId, userId, messageId, content);
        io.to(roomKey(roomId)).emit("room:message:edited", msg);
      } catch (error) {
        safeError("message:edit", error, "Edit failed");
      }
    }
  );

  /* =====================================================
     DELETE MESSAGE (SOFT DELETE)
  ===================================================== */

  socket.on(
    "room:message:delete",
    async (payload: { roomId: string; messageId: string }) => {
      try {
        const { roomId, messageId } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        ensureJoinChannel(roomId);

        await roomService.deleteMessageForEveryone(roomId, userId, messageId);
      } catch (error) {
        safeError("message:delete", error, "Delete failed");
      }
    }
  );

  /* =====================================================
     PIN MESSAGE
  ===================================================== */

  socket.on(
    "room:message:pin",
    async (payload: { roomId: string; messageId: string; pinned?: boolean }) => {
      try {
        const { roomId, messageId } = payload || {};
        const pinned = payload?.pinned !== undefined ? Boolean(payload.pinned) : true;

        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        ensureJoinChannel(roomId);

        const msg = await roomService.pinMessage(roomId, userId, messageId, pinned);
        io.to(roomKey(roomId)).emit("room:message:pinned", msg);
      } catch (error) {
        safeError("message:pin", error, "Pin failed");
      }
    }
  );

  /* =====================================================
     HIGHLIGHT MESSAGE
  ===================================================== */

  socket.on(
    "room:message:highlight",
    async (payload: { roomId: string; messageId: string; highlighted?: boolean }) => {
      try {
        const { roomId, messageId } = payload || {};
        const highlighted = payload?.highlighted !== undefined ? Boolean(payload.highlighted) : true;

        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        ensureJoinChannel(roomId);

        const msg = await roomService.highlightMessage(roomId, userId, messageId, highlighted);
        io.to(roomKey(roomId)).emit("room:message:highlighted", msg);
      } catch (error) {
        safeError("message:highlight", error, "Highlight failed");
      }
    }
  );

  /* =====================================================
     TOGGLE REACTION
  ===================================================== */

  socket.on(
    "room:reaction:toggle",
    async (payload: { roomId: string; messageId: string; emoji: string }) => {
      try {
        const { roomId, messageId, emoji } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        ensureJoinChannel(roomId);

        const reactions = await roomService.toggleReaction(roomId, messageId, userId, emoji);
        io.to(roomKey(roomId)).emit("room:reaction:update", { messageId, reactions });
      } catch (error) {
        safeError("reaction:toggle", error, "Reaction failed");
      }
    }
  );

  /* =====================================================
     CREATE ROOM
  ===================================================== */

  socket.on(
    "room:create",
    async (payload: {
      name: string;
      description?: string;
      avatar?: string;
      cover?: string;
      type?: "public" | "private" | "protected" | "subscription";
      maxUsers?: number;
      password?: string;
      subscriptionPrice?: number;
      tags?: string[];
      slowModeSeconds?: number;
      premiumLevel?: number;
    }) => {
      try {
        const room = await roomService.createRoom(userId, payload);
        socket.emit("room:created", room);
        io.emit("rooms:update", { action: "created", roomId: room._id });
      } catch (error) {
        safeError("create", error, "Create failed");
      }
    }
  );

  /* =====================================================
     GET ROOMS BY TYPE
  ===================================================== */

  // socket.on(
  //   "rooms:get",
  //   async (payload: { type: "public" | "private" | "protected" | "subscription"; limit?: number; page?: number }) => {
  //     try {
  //       const data = await roomService.getRoomsByType(payload?.type as any, {
  //         limit: payload?.limit,
  //         page: payload?.page
  //       });
  //       socket.emit("rooms:list", data);
  //     } catch (error) {
  //       safeError("rooms:get", error, "Fetch rooms failed");
  //     }
  //   }
  // );
  socket.on(
  "rooms:get",
  async (payload: { type: "public" | "private" | "protected" | "subscription"; limit?: number; page?: number }) => {
    try {
      const type = payload?.type as any;
      const limit = payload?.limit;
      const page = payload?.page;

      // ✅ بدلاً من تمرير object كـ argument ثاني (يسبب الخطأ)
      // نفترض أن توقيع الدالة في RoomService هو: (type, limit?, page?)
      const data = await (roomService as any).getRoomsByType(type, limit, page);

      socket.emit("rooms:list", data);
    } catch (error) {
      safeError("rooms:get", error, "Fetch rooms failed");
    }
  }
);

  /* =====================================================
     SEARCH ROOMS
  ===================================================== */

  // socket.on(
  //   "rooms:search",
  //   async (payload: { q: string; type?: "public" | "private" | "protected" | "subscription"; limit?: number }) => {
  //     try {
  //       const rooms = await roomService.searchRooms(payload?.q, payload?.type as any, payload?.limit ?? 30);
  //       socket.emit("rooms:search:results", rooms);
  //     } catch (error) {
  //       safeError("rooms:search", error, "Search failed");
  //     }
  //   }
  // );
  socket.on(
  "rooms:search",
  async (payload: { q: string; type?: "public" | "private" | "protected" | "subscription"; limit?: number }) => {
    try {
      const q = payload?.q;
      const type = payload?.type as any; // ✅ لضمان تطابق RoomType
      const limit = payload?.limit ?? 30;

      const rooms = await (roomService as any).searchRooms(q, type, limit);

      socket.emit("rooms:search:results", rooms);
    } catch (error) {
      safeError("rooms:search", error, "Search failed");
    }
  }
);

  /* =====================================================
     ROOM INFO / SETTINGS (الدوال الناقصة من RoomService)
     updateInfo / changeType / changePremiumLevel / toggleAntiSpam / setRoomLock / setSlowMode
  ===================================================== */

  socket.on(
    "room:updateInfo",
    async (payload: { roomId: string; name?: string; description?: string; avatar?: string; cover?: string }) => {
      try {
        const { roomId, ...data } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;

        ensureJoinChannel(roomId);

        const room = await roomService.updateInfo(roomId, userId, data);
        // الخدمة تبث room:update بالفعل، لكن نرجّع ACK/نتيجة للمرسل
        socket.emit("room:updateInfo:ok", room);
      } catch (error) {
        safeError("updateInfo", error, "Update info failed");
      }
    }
  );

  socket.on("room:changeType", async (payload: { roomId: string; type: any }) => {
    try {
      const { roomId, type } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const room = await roomService.changeType(roomId, userId, type);
      socket.emit("room:changeType:ok", { roomId, type: room.type });
    } catch (error) {
      safeError("changeType", error, "Change type failed");
    }
  });

  socket.on("room:changePremiumLevel", async (payload: { roomId: string; level: number }) => {
    try {
      const { roomId, level } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const room = await roomService.changePremiumLevel(roomId, userId, level as any);
      socket.emit("room:changePremiumLevel:ok", { roomId, premiumLevel: room.premiumLevel });
    } catch (error) {
      safeError("changePremiumLevel", error, "Change premium failed");
    }
  });

  socket.on("room:antiSpam:set", async (payload: { roomId: string; enabled: boolean; max?: number }) => {
    try {
      const { roomId, enabled, max } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const room = await roomService.toggleAntiSpam(roomId, userId, enabled, max);
      socket.emit("room:antiSpam:set:ok", {
        roomId,
        enabled: room.antiSpamEnabled,
        max: room.maxMessagesPerMinute
      });
    } catch (error) {
      safeError("antiSpam:set", error, "Anti-spam failed");
    }
  });

  socket.on("room:lock:set", async (payload: { roomId: string; locked: boolean }) => {
    try {
      const { roomId, locked } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const isLocked = await roomService.setRoomLock(roomId, userId, locked);
      socket.emit("room:lock:set:ok", { roomId, isLocked });
    } catch (error) {
      safeError("lock:set", error, "Lock failed");
    }
  });

  socket.on("room:slowMode:set", async (payload: { roomId: string; seconds: number }) => {
    try {
      const { roomId, seconds } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const s = await roomService.setSlowMode(roomId, userId, seconds);
      socket.emit("room:slowMode:set:ok", { roomId, seconds: s });
    } catch (error) {
      safeError("slowMode:set", error, "Slow mode failed");
    }
  });

  /* =====================================================
     ROLES / MODERATION (الدوال الناقصة من RoomService)
     setUserRole / addMember / removeMember / promoteToAdmin / demoteAdmin / promoteToOwner / transferCreator
     kickUser / banUser / unbanUser / muteUser / unmuteUser
  ===================================================== */

  socket.on(
    "room:role:set",
    async (payload: { roomId: string; targetId: string; role: "owner" | "admin" | "member" }) => {
      try {
        const { roomId, targetId, role } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(targetId)) return;

        ensureJoinChannel(roomId);

        const res = await roomService.setUserRole(roomId, userId, targetId, role);
        socket.emit("room:role:set:ok", { roomId, targetId, role, ...res });
      } catch (error) {
        safeError("role:set", error, "Set role failed");
      }
    }
  );

  socket.on("room:member:add", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.addMember(roomId, userId, targetId);
      socket.emit("room:member:add:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("member:add", error, "Add member failed");
    }
  });

  socket.on("room:member:remove", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.removeMember(roomId, userId, targetId);
      socket.emit("room:member:remove:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("member:remove", error, "Remove member failed");
    }
  });

  socket.on("room:admin:promote", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.promoteToAdmin(roomId, userId, targetId);
      socket.emit("room:admin:promote:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("admin:promote", error, "Promote admin failed");
    }
  });

  socket.on("room:admin:demote", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.demoteAdmin(roomId, userId, targetId);
      socket.emit("room:admin:demote:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("admin:demote", error, "Demote admin failed");
    }
  });

  socket.on("room:owner:promote", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.promoteToOwner(roomId, userId, targetId);
      socket.emit("room:owner:promote:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("owner:promote", error, "Promote owner failed");
    }
  });

  socket.on("room:creator:transfer", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.transferCreator(roomId, userId, targetId);
      socket.emit("room:creator:transfer:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("creator:transfer", error, "Transfer creator failed");
    }
  });

  socket.on("room:kick", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.kickUser(roomId, userId, targetId);
      socket.emit("room:kick:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("kick", error, "Kick failed");
    }
  });

  socket.on("room:ban", async (payload: { roomId: string; targetId: string; reason?: string }) => {
    try {
      const { roomId, targetId, reason } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.banUser(roomId, userId, targetId, reason);
      socket.emit("room:ban:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("ban", error, "Ban failed");
    }
  });

  socket.on("room:unban", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.unbanUser(roomId, userId, targetId);
      socket.emit("room:unban:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("unban", error, "Unban failed");
    }
  });

  socket.on(
    "room:mute",
    async (payload: { roomId: string; targetId: string; minutes: number; reason?: string }) => {
      try {
        const { roomId, targetId, minutes, reason } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(targetId)) return;

        ensureJoinChannel(roomId);

        const res = await roomService.muteUser(roomId, userId, targetId, minutes, reason);
        socket.emit("room:mute:ok", { roomId, targetId, ...res });
      } catch (error) {
        safeError("mute", error, "Mute failed");
      }
    }
  );

  socket.on("room:unmute", async (payload: { roomId: string; targetId: string }) => {
    try {
      const { roomId, targetId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;
      if (!mongoose.Types.ObjectId.isValid(targetId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.unmuteUser(roomId, userId, targetId);
      socket.emit("room:unmute:ok", { roomId, targetId, ...res });
    } catch (error) {
      safeError("unmute", error, "Unmute failed");
    }
  });

  /* =====================================================
     ROOM USERS / STATS (الدوال الناقصة)
     getRoomUsers / getRoomStats / increaseMaxUsers / deleteRoom / autoRejoin / safeRejoin
  ===================================================== */

  socket.on("room:users:get", async (payload: { roomId: string }) => {
    try {
      const { roomId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const data = await roomService.getRoomUsers(roomId);
      socket.emit("room:users:list", { roomId, ...data });
    } catch (error) {
      safeError("users:get", error, "Get users failed");
    }
  });

  socket.on("room:stats:get", async (payload: { roomId: string }) => {
    try {
      const { roomId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const stats = await roomService.getRoomStats(roomId, userId);
      socket.emit("room:stats", stats);
    } catch (error) {
      safeError("stats:get", error, "Get stats failed");
    }
  });

  socket.on("room:maxUsers:increase", async (payload: { roomId: string; amount: number }) => {
    try {
      const { roomId, amount } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const maxUsers = await roomService.increaseMaxUsers(roomId, userId, amount);
      socket.emit("room:maxUsers:increase:ok", { roomId, maxUsers });
    } catch (error) {
      safeError("maxUsers:increase", error, "Increase max users failed");
    }
  });

  socket.on("room:delete", async (payload: { roomId: string }) => {
    try {
      const { roomId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      const res = await roomService.deleteRoom(roomId, userId);
      socket.emit("room:delete:ok", { roomId, ...res });
    } catch (error) {
      safeError("delete", error, "Delete room failed");
    }
  });

  socket.on("room:autoRejoin", async () => {
    try {
      const rooms = await roomService.autoRejoin(userId);
      socket.emit("room:autoRejoin:list", rooms);
    } catch (error) {
      safeError("autoRejoin", error, "Auto rejoin failed");
    }
  });

  socket.on("room:safeRejoin", async (payload: { roomId: string }) => {
    try {
      const { roomId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      ensureJoinChannel(roomId);

      await roomService.safeRejoin(roomId, userId);
      socket.emit("room:safeRejoin:ok", { roomId });
    } catch (error) {
      safeError("safeRejoin", error, "Safe rejoin failed");
    }
  });

  /* =====================================================
     DISCONNECT CLEANUP
  ===================================================== */

  socket.on("disconnect", async (reason) => {
    console.log("🔌 rooms.socket disconnect:", { userId, reason });

    const rooms = Array.from(joinedRooms);
    joinedRooms.clear();

    for (const roomId of rooms) {
      if (!mongoose.Types.ObjectId.isValid(roomId)) continue;

      try {
        await roomService.leaveRoom(roomId, userId);
      } catch {
        // تجاهل
      }

      try {
        socket.leave(roomKey(roomId));
      } catch {}
    }
  });
};