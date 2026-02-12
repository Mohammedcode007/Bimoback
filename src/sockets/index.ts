import { Server } from "socket.io";
import http from "http";

import { socketAuth } from "./socketAuth";
import { presenceSocket } from "./presence.socket";
import { chatSocket } from "./chat.socket";
import { notificationSocket } from "./notification.socket";
import { roomsSocket } from "./rooms.socket";
import { rateLimitSocket } from "./rateLimit.socket";

let io: Server;

export const initSocket = (server: http.Server) => {

  io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

  io.use(socketAuth);

  io.on("connection", (socket) => {

    rateLimitSocket(socket);
    roomsSocket(socket);
    presenceSocket(io, socket);
    chatSocket(io, socket);
    notificationSocket(io, socket);

  });
};

export const getIO = () => io;
