import { Router } from "express";
import messageController from "../controllers/message.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

/* 🔐 حماية جميع المسارات */
router.use(protect);

/* ================= CREATE ================= */

router.post("/send", messageController.send);

/* ================= REACTION ================= */

router.post("/reaction", messageController.toggleReaction);

/* ================= EDIT ================= */

router.put("/edit", messageController.edit);

/* ================= DELETE ================= */

router.delete("/delete", messageController.delete);

/* ================= MARK AS SEEN ================= */

router.post("/seen", messageController.markAsSeen);

/* ================= SEARCH ================= */
/* ⚠️ يجب أن يكون قبل :chatId */

router.get("/:chatId/search", messageController.search);

/* ================= LIST ================= */

router.get("/:chatId", messageController.list);

export default router;
