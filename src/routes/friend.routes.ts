import { Router } from "express";
import friendController from "../controllers/friend.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.use(protect);

/* =========================
   FRIEND ACTIONS
========================= */

router.get("/suggested", friendController.suggested);

router.get("/", friendController.list);

router.post("/:id/send", friendController.send);
router.post("/:id/accept", friendController.accept);
router.post("/:id/cancel", friendController.cancel);

router.delete("/:id/remove", friendController.remove);

router.post("/:id/block", friendController.block);
router.post("/:id/unblock", friendController.unblock);

export default router;