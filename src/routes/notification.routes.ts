import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";

import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
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

/* GET UNREAD COUNT */
router.get("/unread-count", getUnreadCount);

/* MARK ONE */
router.patch("/:id/read", markAsRead);

/* MARK ALL */
router.patch("/read-all", markAllAsRead);

/* DELETE */
router.delete("/:id", deleteNotification);

export default router;
