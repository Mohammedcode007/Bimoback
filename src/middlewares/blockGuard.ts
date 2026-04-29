import { Request, Response, NextFunction } from "express";
import blockService from "../services/block.service";
import { BlockScope } from "../models/BlockRule";

function getAuthUserId(req: Request) {
  return String(
    (req as any).user?.id ||
      (req as any).user?._id ||
      (req as any).userId ||
      ""
  );
}

export const blockGuard = (scope: BlockScope) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthUserId(req);

      const result = await blockService.isBlocked({
        scope,
        userId,
        req,
      });

      if (result.blocked) {
        const message =
          scope === "app"
            ? "Your account or device is blocked from using the app."
            : scope === "rooms"
              ? "You are blocked from rooms."
              : "You are blocked from tweets.";

        return res.status(403).json({
          success: false,
          code: "BLOCKED",
          scope,
          message,
        });
      }

      return next();
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error?.message || "Block check failed",
      });
    }
  };
};