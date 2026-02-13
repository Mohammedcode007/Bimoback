import { getIO } from "../config/socket";
import Notification from "../models/Notification";

class NotificationGateway {

  /* =====================================================
     SEND SINGLE NOTIFICATION
  ===================================================== */

  async send(userId: string, notification: any) {

    console.log("🚀 [Gateway] Sending notification to:", userId);
    console.log("📦 [Gateway] Notification payload:", notification);

    const io = getIO();

    io.to(userId).emit("notification:new", notification);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false
    });

    console.log("🔢 [Gateway] Unread count:", unreadCount);

    io.to(userId).emit("notification:count", unreadCount);

    console.log("✅ [Gateway] Notification + Count emitted");
  }



  /* =====================================================
     SYNC USER NOTIFICATIONS
  ===================================================== */

  async syncUser(userId: string) {

    console.log("🔄 [Gateway] Syncing notifications for user:", userId);

    const io = getIO();

    const notifications = await Notification.find({
      recipient: userId,
      isDeleted: false
    })
      .populate("sender", "username avatar isVerified")
      .sort({ createdAt: -1 })
      .limit(20);

    console.log("📦 [Gateway] Notifications from DB:", notifications);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false
    });

    console.log("🔢 [Gateway] Sync unread count:", unreadCount);

    io.to(userId).emit("notification:sync", {
      notifications,
      unreadCount
    });

    console.log("✅ [Gateway] Sync emitted successfully");
  }
}

export default new NotificationGateway();
