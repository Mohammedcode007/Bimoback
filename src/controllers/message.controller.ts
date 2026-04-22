// controllers/message.controller.ts

import { Request, Response } from "express";
import messageService from "../services/message.service";
import Chat from "../models/Chats";
import mongoose from "mongoose";

class MessageController {

  /* =====================================================
     GET MESSAGES (Pagination)
  ===================================================== */

async list(req: Request, res: Response) {
  const startTime = Date.now();

  try {

    const userId = req.user!.id;
    const chatIdParam = req.params.chatId;

    const chatId =
      Array.isArray(chatIdParam)
        ? chatIdParam[0]
        : chatIdParam;

    const page = Number(req.query.page) || 1;

  

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(403).json({
        message: "Access denied"
      });
    }


    const messages = await messageService.getMessages(
      chatId,
      userId,
      page
    );


    if (messages.length > 0) {

    }

 

    return res.json(messages);

  } catch (error: any) {
    console.error("❌ Message list error:", error);

    return res.status(400).json({
      message: error.message || "Failed to fetch messages"
    });
  }
}

  /* =====================================================
     SEARCH INSIDE CHAT
  ===================================================== */

  async search(req: Request, res: Response) {

    try {

      const userId = req.user!.id;
      const chatIdParam = req.params.chatId;

      const chatId =
        Array.isArray(chatIdParam)
          ? chatIdParam[0]
          : chatIdParam;
      const { q } = req.query;

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ message: "Invalid chat id" });
      }

      if (!q || String(q).trim().length < 1) {
        return res.status(400).json({
          message: "Search query required"
        });
      }

      const chat = await Chat.findOne({
        _id: chatId,
        participants: userId
      });

      if (!chat) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const results = await messageService.search(
        chatId,
        userId,
        String(q)
      );

      return res.json(results);

    } catch (error: any) {

      console.error("Message search error:", error);

      return res.status(400).json({
        message: error.message || "Search failed"
      });
    }
  }

  /* =====================================================
     DELETE MESSAGE
  ===================================================== */

  async delete(req: Request, res: Response) {

    try {

      const userId = req.user!.id;
      const { messageId, type } = req.body;

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({
          message: "Invalid message id"
        });
      }

      if (!["me", "everyone"].includes(type)) {
        return res.status(400).json({
          message: "Invalid delete type"
        });
      }

      if (type === "me") {
        await messageService.deleteForMe(
          messageId,
          userId
        );
      }

      if (type === "everyone") {
        await messageService.deleteForEveryone(
          messageId,
          userId
        );
      }

      return res.json({ success: true });

    } catch (error: any) {

      console.error("Message delete error:", error);

      return res.status(400).json({
        message: error.message || "Delete failed"
      });
    }
  }

}

export default new MessageController();
