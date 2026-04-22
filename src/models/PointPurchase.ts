import mongoose, { Schema } from "mongoose";

export type PurchaseStatus = "pending" | "paid" | "failed";

const PointPurchaseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    amountCents: { type: Number, required: true },
    currency: { type: String, default: "EGP" },

    coinz: { type: Number, required: true },

    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending", index: true },

    merchantOrderId: { type: String, required: true, unique: true, index: true },
    paymobOrderId: { type: Number },
    paymobTxnId: { type: Number, unique: true, sparse: true, index: true },

    // لمنع إضافة الرصيد مرتين
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PointPurchase", PointPurchaseSchema);