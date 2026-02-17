// routes/chat.routes.ts

import { Router } from "express";
import chatController from "../controllers/chat.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

/* =====================================================
   STATIC ROUTES FIRST
===================================================== */

router.get(
  "/unread/total",
  protect,
  chatController.totalUnread
);
router.post(
  "/:chatId/seen",
  protect,
  chatController.markAsSeen
);

/* =====================================================
   CRUD ROUTES
===================================================== */

router.post(
  "/",
  protect,
  chatController.create
);

router.get(
  "/",
  protect,
  chatController.list
);

router.delete(
  "/:chatId",
  protect,
  chatController.delete
);

export default router;
