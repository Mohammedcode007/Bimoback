import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  searchUsers,
  getUserProfile,
  getFriends,
  getUnreadNotificationCount,
  blockUser,
  unblockUser,
  updateProfile,
  getBlockedUsers,
  updateOnlineStatus,
  updateMyProfileSettings,
  getMyFullUser
} from "../controllers/user.controller";

const router = Router();

router.get("/search", protect, searchUsers);
router.get("/profile/:userId", protect, getUserProfile);
router.get("/friends", protect, getFriends);
router.get("/notifications/unread-count", protect, getUnreadNotificationCount);
router.get("/blocked", protect, getBlockedUsers);   // ✅ مهم جداً
router.patch("/me/settings", protect, updateMyProfileSettings); // نفس الكنترولر
router.get("/me/full", protect, getMyFullUser);
router.post("/block", protect, blockUser);
router.post("/unblock", protect, unblockUser);
router.patch("/update", protect, updateProfile);
router.post("/status", protect, updateOnlineStatus);
export default router;
