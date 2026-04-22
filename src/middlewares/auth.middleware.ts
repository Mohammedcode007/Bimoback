import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

/**
 * ✅ تعديل protect ليمرّر role داخل req.user
 * - يقرأ المستخدم من DB (بدون الاعتماد على JWT للـ role)
 * - يضع: req.user = { id, role }
 *
 * ملاحظة TypeScript:
 * - أنت تستخدم req.user (حقل غير موجود افتراضياً على Express Request)
 * - الأفضل أن يكون عندك global type augmentation، لكن هنا سنستخدم casting بشكل آمن.
 */

type JwtPayload = { id: string };

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = String(req.headers.authorization || "");

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    if (!decoded?.id || !String(decoded.id).trim()) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ✅ بدل exists نقرأ role مباشرة
    const user = await User.findById(decoded.id, { role: 1 }).lean();

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    // ✅ ضع role في req.user
    // لو role غير موجود لأي سبب -> user
    (req as any).user = {
      id: String(decoded.id),
      role: String((user as any).role || "user")
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Token failed" });
  }
};