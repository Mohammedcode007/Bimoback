import { Request, Response } from "express";
import favoriteRoomService from "../services/favoriteRoom.service";

type AuthRequest = Request & {
  user?: {
    id?: string;
    _id?: string;
    userId?: string;
  };
};

function getAuthUserId(req: AuthRequest) {
  return String(
    req.user?.id ||
      req.user?._id ||
      req.user?.userId ||
      ""
  );
}

class FavoriteRoomController {
  async add(req: AuthRequest, res: Response) {
    try {
      const userId = getAuthUserId(req);
      const roomId = String(req.params.roomId || "");

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await favoriteRoomService.add(userId, roomId);

      return res.json({
        success: true,
        message: "Room added to favorites",
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to add favorite room",
      });
    }
  }

  async remove(req: AuthRequest, res: Response) {
    try {
      const userId = getAuthUserId(req);
      const roomId = String(req.params.roomId || "");

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await favoriteRoomService.remove(userId, roomId);

      return res.json({
        success: true,
        message: "Room removed from favorites",
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to remove favorite room",
      });
    }
  }

  async toggle(req: AuthRequest, res: Response) {
    try {
      const userId = getAuthUserId(req);
      const roomId = String(req.params.roomId || "");

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await favoriteRoomService.toggle(userId, roomId);

      return res.json({
        success: true,
        message: result.isFavorite
          ? "Room added to favorites"
          : "Room removed from favorites",
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to toggle favorite room",
      });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const userId = getAuthUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 30);

      const result = await favoriteRoomService.list(userId, page, limit);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to fetch favorite rooms",
      });
    }
  }

  async check(req: AuthRequest, res: Response) {
    try {
      const userId = getAuthUserId(req);
      const roomId = String(req.params.roomId || "");

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await favoriteRoomService.isFavorite(userId, roomId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to check favorite room",
      });
    }
  }
}

export default new FavoriteRoomController();