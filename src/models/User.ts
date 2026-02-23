// models/User.ts
import mongoose, { Schema, Document } from "mongoose";
export type UserRole = "user" | "admin";
export type VerificationType = "none" | "blue" | "gold" | "business";
export type ActiveCustomization = {
  avatarFrame?: string;
  messageEffect?: string;
  profileEntryAnimation?: string;
  badges: string[];
  verificationType: VerificationType;
};
export interface IUser extends Document {
  username: string;
  atUsername: string;
  password: string;
  email?: string;
role: UserRole;
  isOnline: boolean;
  isInvisible?: boolean;
  lastSeen?: Date;
  blockedUsers: mongoose.Types.ObjectId[];
  CoinzBalance: number; // 💰 رصيد عملة Coinz

  dateOfBirth?: Date;
  country?: string;
  bio?: string;

  avatar?: string;
  coverImage?: string;

  /* ===== Purchasable / Customization ===== */

  avatarFrame?: string;               // frameId
  badges: string[];                   // badgeIds
  verificationType: VerificationType; // none | blue | gold | business

  ownedMessageEffects: string[];      // effectIds
  ownedGifts: string[];              // giftIds

  // ✅ أنيميشن واحد فقط عند دخول/فتح البروفايل (مثال: "entry_dragon_01" أو رابط Lottie)
  profileEntryAnimation?: string;
  activeCustomization: ActiveCustomization;
  /* ===== Counters Only ===== */

  followersCount: number;
  followingCount: number;
  totalLikesReceived: number;     // مجموع اللايكات على كل التويتات
  totalRetweetsReceived: number;  // مجموع الريتويت
  profileViews: number;

  isVerified: boolean;
  notificationSound: boolean;
  readReceiptsEnabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true
    },

    atUsername: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
role: {
  type: String,
  enum: ["user", "admin"],
  default: "user",
  index: true
},
    /* ===== Basic Info ===== */

    dateOfBirth: Date,

    country: {
      type: String,
      trim: true,
      maxlength: 50
    },

    bio: {
      type: String,
      maxlength: 2000
    },

    avatar: String,
    coverImage: String,

    /* ===== Online ===== */

    isOnline: {
      type: Boolean,
      default: false
    },

    isInvisible: {
      type: Boolean,
      default: false
    },

    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    lastSeen: Date,

    /* ===== Counters ===== */

    followersCount: {
      type: Number,
      default: 0
    },

    CoinzBalance: {
      type: Number,
      default: 100000, // 🎁 يحصل المستخدم على 100000 Coinz عند التسجيل
      min: 0
    },

    followingCount: {
      type: Number,
      default: 0
    },

    totalLikesReceived: {
      type: Number,
      default: 0
    },

    totalRetweetsReceived: {
      type: Number,
      default: 0
    },

    profileViews: {
      type: Number,
      default: 0
    },

    /* ===== Settings ===== */

    isVerified: {
      type: Boolean,
      default: false
    },
    activeCustomization: {
      avatarFrame: { type: String, trim: true, default: "" },
      messageEffect: { type: String, trim: true, default: "" },
      profileEntryAnimation: { type: String, trim: true, default: "" },
      badges: { type: [String], default: [] },
      verificationType: {
        type: String,
        enum: ["none", "blue", "gold", "business"],
        default: "none"
      }
    },
    notificationSound: {
      type: Boolean,
      default: true
    },

    readReceiptsEnabled: {
      type: Boolean,
      default: true
    },

    /* ===== Purchasable / Customization (NEW) ===== */

    avatarFrame: {
      type: String,
      trim: true,
      default: "" // فارغ = بدون إطار
    },

    badges: {
      type: [String],
      default: []
    },

    verificationType: {
      type: String,
      enum: ["none", "blue", "gold", "business"],
      default: "none",
      index: true
    },

    ownedMessageEffects: {
      type: [String],
      default: []
    },

    ownedGifts: {
      type: [String],
      default: []
    },

    // ✅ أنيميشن واحد فقط عند دخول/فتح البروفايل
    profileEntryAnimation: {
      type: String,
      trim: true,
      default: "" // فارغ = بدون أنيميشن
    }
  },
  { timestamps: true }
);

/* ===== Performance Indexes ===== */

UserSchema.index({ username: "text", atUsername: "text" });
UserSchema.index({ followersCount: -1 });
UserSchema.index({ totalLikesReceived: -1 });
UserSchema.index({ isOnline: 1, lastSeen: -1 });
UserSchema.index({ verificationType: 1 });

export default mongoose.model<IUser>("User", UserSchema);