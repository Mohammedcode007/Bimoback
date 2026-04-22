// src/services/report.service.ts

import Report, { ReportReason, ReportTargetType } from "../models/Report";
import User from "../models/User";
import Tweet from "../models/Tweet";
import Message from "../models/Message";
import Room from "../models/Room";
import Comment from "../models/Comment";

import {
  getBaseReasonScore,
  getAutoActionFromScore,
} from "../utils/moderationScore";

import {
  banUserCompletely,
  banUserAccount,
  muteUser,
} from "./ban.service";

type CreateReportInput = {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
};

type LeanIdLike = {
  _id?: any;
};

type LeanTweetOwner = LeanIdLike & {
  author?: any;
  isHidden?: boolean;
};

type LeanMessageOwner = LeanIdLike & {
  sender?: any;
  moderationHidden?: boolean;
};

type LeanRoomOwner = LeanIdLike & {
  owner?: any;
  creator?: any;
  isSuspended?: boolean;
};

type LeanStoryOwner = LeanIdLike & {
  author?: any;
  user?: any;
  owner?: any;
  isHidden?: boolean;
};

type LeanCommentOwner = LeanIdLike & {
  author?: any;
  user?: any;
  isHidden?: boolean;
};

function toIdString(value: any): string | null {
  if (!value) return null;

  if (typeof value === "string") return value;

  if (typeof value?.toString === "function") {
    return value.toString();
  }

  return null;
}

async function resolveTargetOwnerId(
  targetType: ReportTargetType,
  targetId: string
): Promise<string | null> {
  switch (targetType) {
    case "user":
      return targetId;

    case "tweet": {
      const tweet = await Tweet.findById(targetId)
        .select("author")
        .lean<LeanTweetOwner | null>();

      return toIdString(tweet?.author);
    }

    case "message": {
      const message = await Message.findById(targetId)
        .select("sender")
        .lean<LeanMessageOwner | null>();

      return toIdString(message?.sender);
    }

    case "room": {
      const room = await Room.findById(targetId)
        .select("creator owner")
        .lean<LeanRoomOwner | null>();

      return toIdString(room?.owner) || toIdString(room?.creator);
    }



    case "comment": {
      const comment = await Comment.findById(targetId)
        .select("author user")
        .lean<LeanCommentOwner | null>();

      return toIdString(comment?.author) || toIdString(comment?.user);
    }

    default:
      return null;
  }
}

async function ensureTargetExists(
  targetType: ReportTargetType,
  targetId: string
): Promise<boolean> {
  switch (targetType) {
    case "user": {
      const user = await User.findById(targetId).select("_id").lean();
      return !!user;
    }

    case "tweet": {
      const tweet = await Tweet.findById(targetId).select("_id").lean();
      return !!tweet;
    }

    case "message": {
      const message = await Message.findById(targetId).select("_id").lean();
      return !!message;
    }

    case "room": {
      const room = await Room.findById(targetId).select("_id").lean();
      return !!room;
    }

 
    case "comment": {
      const comment = await Comment.findById(targetId).select("_id").lean();
      return !!comment;
    }

    default:
      return false;
  }
}

async function getSimilarReportsCount(
  targetType: ReportTargetType,
  targetId: string
): Promise<number> {
  return Report.countDocuments({
    targetType,
    targetId,
  });
}

function getReporterTrustWeight(user: { createdAt?: Date | string } | null): number {
  let trust = 0;

  if (!user?.createdAt) return trust;

  const createdAt = new Date(user.createdAt).getTime();
  const now = Date.now();
  const accountAgeDays = (now - createdAt) / (1000 * 60 * 60 * 24);

  if (accountAgeDays > 30) trust += 5;
  if (accountAgeDays > 180) trust += 5;

  return trust;
}

async function hideTargetContent(
  targetType: ReportTargetType,
  targetId: string,
  reason?: string
): Promise<void> {
  switch (targetType) {
    case "tweet": {
  await Tweet.updateOne(
  { _id: targetId },
  {
    $set: {
      isHidden: true,
      hiddenReason: reason || "Reported content",
      hiddenAt: new Date(),
      hiddenBy: "system",
    },
  }
);
      break;
    }

    case "message": {
await Message.updateOne(
  { _id: targetId },
  {
    $set: {
      moderationHidden: true,
      moderationReason: reason || "Reported content",
      moderationHiddenAt: new Date(),
      moderationHiddenBy: "system",
    },
  }
);
      break;
    }



    case "comment": {
await Comment.updateOne(
  { _id: targetId },
  {
    $set: {
      isHidden: true,
      hiddenReason: reason || "Reported content",
      hiddenAt: new Date(),
      hiddenBy: "system",
    },
  }
);
      break;
    }

    case "room": {
   await Room.updateOne(
  { _id: targetId },
  {
    $set: {
      isSuspended: true,
      suspensionReason: reason || "Reported content",
      suspendedAt: new Date(),
      suspendedBy: "system",
    },
  }
);
      break;
    }

    case "user":
    default:
      break;
  }
}

async function applyAutoAction(params: {
  action: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string | null;
  reason: string;
}) {
  const { action, targetType, targetId, targetOwnerId, reason } = params;

  if (action === "none") {
    return { actionTaken: false, action: "none" };
  }

  if (action === "hide_content") {
    if (targetType !== "user") {
      await hideTargetContent(targetType, targetId, reason);
    }
    return { actionTaken: true, action };
  }

  if (action === "mute_24h_and_hide_content") {
    if (targetType !== "user") {
      await hideTargetContent(targetType, targetId, reason);
    }

    if (targetOwnerId) {
      await muteUser(targetOwnerId, reason, 24);
    }

    return { actionTaken: true, action };
  }

  if (action === "ban_account" && targetOwnerId) {
    await banUserAccount(targetOwnerId, reason);
    return { actionTaken: true, action };
  }

  if (action === "ban_device_and_account" && targetOwnerId) {
    await banUserCompletely(targetOwnerId, reason);
    return { actionTaken: true, action };
  }

  return { actionTaken: false, action: "none" };
}

export async function createReport(input: CreateReportInput) {
  const { reporterId, targetType, targetId, reason, details } = input;

  const reporter = await User.findById(reporterId)
    .select("createdAt")
    .lean<{ createdAt?: Date | string } | null>();

  if (!reporter) {
    throw new Error("Reporter not found");
  }

  const targetExists = await ensureTargetExists(targetType, targetId);
  if (!targetExists) {
    throw new Error("Target not found");
  }

  const targetOwnerId = await resolveTargetOwnerId(targetType, targetId);

  if (targetOwnerId && String(targetOwnerId) === String(reporterId)) {
    throw new Error("You cannot report your own content");
  }

  const trustScore = getReporterTrustWeight(reporter);
  const existingSimilarCount = await getSimilarReportsCount(targetType, targetId);

  let autoScore = getBaseReasonScore(reason);
  autoScore += trustScore;

  if (existingSimilarCount >= 1) autoScore += 10;
  if (existingSimilarCount >= 3) autoScore += 15;
  if (existingSimilarCount >= 5) autoScore += 20;

  const action = getAutoActionFromScore(autoScore);

  const report = await Report.create({
    reporterId,
    targetType,
    targetId,
    targetOwnerId,
    reason,
    details: details || "",
    autoScore,
    trustScoreApplied: trustScore,
    matchedReportsCount: existingSimilarCount + 1,
    status: action === "none" ? "pending" : "auto_action_taken",
    autoAction: action === "none" ? null : action,
  });

  const actionResult = await applyAutoAction({
    action,
    targetType,
    targetId,
    targetOwnerId,
    reason: `Auto moderation بسبب ${reason}`,
  });

  if (actionResult.actionTaken) {
    report.autoActionMeta = {
      performedAt: new Date(),
      by: "system",
      action: actionResult.action,
    };

    await report.save();
  }

  return report;
}

export async function getReportsForTarget(
  targetType: ReportTargetType,
  targetId: string
) {
  return Report.find({ targetType, targetId })
    .sort({ createdAt: -1 })
    .lean();
}

export async function getReportsByReporter(reporterId: string) {
  return Report.find({ reporterId })
    .sort({ createdAt: -1 })
    .lean();
}