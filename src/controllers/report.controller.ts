// src/controllers/report.controller.ts
import { Request, Response, NextFunction } from "express";
import { createReport } from "../services/report.service";

async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const reporterId = req.user?.id;
    const { targetType, targetId, reason, details } = req.body;

    const report = await createReport({
      reporterId,
      targetType,
      targetId,
      reason,
      details,
    });

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  create,
};