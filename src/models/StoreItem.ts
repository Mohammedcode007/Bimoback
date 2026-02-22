import mongoose, { Schema, Document } from "mongoose";

export type StoreItemType =
  | "avatarFrame"
  | "badge"
  | "messageEffect"
  | "gift"
  | "profileEntryAnimation"
  | "verification"; // لو حبيت تبيع توثيق

export interface IStoreItem extends Document {
  type: StoreItemType;
  key: string;            // معرف ثابت: "frame_gold_01", "badge_founder", ...
  name: string;           // اسم للعرض
  description?: string;
  priceCoinz: number;     // السعر بالكوينز
  isActive: boolean;      // متاح للبيع؟
  isConsumable: boolean;  // للهدايا/العناصر الاستهلاكية
  isStackable: boolean;   // لو ينفع تتجمع بالكميات
  meta?: Record<string, any>; // بيانات إضافية مثل url للصورة/lottie
  createdAt: Date;
  updatedAt: Date;
}

const StoreItemSchema = new Schema<IStoreItem>(
  {
    type: {
      type: String,
      enum: ["avatarFrame", "badge", "messageEffect", "gift", "profileEntryAnimation", "verification"],
      required: true,
      index: true
    },
    key: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priceCoinz: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },

    isConsumable: { type: Boolean, default: false },
    isStackable: { type: Boolean, default: false },

    meta: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

StoreItemSchema.index({ type: 1, isActive: 1, priceCoinz: 1 });

export default mongoose.model<IStoreItem>("StoreItem", StoreItemSchema);