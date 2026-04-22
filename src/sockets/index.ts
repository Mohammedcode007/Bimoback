// import { Server } from "socket.io";
// import http from "http";

// import { socketAuth } from "./socketAuth";
// import { presenceSocket } from "./presence.socket";
// import { chatSocket } from "./chat.socket";
// import { notificationSocket } from "./notification.socket";
// import { roomsSocket } from "./rooms.socket";
// import { rateLimitSocket } from "./rateLimit.socket";

// let io: Server;

// export const initSocket = (server: http.Server) => {

//   io = new Server(server, {
//     cors: {
//       origin: "*"
//     }
//   });

//   io.use(socketAuth);

//   io.on("connection", (socket) => {

//     rateLimitSocket(socket);
//     roomsSocket(socket);
//     presenceSocket(io, socket);
//     chatSocket(io, socket);
//     notificationSocket(io, socket);

//   });
// };

// export const getIO = () => io;

import { Server } from "socket.io";
import http from "http";

import { socketAuth } from "./socketAuth";
import { presenceSocket } from "./presence.socket";
import { chatSocket } from "./chat.socket";
import { notificationSocket } from "./notification.socket";
import { roomsSocket } from "./rooms.socket";
import { rateLimitSocket } from "./rateLimit.socket";

let io: Server | null = null;

export const initSocket = (server: http.Server) => {

  io = new Server(server, {
    cors: {
      origin: "*"
    },
    transports: ["websocket"],     // 🔥 يمنع polling ويحسن الأداء
    pingTimeout: 20000,
    pingInterval: 25000
  });

  /* ================= GLOBAL AUTH ================= */

  io.use(socketAuth);

  /* ================= CONNECTION ================= */

  io.on("connection", (socket) => {
 const userId = String(socket.data?.userId || "");

  // ✅ دخول غرفة شخصية للمستخدم (مهم لكل io.to(userId))
  if (userId) {
    socket.join(userId);
  }

    /* ⚡ Rate Limit أولًا */
    rateLimitSocket(socket);

    /* 🏠 Rooms */
    roomsSocket(socket);

    /* 👁 Presence */
    presenceSocket(io!, socket);

    /* 💬 Chat */
    chatSocket(io!, socket);

    /* 🔔 Notifications */
    notificationSocket(io!, socket);

  });

  console.log("✅ Socket initialized");
};

/* ================= SAFE GET IO ================= */

export const getIO = () => {

  if (!io) {
    throw new Error("Socket.io not initialized");
  }

  return io;
};
