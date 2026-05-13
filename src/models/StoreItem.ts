// import mongoose, { Schema, Document } from "mongoose";

// export type StoreItemType =
//   | "avatarFrame"
//   | "avatarGif"
//   | "usernameColor"
//   | "messageTextColor"
//   | "badge"
//   | "messageEffect"
//   | "gift"
//   | "profileEntryAnimation"
//   | "verification";

// export interface IStoreItem extends Document {
//   type: StoreItemType;
//   key: string;
//   name: string;
//   description?: string;
//   priceCoinz: number;
//   isActive: boolean;

//   isConsumable: boolean;
//   isStackable: boolean;

//   // مدة الاستخدام (0 = دائم)
//   durationDays: number;

//   meta?: Record<string, any>;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const StoreItemSchema = new Schema<IStoreItem>(
//   {
//     type: {
//       type: String,
//       enum: [
//         "avatarFrame",
//         "avatarGif",
//         "usernameColor",
//         "messageTextColor",
//         "badge",
//         "messageEffect",
//         "gift",
//         "profileEntryAnimation",
//         "verification"
//       ],
//       required: true,
//       index: true
//     },

//     key: {
//       type: String,
//       required: true,
//       unique: true,
//       trim: true,
//       index: true
//     },

//     name: {
//       type: String,
//       required: true,
//       trim: true
//     },

//     description: {
//       type: String,
//       default: "",
//       trim: true
//     },

//     priceCoinz: {
//       type: Number,
//       required: true,
//       min: 0
//     },

//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true
//     },

//     isConsumable: {
//       type: Boolean,
//       default: false
//     },

//     isStackable: {
//       type: Boolean,
//       default: false
//     },

//     // مدة الاستخدام (0 = دائم)
//     durationDays: {
//       type: Number,
//       default: 0,
//       min: 0
//     },

//     meta: {
//       type: Schema.Types.Mixed,
//       default: {}
//     }
//   },
//   { timestamps: true }
// );

// // تحسين البحث في المتجر
// StoreItemSchema.index({ type: 1, isActive: 1, priceCoinz: 1 });

// export default mongoose.model<IStoreItem>("StoreItem", StoreItemSchema);
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

export type BadgeKind = "static" | "animated";

export type StoreItemMeta = {
  /**
   * خاص بالبادجات:
   * static   = بادج صورة ثابتة
   * animated = بادج متحرك Lottie
   */
  badgeKind?: BadgeKind;

  /**
   * true لو البادج متحرك
   * false لو ثابت
   */
  isAnimated?: boolean;

  /**
   * رابط صورة ثابتة PNG/JPG/WebP
   */
  iconUrl?: string;

  /**
   * رابط معاينة، يمكن أن يكون صورة أو lottie json
   */
  previewUrl?: string;

  /**
   * رابط lottie json للبادج المتحرك
   */
  lottieUrl?: string;

  /**
   * مستوى البادج اختياري
   */
  rarity?: "common" | "rare" | "epic" | "legendary" | string;

  /**
   * خاص بالتوثيق
   */
  verificationType?: "none" | "blue" | "gold" | "business";

  /**
   * أي بيانات إضافية
   */
  [key: string]: any;
};

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

  meta?: StoreItemMeta;

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
        "verification",
      ],
      required: true,
      index: true,
    },

    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    priceCoinz: {
      type: Number,
      required: true,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isConsumable: {
      type: Boolean,
      default: false,
    },

    isStackable: {
      type: Boolean,
      default: false,
    },

    // مدة الاستخدام (0 = دائم)
    durationDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

/**
 * تنظيف وتوحيد بيانات meta قبل الحفظ
 * حتى يكون التمييز بين البادج المتحرك والثابت واضحًا دائمًا.
 */
StoreItemSchema.pre("validate", function () {
  const doc = this as IStoreItem;

  doc.meta = doc.meta || {};

  if (doc.type !== "badge") {
    return;
  }

  const meta = doc.meta || {};

  const lottieUrl = String(meta.lottieUrl || "").trim();
  const iconUrl = String(meta.iconUrl || "").trim();
  const previewUrl = String(meta.previewUrl || "").trim();

  const hasLottie =
    !!lottieUrl ||
    previewUrl.toLowerCase().endsWith(".json") ||
    iconUrl.toLowerCase().endsWith(".json");

  if (meta.badgeKind !== "animated" && meta.badgeKind !== "static") {
    meta.badgeKind = hasLottie ? "animated" : "static";
  }

  if (typeof meta.isAnimated !== "boolean") {
    meta.isAnimated = meta.badgeKind === "animated" || hasLottie;
  }

  if (meta.isAnimated === true) {
    meta.badgeKind = "animated";
  } else {
    meta.badgeKind = "static";
    meta.isAnimated = false;
  }

  if (meta.badgeKind === "animated" && !meta.previewUrl && meta.lottieUrl) {
    meta.previewUrl = meta.lottieUrl;
  }

  if (meta.badgeKind === "static" && !meta.previewUrl && meta.iconUrl) {
    meta.previewUrl = meta.iconUrl;
  }

  doc.meta = meta;
});

// تحسين البحث في المتجر
StoreItemSchema.index({ type: 1, isActive: 1, priceCoinz: 1 });

// فلترة البادجات المتحركة والثابتة
StoreItemSchema.index({ type: 1, "meta.badgeKind": 1, isActive: 1 });
StoreItemSchema.index({ type: 1, "meta.isAnimated": 1, isActive: 1 });

export default mongoose.model<IStoreItem>("StoreItem", StoreItemSchema);