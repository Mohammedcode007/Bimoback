// src/models/UserDevice.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUserDevice extends Document {
  userId: Types.ObjectId;
  installationId: string;
  deviceFingerprint: string;

  platform?: string;
  brand?: string;
  modelName?: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;

  lastIp?: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserDeviceSchema = new Schema<IUserDevice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    installationId: {
      type: String,
      required: true,
      index: true,
    },
    deviceFingerprint: {
      type: String,
      required: true,
      index: true,
    },

    platform: String,
    brand: String,
    modelName: String,
    osName: String,
    osVersion: String,
    appVersion: String,

    lastIp: String,
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

UserDeviceSchema.index(
  { userId: 1, installationId: 1 },
  { unique: true }
);

export default mongoose.model<IUserDevice>("UserDevice", UserDeviceSchema);