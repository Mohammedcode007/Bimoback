import { Request, Response } from "express";
import crypto from "crypto";
import User from "../models/User";
import PointPurchase from "../models/PointPurchase";
import { paymobAuthToken, paymobCreateOrder, paymobPaymentKey } from "../services/paymob.service";

function makeMerchantOrderId(userId: string) {
  // فريد + قابل للتتبع
  return `bimo_${userId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// ✅ POST /payments/paymob/create
export const createPaymobTopup = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    // أنت تتحكم بالباقات هنا
    const { packageId } = req.body as { packageId: string };

    // مثال باقات (عدّلها حسب نظامك)
    const packages: Record<string, { amountCents: number; coinz: number }> = {
      p1: { amountCents: 1000, coinz: 100 },   // 10 EGP
      p2: { amountCents: 2500, coinz: 260 },   // 25 EGP
      p3: { amountCents: 5000, coinz: 550 },   // 50 EGP
    };

    const pack = packages[packageId];
    if (!pack) return res.status(400).json({ message: "Invalid packageId" });

    const user = await User.findById(userId).select("email username atUsername");
    if (!user) return res.status(404).json({ message: "User not found" });

    const currency = process.env.PAYMOB_CURRENCY || "EGP";
    const merchantOrderId = makeMerchantOrderId(userId);

    // 1) سجل Pending في DB
    await PointPurchase.create({
      userId,
      amountCents: pack.amountCents,
      currency,
      coinz: pack.coinz,
      status: "pending",
      merchantOrderId,
    });

    // 2) Paymob
    const authToken = await paymobAuthToken();
    const order = await paymobCreateOrder({
      authToken,
      amountCents: pack.amountCents,
      currency,
      merchantOrderId,
    });

    const paymentKey = await paymobPaymentKey({
      authToken,
      amountCents: pack.amountCents,
      currency,
      orderId: order.id,
      integrationId: Number(process.env.PAYMOB_INTEGRATION_ID),
      billing: {
        first_name: (user.username || "Bimo").split(" ")[0] || "Bimo",
        last_name: "User",
        email: user.email || "na@bimo.app",
        phone_number: "+201000000000", // لو عندك phone في User استخدمه
      },
    });

    // 3) update purchase بالـ paymobOrderId
    await PointPurchase.updateOne({ merchantOrderId }, { $set: { paymobOrderId: order.id } });

    const iframeId = process.env.PAYMOB_IFRAME_ID;
    const paymentUrl = `https://accept.paymobsolutions.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

    return res.json({
      success: true,
      merchantOrderId,
      paymobOrderId: order.id,
      paymentUrl,
    });
  }catch (e: any) {
  console.error("❌ PAYMOB CREATE ERROR (status):", e?.response?.status);
  console.error("❌ PAYMOB CREATE ERROR (data):", e?.response?.data);
  console.error("❌ PAYMOB CREATE ERROR (headers):", e?.response?.headers);
  console.error("❌ PAYMOB CREATE ERROR (message):", e?.message || e);

  return res.status(500).json({
    message: "Failed to create paymob payment",
    paymobError: e?.response?.data || null,
    status: e?.response?.status || null,
  });
}
};