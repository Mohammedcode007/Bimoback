// src/services/ban.service.ts
import User from "../models/User";
import UserModeration from "../models/UserModeration";
import UserDevice from "../models/UserDevice";
import BannedDevice from "../models/BannedDevice";

export async function ensureModerationDoc(userId: string) {
  let doc = await UserModeration.findOne({ userId });
  if (!doc) {
    doc = await UserModeration.create({ userId });
  }
  return doc;
}

export async function muteUser(userId: string, reason: string, hours = 24) {
  const moderation = await ensureModerationDoc(userId);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  moderation.isMuted = true;
  moderation.muteExpiresAt = expiresAt;
  moderation.strikes += 1;
  moderation.history.push({
    reason,
    score: 0,
    action: "mute",
    createdAt: new Date(),
    expiresAt,
  });
  await moderation.save();

  return moderation;
}

export async function banUserAccount(userId: string, reason: string) {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        isBanned: true,
        banReason: reason,
        bannedAt: new Date(),
      },
    }
  );

  const moderation = await ensureModerationDoc(userId);
  moderation.isBanned = true;
  moderation.bannedAt = new Date();
  moderation.banReason = reason;
  moderation.strikes += 1;
  moderation.history.push({
    reason,
    score: 0,
    action: "ban_account",
    createdAt: new Date(),
  });
  await moderation.save();
}

export async function banUserDevices(userId: string, reason: string) {
  const devices = await UserDevice.find({ userId }).lean();

  if (!devices.length) return;

  for (const device of devices) {
    await BannedDevice.updateOne(
      {
        $or: [
          { installationId: device.installationId },
          { deviceFingerprint: device.deviceFingerprint },
        ],
      },
      {
        $set: {
          installationId: device.installationId,
          deviceFingerprint: device.deviceFingerprint,
          reason,
          bannedAt: new Date(),
          isActive: true,
          meta: { userId },
        },
      },
      { upsert: true }
    );
  }
}

export async function banUserCompletely(userId: string, reason: string) {
  await banUserAccount(userId, reason);
  await banUserDevices(userId, reason);
}