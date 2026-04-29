// // auth.routes.ts
// import { Router } from "express";
// import {
//   register,
//   login,
//   logout,
//   toggleInvisible,
//   googleAuth,
//   forgotPassword,
//   verifyResetOtp,
//   resetPassword
// } from "../controllers/auth.controller";
// import { protect } from "../middlewares/auth.middleware";

// const router = Router();

// router.post("/register", register);
// router.post("/login", login);
// router.post("/logout", protect, logout);
// router.post("/google", googleAuth);

// router.patch("/presence/invisible", protect, toggleInvisible);
// router.post("/forgot-password", forgotPassword);
// router.post("/verify-reset-otp", verifyResetOtp);
// router.post("/reset-password", resetPassword);
// export default router;

// auth.routes.ts
import { Router, RequestHandler } from "express";
import {
  register,
  login,
  logout,
  toggleInvisible,
  googleAuth,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
import { blockGuard } from "../middlewares/blockGuard";

const router = Router();

const asHandler = (handler: any) => handler as RequestHandler;

// ✅ مهم جدًا: منع المحظور من التطبيق من التسجيل أو الدخول
router.post("/register", blockGuard("app"), asHandler(register));
router.post("/login", blockGuard("app"), asHandler(login));
router.post("/google", blockGuard("app"), asHandler(googleAuth));

// ✅ logout يحتاج protect، وبعدها blockGuard("app") اختياري
// الأفضل ترك logout بدون blockGuard حتى يستطيع المحظور تسجيل الخروج من الجهاز
router.post("/logout", protect as RequestHandler, asHandler(logout));

// ✅ أي مستخدم محظور من التطبيق لا يغير الحالة
router.patch(
  "/presence/invisible",
  protect as RequestHandler,
  blockGuard("app"),
  asHandler(toggleInvisible)
);

// ✅ هذه تخص استرجاع الحساب.
// لو تريد منع المحظور تمامًا من استرجاع الحساب، أضف blockGuard("app").
// أنا أنصح تتركها بدون blockGuard في البداية.
router.post("/forgot-password", asHandler(forgotPassword));
router.post("/verify-reset-otp", asHandler(verifyResetOtp));
router.post("/reset-password", asHandler(resetPassword));

export default router;