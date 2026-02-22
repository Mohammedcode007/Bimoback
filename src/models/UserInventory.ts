import mongoose, { Schema, Document } from "mongoose";
import { StoreItemType } from "./StoreItem";

export interface IUserInventory extends Document {
  user: mongoose.Types.ObjectId;
  item: mongoose.Types.ObjectId; // ref StoreItem
  itemType: StoreItemType;
  itemKey: string;              // تكرار للسرعة
  quantity: number;             // للهدايا/العناصر القابلة للتجميع
  acquiredAt: Date;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserInventorySchema = new Schema<IUserInventory>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    item: { type: Schema.Types.ObjectId, ref: "StoreItem", required: true, index: true },
    itemType: { type: String, required: true, index: true },
    itemKey: { type: String, required: true, index: true },

    quantity: { type: Number, default: 1, min: 0 },
    acquiredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// يمنع تكرار نفس العنصر للمستخدم (إلا لو stackable -> سنزيد quantity بدلاً من تكرار doc)
UserInventorySchema.index({ user: 1, item: 1 }, { unique: true });

export default mongoose.model<IUserInventory>("UserInventory", UserInventorySchema);