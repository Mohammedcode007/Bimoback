// chat.socket.ts
import { Server, Socket } from "socket.io";

export const chatSocket = (io: Server, socket: Socket) => {

  socket.on("chat:typing", ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit("chat:typing", {
      userId: socket.data.userId
    });
  });

  socket.on("chat:message", ({ chatId, message }) => {
    io.to(`chat:${chatId}`).emit("chat:newMessage", message);
  });

  socket.on("chat:delivered", ({ chatId, messageId }) => {
    socket.to(`chat:${chatId}`).emit("chat:delivered", {
      messageId,
      userId: socket.data.userId
    });
  });

  socket.on("chat:seen", ({ chatId, messageId }) => {
    socket.to(`chat:${chatId}`).emit("chat:seen", {
      messageId,
      userId: socket.data.userId
    });
  });

};
