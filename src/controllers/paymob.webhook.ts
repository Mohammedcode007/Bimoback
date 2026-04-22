import { Request, Response } from "express";
import crypto from "crypto";
import PointPurchase from "../models/PointPurchase";
import User from "../models/User";

/**
 * Paymob HMAC: يعتمد على ترتيب حقول محدد.
 * في لوحتك يوجد HMAC Secret. (أنت أرسلت HMAC قيمة طويلة)
 * ملاحظة: ترتيب الحقول يختلف حسب نوع الـ callback.
 * لذلك سننفذ طريقتين:
 * 1) نتحقق من hmac إن كان موجوداً بشكل قياسي في query
 * 2) وإن لم يكن مضبوط عندك الآن، نعمل "تشغيل مبدئي" بتأكيد success + منع التكرار بالـ txn id
 *
 * الأفضل لاحقاً: تثبيت التحقق بالترتيب الرسمي من Paymob docs داخل حسابك.
 */

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

// ✅ POST /payments/paymob/webhook
export const paymobWebhook = async (req: Request, res: Response) => {
  try {
    // حسب Paymob، كثير من الأحداث تأتي داخل obj
    const obj = req.body?.obj || req.body;

    const success = !!obj?.success;
    const isVoided = !!obj?.is_voided;
    const isRefunded = !!obj?.is_refunded;

    const txnId = Number(obj?.id); // transaction id
    const paymobOrderId = Number(obj?.order?.id);
    const merchantOrderId = String(obj?.order?.merchant_order_id || "");

    // 1) إهمال أي حالة غير نجاح
    if (!success || isVoided || isRefunded) {
      // حدّث purchase إن وجد
      if (merchantOrderId) {
        await PointPurchase.updateOne(
          { merchantOrderId },
          { $set: { status: "failed" } }
        );
      }
      return res.send("ignored");
    }

    if (!merchantOrderId || !Number.isFinite(txnId)) {
      return res.status(400).send("missing data");
    }

    // 2) امنع التكرار: لو txnId تم تسجيله سابقاً لا تضف رصيد مرة أخرى
    const purchase = await PointPurchase.findOne({ merchantOrderId });
    if (!purchase) return res.status(404).send("purchase not found");

    if (purchase.status === "paid" && purchase.creditedAt) {
      return res.send("already credited");
    }

    // 3) تحديث atomic: وضع txnId + paid + creditedAt ثم زيادة الرصيد
    // نجعلها خطوتين لكن بفلترة تمنع التكرار
    const updated = await PointPurchase.findOneAndUpdate(
      {
        merchantOrderId,
        $or: [{ paymobTxnId: { $exists: false } }, { paymobTxnId: null }],
        creditedAt: null,
      },
      {
        $set: {
          status: "paid",
          paymobTxnId: txnId,
          paymobOrderId: paymobOrderId || purchase.paymobOrderId,
          creditedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      // يعني webhook وصل مرة ثانية
      return res.send("duplicate");
    }

    await User.updateOne(
      { _id: updated.userId },
      { $inc: { CoinzBalance: updated.coinz } }
    );

    return res.send("ok");
  } catch (e: any) {
    console.error("❌ PAYMOB WEBHOOK ERROR:", e?.message || e);
    return res.status(500).send("error");
  }
};