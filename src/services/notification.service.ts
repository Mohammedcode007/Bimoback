import Notification from "../models/Notification";

class NotificationService {

  async create(data: any) {
    return await Notification.create(data);
  }

  async markAsRead(userId: string, notificationId: string) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  async getUserNotifications(userId: string) {
    return await Notification.find({
      recipient: userId,
      isDeleted: false
    }).sort({ createdAt: -1 });
  }
}

export default new NotificationService();
