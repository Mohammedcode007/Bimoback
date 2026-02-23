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
// ✅ تعديل meta (Admin فقط داخل الكنترولر)
router.patch("/items/:id/meta", protect, StoreController.updateItemMeta);
router.patch("/items/:id/meta/set", protect, StoreController.setItemMetaFields);
// عرض مخزون المستخدم + الرصيد
router.get("/me/inventory", protect, StoreController.myInventory);

// ✅ شراء Coinz (للمستخدم نفسه فقط - Mock)
router.post("/coinz/buy", protect, StoreController.buyCoinz);
router.post("/items", protect, StoreController.createItem);
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