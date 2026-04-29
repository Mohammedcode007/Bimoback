import { Request } from "express";
import { Types } from "mongoose";
import BlockRule, {
  BlockScope,
  BlockTargetType,
} from "../models/BlockRule";
import User from "../models/User";
import { getRequestIdentity, sha256 } from "../utils/requestIdentity";

async function buildIdentityFromUserId(userId?: string) {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return "";
  }

  const user: any = await User.findById(userId)
    .select("_id email phone firebaseUid googleId atUsername username")
    .lean();

  if (!user) return "";

  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phone || "").trim();
  const firebaseUid = String(user.firebaseUid || "").trim();
  const googleId = String(user.googleId || "").trim();

  const rawIdentity =
    firebaseUid ||
    googleId ||
    email ||
    phone ||
    String(user._id);

  return sha256(rawIdentity);
}

class BlockService {
  async createBlock(input: {
    scope: BlockScope;
    targetType: BlockTargetType;
    targetUserId?: string;
    actorId?: string;
    reason?: string;
    req?: Request;
    expiresAt?: Date | null;
    includeIdentity?: boolean;
    includeDevice?: boolean;
    includeIp?: boolean;
  }) {
    const {
      scope,
      targetType,
      targetUserId,
      actorId,
      reason,
      req,
      expiresAt = null,
      includeIdentity = true,
      includeDevice = true,
      includeIp = false,
    } = input;

    let identityKey = "";
    let deviceId = "";
    let ipHash = "";
    let userAgentHash = "";

    if (targetUserId) {
      identityKey = await buildIdentityFromUserId(targetUserId);
    }

    if (req) {
      const requestIdentity = getRequestIdentity(req);

      if (includeDevice) {
        deviceId = requestIdentity.deviceId;
      }

      if (includeIp) {
        ipHash = requestIdentity.ipHash;
      }

      userAgentHash = requestIdentity.userAgentHash;
    }

    const rule = await BlockRule.create({
      scope,
      targetType,

      user:
        targetUserId && Types.ObjectId.isValid(targetUserId)
          ? new Types.ObjectId(targetUserId)
          : null,

      identityKey: includeIdentity ? identityKey : "",
      deviceId: includeDevice ? deviceId : "",
      ipHash: includeIp ? ipHash : "",
      userAgentHash,

      reason: String(reason || ""),

      createdBy:
        actorId && Types.ObjectId.isValid(actorId)
          ? new Types.ObjectId(actorId)
          : null,

      isActive: true,
      expiresAt,
    });

    return {
      success: true,
      rule,
    };
  }

  async isBlocked(input: {
    scope: BlockScope;
    userId?: string;
    req?: Request;
  }) {
    const { scope, userId, req } = input;

    const now = new Date();

    const or: any[] = [];

    if (userId && Types.ObjectId.isValid(userId)) {
      or.push({ user: new Types.ObjectId(userId) });

      const identityKey = await buildIdentityFromUserId(userId);
      if (identityKey) {
        or.push({ identityKey });
      }
    }

    if (req) {
      const requestIdentity = getRequestIdentity(req);

      if (requestIdentity.deviceId) {
        or.push({ deviceId: requestIdentity.deviceId });
      }

      if (requestIdentity.ipHash) {
        or.push({ ipHash: requestIdentity.ipHash });
      }
    }

    if (!or.length) {
      return {
        blocked: false,
        rule: null,
      };
    }

    const rule = await BlockRule.findOne({
      scope,
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
      $and: [
        {
          $or: or,
        },
      ],
    }).lean();

    return {
      blocked: Boolean(rule),
      rule,
    };
  }

  async deactivateBlock(ruleId: string) {
    if (!Types.ObjectId.isValid(ruleId)) {
      throw new Error("Invalid ruleId");
    }

    await BlockRule.updateOne(
      { _id: ruleId },
      { $set: { isActive: false } }
    );

    return { success: true };
  }

  async listBlocks(scope?: BlockScope) {
    const filter: any = {
      isActive: true,
    };

    if (scope) {
      filter.scope = scope;
    }

    const items = await BlockRule.find(filter)
      .populate("user", "username atUsername avatar avatarGif")
      .populate("createdBy", "username atUsername avatar")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return items;
  }
}

export default new BlockService();