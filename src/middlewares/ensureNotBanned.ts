// داخل auth.middleware أو middleware جديد
import User from "../models/User";

export async function ensureNotBanned(req: any, res: any, next: any) {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const user = await User.findById(userId).select("isBanned banExpiresAt");
    if (!user) return next();

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "This account is restricted",
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}