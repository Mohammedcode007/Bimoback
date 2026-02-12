import { Socket } from "socket.io";

const messageTimestamps = new Map<string, number>();

export const rateLimitSocket = (socket: Socket) => {

  socket.use((packet, next) => {
    const now = Date.now();
    const last = messageTimestamps.get(socket.id) || 0;

    if (now - last < 300) {
      return next(new Error("Too many requests"));
    }

    messageTimestamps.set(socket.id, now);
    next();
  });

};
