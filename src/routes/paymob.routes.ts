import { Router } from "express";
import { createPaymobTopup } from "../controllers/paymob.controller";
import { paymobWebhook } from "../controllers/paymob.webhook";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// إنشاء عملية دفع (محمية)
router.post("/create", protect, createPaymobTopup);

// webhook (لا تضع protect)
router.post("/webhook", paymobWebhook);

export default router;