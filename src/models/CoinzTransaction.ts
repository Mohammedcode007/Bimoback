import mongoose, { Schema, Document } from "mongoose";

export type CoinzTxType = "credit" | "debit" | "purchase";

export interface ICoinzTransaction extends Document {
  user: mongoose.Types.ObjectId;
  type: CoinzTxType;
  amount: number; // موجب دائماً
  balanceAfter: number;
  reason?: string;

  // في حالة purchase
  items?: Array<{ itemId: string; key: string; type: string; qty: number; priceCoinz: number }>;

  createdAt: Date;
}

const CoinzTransactionSchema = new Schema<ICoinzTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["credit", "debit", "purchase"], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, default: "" },

    items: {
      type: [
        {
          itemId: String,
          key: String,
          type: String,
          qty: Number,
          priceCoinz: Number
        }
      ],
      default: []
    },

    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

CoinzTransactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model<ICoinzTransaction>("CoinzTransaction", CoinzTransactionSchema);