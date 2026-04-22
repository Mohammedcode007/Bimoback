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

/*        ====
   INIT SOCKET
       ==== */

export const initSocket = (server: http.Server) => {

  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  /*    ====
     Authentication Middleware
     ==== */

  io.use(socketAuth);

  /*    ====
     Connection Handler
     ==== */

  io.on("connection", async (socket) => {

    const userId: string = socket.data.userId;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    console.log(`🔌 User connected: ${userId}`);

    /*    ====
       Join Personal Room
       ==== */

    socket.join(userId);

    /*    ====
       Auto Sync Notifications
       ==== */

    try {
      await notificationGateway.syncUser(userId);
    } catch (err) {
      console.error("Notification sync error:", err);
    }

    /*    ====
       Attach Feature Modules
       ==== */

    rateLimitSocket(socket);
    roomsSocket(socket);
    presenceSocket(io, socket);
    chatSocket(io, socket);
    notificationSocket(io, socket);

    /*    ====
       Disconnect Handling
       ==== */

    socket.on("disconnect", (reason) => {
      console.log(`❌ User disconnected: ${userId} | Reason: ${reason}`);
    });

    socket.on("error", (err) => {
      console.error(`⚠ Socket error (${userId}):`, err);
    });

  });

  return io;
};

/*        ====
   GET IO INSTANCE
       ==== */

export const getIO = (): Server => {

  if (!io) {
    throw new Error("Socket not initialized");
  }

  return io;
};
