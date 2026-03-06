import Notification from "../models/Notification";
import notificationGateway from "./notification.gateway";
import { sendFCMToUser } from "./pushFCM.service";

class NotificationService {
  /* =====================================================
     CREATE NOTIFICATION
  ===================================================== */
  async create(data: any) {
    console.log("🔔 NotificationService.create called");
    console.log("📦 Incoming data:", {
      recipient: data?.recipient?.toString?.() || data?.recipient,
      sender: data?.sender?.toString?.() || data?.sender,
      type: data?.type,
      body: data?.body,
      isRead: data?.isRead,
      isDeleted: data?.isDeleted,
    });

    console.log("📝 Saving notification to database...");
    const notification = await Notification.create(data);

    console.log("✅ Notification saved");
    console.log("🆔 Notification ID:", notification?._id?.toString());

    console.log("🔎 Loading populated notification...");
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "username avatar isVerified");

    console.log("✅ Populated notification loaded");
    console.log("👤 Populated sender:", populatedNotification?.sender || null);

    /* 1) In-app via Socket */
    console.log("📡 Sending in-app notification via socket...");
    await notificationGateway.send(
      data.recipient.toString(),
      populatedNotification
    );
    console.log("✅ In-app socket notification sent");

    /* 2) Push via FCM (best-effort) */
    const title = "Bimo";
    const body = data?.body || "لديك إشعار جديد";

    console.log("📲 Preparing FCM push...");
    console.log("📨 FCM payload:", {
      recipient: data.recipient.toString(),
      title,
      body,
      data: {
        type: String(data?.type || "notification"),
        notificationId: String(notification._id),
      },
    });

    try {
      console.log("🚀 Calling sendFCMToUser...");
      await sendFCMToUser(data.recipient.toString(), {
        title,
        body,
        data: {
          type: String(data?.type || "notification"),
          notificationId: String(notification._id),
        },
      });
      console.log("✅ FCM push sent successfully");
    } catch (e) {
      console.error("❌ FCM send error:", e);
    }

    console.log("🏁 NotificationService.create finished");
    return populatedNotification;
  }

  /* =====================================================
     MARK AS READ
  ===================================================== */
  async markAsRead(userId: string, notificationId: string) {
    console.log("📖 markAsRead called", { userId, notificationId });

    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { returnDocument: "after" }
    );

    console.log("✅ markAsRead DB update result:", updated ? updated._id : null);

    console.log("🔄 Syncing notifications to socket...");
    await notificationGateway.syncUser(userId);
    console.log("✅ Notification sync completed");

    return updated;
  }

  /* =====================================================
     GET USER NOTIFICATIONS
  ===================================================== */
  async getUserNotifications(userId: string) {
    console.log("📥 getUserNotifications called for user:", userId);

    const notifications = await Notification.find({
      recipient: userId,
      isDeleted: false,
    })
      .populate("sender", "username avatar isVerified")
      .sort({ createdAt: -1 });

    console.log("✅ Notifications fetched:", notifications.length);

    return notifications;
  }
}

export default new NotificationService();