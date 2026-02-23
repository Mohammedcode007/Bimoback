import mongoose, { Schema, Document } from "mongoose";

export type CoinzTxType = "credit" | "debit" | "purchase" | "buy_coinz";

export interface ICoinzTransaction extends Document {
  user: mongoose.Types.ObjectId;
  type: CoinzTxType;
  amount: number;
  balanceAfter: number;
  reason?: string;

  items?: Array<{
    itemId: mongoose.Types.ObjectId;
    key: string;
    type: string;
    qty: number;
    priceCoinz: number;
    durationDays?: number;
  }>;

  createdAt: Date;
}

const TxItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "StoreItem", required: true },
    key: { type: String, required: true },
    type: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    priceCoinz: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const CoinzTransactionSchema = new Schema<ICoinzTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["credit", "debit", "purchase", "buy_coinz"], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, default: "" },

    items: { type: [TxItemSchema], default: [] },

    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

CoinzTransactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model<ICoinzTransaction>("CoinzTransaction", CoinzTransactionSchema);