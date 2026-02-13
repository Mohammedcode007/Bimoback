import { Server, Socket } from "socket.io";
import Notification from "../models/Notification";
import notificationGateway from "../services/notification.gateway";

export const notificationSocket = (io: Server, socket: Socket) => {

  const userId: string = socket.data.userId;

  if (!userId) return;

  /* =====================================================
     MARK SINGLE NOTIFICATION AS READ
  ===================================================== */

  socket.on("notification:read", async (notificationId: string) => {

    try {

      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId,
          isDeleted: false
        },
        {
          isRead: true,
          readAt: new Date()
        },
        { new: true }
      );

      if (!notification) return;

      /* 🔥 إعادة مزامنة كاملة لضمان العداد الصحيح */
      await notificationGateway.syncUser(userId);

    } catch (error) {
      console.error("Notification read error:", error);
    }

  });


  /* =====================================================
     MARK ALL AS READ
  ===================================================== */

  socket.on("notification:readAll", async () => {

    try {

      await Notification.updateMany(
        {
          recipient: userId,
          isRead: false,
          isDeleted: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      await notificationGateway.syncUser(userId);

    } catch (error) {
      console.error("Notification readAll error:", error);
    }

  });


  /* =====================================================
     MANUAL SYNC
  ===================================================== */

  socket.on("notification:sync", async () => {

    try {
      await notificationGateway.syncUser(userId);
    } catch (error) {
      console.error("Notification sync error:", error);
    }

  });


  /* =====================================================
     SOFT DELETE NOTIFICATION
  ===================================================== */

  socket.on("notification:delete", async (notificationId: string) => {

    try {

      await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId
        },
        {
          isDeleted: true
        }
      );

      await notificationGateway.syncUser(userId);

    } catch (error) {
      console.error("Notification delete error:", error);
    }

  });

};
