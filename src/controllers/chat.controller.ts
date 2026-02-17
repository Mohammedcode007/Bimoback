// controllers/chat.controller.ts

import { Request, Response } from "express";
import chatService from "../services/chat.service";
import mongoose from "mongoose";

class ChatController {

  /* =====================================================
     CREATE OR GET PRIVATE CHAT
  ===================================================== */

  async create(req: Request, res: Response) {

    try {

      const userId = req.user!.id;
      const { targetId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({
          message: "Invalid target id"
        });
      }

      const chat = await chatService.createOrGetPrivateChat(
        userId,
        targetId
      );

      return res.json(chat);

    } catch (error: any) {

      console.error("Chat create error:", error);

      return res.status(400).json({
        message: error.message || "Failed to create chat"
      });
    }
  }

  /* =====================================================
     GET MY CHATS
  ===================================================== */

  async list(req: Request, res: Response) {

    try {

      const userId = req.user!.id;

      const chats = await chatService.getUserChats(userId);

      return res.json(chats);

    } catch (error: any) {

      console.error("Chat list error:", error);

      return res.status(400).json({
        message: error.message || "Failed to fetch chats"
      });
    }
  }

  /* =====================================================
     DELETE CHAT FOR ME
  ===================================================== */

  async delete(req: Request, res: Response) {

    try {

      const userId = req.user!.id;

      const chatIdParam = req.params.chatId;

      const chatId =
        Array.isArray(chatIdParam)
          ? chatIdParam[0]
          : chatIdParam;

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          message: "Invalid chat id"
        });
      }

      await chatService.deleteForMe(chatId, userId);

      return res.json({ success: true });

    } catch (error: any) {

      console.error("Chat delete error:", error);

      return res.status(400).json({
        message: error.message || "Delete failed"
      });
    }
  }
/* =====================================================
   MARK AS SEEN
===================================================== */

async markAsSeen(req: Request, res: Response) {

  try {

    const userId = req.user!.id;

    const chatIdParam = req.params.chatId;

    const chatId =
      Array.isArray(chatIdParam)
        ? chatIdParam[0]
        : chatIdParam;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    await chatService.markAsSeen(chatId, userId);

    return res.json({ success: true });

  } catch (error: any) {

    return res.status(400).json({
      message: error.message || "Failed to mark as seen"
    });
  }
}

  /* =====================================================
     GET TOTAL UNREAD
  ===================================================== */

  async totalUnread(req: Request, res: Response) {

    try {

      const userId = req.user!.id;

      const total = await chatService.getTotalUnread(userId);

      return res.json({ total });

    } catch (error: any) {

      console.error("Total unread error:", error);

      return res.status(400).json({
        message: error.message || "Failed to get unread count"
      });
    }
  }

}

export default new ChatController();
