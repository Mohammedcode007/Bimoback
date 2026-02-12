// Badge.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type BadgeType =
  | "system"
  | "achievement"
  | "premium"
  | "room"
  | "seasonal";

export interface IBadge extends Document {
  name: string;
  description?: string;

  type: BadgeType;

  icon: string;
  color?: string;
  backgroundColor?: string;

  level?: number;

  isVerifiedBadge: boolean;
  isPremium: boolean;

  requiredPoints?: number;

  linkedRoom?: Types.ObjectId;

  expiresAt?: Date;

  priority: number;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const BadgeSchema = new Schema<IBadge>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    description: {
      type: String,
      maxlength: 300
    },

    type: {
      type: String,
      enum: ["system", "achievement", "premium", "room", "seasonal"],
      default: "system",
      index: true
    },

    icon: {
      type: String,
      required: true
    },

    color: String,
    backgroundColor: String,

    level: {
      type: Number,
      default: 1
    },

    isVerifiedBadge: {
      type: Boolean,
      default: false
    },

    isPremium: {
      type: Boolean,
      default: false
    },

    requiredPoints: {
      type: Number
    },

    linkedRoom: {
      type: Schema.Types.ObjectId,
      ref: "Room"
    },

    expiresAt: Date,

    priority: {
      type: Number,
      default: 0
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   Performance Indexes
========================= */

BadgeSchema.index({ type: 1 });
BadgeSchema.index({ priority: -1 });
BadgeSchema.index({ linkedRoom: 1 });

export default mongoose.model<IBadge>("Badge", BadgeSchema);
