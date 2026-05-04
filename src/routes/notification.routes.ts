import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";

import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  saveDeviceToken,
  sendTestNotification,
  removeDeviceToken,
  markRelatedNotificationsAsRead
} from "../controllers/notification.controller";

const router = Router();

/* ======================================================
   ALL ROUTES PROTECTED
====================================================== */

router.use(protect);

/* ======================================================
   ROUTES
====================================================== */

/* GET ALL */
router.get("/", getUserNotifications);
router.post("/test-send", sendTestNotification);
/* GET UNREAD COUNT */
router.get("/unread-count", getUnreadCount);
router.patch("/mark-related-read", markRelatedNotificationsAsRead);

/* MARK ONE */
router.patch("/:id/read", markAsRead);

/* MARK ALL */
router.patch("/read-all", markAllAsRead);

/* DELETE */
router.delete("/:id", deleteNotification);
router.post("/device-token", saveDeviceToken);
router.delete("/device-token",  removeDeviceToken);

export default router;
