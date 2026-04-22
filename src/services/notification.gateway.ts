import { getIO } from "../config/socket";
import Notification from "../models/Notification";

class NotificationGateway {

  /* =====================================================
     SEND SINGLE NOTIFICATION
  ===================================================== */

  async send(userId: string, notification: any) {

  

    const io = getIO();

    io.to(userId).emit("notification:new", notification);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false
    });


    io.to(userId).emit("notification:count", unreadCount);

  }



  /* =====================================================
     SYNC USER NOTIFICATIONS
  ===================================================== */

  async syncUser(userId: string) {


    const io = getIO();

    const notifications = await Notification.find({
      recipient: userId,
      isDeleted: false
    })
      .populate("sender", "username avatar isVerified")
      .sort({ createdAt: -1 })
      .limit(20);


    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false
    });


    io.to(userId).emit("notification:sync", {
      notifications,
      unreadCount
    });

  }
}

export default new NotificationGateway();
