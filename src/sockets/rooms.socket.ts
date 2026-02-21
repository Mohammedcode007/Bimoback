// rooms.socket.ts
import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import roomService from "../services/room.service";

/**
 * Rooms Socket
 * - يعتمد على socketAuth الذي يضع socket.data.userId
 * - يبث الأحداث على قناة: room:{roomId}
 * - يبث أحداث خاصة بالمستخدم على قناة: userId
 */

const roomKey = (roomId: string) => `room:${roomId}`;

export const roomsSocket = (socket: Socket) => {
  const userId: string = socket.data.userId;
  if (!userId) return;

  // ✅ الحل: io بدون socket.server
  const io: Server = socket.nsp.server;

  /* =====================================================
     JOIN ROOM
  ===================================================== */

  socket.on("room:join", async (roomId: string) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      await roomService.joinRoom(roomId, userId);

      socket.join(roomKey(roomId));

      io.to(roomKey(roomId)).emit("room:user:joined", { roomId, userId });
    } catch (error) {
      console.error("room:join error:", error);
      socket.emit("room:error", {
        action: "join",
        message: (error as any)?.message || "Join failed"
      });
    }
  });

  /* =====================================================
     LEAVE ROOM
  ===================================================== */

  socket.on("room:leave", async (roomId: string) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      await roomService.leaveRoom(roomId, userId);

      socket.leave(roomKey(roomId));

      io.to(roomKey(roomId)).emit("room:user:left", { roomId, userId });
    } catch (error) {
      console.error("room:leave error:", error);
      socket.emit("room:error", {
        action: "leave",
        message: (error as any)?.message || "Leave failed"
      });
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
    }) => {
      try {
        const roomId = payload?.roomId;
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;

        // ضمان أن السوكيت داخل غرفة البث
        socket.join(roomKey(roomId));

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
        console.error("room:message:send error:", error);
        socket.emit("room:error", {
          action: "message:send",
          message: (error as any)?.message || "Send failed"
        });
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

        const msg = await roomService.editMessage(roomId, userId, messageId, content);
        io.to(roomKey(roomId)).emit("room:message:edited", msg);
      } catch (error) {
        console.error("room:message:edit error:", error);
        socket.emit("room:error", {
          action: "message:edit",
          message: (error as any)?.message || "Edit failed"
        });
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

        await roomService.deleteMessageForEveryone(roomId, userId, messageId);
      } catch (error) {
        console.error("room:message:delete error:", error);
        socket.emit("room:error", {
          action: "message:delete",
          message: (error as any)?.message || "Delete failed"
        });
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

        const msg = await roomService.pinMessage(roomId, userId, messageId, pinned);
        io.to(roomKey(roomId)).emit("room:message:pinned", msg);
      } catch (error) {
        console.error("room:message:pin error:", error);
        socket.emit("room:error", {
          action: "message:pin",
          message: (error as any)?.message || "Pin failed"
        });
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

        // رجّع للعميل الذي أنشأ الغرفة
        socket.emit("room:created", room);

        // (اختياري) بث للجميع/للاكتشاف
        io.emit("rooms:update", { action: "created", roomId: room._id });
      } catch (error) {
        console.error("room:create error:", error);
        socket.emit("room:error", {
          action: "create",
          message: (error as any)?.message || "Create failed"
        });
      }
    }
  );
    /* =====================================================
     GET ROOMS BY TYPE
  ===================================================== */

  socket.on(
    "rooms:get",
    async (payload: { type: "public" | "private" | "protected" | "subscription"; limit?: number; page?: number }) => {
      try {
        const data = await roomService.getRoomsByType(payload?.type as any, {
          limit: payload?.limit,
          page: payload?.page
        });

        socket.emit("rooms:list", data);
      } catch (error) {
        console.error("rooms:get error:", error);
        socket.emit("room:error", {
          action: "rooms:get",
          message: (error as any)?.message || "Fetch rooms failed"
        });
      }
    }
  );
    /* =====================================================
     SEARCH ROOMS
  ===================================================== */

  socket.on(
    "rooms:search",
    async (payload: { q: string; type?: "public" | "private" | "protected" | "subscription"; limit?: number }) => {
      try {
        const rooms = await roomService.searchRooms(
          payload?.q,
          payload?.type as any,
          payload?.limit ?? 30
        );

        socket.emit("rooms:search:results", rooms);
      } catch (error) {
        console.error("rooms:search error:", error);
        socket.emit("room:error", {
          action: "rooms:search",
          message: (error as any)?.message || "Search failed"
        });
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
        const highlighted =
          payload?.highlighted !== undefined ? Boolean(payload.highlighted) : true;

        if (!mongoose.Types.ObjectId.isValid(roomId)) return;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        const msg = await roomService.highlightMessage(roomId, userId, messageId, highlighted);
        io.to(roomKey(roomId)).emit("room:message:highlighted", msg);
      } catch (error) {
        console.error("room:message:highlight error:", error);
        socket.emit("room:error", {
          action: "message:highlight",
          message: (error as any)?.message || "Highlight failed"
        });
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

        const reactions = await roomService.toggleReaction(roomId, messageId, userId, emoji);

        io.to(roomKey(roomId)).emit("room:reaction:update", {
          messageId,
          reactions
        });
      } catch (error) {
        console.error("room:reaction:toggle error:", error);
        socket.emit("room:error", {
          action: "reaction:toggle",
          message: (error as any)?.message || "Reaction failed"
        });
      }
    }
  );

  /* =====================================================
     POLL
  ===================================================== */

  socket.on(
    "room:poll:start",
    async (payload: { roomId: string; question: string; options: string[]; minutes: number }) => {
      try {
        const { roomId, question, options, minutes } = payload || {};
        if (!mongoose.Types.ObjectId.isValid(roomId)) return;

        const poll = await roomService.startPoll(roomId, userId, question, options, minutes);
        io.to(roomKey(roomId)).emit("room:poll:start", poll);
      } catch (error) {
        console.error("room:poll:start error:", error);
        socket.emit("room:error", {
          action: "poll:start",
          message: (error as any)?.message || "Poll start failed"
        });
      }
    }
  );

  socket.on("room:poll:vote", async (payload: { roomId: string; optionIndex: number }) => {
    try {
      const { roomId, optionIndex } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      const poll = await roomService.vote(roomId, optionIndex);
      io.to(roomKey(roomId)).emit("room:poll:update", poll);
    } catch (error) {
      console.error("room:poll:vote error:", error);
      socket.emit("room:error", {
        action: "poll:vote",
        message: (error as any)?.message || "Vote failed"
      });
    }
  });

  socket.on("room:poll:end", async (payload: { roomId: string }) => {
    try {
      const { roomId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      await roomService.endPoll(roomId, userId);
      io.to(roomKey(roomId)).emit("room:poll:end");
    } catch (error) {
      console.error("room:poll:end error:", error);
      socket.emit("room:error", {
        action: "poll:end",
        message: (error as any)?.message || "Poll end failed"
      });
    }
  });

  /* =====================================================
     VOICE
  ===================================================== */

  socket.on("room:voice:seats", async (payload: { roomId: string; seats: number }) => {
    try {
      const { roomId, seats } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      const s = await roomService.setMaxVoiceSeats(roomId, userId, seats);
      io.to(roomKey(roomId)).emit("room:voice:seats", s);
    } catch (error) {
      console.error("room:voice:seats error:", error);
      socket.emit("room:error", {
        action: "voice:seats",
        message: (error as any)?.message || "Set seats failed"
      });
    }
  });

  socket.on("room:voice:raiseHand", async (payload: { roomId: string }) => {
    try {
      const { roomId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      const list = await roomService.raiseHand(roomId, userId);
      io.to(roomKey(roomId)).emit("room:hand:update", list);
    } catch (error) {
      console.error("room:voice:raiseHand error:", error);
      socket.emit("room:error", {
        action: "voice:raiseHand",
        message: (error as any)?.message || "Raise hand failed"
      });
    }
  });

  socket.on("room:voice:clearHand", async (payload: { roomId: string }) => {
    try {
      const { roomId } = payload || {};
      if (!mongoose.Types.ObjectId.isValid(roomId)) return;

      const list = await roomService.clearRaisedHand(roomId, userId);
      io.to(roomKey(roomId)).emit("room:hand:update", list);
    } catch (error) {
      console.error("room:voice:clearHand error:", error);
      socket.emit("room:error", {
        action: "voice:clearHand",
        message: (error as any)?.message || "Clear hand failed"
      });
    }
  });
};