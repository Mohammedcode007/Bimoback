// auth.routes.ts
import { Router } from "express";
import {
  register,
  login,
  logout,
  toggleInvisible,
  googleAuth,
  forgotPassword,
  verifyResetOtp,
  resetPassword
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/google", googleAuth);

router.patch("/presence/invisible", protect, toggleInvisible);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
export default router;
