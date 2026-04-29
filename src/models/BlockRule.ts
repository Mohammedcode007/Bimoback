import mongoose, { Schema, Document, Types } from "mongoose";

export type BlockScope = "rooms" | "tweets" | "app";

export type BlockTargetType = "user" | "identity" | "device" | "ip" | "mixed";

export interface IBlockRule extends Document {
  scope: BlockScope;
  targetType: BlockTargetType;

  user?: Types.ObjectId | null;

  identityKey?: string;
  deviceId?: string;
  ipHash?: string;
  userAgentHash?: string;

  reason?: string;

  createdBy?: Types.ObjectId | null;

  isActive: boolean;
  expiresAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const BlockRuleSchema = new Schema<IBlockRule>(
  {
    scope: {
      type: String,
      enum: ["rooms", "tweets", "app"],
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      enum: ["user", "identity", "device", "ip", "mixed"],
      required: true,
      index: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    identityKey: {
      type: String,
      default: "",
      index: true,
    },

    deviceId: {
      type: String,
      default: "",
      index: true,
    },

    ipHash: {
      type: String,
      default: "",
      index: true,
    },

    userAgentHash: {
      type: String,
      default: "",
      index: true,
    },

    reason: {
      type: String,
      default: "",
      maxlength: 500,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

BlockRuleSchema.index({ scope: 1, isActive: 1, user: 1 });
BlockRuleSchema.index({ scope: 1, isActive: 1, identityKey: 1 });
BlockRuleSchema.index({ scope: 1, isActive: 1, deviceId: 1 });
BlockRuleSchema.index({ scope: 1, isActive: 1, ipHash: 1 });

export default mongoose.model<IBlockRule>("BlockRule", BlockRuleSchema);