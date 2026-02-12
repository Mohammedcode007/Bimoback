import { Server, Socket } from "socket.io";
import Notification from "../models/Notification";

export const notificationSocket = (io: Server, socket: Socket) => {

  const userId: string = socket.data.userId;

  if (!userId) return;

  /* =========================
     MARK AS READ
  ========================= */

  socket.on("notification:read", async (notificationId: string) => {

    await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() }
    );

    io.to(userId).emit("notification:updated", {
      notificationId
    });
  });

};
