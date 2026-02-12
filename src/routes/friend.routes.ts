import { Router } from "express";
import friendController from "../controllers/friend.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.use(protect);

/* =========================
   FRIEND ACTIONS
========================= */

router.post("/:id/send", friendController.send);
router.post("/:id/accept", friendController.accept);
router.delete("/:id/remove", friendController.remove);
router.post("/:id/block", friendController.block);
router.post("/:id/unblock", friendController.unblock);
router.get("/", friendController.list);
router.post("/:id/cancel", friendController.cancel);

export default router;
