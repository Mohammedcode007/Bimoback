// src/models/Report.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type ReportTargetType =
  | "user"
  | "tweet"
  | "message"
  | "room"
  | "story"
  | "comment";

export type ReportReason =
  | "spam"
  | "harassment"
  | "sexual"
  | "violence"
  | "hate"
  | "fake_account"
  | "scam"
  | "other";

export type ReportStatus =
  | "pending"
  | "under_review"
  | "resolved"
  | "rejected"
  | "auto_action_taken";

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  targetOwnerId?: Types.ObjectId | null;

  reason: ReportReason;
  details?: string;

  autoScore: number;
  trustScoreApplied: number;
  matchedReportsCount: number;

  status: ReportStatus;

  autoAction?: string | null;
  autoActionMeta?: Record<string, any> | null;

  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["user", "tweet", "message", "room", "story", "comment"],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    targetOwnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "sexual",
        "violence",
        "hate",
        "fake_account",
        "scam",
        "other",
      ],
      required: true,
      index: true,
    },
    details: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    autoScore: {
      type: Number,
      default: 0,
    },
    trustScoreApplied: {
      type: Number,
      default: 0,
    },
    matchedReportsCount: {
      type: Number,
      default: 1,
    },

    status: {
      type: String,
      enum: ["pending", "under_review", "resolved", "rejected", "auto_action_taken"],
      default: "pending",
      index: true,
    },

    autoAction: {
      type: String,
      default: null,
    },
    autoActionMeta: {
      type: Schema.Types.Mixed,
      default: null,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// منع نفس الشخص من عمل بلاغات كثيرة على نفس الشيء
ReportSchema.index(
  { reporterId: 1, targetType: 1, targetId: 1 },
  { unique: true }
);

export default mongoose.model<IReport>("Report", ReportSchema);