import { Request, Response } from "express";
import blockService from "../services/block.service";

function getAuthUserId(req: Request) {
  return String(
    (req as any).user?.id ||
      (req as any).user?._id ||
      (req as any).userId ||
      ""
  );
}

export const blockTarget = async (req: Request, res: Response) => {
  try {
    const actorId = getAuthUserId(req);

    const {
      scope,
      targetType,
      targetUserId,
      reason,
      expiresAt,
      includeIdentity,
      includeDevice,
      includeIp,
    } = req.body;

    if (!["rooms", "tweets", "app"].includes(String(scope))) {
      return res.status(400).json({
        success: false,
        message: "Invalid block scope",
      });
    }

    if (!["user", "identity", "device", "ip", "mixed"].includes(String(targetType))) {
      return res.status(400).json({
        success: false,
        message: "Invalid target type",
      });
    }

    const result = await blockService.createBlock({
      scope,
      targetType,
      targetUserId,
      actorId,
      reason,
      req,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      includeIdentity: includeIdentity !== false,
      includeDevice: includeDevice !== false,
      includeIp: includeIp === true,
    });

    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message || "Block failed",
    });
  }
};

export const listBlocks = async (req: Request, res: Response) => {
  try {
    const scope = req.query.scope ? String(req.query.scope) : undefined;

    const items = await blockService.listBlocks(scope as any);

    return res.json({
      success: true,
      items,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message || "Failed to list blocks",
    });
  }
};

export const unblockRule = async (req: Request, res: Response) => {
  try {
    const rawRuleId = req.params.ruleId;

    const ruleId = Array.isArray(rawRuleId)
      ? rawRuleId[0]
      : String(rawRuleId || "");

    if (!ruleId) {
      return res.status(400).json({
        success: false,
        message: "ruleId is required",
      });
    }

    const result = await blockService.deactivateBlock(ruleId);

    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message || "Unblock failed",
    });
  }
};