// src/routes/report.routes.ts
import { Router } from "express";
import reportController from "../controllers/report.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", protect, reportController.create);

export default router;