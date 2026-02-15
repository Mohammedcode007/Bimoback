// auth.routes.ts
import { Router } from "express";
import {
  register,
  login,
  logout,
  toggleInvisible
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);
router.patch("/presence/invisible", protect, toggleInvisible);

export default router;
