// routes/contactUs.routes.ts
import { Router } from "express";
import { contactUsSend } from "../controllers/contactUs.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// POST /contact-us
router.post("/",protect, contactUsSend);

export default router;