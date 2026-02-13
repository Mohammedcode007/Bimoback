import Notification from "../models/Notification";
import notificationGateway from "./notification.gateway";

class NotificationService {

  /* =====================================================
     CREATE NOTIFICATION
  ===================================================== */

  async create(data: any) {

    console.log("📌 Creating notification with data:", data);

    const notification = await Notification.create(data);

    console.log("✅ Notification saved in DB:", notification);

    // نجلبه مرة أخرى مع populate للتأكد من sender
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "username avatar isVerified");

    console.log("🔎 Populated notification before sending:", populatedNotification);

    await notificationGateway.send(
      data.recipient.toString(),
      populatedNotification
    );

    console.log("🚀 Notification sent to gateway");

    return populatedNotification;
  }


  /* =====================================================
     MARK AS READ
  ===================================================== */

  async markAsRead(userId: string, notificationId: string) {

    console.log("📌 Mark as read:", {
      userId,
      notificationId
    });

    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    console.log("✅ Updated notification:", updated);

    await notificationGateway.syncUser(userId);

    console.log("🔄 Synced notifications after read");

    return updated;
  }


  /* =====================================================
     GET USER NOTIFICATIONS
  ===================================================== */

  async getUserNotifications(userId: string) {

    console.log("📌 Fetching notifications for user:", userId);

    const notifications = await Notification.find({
      recipient: userId,
      isDeleted: false
    })
      .populate("sender", "username avatar isVerified")
      .sort({ createdAt: -1 });

    console.log("📦 Notifications returned:", notifications);

    return notifications;
  }

}

export default new NotificationService();
