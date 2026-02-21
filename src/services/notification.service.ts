import Notification from "../models/Notification";
import notificationGateway from "./notification.gateway";

class NotificationService {

  /* =====================================================
     CREATE NOTIFICATION
  ===================================================== */

  async create(data: any) {


    const notification = await Notification.create(data);


    // نجلبه مرة أخرى مع populate للتأكد من sender
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "username avatar isVerified");


    await notificationGateway.send(
      data.recipient.toString(),
      populatedNotification
    );


    return populatedNotification;
  }


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
