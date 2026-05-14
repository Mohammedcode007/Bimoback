import { Router } from "express";
import favoriteRoomController from "../controllers/favoriteRoom.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

/**
 * قائمة الغرف المفضلة للمستخدم الحالي
 * GET /api/rooms/favorites
 */
router.get(
  "/favorites",
  protect,
  favoriteRoomController.list.bind(favoriteRoomController)
);

/**
 * معرفة هل الغرفة مفضلة أم لا
 * GET /api/rooms/:roomId/favorite
 */
router.get(
  "/:roomId/favorite",
  protect,
  favoriteRoomController.check.bind(favoriteRoomController)
);

/**
 * إضافة غرفة للمفضلة
 * POST /api/rooms/:roomId/favorite
 */
router.post(
  "/:roomId/favorite",
  protect,
  favoriteRoomController.add.bind(favoriteRoomController)
);

/**
 * تبديل الحالة favorite/unfavorite
 * PATCH /api/rooms/:roomId/favorite/toggle
 */
router.patch(
  "/:roomId/favorite/toggle",
  protect,
  favoriteRoomController.toggle.bind(favoriteRoomController)
);

/**
 * حذف غرفة من المفضلة
 * DELETE /api/rooms/:roomId/favorite
 */
router.delete(
  "/:roomId/favorite",
  protect,
  favoriteRoomController.remove.bind(favoriteRoomController)
);

export default router;