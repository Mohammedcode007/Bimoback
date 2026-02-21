import { Request, Response } from "express";
import notificationService from "../services/notification.service";
import Notification from "../models/Notification";

/* ======================================================
   1️⃣ GET ALL NOTIFICATIONS
====================================================== */

export const getUserNotifications = async (
  req: Request,
  res: Response
) => {
  try {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }


    const notifications =
      await notificationService.getUserNotifications(req.user.id);

    res.json(notifications);

  } catch (error) {
    console.error("❌ GET NOTIFICATIONS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};


/* ======================================================
   2️⃣ GET UNREAD COUNT
====================================================== */

export const getUnreadCount = async (
  req: Request,
  res: Response
) => {
  try {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }


    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
      isDeleted: false
    });

    res.json({ unreadCount: count });

  } catch (error) {
    console.error("❌ UNREAD COUNT ERROR:", error);
    res.status(500).json({ message: "Failed to count unread notifications" });
  }
};


/* ======================================================
   3️⃣ MARK ONE AS READ
====================================================== */

export const markAsRead = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  try {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notificationId = req.params.id;


    const updated = await notificationService.markAsRead(
      req.user.id,
      notificationId
    );

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(updated);

  } catch (error) {
    console.error("❌ MARK AS READ ERROR:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};


/* ======================================================
   4️⃣ MARK ALL AS READ
====================================================== */

export const markAllAsRead = async (
  req: Request,
  res: Response
) => {
  try {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }


    await Notification.updateMany(
      {
        recipient: req.user.id,
        isRead: false,
        isDeleted: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({ success: true });

  } catch (error) {
    console.error("❌ MARK ALL ERROR:", error);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};


/* ======================================================
   5️⃣ DELETE NOTIFICATION
====================================================== */

export const deleteNotification = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  try {

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notificationId = req.params.id;


    const deleted = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: req.user.id
      },
      { isDeleted: true },
      { returnDocument: "after"
 }
    );

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ success: true });

  } catch (error) {
    console.error("❌ DELETE ERROR:", error);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};
