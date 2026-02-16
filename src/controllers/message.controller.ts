import { Request, Response } from "express";
import mongoose from "mongoose";
import messageService from "../services/message.service";
import chatService from "../services/chat.service";

class MessageController {

  /* ================= SEND ================= */

  async send(
    req: Request<{}, {}, {
      chatId: string;
      content?: string;
      type: string;
      media?: any;
      replyTo?: string;
    }>,
    res: Response
  ) {

    try {

      const userId = req.user!.id;
      const { chatId, content, type, media, replyTo } = req.body;

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          message: "Valid Chat ID required"
        });
      }

      if (!type) {
        return res.status(400).json({
          message: "Message type required"
        });
      }

      const chat = await chatService.getChatById(chatId);

      if (!chat) {
        return res.status(404).json({
          message: "Chat not found"
        });
      }

      const isParticipant = chat.participants.some(
        (p: any) => p._id.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const message = await messageService.sendMessage(
        userId,
        chatId,
        content || "",
        type,
        media,
        replyTo
      );

      res.json(message);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /* ================= LIST ================= */

  async list(
    req: Request<{ chatId: string }, {}, {}, { page?: string }>,
    res: Response
  ) {

    try {

      const userId = req.user!.id;
      const { chatId } = req.params;
      const page = Number(req.query.page) || 1;

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          message: "Valid Chat ID required"
        });
      }

      const chat = await chatService.getChatById(chatId);

      if (!chat) {
        return res.status(404).json({
          message: "Chat not found"
        });
      }

      const isParticipant = chat.participants.some(
        (p: any) => p._id.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const messages = await messageService.getMessages(
        chatId,
        userId,
        page
      );

      res.json(messages);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /* ================= SEARCH ================= */

  async search(
    req: Request<{ chatId: string }, {}, {}, { q?: string }>,
    res: Response
  ) {

    try {

      const userId = req.user!.id;
      const { chatId } = req.params;
      const query = req.query.q;

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          message: "Valid Chat ID required"
        });
      }

      if (!query) {
        return res.status(400).json({
          message: "Search query required"
        });
      }

      const chat = await chatService.getChatById(chatId);

      if (!chat) {
        return res.status(404).json({
          message: "Chat not found"
        });
      }

      const isParticipant = chat.participants.some(
        (p: any) => p._id.toString() === userId
      );

      if (!isParticipant) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      const results = await messageService.searchMessages(
        chatId,
        userId,
        query
      );

      res.json(results);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /* ================= MARK AS SEEN ================= */

  async markAsSeen(
    req: Request<{}, {}, { chatId: string }>,
    res: Response
  ) {

    try {

      const userId = req.user!.id;
      const { chatId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          message: "Valid Chat ID required"
        });
      }

      await messageService.markAsSeen(userId, chatId);

      res.json({ success: true });

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /* ================= REACTION ================= */

  async toggleReaction(
    req: Request<{}, {}, { messageId: string; emoji: string }>,
    res: Response
  ) {

    try {

      const userId = req.user!.id;
      const { messageId, emoji } = req.body;

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({
          message: "Valid Message ID required"
        });
      }

      const reactions = await messageService.toggleReaction(
        userId,
        messageId,
        emoji
      );

      res.json({ reactions });

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /* ================= DELETE ================= */

  async delete(
    req: Request<{}, {}, { messageId: string; type: "me" | "everyone" }>,
    res: Response
  ) {

    try {

      const userId = req.user!.id;
      const { messageId, type } = req.body;

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({
          message: "Valid Message ID required"
        });
      }

      if (type === "me") {
        await messageService.deleteForMe(userId, messageId);
      }

      if (type === "everyone") {
        await messageService.deleteForEveryone(userId, messageId);
      }

      res.json({ success: true });

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /* ================= EDIT ================= */

  async edit(
    req: Request<{}, {}, { messageId: string; content: string }>,
    res: Response
  ) {

    try {

      const userId = req.user!.id;
      const { messageId, content } = req.body;

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({
          message: "Valid Message ID required"
        });
      }

      const message = await messageService.editMessage(
        userId,
        messageId,
        content
      );

      res.json(message);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

}

export default new MessageController();
