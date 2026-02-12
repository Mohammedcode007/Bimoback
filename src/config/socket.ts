import { Server } from "socket.io";
import http from "http";

import { socketAuth } from "../sockets/socketAuth";
import { presenceSocket } from "../sockets/presence.socket";
import { chatSocket } from "../sockets/chat.socket";
import { notificationSocket } from "../sockets/notification.socket";
import { roomsSocket } from "../sockets/rooms.socket";
import { rateLimitSocket } from "../sockets/rateLimit.socket";

let io: Server;

/* =====================================================
   INIT SOCKET
===================================================== */

export const initSocket = (server: http.Server) => {

  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  /* =========================
     Authentication Middleware
  ========================= */

  io.use(socketAuth);

  /* =========================
     Connection Handler
  ========================= */

  io.on("connection", (socket) => {

    const userId = socket.data.userId;

    if (!userId) {
      socket.disconnect();
      return;
    }

    console.log(`🔌 User connected: ${userId}`);

    /* Join personal room */
    socket.join(userId);

    /* Attach feature modules */
    rateLimitSocket(socket);
    roomsSocket(socket);
    presenceSocket(io, socket);
    chatSocket(io, socket);
    notificationSocket(io, socket);

    /* Disconnect */
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${userId}`);
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
