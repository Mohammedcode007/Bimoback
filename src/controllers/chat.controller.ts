import { Request, Response } from "express";
import mongoose from "mongoose";
import chatService from "../services/chat.service";
import User from "../models/User";
import Friend from "../models/Friend";

class ChatController {

  /* ================= CREATE CHAT ================= */

  async create(req: Request, res: Response) {

    try {

      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const { targetId } = req.body;

      if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({
          message: "Valid target user required"
        });
      }

      const targetObjectId = new mongoose.Types.ObjectId(targetId);

      if (userId.equals(targetObjectId)) {
        return res.status(400).json({
          message: "Cannot chat with yourself"
        });
      }

      const targetUser = await User.findById(targetObjectId);

      if (!targetUser) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      /* 🔥 منع الشات لو تم الحظر */

      if (targetUser.blockedUsers.some(
        id => id.equals(userId)
      )) {
        return res.status(403).json({
          message: "You are blocked by this user"
        });
      }

      /* 🔥 تحقق الصداقة */

      const relation = await Friend.findOne({
        $or: [
          { requester: userId, recipient: targetObjectId, status: "accepted" },
          { requester: targetObjectId, recipient: userId, status: "accepted" }
        ]
      });

      if (!relation) {
        return res.status(403).json({
          message: "You can only chat with friends"
        });
      }

      const chat = await chatService.getOrCreateChat(
        userId.toString(),
        targetObjectId.toString()
      );

      res.json(chat);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /* ================= LIST CHATS ================= */

  async list(req: Request, res: Response) {

    try {

      const userId = req.user!.id;

      const chats = await chatService.listChats(userId);

      res.json(chats);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /* ================= GET SINGLE CHAT ================= */

  async getOne(req: Request, res: Response) {

    try {

      const userId = new mongoose.Types.ObjectId(req.user!.id);

      const chatId = Array.isArray(req.params.chatId)
        ? req.params.chatId[0]
        : req.params.chatId;

      if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
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

      /* 🔥 تأكد أن المستخدم مشارك */

      const isParticipant = chat.participants.some(
        (p: any) => p._id?.equals(userId)
      );

      if (!isParticipant) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      /* 🔥 إذا الشات محذوف لهذا المستخدم */

      if (chat.deletedFor?.some(
        (id: any) => id.equals(userId)
      )) {
        return res.status(404).json({
          message: "Chat not found"
        });
      }

      res.json(chat);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /* ================= TOTAL UNREAD ================= */

  async totalUnread(req: Request, res: Response) {

    try {

      const userId = req.user!.id;

      const total = await chatService.getTotalUnread(userId);

      res.json({ totalUnread: total });

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /* ================= DELETE CHAT (SOFT) ================= */

  async deleteChat(req: Request, res: Response) {

    try {

      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const { chatId } = req.body;

      if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
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
        (p: any) => p._id?.equals(userId)
      );

      if (!isParticipant) {
        return res.status(403).json({
          message: "Access denied"
        });
      }

      await chatService.deleteChatForUser(
        userId.toString(),
        chatId
      );

      res.json({ success: true });

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

}

export default new ChatController();
