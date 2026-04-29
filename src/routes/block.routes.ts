import { Router } from "express";
import {
  blockTarget,
  listBlocks,
  unblockRule,
} from "../controllers/block.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", protect, blockTarget);

router.get("/", protect, listBlocks);

router.patch("/:ruleId/unblock", protect, unblockRule);

export default router;