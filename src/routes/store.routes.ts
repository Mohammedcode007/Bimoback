import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import StoreController from "../controllers/store.controller";

const router = Router();

/* =========================
   Public Store
========================= */

// عرض عناصر المتجر (يمكن جعله بدون protect لو أردت)
router.get("/items", protect, StoreController.listItems);

/* =========================
   User Store
========================= */

// عرض مخزون المستخدم + الرصيد
router.get("/me/inventory", protect, StoreController.myInventory);

// شراء عناصر
router.post("/purchase", protect, StoreController.purchase);

// تفعيل / تبديل عنصر
router.patch("/activate", protect, StoreController.activate);

/* =========================
   Admin Coinz Control
========================= */

// إضافة كوينز (Admin فقط)
router.patch("/coinz/credit", protect, StoreController.creditCoinz);

// خصم كوينز (Admin فقط)
router.patch("/coinz/debit", protect, StoreController.debitCoinz);

export default router;