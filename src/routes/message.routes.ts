// routes/message.routes.ts

import { Router } from "express";
import messageController from "../controllers/message.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.get("/:chatId", protect, messageController.list);

router.get(
  "/:chatId/search",
  protect,
  messageController.search
);

router.delete(
  "/delete",
  protect,
  messageController.delete
);

export default router;
