import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as controller from "../controllers/follow.controller";

const router = Router();

router.use(protect);

router.post("/:id", controller.toggleFollow);
router.get("/:id/followers", controller.getFollowers);
router.get("/:id/following", controller.getFollowing);
router.get("/:id/status", controller.checkStatus);
router.post("/:id/block", controller.blockUser);

export default router;
