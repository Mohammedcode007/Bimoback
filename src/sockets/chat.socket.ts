import { Server, Socket } from "socket.io";
import messageService from "../services/message.service";
import mongoose from "mongoose";
import { activeChats, onlineUsers } from "./socketState";

/* ================= SMART TYPING ================= */

const typingUsers = new Map<string, NodeJS.Timeout>();
const typingThrottle = new Map<string, number>();

/* ================= RATE LIMIT ================= */

const messageLimiter = new Map<string, number[]>();

function checkRateLimit(userId: string) {

  const now = Date.now();
  const windowMs = 10000;
  const limit = 25;

  const timestamps = messageLimiter.get(userId) || [];
  const recent = timestamps.filter(ts => now - ts < windowMs);

  if (recent.length >= limit) {
    throw new Error("Too many messages");
  }

  recent.push(now);
  messageLimiter.set(userId, recent);
}

/* ================= SOCKET ================= */

export const chatSocket = (io: Server, socket: Socket) => {

  const userId: string = socket.data.userId;
  const avatar = socket.data.avatar;

  if (!userId) return;

  console.log("🟢 CONNECTED:", userId);

  /* 🔥 personal room */
  socket.join(userId);

  /* 🔥 presence */
  onlineUsers.add(userId);

  io.emit("presence:update", {
    userId,
    isOnline: true
  });

  /* ================= JOIN CHAT ================= */

  socket.on("chat:join", ({ chatId }) => {

    if (!mongoose.Types.ObjectId.isValid(chatId)) return;

    socket.join(`chat:${chatId}`);

    activeChats.set(userId, chatId);
  });

  /* ================= LEAVE CHAT ================= */

  socket.on("chat:leave", ({ chatId }) => {

    socket.leave(`chat:${chatId}`);
    activeChats.delete(userId);
  });

  /* ================= SEND MESSAGE ================= */

  socket.on("chat:send", async (data, callback?: Function) => {

    try {

      checkRateLimit(userId);

      if (!mongoose.Types.ObjectId.isValid(data.chatId)) {
        throw new Error("Invalid chat ID");
      }

      const message = await messageService.sendMessage(
        userId,
        data.chatId,
        data.content,
        data.type,
        data.media,
        data.replyTo
      );

      /* broadcast message */
socket.to(`chat:${data.chatId}`).emit("chat:new", message);

      /* optimistic ACK */
      if (callback) {
        callback({
          status: "sent",
          realId: message._id
        });
      }

    } catch (error: any) {

      if (callback) {
        callback({ error: error.message });
      }
    }
  });

  /* ================= REACTION ================= */

  socket.on("chat:reaction", async ({ messageId, emoji }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) return;

    await messageService.toggleReaction(
      userId,
      messageId,
      emoji
    );
  });

  /* ================= DELETE ================= */

  socket.on("chat:delete", async ({ messageId, type }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) return;

    if (type === "me") {
      await messageService.deleteForMe(userId, messageId);
    }

    if (type === "everyone") {
      await messageService.deleteForEveryone(userId, messageId);
    }
  });

  /* ================= EDIT ================= */

  socket.on("chat:edit", async ({ messageId, content }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) return;

    await messageService.editMessage(
      userId,
      messageId,
      content
    );
  });

  /* ================= DELIVERED ================= */

  socket.on("chat:delivered", async ({ messageId }) => {

    if (!mongoose.Types.ObjectId.isValid(messageId)) return;

    await messageService.markAsDelivered(
      userId,
      messageId
    );
  });

  /* ================= SEEN ================= */

  socket.on("chat:seen", async ({ chatId }) => {

    if (!mongoose.Types.ObjectId.isValid(chatId)) return;

    await messageService.markAsSeen(userId, chatId);

    io.to(`chat:${chatId}`).emit("message:seen", {
      userId,
      avatar
    });
  });

  /* ================= SMART TYPING ================= */

  socket.on("chat:typing", ({ chatId }) => {

    if (!mongoose.Types.ObjectId.isValid(chatId)) return;

    const key = `${chatId}-${userId}`;
    const now = Date.now();

    const last = typingThrottle.get(key) || 0;
    if (now - last < 1000) return;

    typingThrottle.set(key, now);

    socket.to(`chat:${chatId}`).emit("chat:typing", {
      userId
    });

    if (typingUsers.has(key)) {
      clearTimeout(typingUsers.get(key)!);
    }

    const timeout = setTimeout(() => {

      socket.to(`chat:${chatId}`).emit("chat:stopTyping", {
        userId
      });

      typingUsers.delete(key);

    }, 2000);

    typingUsers.set(key, timeout);
  });

  /* ================= DISCONNECT ================= */

  socket.on("disconnect", () => {

    console.log("🔴 DISCONNECTED:", userId);

    activeChats.delete(userId);
    onlineUsers.delete(userId);

    io.emit("presence:update", {
      userId,
      isOnline: false
    });

    typingUsers.forEach((timeout, key) => {
      if (key.includes(userId)) {
        clearTimeout(timeout);
        typingUsers.delete(key);
      }
    });

    messageLimiter.delete(userId);
  });
};
