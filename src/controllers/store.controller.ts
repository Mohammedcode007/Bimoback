// controllers/store.controller.ts
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

  // ضمان شكل badges
  if (!Array.isArray(u.activeCustomization.badges)) u.activeCustomization.badges = [];
  if (!isVerificationType(u.activeCustomization.verificationType)) u.activeCustomization.verificationType = "none";
}

export default class StoreController {
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
   * POST /api/store/purchase
   * body:
   * {
   *   items: [{ itemId: string, quantity?: number }],
   *   setActive?: boolean
   * }
   */
  static async purchase(req: AuthedReq, res: Response) {
    try {
      requireAuth(req);

      const userId = req.user!.id;
      const itemsReq = Array.isArray(req.body?.items) ? req.body.items : [];
      const setActive = Boolean(req.body?.setActive);

      if (!itemsReq.length) {
        return res.status(400).json({ success: false, message: "items is required" });
      }

      // تجميع الكميات لنفس itemId
      const mapQty = new Map<string, number>();
      for (const it of itemsReq) {
        const itemId = String(it?.itemId || "").trim();
        const qty = Math.max(1, Number(it?.quantity || 1));

        if (!mongoose.isValidObjectId(itemId)) {
          return res.status(400).json({ success: false, message: "Invalid itemId" });
        }
        if (!Number.isFinite(qty) || qty < 1) {
          return res.status(400).json({ success: false, message: "Invalid quantity" });
        }

        mapQty.set(itemId, (mapQty.get(itemId) || 0) + qty);
      }

      const itemIds = Array.from(mapQty.keys());
      const storeItems = await StoreItem.find({ _id: { $in: itemIds }, isActive: true }).lean();

      if (storeItems.length !== itemIds.length) {
        return res.status(400).json({ success: false, message: "One or more items not found or inactive" });
      }

      const purchaseLines = storeItems.map((si: any) => {
        const qty = mapQty.get(String(si._id)) || 1;
        const lineTotal = Number(si.priceCoinz) * qty;
        return { si, qty, lineTotal };
      });

      const totalCost = purchaseLines.reduce((a, b) => a + b.lineTotal, 0);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const user = await User.findById(userId).session(session);
        if (!user) {
          await session.abortTransaction();
          return res.status(404).json({ success: false, message: "User not found" });
        }

        ensureActiveCustomization(user);

        if ((user.CoinzBalance || 0) < totalCost) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: "Insufficient CoinzBalance" });
        }

        // خصم الكوينز
        user.CoinzBalance = (user.CoinzBalance || 0) - totalCost;

        for (const line of purchaseLines) {
          const si: any = line.si;
          const qty: number = line.qty;

          const existing = await UserInventory.findOne({ user: user._id, item: si._id }).session(session);

          if (existing) {
            if (si.isStackable || si.isConsumable) {
              existing.quantity = (existing.quantity || 0) + qty;
              await existing.save({ session });
            } else {
              throw Object.assign(new Error(`Item already owned: ${si.key}`), { status: 400 });
            }
          } else {
            await UserInventory.create(
              [
                {
                  user: user._id,
                  item: si._id,
                  itemType: si.type,
                  itemKey: si.key,
                  quantity: qty
                }
              ],
              { session }
            );
          }

          // تفعيل تلقائي (اختياري)
          if (setActive) {
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

        // سجل معاملة
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
                priceCoinz: Number(l.si.priceCoinz)
              }))
            }
          ],
          { session }
        );

        await session.commitTransaction();

        return res.json({
          success: true,
          message: "Purchased successfully",
          totalCost,
          coinzBalance: user.CoinzBalance,
          activeCustomization: user.activeCustomization
        });
      } catch (e: any) {
        await session.abortTransaction();
        const status = e?.status || 500;
        return res.status(status).json({ success: false, message: e?.message || "Purchase failed" });
      } finally {
        session.endSession();
      }
    } catch (e: any) {
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

      // تحقق أن المستخدم يمتلك العنصر فعلاً
      const inv = await UserInventory.findOne({ user: userId, itemKey: key, itemType: type as any }).lean();
      if (!inv) {
        return res.status(400).json({ success: false, message: "Item not owned" });
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
        // key هنا يجب أن يكون: none|blue|gold|business
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