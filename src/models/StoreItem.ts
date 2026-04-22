import mongoose, { Schema, Document } from "mongoose";

export type StoreItemType =
  | "avatarFrame"
  | "avatarGif"
  | "usernameColor"
  | "messageTextColor"
  | "badge"
  | "messageEffect"
  | "gift"
  | "profileEntryAnimation"
  | "verification";

export interface IStoreItem extends Document {
  type: StoreItemType;
  key: string;
  name: string;
  description?: string;
  priceCoinz: number;
  isActive: boolean;

  isConsumable: boolean;
  isStackable: boolean;

  // مدة الاستخدام (0 = دائم)
  durationDays: number;

  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const StoreItemSchema = new Schema<IStoreItem>(
  {
    type: {
      type: String,
      enum: [
        "avatarFrame",
        "avatarGif",
        "usernameColor",
        "messageTextColor",
        "badge",
        "messageEffect",
        "gift",
        "profileEntryAnimation",
        "verification"
      ],
      required: true,
      index: true
    },

    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    priceCoinz: {
      type: Number,
      required: true,
      min: 0
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    isConsumable: {
      type: Boolean,
      default: false
    },

    isStackable: {
      type: Boolean,
      default: false
    },

    // مدة الاستخدام (0 = دائم)
    durationDays: {
      type: Number,
      default: 0,
      min: 0
    },

    meta: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

// تحسين البحث في المتجر
StoreItemSchema.index({ type: 1, isActive: 1, priceCoinz: 1 });

export default mongoose.model<IStoreItem>("StoreItem", StoreItemSchema);