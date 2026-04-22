// src/models/BannedDevice.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IBannedDevice extends Document {
  installationId?: string | null;
  deviceFingerprint?: string | null;

  reason: string;
  bannedAt: Date;
  expiresAt?: Date | null;

  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  meta?: Record<string, any>;
}

const BannedDeviceSchema = new Schema<IBannedDevice>(
  {
    installationId: {
      type: String,
      default: null,
      index: true,
    },
    deviceFingerprint: {
      type: String,
      default: null,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    bannedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model<IBannedDevice>("BannedDevice", BannedDeviceSchema);