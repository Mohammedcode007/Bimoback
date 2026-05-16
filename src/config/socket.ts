

import { Server } from "socket.io";
import http from "http";

import { socketAuth } from "../sockets/socketAuth";
import { presenceSocket } from "../sockets/presence.socket";
import { chatSocket } from "../sockets/chat.socket";
import { notificationSocket } from "../sockets/notification.socket";
import { roomsSocket } from "../sockets/rooms.socket";
import { rateLimitSocket } from "../sockets/rateLimit.socket";

import notificationGateway from "../services/notification.gateway";

let io: Server;

/* =====================================================
   TRACK SOCKETS PER USER
   مهم حتى لو المستخدم فاتح التطبيق من أكثر من جهاز
===================================================== */

const connectedSocketsByUser = new Map<string, Set<string>>();
const disconnectTimersByUser = new Map<string, NodeJS.Timeout>();

const DISCONNECT_LEAVE_ROOMS_DELAY_MS = 5000;
/* =====================================================
   HELPERS
===================================================== */

function addUserSocket(userId: string, socketId: string) {
  if (!connectedSocketsByUser.has(userId)) {
    connectedSocketsByUser.set(userId, new Set());
  }

  connectedSocketsByUser.get(userId)!.add(socketId);

  const oldTimer = disconnectTimersByUser.get(userId);

  if (oldTimer) {
    clearTimeout(oldTimer);
    disconnectTimersByUser.delete(userId);
  }

  console.log("🟢 [socket] user socket added", {
    userId,
    socketId,
    socketsCount: connectedSocketsByUser.get(userId)?.size || 0,
  });
}
async function isUserReallyConnected(userId: string) {
  try {
    if (!io) return false;

    const sockets = await io.fetchSockets();

    return sockets.some((s: any) => {
      return String(s.data?.userId || "") === String(userId);
    });
  } catch (e) {
    console.error("❌ [socket] isUserReallyConnected failed:", e);
    return false;
  }
}
function removeUserSocket(userId: string, socketId: string) {
  const sockets = connectedSocketsByUser.get(userId);

  if (!sockets) return 0;

  sockets.delete(socketId);

  const count = sockets.size;

  if (count <= 0) {
    connectedSocketsByUser.delete(userId);
  }

  console.log("🔴 [socket] user socket removed", {
    userId,
    socketId,
    socketsCount: count,
  });

  return count;
}

function scheduleLeaveAllRoomsAfterDisconnect(userId: string, reason: string) {
  const oldTimer = disconnectTimersByUser.get(userId);

  if (oldTimer) {
    clearTimeout(oldTimer);
  }

  const timer = setTimeout(async () => {
const stillTracked = connectedSocketsByUser.get(userId);

if (stillTracked && stillTracked.size > 0) {
  console.log("ℹ️ [socket] user reconnected, skip leaving rooms", {
    userId,
    socketsCount: stillTracked.size,
  });

  disconnectTimersByUser.delete(userId);
  return;
}

const reallyConnected = await isUserReallyConnected(userId);

if (reallyConnected) {
  console.log("ℹ️ [socket] user is really connected, skip leaving rooms", {
    userId,
  });

  disconnectTimersByUser.delete(userId);
  return;
}

    try {
      console.log("🚪 [socket] leave all active rooms after disconnect", {
        userId,
        reason,
      });

      /**
       * Dynamic import مهم هنا لتجنب circular dependency
       * لأن room.service يستورد getIO من هذا الملف.
       */
      const mod = await import("../services/room.service");
      const roomService = mod.default;

      await roomService.leaveAllActiveRoomsForUser(userId);

      console.log("✅ [socket] user left all active rooms", {
        userId,
      });
    } catch (error) {
      console.error("❌ [socket] leaveAllActiveRoomsForUser error:", error);
    } finally {
      disconnectTimersByUser.delete(userId);
    }
  }, DISCONNECT_LEAVE_ROOMS_DELAY_MS);

  disconnectTimersByUser.set(userId, timer);
}

/* =====================================================
   INIT SOCKET
===================================================== */

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  /* =====================================================
     Authentication Middleware
  ===================================================== */

  io.use(socketAuth);

  /* =====================================================
     Connection Handler
  ===================================================== */

  io.on("connection", async (socket) => {
    const userId: string = String(socket.data.userId || "");

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    console.log(`🔌 User connected: ${userId}`);

    addUserSocket(userId, socket.id);

    /* =====================================================
       Join Personal Room
    ===================================================== */

    socket.join(userId);

    /* =====================================================
       Auto Sync Notifications
    ===================================================== */

    try {
      await notificationGateway.syncUser(userId);
    } catch (err) {
      console.error("Notification sync error:", err);
    }

    /* =====================================================
       Attach Feature Modules
    ===================================================== */

    rateLimitSocket(socket);
    roomsSocket(socket);
    presenceSocket(io, socket);
    chatSocket(io, socket);
    notificationSocket(io, socket);

    /* =====================================================
       Disconnect Handling
    ===================================================== */

    socket.on("disconnect", (reason) => {
      console.log(`❌ User disconnected: ${userId} | Reason: ${reason}`);

      const remainingSocketsCount = removeUserSocket(userId, socket.id);

      /**
       * لو المستخدم له socket ثاني مفتوح، لا تخرجه من الغرف.
       * مثلًا فاتح من جهازين أو حصل reconnect سريع.
       */
      if (remainingSocketsCount > 0) {
        console.log("ℹ️ [socket] skip leave rooms because user still has active sockets", {
          userId,
          remainingSocketsCount,
        });

        return;
      }

      scheduleLeaveAllRoomsAfterDisconnect(userId, reason);
    });

    socket.on("error", (err) => {
      console.error(`⚠ Socket error (${userId}):`, err);
    });
  });

  return io;
};

/* =====================================================
   GET IO INSTANCE
===================================================== */

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket not initialized");
  }

  return io;
};