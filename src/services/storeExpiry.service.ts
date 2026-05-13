// src/services/storeExpiry.service.ts

import mongoose from "mongoose";
import StoreItem from "../models/StoreItem";
import User from "../models/User";
import UserInventory from "../models/UserInventory";

type ExpiredInventoryRow = {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  item?: any;
  itemType?: string;
  itemKey?: string;
  expiresAt?: Date | null;
};

const VERIFICATION_TYPES = ["none", "blue", "gold", "business"] as const;
type VerificationType = (typeof VERIFICATION_TYPES)[number];

function isVerificationType(value: unknown): value is VerificationType {
  return typeof value === "string" && (VERIFICATION_TYPES as readonly string[]).includes(value);
}

function isExpiredDate(value?: Date | string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

function ensureActiveCustomization(user: any) {
  user.activeCustomization = user.activeCustomization || {
    avatarFrame: "",
    avatarGif: "",
    usernameColor: "",
    messageTextColor: "",
    messageEffect: "",
    profileEntryAnimation: "",
    badges: [],
    verificationType: "none",
  };

  if (!Array.isArray(user.activeCustomization.badges)) {
    user.activeCustomization.badges = [];
  }

  if (!isVerificationType(user.activeCustomization.verificationType)) {
    user.activeCustomization.verificationType = "none";
  }

  if (typeof user.activeCustomization.avatarFrame !== "string") {
    user.activeCustomization.avatarFrame = "";
  }

  if (typeof user.activeCustomization.avatarGif !== "string") {
    user.activeCustomization.avatarGif = "";
  }

  if (typeof user.activeCustomization.usernameColor !== "string") {
    user.activeCustomization.usernameColor = "";
  }

  if (typeof user.activeCustomization.messageTextColor !== "string") {
    user.activeCustomization.messageTextColor = "";
  }

  if (typeof user.activeCustomization.messageEffect !== "string") {
    user.activeCustomization.messageEffect = "";
  }

  if (typeof user.activeCustomization.profileEntryAnimation !== "string") {
    user.activeCustomization.profileEntryAnimation = "";
  }
}

function getRowType(row: any) {
  return String(row?.itemType || row?.item?.type || "").trim();
}

function getRowKey(row: any) {
  return String(row?.itemKey || row?.item?.key || "").trim();
}

function getVerificationTypeFromRow(row: any): VerificationType | null {
  const direct = row?.item?.meta?.verificationType;

  if (isVerificationType(direct)) {
    return direct;
  }

  return null;
}

function clearActiveByExpiredRow(user: any, row: any) {
  ensureActiveCustomization(user);

  const type = getRowType(row);
  const key = getRowKey(row);

  if (!type || !key) return;

  if (type === "badge") {
    user.activeCustomization.badges = user.activeCustomization.badges.filter(
      (x: string) => String(x) !== key
    );

    if (Array.isArray(user.badges)) {
      user.badges = user.badges.filter((x: string) => String(x) !== key);
    }

    return;
  }

  if (type === "avatarFrame") {
    if (String(user.activeCustomization.avatarFrame || "") === key) {
      user.activeCustomization.avatarFrame = "";
    }

    if (String(user.avatarFrame || "") === key) {
      user.avatarFrame = "";
    }

    return;
  }

  if (type === "avatarGif") {
    if (String(user.activeCustomization.avatarGif || "") === key) {
      user.activeCustomization.avatarGif = "";
    }

    if (String(user.avatarGif || "") === key) {
      user.avatarGif = "";
    }

    return;
  }

  if (type === "usernameColor") {
    if (String(user.activeCustomization.usernameColor || "") === key) {
      user.activeCustomization.usernameColor = "";
    }

    if (String(user.usernameColor || "") === key) {
      user.usernameColor = "";
    }

    return;
  }

  if (type === "messageTextColor") {
    if (String(user.activeCustomization.messageTextColor || "") === key) {
      user.activeCustomization.messageTextColor = "";
    }

    if (String(user.messageTextColor || "") === key) {
      user.messageTextColor = "";
    }

    return;
  }

  if (type === "messageEffect") {
    if (String(user.activeCustomization.messageEffect || "") === key) {
      user.activeCustomization.messageEffect = "";
    }

    if (Array.isArray(user.ownedMessageEffects)) {
      user.ownedMessageEffects = user.ownedMessageEffects.filter(
        (x: string) => String(x) !== key
      );
    }

    return;
  }

  if (type === "profileEntryAnimation") {
    if (String(user.activeCustomization.profileEntryAnimation || "") === key) {
      user.activeCustomization.profileEntryAnimation = "";
    }

    if (String(user.profileEntryAnimation || "") === key) {
      user.profileEntryAnimation = "";
    }

    return;
  }

  if (type === "verification") {
    const expiredVerificationType = getVerificationTypeFromRow(row);

    if (
      expiredVerificationType &&
      user.activeCustomization.verificationType === expiredVerificationType
    ) {
      user.activeCustomization.verificationType = "none";
    }

    if (
      expiredVerificationType &&
      user.verificationType === expiredVerificationType
    ) {
      user.verificationType = "none";
    }

    return;
  }
}

function clearExpiredCustomEmojiBadge(user: any) {
  user.customEmojiBadge = user.customEmojiBadge || {
    emoji: "",
    isActive: false,
    purchasedAt: null,
    expiresAt: null,
  };

  if (isExpiredDate(user.customEmojiBadge.expiresAt)) {
    user.customEmojiBadge = {
      emoji: "",
      isActive: false,
      purchasedAt: null,
      expiresAt: null,
    };
  }
}

async function hydrateExpiredRows(rows: any[]) {
  const needItemIds = rows
    .filter((row) => !row.item || typeof row.item !== "object")
    .map((row) => row.item)
    .filter(Boolean)
    .map((id) => String(id));

  if (!needItemIds.length) return rows;

  const items = await StoreItem.find({ _id: { $in: needItemIds } }).lean();

  const itemMap = new Map<string, any>();
  for (const item of items) {
    itemMap.set(String(item._id), item);
  }

  return rows.map((row) => {
    if (row.item && typeof row.item === "object") return row;

    const item = row.item ? itemMap.get(String(row.item)) : null;
    return {
      ...row,
      item,
    };
  });
}

/**
 * تنظيف مستخدم واحد:
 * - يحذف أي UserInventory انتهى expiresAt
 * - يحذف نفس العنصر من activeCustomization
 * - ينظف customEmojiBadge لو انتهى
 * - ينظف User.inventory المدمج لو موجود عندك قديمًا
 */
export async function cleanupExpiredStoreForUser(userId: string) {
  if (!mongoose.isValidObjectId(userId)) {
    return {
      success: false,
      deletedCount: 0,
      message: "Invalid userId",
    };
  }

  const now = new Date();

  const user = await User.findById(userId);

  if (!user) {
    return {
      success: false,
      deletedCount: 0,
      message: "User not found",
    };
  }

  ensureActiveCustomization(user);
  clearExpiredCustomEmojiBadge(user);

  /**
   * 1) هات كل العناصر المنتهية من مخزون المستخدم
   */
  const expiredRowsRaw = await UserInventory.find({
    user: user._id,
    expiresAt: {
      $ne: null,
      $lte: now,
    },
  })
    .populate("item")
    .lean();

  const expiredRows = (await hydrateExpiredRows(expiredRowsRaw)) as ExpiredInventoryRow[];

  /**
   * 2) احذف تأثيرها من activeCustomization
   * يعني لو بادج كان active ينشال
   * لو لون كان active ينشال
   * لو فريم كان active ينشال
   */
  for (const row of expiredRows) {
    clearActiveByExpiredRow(user, row);
  }

  /**
   * 3) تنظيف احتياطي لو عندك inventory قديم داخل User نفسه
   * هذا لا يخص UserInventory فقط، لكنه مفيد لو كان عندك نظام قديم.
   */
  if (Array.isArray((user as any).inventory)) {
    const before = (user as any).inventory.length;

    (user as any).inventory = (user as any).inventory.filter((row: any) => {
      const expired = isExpiredDate(row?.expiresAt);

      if (expired) {
        clearActiveByExpiredRow(user, row);
      }

      return !expired;
    });

    if ((user as any).inventory.length !== before) {
      user.markModified("inventory");
    }
  }

  user.markModified("activeCustomization");
  user.markModified("customEmojiBadge");

  await user.save();

  /**
   * 4) الحذف الحقيقي من المخزون
   * هذا هو الجزء المهم:
   * أي عنصر مدته انتهت يتم حذفه نهائيًا من UserInventory
   */
  const deleteResult = await UserInventory.deleteMany({
    user: user._id,
    expiresAt: {
      $ne: null,
      $lte: now,
    },
  });

  return {
    success: true,
    deletedCount: deleteResult.deletedCount || 0,
    activeCustomization: user.activeCustomization,
    customEmojiBadge: user.customEmojiBadge,
  };
}

/**
 * تنظيف كل المستخدمين:
 * استخدمها في cron أو setInterval.
 */
export async function cleanupExpiredStoreForAll() {
  const now = new Date();

  const expiredRows = await UserInventory.find({
    expiresAt: { $ne: null, $lte: now },
  })
    .select("user")
    .lean();

  const userIds = Array.from(
    new Set(expiredRows.map((row: any) => String(row.user)).filter(Boolean))
  );

  let totalDeleted = 0;

  for (const userId of userIds) {
    const result = await cleanupExpiredStoreForUser(userId);
    totalDeleted += Number(result.deletedCount || 0);
  }

  /**
   * تنظيف احتياطي للمستخدمين الذين عندهم customEmojiBadge منتهي
   * حتى لو ليس لديهم UserInventory منتهي.
   */
  const usersWithExpiredEmoji = await User.find({
    "customEmojiBadge.expiresAt": { $ne: null, $lte: now },
  }).select("_id");

  for (const user of usersWithExpiredEmoji) {
    const result = await cleanupExpiredStoreForUser(String(user._id));
    totalDeleted += Number(result.deletedCount || 0);
  }

  return {
    success: true,
    usersChecked: userIds.length,
    totalDeleted,
  };
}