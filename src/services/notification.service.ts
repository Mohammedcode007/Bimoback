import Notification from "../models/Notification";
import notificationGateway from "./notification.gateway";
import { sendFCMToUser } from "./pushFCM.service";

class NotificationService {

  /* =====================================================
     CREATE NOTIFICATION
  ===================================================== */
 async create(data: any) {
  const notification = await Notification.create(data);

  const populatedNotification = await Notification.findById(notification._id)
    .populate("sender", "username avatar isVerified");

  // 1) In-app via Socket
  await notificationGateway.send(
    data.recipient.toString(),
    populatedNotification
  );

  // 2) Push via FCM (best-effort)
  const title = "Bimo";
  const body = data?.message || "لديك إشعار جديد";

  try {
    await sendFCMToUser(data.recipient.toString(), {
      title,
      body,
      data: {
        type: String(data?.type || "notification"),
        notificationId: String(notification._id),
      },
    });
  } catch (e) {
    console.error("FCM send error:", e);
  }

  return populatedNotification;
}
  // async create(data: any) {


  //   const notification = await Notification.create(data);


  //   // نجلبه مرة أخرى مع populate للتأكد من sender
  //   const populatedNotification = await Notification.findById(notification._id)
  //     .populate("sender", "username avatar isVerified");


  //   await notificationGateway.send(
  //     data.recipient.toString(),
  //     populatedNotification
  //   );


  //   return populatedNotification;
  // }


  /* =====================================================
     MARK AS READ
  ===================================================== */

  async markAsRead(userId: string, notificationId: string) {

 
    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      {returnDocument: "after"
 }
    );


    await notificationGateway.syncUser(userId);


    return updated;
  }


  /* =====================================================
     GET USER NOTIFICATIONS
  ===================================================== */

  async getUserNotifications(userId: string) {


    const notifications = await Notification.find({
      recipient: userId,
      isDeleted: false
    })
      .populate("sender", "username avatar isVerified")
      .sort({ createdAt: -1 });


    return notifications;
  }

}

export default new NotificationService();
