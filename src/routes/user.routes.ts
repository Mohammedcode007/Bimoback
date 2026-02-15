import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  searchUsers,
  getUserProfile,
  getFriends,
  getUnreadNotificationCount,
  blockUser,
  unblockUser,
  updateProfile
} from "../controllers/user.controller";

const router = Router();

router.get("/search", protect, searchUsers);
router.get("/profile/:userId", protect, getUserProfile);
router.get("/friends", protect, getFriends);
router.get("/notifications/unread-count", protect, getUnreadNotificationCount);

router.post("/block", protect, blockUser);
router.post("/unblock", protect, unblockUser);
router.patch("/update", protect, updateProfile);

export default router;
