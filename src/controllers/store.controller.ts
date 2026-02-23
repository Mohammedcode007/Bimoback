import { Request, Response } from "express";
import mongoose from "mongoose";
import StoreItem from "../models/StoreItem";
import UserInventory from "../models/UserInventory";
import CoinzTransaction from "../models/CoinzTransaction";
import User from "../models/User";

type AuthedReq = Request & { user?: { id: string; role?: string } };

/* =========================
   Helpers
========================= */

function requireAuth(req: AuthedReq) {
  if (!req.user?.id) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

function requireAdmin(req: AuthedReq) {
  if (req.user?.role !== "admin") {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

// ✅ VerificationType guard (بدون any)
const VERIFICATION_TYPES = ["none", "blue", "gold", "business"] as const;
type VerificationType = (typeof VERIFICATION_TYPES)[number];

function isVerificationType(v: unknown): v is VerificationType {
  return typeof v === "string" && (VERIFICATION_TYPES as readonly string[]).includes(v);
}

// ✅ ضمان وجود activeCustomization بشكل صحيح (لأن badges مطلوبة)
function ensureActiveCustomization(u: any) {
  u.activeCustomization = u.activeCustomization || {
    avatarFrame: "",
    messageEffect: "",
    profileEntryAnimation: "",
    badges: [],
    verificationType: "none"
  };

  if (!Array.isArray(u.activeCustomization.badges)) u.activeCustomization.badges = [];
  if (!isVerificationType(u.activeCustomization.verificationType)) u.activeCustomization.verificationType = "none";
}

// ✅ حساب expiresAt بالأيام فقط
function msFromDays(days: number): number {
  const d = Number(days || 0);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return d * 24 * 60 * 60 * 1000;
}

/**
 * ✅ تمديد/إنشاء expiresAt
 * - لو durationDays = 0 => null (دائم)
 * - لو موجود expiresAt سابقًا => نمدد من الأكبر بين (expiresAt, now)
 */
function computeNewExpiresAt(oldExpiresAt: Date | null | undefined, addMs: number): Date | null {
  if (!addMs || addMs <= 0) return null;

  const now = Date.now();
  const base = oldExpiresAt ? Math.max(new Date(oldExpiresAt).getTime(), now) : now;
  return new Date(base + addMs);
}

function isExpired(expiresAt?: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}
// ✅ تحقق أن meta كائن
function assertPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export default class StoreController {
/**
 * ✅ POST /api/store/items  (Admin)
 * body:
 * {
 *   type: "badge" | "avatarFrame" | ...
 *   key: string,
 *   name: string,
 *   description?: string,
 *   priceCoinz: number,
 *   isActive?: boolean,
 *   isConsumable?: boolean,
 *   isStackable?: boolean,
 *   durationDays?: number, // 0 = دائم
 *   meta?: object
 * }
 */
static async createItem(req: AuthedReq, res: Response) {
  try {
    requireAuth(req);
    requireAdmin(req);

    const type = String(req.body?.type || "").trim();
    const key = String(req.body?.key || "").trim();
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();

    const priceCoinz = Number(req.body?.priceCoinz || 0);
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;
    const isConsumable = Boolean(req.body?.isConsumable);
    const isStackable = Boolean(req.body?.isStackable);

    const durationDays = Number(req.body?.durationDays || 0);
    const meta = req.body?.meta;

    const allowedTypes = [
      "avatarFrame",
      "badge",
      "messageEffect",
      "gift",
      "profileEntryAnimation",
      "verification"
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }
    if (!key || key.length < 3) {
      return res.status(400).json({ success: false, message: "Invalid key" });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    if (!Number.isFinite(priceCoinz) || priceCoinz < 0) {
      return res.status(400).json({ success: false, message: "Invalid priceCoinz" });
    }
    if (!Number.isFinite(durationDays) || durationDays < 0) {
      return res.status(400).json({ success: false, message: "Invalid durationDays" });
    }
    if (meta !== undefined && (typeof meta !== "object" || meta === null || Array.isArray(meta))) {
      return res.status(400).json({ success: false, message: "meta must be an object" });
    }

    // منع تكرار key
    const exists = await StoreItem.findOne({ key }).lean();
    if (exists) {
      return res.status(400).json({ success: false, message: "key already exists" });
    }

    const item = await StoreItem.create({
      type,
      key,
      name,
      description,
      priceCoinz,
      isActive,
      isConsumable,
      isStackable,
      durationDays,
      meta: meta || {}
    });

    return res.status(201).json({ success: true, message: "Item created", item });
  } catch (e: any) {
    return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
  }
}

  static async updateItemMeta(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);
      requireAdmin(req);

      const id = String(req.params.id || "").trim();
      const mode = String(req.body?.mode || "merge").trim(); // merge | replace
      const meta = req.body?.meta;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      if (!assertPlainObject(meta)) {
        return res.status(400).json({ success: false, message: "meta must be an object" });
      }
      if (mode !== "merge" && mode !== "replace") {
        return res.status(400).json({ success: false, message: "mode must be merge or replace" });
      }

      const item = await StoreItem.findById(id);
      if (!item) return res.status(404).json({ success: false, message: "Item not found" });

      const oldMeta = assertPlainObject(item.meta) ? (item.meta as any) : {};

      item.meta = mode === "replace" ? meta : { ...oldMeta, ...meta };

      await item.save(); // ✅ مهم: بدون session هنا، وبالتالي لا تمرر { session } إلا إذا كنت داخل transaction

      return res.json({
        success: true,
        message: "Meta updated",
        item: {
          _id: String(item._id),
          key: item.key,
          type: item.type,
          meta: item.meta
        }
      });
    } catch (e: any) {
      return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
    }
  }

  /**
   * ✅ PATCH /api/store/items/:id/meta/set   (Admin)
   * body:
   * {
   *   "set": {
   *     "iconUrl": "https://...",
   *     "rarity": "epic",
   *     "isLimited": true,
   *     "bundle.includes": ["k1","k2"]   // dot notation يسمح بتداخل
   *   }
   * }
   *
   * هذه الدالة لا تستبدل meta، بل تعدل حقول داخلها.
   */
  static async setItemMetaFields(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);
      requireAdmin(req);

      const id = String(req.params.id || "").trim();
      const setObj = req.body?.set;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      if (!assertPlainObject(setObj)) {
        return res.status(400).json({ success: false, message: "set must be an object" });
      }

      // بناء $set على meta.*
      const $set: Record<string, any> = {};
      for (const [k, v] of Object.entries(setObj)) {
        const key = String(k || "").trim();
        if (!key) continue;

        // امنع حقول خطرة أو محاولة الخروج من meta
        if (key.startsWith("$") || key.includes("__proto__") || key.includes("constructor")) {
          return res.status(400).json({ success: false, message: "Invalid meta key" });
        }

        // لو المستخدم أرسل "meta.iconUrl" نتركه كما هو، غير ذلك نضيف "meta."
        const path = key.startsWith("meta.") ? key : `meta.${key}`;
        $set[path] = v;
      }

      const item = await StoreItem.findByIdAndUpdate(
        id,
        { $set },
        { new: true }
      ).lean();

      if (!item) return res.status(404).json({ success: false, message: "Item not found" });

      return res.json({
        success: true,
        message: "Meta fields updated",
        item
      });
    } catch (e: any) {
      return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
    }
  }

  /** GET /api/store/items?type=badge&active=true */
  static async listItems(req: Request, res: Response) {
    const type = String(req.query.type || "").trim();
    const active = String(req.query.active || "true") === "true";

    const filter: any = {};
    if (type) filter.type = type;
    if (active) filter.isActive = true;

    const items = await StoreItem.find(filter).sort({ type: 1, priceCoinz: 1 }).lean();
    return res.json({ success: true, items });
  }

  /** GET /api/store/me/inventory */
  static async myInventory(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);

      const inv = await UserInventory.find({ user: req.user!.id })
        .populate("item")
        .sort({ updatedAt: -1 })
        .lean();

      const user = await User.findById(req.user!.id, { CoinzBalance: 1, activeCustomization: 1 }).lean();

      return res.json({
        success: true,
        coinzBalance: user?.CoinzBalance ?? 0,
        activeCustomization: user?.activeCustomization ?? {
          avatarFrame: "",
          messageEffect: "",
          profileEntryAnimation: "",
          badges: [],
          verificationType: "none"
        },
        inventory: inv
      });
    } catch (e: any) {
      return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
    }
  }

  /**
   * ✅ POST /api/store/coinz/buy
   * body: { amount: number }
   * شراء وهمي: أي مستخدم يشتري لنفسه فقط
   */
  static async buyCoinz(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);

      const userId = req.user!.id;
      const amount = Number(req.body?.amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" });
      }

      // حد أعلى لمنع العبث (عدّله حسب نظامك)
      if (amount > 10_000_000) {
        return res.status(400).json({ success: false, message: "Amount too large" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const user = await User.findById(userId).session(session);
        if (!user) {
          await session.abortTransaction();
          return res.status(404).json({ success: false, message: "User not found" });
        }

        user.CoinzBalance = (user.CoinzBalance || 0) + amount;
        await user.save({ session });

        await CoinzTransaction.create(
          [
            {
              user: user._id,
              type: "buy_coinz",
              amount,
              balanceAfter: user.CoinzBalance,
              reason: "User buy coinz (mock)"
            }
          ],
          { session }
        );

        await session.commitTransaction();

        return res.json({
          success: true,
          message: "Coinz purchased successfully",
          added: amount,
          coinzBalance: user.CoinzBalance
        });
      } catch (e: any) {
        await session.abortTransaction();
        return res.status(e?.status || 500).json({ success: false, message: e?.message || "Buy coinz failed" });
      } finally {
        session.endSession();
      }
    } catch (e: any) {
      return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
    }
  }

  /**
   * POST /api/store/purchase
   * body:
   * {
   *   items: [{ itemId: string, quantity?: number }],
   *   setActive?: boolean
   * }
   */
static async purchase(req: AuthedReq, res: Response) {
  // ✅ request id لتتبع نفس الطلب في اللوج
  const rid = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const log = (...args: any[]) => console.log(`[STORE_PURCHASE][${rid}]`, ...args);
  const warn = (...args: any[]) => console.warn(`[STORE_PURCHASE][${rid}]`, ...args);
  const errlog = (...args: any[]) => console.error(`[STORE_PURCHASE][${rid}]`, ...args);

  try {
    requireAuth(req);

    const userId = req.user!.id;
    const itemsReq = Array.isArray(req.body?.items) ? req.body.items : [];
    const setActive = Boolean(req.body?.setActive);

    log("Request received", {
      userId,
      itemsCount: itemsReq.length,
      setActive
    });

    if (!itemsReq.length) {
      warn("Validation failed: items is required");
      return res.status(400).json({ success: false, message: "items is required" });
    }

    // تجميع الكميات لنفس itemId
    const mapQty = new Map<string, number>();
    for (const it of itemsReq) {
      const itemId = String(it?.itemId || "").trim();
      const qty = Math.max(1, Number(it?.quantity || 1));

      log("Item input", { itemId, qty });

      if (!mongoose.isValidObjectId(itemId)) {
        warn("Validation failed: Invalid itemId", { itemId });
        return res.status(400).json({ success: false, message: "Invalid itemId" });
      }
      if (!Number.isFinite(qty) || qty < 1) {
        warn("Validation failed: Invalid quantity", { itemId, qty });
        return res.status(400).json({ success: false, message: "Invalid quantity" });
      }

      mapQty.set(itemId, (mapQty.get(itemId) || 0) + qty);
    }

    const itemIds = Array.from(mapQty.keys());
    log("Aggregated items", {
      uniqueItems: itemIds.length,
      itemIds
    });

    const storeItems = await StoreItem.find({ _id: { $in: itemIds }, isActive: true }).lean();

    log("Fetched store items", {
      fetched: storeItems.length,
      expected: itemIds.length
    });

    if (storeItems.length !== itemIds.length) {
      warn("Mismatch items: not found or inactive", {
        requested: itemIds,
        fetchedIds: storeItems.map((x: any) => String(x._id))
      });
      return res.status(400).json({ success: false, message: "One or more items not found or inactive" });
    }

    const purchaseLines = storeItems.map((si: any) => {
      const qty = mapQty.get(String(si._id)) || 1;
      const lineTotal = Number(si.priceCoinz) * qty;
      return { si, qty, lineTotal };
    });

    const totalCost = purchaseLines.reduce((a, b) => a + b.lineTotal, 0);

    log("Purchase lines computed", {
      totalCost,
      lines: purchaseLines.map((l) => ({
        itemId: String(l.si._id),
        key: String(l.si.key),
        type: String(l.si.type),
        qty: Number(l.qty),
        priceCoinz: Number(l.si.priceCoinz),
        lineTotal: Number(l.lineTotal),
        durationDays: Number(l.si.durationDays || 0),
        isStackable: Boolean(l.si.isStackable),
        isConsumable: Boolean(l.si.isConsumable)
      }))
    });

    const session = await mongoose.startSession();
    session.startTransaction();
    log("Transaction started");

    try {
      const user = await User.findById(userId).session(session);
      if (!user) {
        warn("User not found", { userId });
        await session.abortTransaction();
        return res.status(404).json({ success: false, message: "User not found" });
      }

      ensureActiveCustomization(user);

      const beforeBalance = Number(user.CoinzBalance || 0);
      log("User loaded", {
        userId: String(user._id),
        beforeBalance
      });

      if (beforeBalance < totalCost) {
        warn("Insufficient balance", { beforeBalance, totalCost });
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Insufficient CoinzBalance" });
      }

      // خصم الكوينز
      user.CoinzBalance = beforeBalance - totalCost;
      log("Balance deducted", {
        beforeBalance,
        deducted: totalCost,
        afterBalance: user.CoinzBalance
      });

      const inventoryUpdates: any[] = [];

      for (const line of purchaseLines) {
        const si: any = line.si;
        const qty: number = line.qty;

        const durationDays = Number(si.durationDays || 0);
        const durationMs = msFromDays(durationDays);
        const addMs = durationMs * qty;

        log("Processing item", {
          itemId: String(si._id),
          key: String(si.key),
          type: String(si.type),
          qty,
          durationDays,
          durationMs,
          addMs
        });

        const existing = await UserInventory.findOne({ user: user._id, item: si._id }).session(session);

        if (existing) {
          log("Inventory exists", {
            invId: String(existing._id),
            oldQty: Number(existing.quantity || 0),
            oldExpiresAt: existing.expiresAt || null,
            isStackable: Boolean(si.isStackable),
            isConsumable: Boolean(si.isConsumable)
          });

          if (si.isStackable || si.isConsumable) {
            existing.quantity = (existing.quantity || 0) + qty;

            const newExp = computeNewExpiresAt(existing.expiresAt, addMs);
            existing.expiresAt = newExp;

            await existing.save({ session });

            log("Inventory updated", {
              invId: String(existing._id),
              newQty: existing.quantity,
              newExpiresAt: existing.expiresAt || null
            });

            inventoryUpdates.push({
              itemId: String(si._id),
              key: String(si.key),
              type: String(si.type),
              quantity: existing.quantity,
              expiresAt: existing.expiresAt
            });
          } else {
            warn("Item already owned and non-repeatable", { key: String(si.key) });
            throw Object.assign(new Error(`Item already owned: ${si.key}`), { status: 400 });
          }
        } else {
          const expiresAt = computeNewExpiresAt(null, addMs);

          const created = await UserInventory.create(
            [
              {
                user: user._id,
                item: si._id,
                itemType: si.type,
                itemKey: si.key,
                quantity: qty,
                acquiredAt: new Date(),
                expiresAt
              }
            ],
            { session }
          );

          log("Inventory created", {
            invId: String(created?.[0]?._id || ""),
            qty: created?.[0]?.quantity ?? qty,
            expiresAt: created?.[0]?.expiresAt ?? expiresAt
          });

          inventoryUpdates.push({
            itemId: String(si._id),
            key: String(si.key),
            type: String(si.type),
            quantity: created?.[0]?.quantity ?? qty,
            expiresAt: created?.[0]?.expiresAt ?? expiresAt
          });
        }

        // تفعيل تلقائي (اختياري)
        if (setActive) {
          log("Auto-activate requested", { type: String(si.type), key: String(si.key) });

          switch (si.type) {
            case "avatarFrame":
              user.activeCustomization.avatarFrame = si.key;
              break;

            case "messageEffect":
              user.activeCustomization.messageEffect = si.key;
              break;

            case "profileEntryAnimation":
              user.activeCustomization.profileEntryAnimation = si.key;
              break;

            case "badge": {
              const badges = user.activeCustomization.badges;
              if (!badges.includes(si.key)) badges.push(si.key);
              user.activeCustomization.badges = badges;
              break;
            }

            case "verification": {
              const v = si.meta?.verificationType;
              if (isVerificationType(v)) {
                user.activeCustomization.verificationType = v;
              } else {
                warn("verificationType missing/invalid in meta", { v, itemKey: String(si.key) });
              }
              break;
            }

            case "gift":
            default:
              break;
          }
        }
      }

      await user.save({ session });
      log("User saved", { afterBalance: user.CoinzBalance });

      await CoinzTransaction.create(
        [
          {
            user: user._id,
            type: "purchase",
            amount: totalCost,
            balanceAfter: user.CoinzBalance,
            reason: "Store purchase",
            items: purchaseLines.map((l) => ({
              itemId: String(l.si._id),
              key: String(l.si.key),
              type: String(l.si.type),
              qty: Number(l.qty),
              priceCoinz: Number(l.si.priceCoinz),
              durationDays: Number(l.si.durationDays || 0)
            }))
          }
        ],
        { session }
      );

      log("Transaction record created");

      await session.commitTransaction();
      log("Transaction committed successfully");

      return res.json({
        success: true,
        message: "Purchased successfully",
        totalCost,
        coinzBalance: user.CoinzBalance,
        activeCustomization: user.activeCustomization,
        inventoryUpdates
      });
    } catch (e: any) {
      // ✅ اعرض تفاصيل أوضح في اللوج
      errlog("Transaction failed", {
        status: e?.status || 500,
        message: e?.message,
        name: e?.name,
        code: e?.code,
        stack: e?.stack
      });

      await session.abortTransaction();
      const status = e?.status || 500;
      return res.status(status).json({ success: false, message: e?.message || "Purchase failed" });
    } finally {
      session.endSession();
      log("Session ended");
    }
  } catch (e: any) {
    errlog("Request failed (outer catch)", {
      status: e?.status || 500,
      message: e?.message,
      name: e?.name,
      stack: e?.stack
    });

    return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
  }
}

  /**
   * PATCH /api/store/activate
   * body:
   * { type: "avatarFrame" | "messageEffect" | "profileEntryAnimation" | "badge" | "verification",
   *   key: string,
   *   mode?: "set" | "add" | "remove"
   * }
   */
  static async activate(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);

      const userId = req.user!.id;
      const type = String(req.body?.type || "").trim();
      const key = String(req.body?.key || "").trim();
      const mode = String(req.body?.mode || "set").trim();

      if (!type || !key) {
        return res.status(400).json({ success: false, message: "type and key are required" });
      }

      // تحقق أن المستخدم يمتلك العنصر فعلاً + ليس منتهي
      const inv = await UserInventory.findOne({ user: userId, itemKey: key, itemType: type as any }).lean();
      if (!inv) {
        return res.status(400).json({ success: false, message: "Item not owned" });
      }
      if (isExpired(inv.expiresAt)) {
        return res.status(400).json({ success: false, message: "Item expired" });
      }

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      ensureActiveCustomization(user);

      if (type === "badge") {
        const badges: string[] = user.activeCustomization.badges;

        if (mode === "add") {
          if (!badges.includes(key)) badges.push(key);
          user.activeCustomization.badges = badges;
        } else if (mode === "remove") {
          user.activeCustomization.badges = badges.filter((x) => x !== key);
        } else {
          // set => يجعلها الشارة الوحيدة
          user.activeCustomization.badges = [key];
        }
      } else if (type === "avatarFrame") {
        user.activeCustomization.avatarFrame = key;
      } else if (type === "messageEffect") {
        user.activeCustomization.messageEffect = key;
      } else if (type === "profileEntryAnimation") {
        user.activeCustomization.profileEntryAnimation = key;
      } else if (type === "verification") {
        if (!isVerificationType(key)) {
          return res.status(400).json({ success: false, message: "Invalid verificationType" });
        }
        user.activeCustomization.verificationType = key;
      } else {
        return res.status(400).json({ success: false, message: "Unsupported activate type" });
      }

      await user.save();

      return res.json({
        success: true,
        message: "Activated",
        activeCustomization: user.activeCustomization
      });
    } catch (e: any) {
      return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
    }
  }

  /**
   * PATCH /api/store/coinz/credit  (Admin)
   * body: { userId: string, amount: number, reason?: string }
   */
  static async creditCoinz(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);
      requireAdmin(req);

      const userId = String(req.body?.userId || "").trim();
      const amount = Number(req.body?.amount || 0);
      const reason = String(req.body?.reason || "Admin credit");

      if (!mongoose.isValidObjectId(userId) || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid userId or amount" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const user = await User.findById(userId).session(session);
        if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

        user.CoinzBalance = (user.CoinzBalance || 0) + amount;
        await user.save({ session });

        await CoinzTransaction.create(
          [
            {
              user: user._id,
              type: "credit",
              amount,
              balanceAfter: user.CoinzBalance,
              reason
            }
          ],
          { session }
        );

        await session.commitTransaction();

        return res.json({ success: true, coinzBalance: user.CoinzBalance });
      } catch (e: any) {
        await session.abortTransaction();
        return res.status(e?.status || 500).json({ success: false, message: e?.message || "Credit failed" });
      } finally {
        session.endSession();
      }
    } catch (e: any) {
      return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
    }
  }

  /**
   * PATCH /api/store/coinz/debit  (Admin)
   * body: { userId: string, amount: number, reason?: string }
   */
  static async debitCoinz(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);
      requireAdmin(req);

      const userId = String(req.body?.userId || "").trim();
      const amount = Number(req.body?.amount || 0);
      const reason = String(req.body?.reason || "Admin debit");

      if (!mongoose.isValidObjectId(userId) || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid userId or amount" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const user = await User.findById(userId).session(session);
        if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

        if ((user.CoinzBalance || 0) < amount) {
          throw Object.assign(new Error("Insufficient balance"), { status: 400 });
        }

        user.CoinzBalance = (user.CoinzBalance || 0) - amount;
        await user.save({ session });

        await CoinzTransaction.create(
          [
            {
              user: user._id,
              type: "debit",
              amount,
              balanceAfter: user.CoinzBalance,
              reason
            }
          ],
          { session }
        );

        await session.commitTransaction();

        return res.json({ success: true, coinzBalance: user.CoinzBalance });
      } catch (e: any) {
        await session.abortTransaction();
        return res.status(e?.status || 500).json({ success: false, message: e?.message || "Debit failed" });
      } finally {
        session.endSession();
      }
    } catch (e: any) {
      return res.status(e?.status || 500).json({ success: false, message: e?.message || "Failed" });
    }
  }
}