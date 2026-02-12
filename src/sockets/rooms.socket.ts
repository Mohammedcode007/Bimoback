import { Socket } from "socket.io";

export const roomsSocket = (socket: Socket) => {

  socket.on("chat:join", (chatId: string) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on("chat:leave", (chatId: string) => {
    socket.leave(`chat:${chatId}`);
  });

  socket.join(`user:${socket.data.userId}`);
};
