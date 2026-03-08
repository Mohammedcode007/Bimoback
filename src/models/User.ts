
// models/User.ts
import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "user" | "admin";
export type VerificationType = "none" | "blue" | "gold" | "business";
export type StoryType = "image" | "video" | "text";
export type StoryPrivacy = "public" | "followers" | "private";
export type CustomEmojiBadge = {
  emoji: string;
  isActive: boolean;
  purchasedAt?: Date | null;
  expiresAt?: Date | null;
};
export type UserStory = {
  _id?: mongoose.Types.ObjectId;

  type: StoryType;
  text?: string;         // لو type = text أو كـ caption
  mediaUrl?: string;     // صورة/فيديو
  thumbUrl?: string;     // اختياري للفيديو
  durationMs?: number;   // مدة عرض القصة (للـ text/image)

  privacy: StoryPrivacy; // public | followers | private
  isArchived?: boolean;  // لو حبيت أرشفة بدل الحذف

  viewsCount: number;
  viewers?: mongoose.Types.ObjectId[]; // اختياري (قد يكبر الحجم)

  createdAt: Date;
  expiresAt: Date;       // عادة createdAt + 24h
};
export type ActiveCustomization = {
  avatarFrame?: string;
  messageEffect?: string;
  profileEntryAnimation?: string;
  badges: string[];
  verificationType: VerificationType;
};

/**
 * ✅ إضافات صفحة التعديل (بدون المساس بالقديم):
 * - displayName, city
 * - privacy: profileVisible, showLastActive, showMedia, allowMessages
 * - notifications: messages, likes, follows
 * - partnerPreferences: ageRange, location, maritalStatus, religiosity
 * - tags (اهتمامات)
 */

export type PrivacySettings = {
  profileVisible: boolean;
  showLastActive: boolean;
  showMedia: boolean;
  allowMessages: boolean;
};

export type NotificationSettings = {
  messages: boolean;
  likes: boolean;
  follows: boolean;
};

export type PartnerPreferences = {
  ageRange?: string;
  location?: string;
  maritalStatus?: string;
  religiosity?: string;
};

export interface IUser extends Document {
  username: string;
  atUsername: string;
   password?: string | null;
  email?: string | null;
  googleUid?: string | null;
  provider?: "local" | "google";

  role: UserRole;

  isOnline: boolean;
  isInvisible?: boolean;
lastSeen?: Date | null;
  blockedUsers: mongoose.Types.ObjectId[];
  CoinzBalance: number; // 💰 رصيد عملة Coinz

  dateOfBirth?: Date;
  country?: string;
  bio?: string;

  avatar?: string;
  coverImage?: string;
  fcmTokens: string[];
  /* ===== Purchasable / Customization ===== */

  avatarFrame?: string; // frameId
  badges: string[]; // badgeIds
  verificationType: VerificationType; // none | blue | gold | business
  stories: UserStory[];
  ownedMessageEffects: string[]; // effectIds
  ownedGifts: string[]; // giftIds

  // ✅ أنيميشن واحد فقط عند دخول/فتح البروفايل (مثال: "entry_dragon_01" أو رابط Lottie)
  profileEntryAnimation?: string;

  activeCustomization: ActiveCustomization;
  customEmojiBadge?: CustomEmojiBadge;
  /* ===== Counters Only ===== */

  followersCount: number;
  followingCount: number;
  totalLikesReceived: number; // مجموع اللايكات على كل التويتات
  totalRetweetsReceived: number; // مجموع الريتويت
  profileViews: number;

  isVerified: boolean;
  notificationSound: boolean;
  readReceiptsEnabled: boolean;

  /* =========================
     ✅ NEW (Settings Screen)
  ========================= */

  displayName?: string; // اسم العرض (غير username)
  city?: string;

  privacy?: PrivacySettings;
  notifications?: NotificationSettings;

  partnerPreferences?: PartnerPreferences;

  tags: string[]; // اهتمامات/وسوم المستخدم

  createdAt: Date;
  updatedAt: Date;
}
const UserStorySchema = new Schema<UserStory>(
  {
    type: {
      type: String,
      enum: ["image", "video", "text"],
      required: true,
      index: true,
    },

    text: { type: String, trim: true, maxlength: 4000, default: "" },

    mediaUrl: { type: String, trim: true, default: "" },
    thumbUrl: { type: String, trim: true, default: "" },
    // ✅ FCM Device Tokens (Push Notifications)

    durationMs: { type: Number, default: 6000, min: 1000, max: 60000 },

    privacy: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
      // index: true,
    },

    isArchived: { type: Boolean, default: false, index: true },

    viewsCount: { type: Number, default: 0 },

    viewers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    createdAt: { type: Date, default: Date.now, index: true },

    expiresAt: {
      type: Date,
      required: true,
      // index: true,
      // لا يوجد TTL هنا لأنّه subdocument، لكن نستخدمه للفلترة والتنظيف
    },
  },
  { _id: true }
);
const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },

    atUsername: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

 password: {
  type: String,
  required: function (this: IUser) {
    return (this.provider || "local") !== "google";
  },
  default: null,
},

email: {
  type: String,
  trim: true,
  lowercase: true,
  index: true,
  default: null,
},

googleUid: {
  type: String,
  default: null,
  index: true,
},

provider: {
  type: String,
  enum: ["local", "google"],
  default: "local",
  index: true,
},

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
    stories: {
      type: [UserStorySchema],
      default: [],
    },
        fcmTokens: {
      type: [String],
      default: [],
      index: true,
    },
    /* ===== Basic Info ===== */

    dateOfBirth: Date,

    country: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    bio: {
      type: String,
      maxlength: 2000,
    },

    avatar: String,
    coverImage: String,

    /* ===== Online ===== */

    isOnline: {
      type: Boolean,
      default: false,
    },

    isInvisible: {
      type: Boolean,
      default: false,
    },

    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    lastSeen: Date,

    /* ===== Counters ===== */

    followersCount: {
      type: Number,
      default: 0,
    },

    CoinzBalance: {
      type: Number,
      default: 100000, // 🎁 يحصل المستخدم على 100000 Coinz عند التسجيل
      min: 0,
    },

    followingCount: {
      type: Number,
      default: 0,
    },

    totalLikesReceived: {
      type: Number,
      default: 0,
    },

    totalRetweetsReceived: {
      type: Number,
      default: 0,
    },

    profileViews: {
      type: Number,
      default: 0,
    },

    /* ===== Settings ===== */

    isVerified: {
      type: Boolean,
      default: false,
    },

    activeCustomization: {
      avatarFrame: { type: String, trim: true, default: "" },
      messageEffect: { type: String, trim: true, default: "" },
      profileEntryAnimation: { type: String, trim: true, default: "" },
      badges: { type: [String], default: [] },
      verificationType: {
        type: String,
        enum: ["none", "blue", "gold", "business"],
        default: "none",
      },
    },
    customEmojiBadge: {
      emoji: { type: String, trim: true, default: "" },
      isActive: { type: Boolean, default: false },
      purchasedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
    notificationSound: {
      type: Boolean,
      default: true,
    },

    readReceiptsEnabled: {
      type: Boolean,
      default: true,
    },

    /* ===== Purchasable / Customization (NEW) ===== */

    avatarFrame: {
      type: String,
      trim: true,
      default: "", // فارغ = بدون إطار
    },

    badges: {
      type: [String],
      default: [],
    },

    verificationType: {
      type: String,
      enum: ["none", "blue", "gold", "business"],
      default: "none",
    },

    ownedMessageEffects: {
      type: [String],
      default: [],
    },

    ownedGifts: {
      type: [String],
      default: [],
    },

    // ✅ أنيميشن واحد فقط عند دخول/فتح البروفايل
    profileEntryAnimation: {
      type: String,
      trim: true,
      default: "", // فارغ = بدون أنيميشن
    },

    /* =========================
       ✅ NEW (Settings Screen)
       بدون المساس بالقديم
    ========================= */

    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
      index: true,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },

    // خصوصية
    privacy: {
      profileVisible: { type: Boolean, default: true },
      showLastActive: { type: Boolean, default: true },
      showMedia: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true },
    },

    // إشعارات (غير notificationSound العامة)
    notifications: {
      messages: { type: Boolean, default: true },
      likes: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
    },

    // تفضيلات شريك الحياة
    partnerPreferences: {
      ageRange: { type: String, trim: true, default: "" },
      location: { type: String, trim: true, default: "" },
      maritalStatus: { type: String, trim: true, default: "" },
      religiosity: { type: String, trim: true, default: "" },
    },

    // اهتمامات/وسوم
    tags: {
      type: [String],
      default: [],
      // index: true,
    },
  },
  { timestamps: true }
);

/* ===== Performance Indexes ===== */

UserSchema.index({ username: "text", atUsername: "text", displayName: "text" });
UserSchema.index({ followersCount: -1 });
UserSchema.index({ totalLikesReceived: -1 });
UserSchema.index({ isOnline: 1, lastSeen: -1 });
UserSchema.index({ verificationType: 1 });
UserSchema.index({ "privacy.profileVisible": 1 });
UserSchema.index({ tags: 1 });
UserSchema.index({ "stories.expiresAt": 1 });
UserSchema.index({ "stories.createdAt": -1 });
UserSchema.index({ "stories.privacy": 1 });
const MODEL_NAME = "User";

// ✅ في التطوير: امسح الموديل القديم إن كان متسجل بسكيما قديمة (بدون stories)
if (process.env.NODE_ENV !== "production") {
  if (mongoose.models[MODEL_NAME]) {
    delete mongoose.models[MODEL_NAME];

    // أحيانًا تُخزن السكيما داخليًا أيضًا
    const ms = (mongoose as any).modelSchemas;
    if (ms?.[MODEL_NAME]) delete ms[MODEL_NAME];
  }
}

export default mongoose.model<IUser>(MODEL_NAME, UserSchema);