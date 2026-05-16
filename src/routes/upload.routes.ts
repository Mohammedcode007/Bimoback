// src/routes/upload.routes.ts

import { Router } from "express";
import {
  uploadMultiple,
  uploadSingle,
} from "../controllers/upload.controller";
import {
  uploadMultipleFiles,
  uploadSingleFile,
} from "../middlewares/upload.middleware";

// لو عندك auth middleware استخدمه هنا
// import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/single", uploadSingleFile, uploadSingle);

router.post("/multiple", uploadMultipleFiles, uploadMultiple);

export default router;