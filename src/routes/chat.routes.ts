import { Router } from "express";
import chatController from "../controllers/chat.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.use(protect);

/* 🔥 مهم جدًا: المسارات الثابتة أولًا */

router.post("/create", chatController.create);
router.post("/delete", chatController.deleteChat);
router.get("/total-unread", chatController.totalUnread);
router.get("/", chatController.list);
router.get("/:chatId", chatController.getOne);


export default router;
