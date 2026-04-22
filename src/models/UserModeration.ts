// src/models/UserModeration.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUserModerationHistoryItem {
  reason: string;
  score: number;
  action: string;
  createdAt: Date;
  expiresAt?: Date | null;
  meta?: Record<string, any>;
}

export interface IUserModeration extends Document {
  userId: Types.ObjectId;

  strikes: number;
  falseReportsCount: number;

  isMuted: boolean;
  muteExpiresAt?: Date | null;

  isShadowBanned: boolean;
  shadowBanExpiresAt?: Date | null;

  isBanned: boolean;
  bannedAt?: Date | null;
  banExpiresAt?: Date | null;
  banReason?: string | null;

  history: IUserModerationHistoryItem[];

  createdAt: Date;
  updatedAt: Date;
}

const HistorySchema = new Schema<IUserModerationHistoryItem>(
  {
    reason: { type: String, required: true },
    score: { type: Number, required: true },
    action: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const UserModerationSchema = new Schema<IUserModeration>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    strikes: { type: Number, default: 0 },
    falseReportsCount: { type: Number, default: 0 },

    isMuted: { type: Boolean, default: false },
    muteExpiresAt: { type: Date, default: null },

    isShadowBanned: { type: Boolean, default: false },
    shadowBanExpiresAt: { type: Date, default: null },

    isBanned: { type: Boolean, default: false },
    bannedAt: { type: Date, default: null },
    banExpiresAt: { type: Date, default: null },
    banReason: { type: String, default: null },

    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IUserModeration>(
  "UserModeration",
  UserModerationSchema
);