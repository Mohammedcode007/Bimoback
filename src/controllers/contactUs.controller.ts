// controllers/contactUs.controller.ts
import { Request, Response } from "express";
import MessageService from "../services/message.service";

export const contactUsSend = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; // عدّل حسب نظام التوثيق لديك
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { content } = req.body;
    const msg = await MessageService.sendContactUsText(userId, content);

    return res.status(201).json({
      message: "Sent",
      data: msg,
    });
  } catch (err: any) {
    return res.status(400).json({
      message: err?.message || "Failed",
    });
  }
};