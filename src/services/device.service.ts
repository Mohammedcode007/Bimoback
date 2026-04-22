// src/services/device.service.ts
import UserDevice from "../models/UserDevice";
import BannedDevice from "../models/BannedDevice";
import { buildDeviceFingerprint } from "../utils/deviceFingerprint";

type DeviceInput = {
  userId: string;
  installationId: string;
  platform?: string;
  brand?: string;
  modelName?: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;
  ip?: string;
};

export async function registerOrUpdateUserDevice(input: DeviceInput) {
  const deviceFingerprint = buildDeviceFingerprint(input);

  await UserDevice.updateOne(
    { userId: input.userId, installationId: input.installationId },
    {
      $set: {
        userId: input.userId,
        installationId: input.installationId,
        deviceFingerprint,
        platform: input.platform,
        brand: input.brand,
        modelName: input.modelName,
        osName: input.osName,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
        lastIp: input.ip,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true }
  );

  return { deviceFingerprint };
}

export async function ensureDeviceNotBanned(input: {
  installationId?: string;
  platform?: string;
  brand?: string;
  modelName?: string;
  osName?: string;
  osVersion?: string;
}) {
  const deviceFingerprint = buildDeviceFingerprint(input);

  const banned = await BannedDevice.findOne({
    isActive: true,
    $or: [
      { installationId: input.installationId || null },
      { deviceFingerprint },
    ],
    $orActiveExpiry: undefined,
  }).lean();

  if (banned) {
    throw new Error("This account or device is restricted");
  }

  return { deviceFingerprint };
}