
import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "user" | "admin";
export type VerificationType = "none" | "blue" | "gold" | "business";
export type StoryType = "image" | "video" | "text";
export type StoryPrivacy = "public" | "followers" | "private";
export type BotLanguage = "ar" | "en";
export type BotType = "assistant" | "support" | "system";

export type CustomEmojiBadge = {
  emoji: string;
  isActive: boolean;
  purchasedAt?: Date | null;
  expiresAt?: Date | null;
};
export type CustomImageBadge = {
  url: string;
  isActive: boolean;
  purchasedAt?: Date | null;
  expiresAt?: Date | null;
};
export type UserStory = {
  _id?: mongoose.Types.ObjectId;

  type: StoryType;
  text?: string;
  mediaUrl?: string;
  thumbUrl?: string;
  durationMs?: number;

  privacy: StoryPrivacy;
  isArchived?: boolean;

  viewsCount: number;
  viewers?: mongoose.Types.ObjectId[];

  createdAt: Date;
  expiresAt: Date;
};

export type ActiveCustomization = {
  avatarFrame?: string;
  avatarGif?: string;
  usernameColor?: string;
  messageTextColor?: string;
  messageEffect?: string;
  profileEntryAnimation?: string;
  badges: string[];
  verificationType: VerificationType;
};

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
  gender?: "male" | "female";
  isBot?: boolean;
  isOfficial?: boolean;
  botType?: BotType | null;
  botAutoReplyEnabled?: boolean;
  botLanguage?: BotLanguage | null;

  inventory: {
    itemType: string;
    itemKey: string;
    item?: mongoose.Types.ObjectId | null;
    meta?: any;
    purchasedAt?: Date | null;
    expiresAt?: Date | null;
    quantity?: number;
  }[];

  role: UserRole;

  resetPasswordOtpHash?: string | null;
  resetPasswordOtpExpiresAt?: Date | null;
  resetPasswordOtpRequestedAt?: Date | null;
  resetPasswordOtpVerifyAttempts?: number;
  resetPasswordOtpLastAttemptAt?: Date | null;

  isOnline: boolean;
  isInvisible?: boolean;
  lastSeen?: Date | null;
  blockedUsers: mongoose.Types.ObjectId[];

  CoinzBalance: number;

  dateOfBirth?: Date;
  country?: string;
  bio?: string;
  avatar?: string;
  avatarPublicId?: string;

  avatarGif?: string;
  avatarGifPublicId?: string;

  coverImage?: string;
  cover?: string;
  coverImagePublicId?: string;

  usernameColor?: string;
  messageTextColor?: string;

  fcmTokens: string[];

  avatarFrame?: string;
  badges: string[];
  verificationType: VerificationType;
  stories: UserStory[];
  ownedMessageEffects: string[];
  ownedGifts: string[];
  profileEntryAnimation?: string;

  activeCustomization: ActiveCustomization;
  customEmojiBadge?: CustomEmojiBadge;
customImageBadge?: CustomImageBadge;
  followersCount: number;
  giftsSentCount: number;
  profileViewTimestamps?: {
    viewer: mongoose.Types.ObjectId;
    viewedAt: Date;
  }[];
  giftsReceivedCount: number;
  followingCount: number;
  totalLikesReceived: number;
  totalRetweetsReceived: number;
  profileViews: number;

  isVerified: boolean;
  notificationSound: boolean;
  readReceiptsEnabled: boolean;

  isWelcomeSender?: boolean;
  welcomeMessagesSeeded?: boolean;

  isBanned: boolean;
  banReason?: string | null;
  bannedAt?: Date | null;
  banExpiresAt?: Date | null;

  displayName?: string;
  city?: string;
  age?: number;
  privacy?: PrivacySettings;
  notifications?: NotificationSettings;
  partnerPreferences?: PartnerPreferences;

  tags: string[];

  createdAt: Date;
  updatedAt: Date;
}
const ProfileViewTimestampSchema = new Schema(
  {
    viewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

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
    durationMs: { type: Number, default: 6000, min: 1000, max: 60000 },
    privacy: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    isArchived: { type: Boolean, default: false, index: true },
    viewsCount: { type: Number, default: 0 },
    viewers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true },
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
      default: undefined,
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
    profileViewTimestamps: {
      type: [ProfileViewTimestampSchema],
      default: [],
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

    dateOfBirth: Date,

    country: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: null,
      index: true,
    },
    bio: {
      type: String,
      maxlength: 2000,
    },

    avatar: {
      type: String,
      trim: true,
      default: "",
    },

    avatarPublicId: {
      type: String,
      trim: true,
      default: "",
    },

    avatarGif: {
      type: String,
      trim: true,
      default: "",
    },

    avatarGifPublicId: {
      type: String,
      trim: true,
      default: "",
    },

    coverImage: {
      type: String,
      trim: true,
      default: "",
    },

    cover: {
      type: String,
      trim: true,
      default: "",
    },

    coverImagePublicId: {
      type: String,
      trim: true,
      default: "",
    },

    usernameColor: {
      type: String,
      trim: true,
      default: "",
    },

    messageTextColor: {
      type: String,
      trim: true,
      default: "",
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    resetPasswordOtpHash: {
      type: String,
      default: null,
    },

    resetPasswordOtpExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    resetPasswordOtpRequestedAt: {
      type: Date,
      default: null,
    },

    resetPasswordOtpVerifyAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    resetPasswordOtpLastAttemptAt: {
      type: Date,
      default: null,
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

    followersCount: {
      type: Number,
      default: 0,
    },
    giftsSentCount: {
      type: Number,
      default: 0,
    },

    giftsReceivedCount: {
      type: Number,
      default: 0,
    },
    CoinzBalance: {
      type: Number,
      default: 10000,
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

    botLanguage: {
      type: String,
      enum: ["ar", "en"],
      default: null,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    inventory: [
      {
        itemType: {
          type: String,
          default: "badge",
        },

        itemKey: {
          type: String,
          required: true,
        },

        item: {
          type: Schema.Types.ObjectId,
          ref: "StoreItem",
          default: null,
        },

        meta: {
          type: Schema.Types.Mixed,
          default: {},
        },

        purchasedAt: {
          type: Date,
          default: null,
        },

        expiresAt: {
          type: Date,
          default: null,
        },

        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],

    activeCustomization: {
      avatarFrame: { type: String, trim: true, default: "" },
      avatarGif: { type: String, trim: true, default: "" },
      usernameColor: { type: String, trim: true, default: "" },
      messageTextColor: { type: String, trim: true, default: "" },
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
customImageBadge: {
  url: { type: String, trim: true, default: "" },
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

    isWelcomeSender: {
      type: Boolean,
      default: false,
      index: true,
    },

    welcomeMessagesSeeded: {
      type: Boolean,
      default: false,
      index: true,
    },

    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },

    banReason: {
      type: String,
      trim: true,
      default: null,
    },

    isBot: {
      type: Boolean,
      default: false,
      index: true,
    },

    isOfficial: {
      type: Boolean,
      default: false,
      index: true,
    },

    botType: {
      type: String,
      enum: ["assistant", "support", "system"],
      default: null,
      index: true,
    },

    botAutoReplyEnabled: {
      type: Boolean,
      default: false,
    },

    bannedAt: {
      type: Date,
      default: null,
    },

    banExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    avatarFrame: {
      type: String,
      trim: true,
      default: "",
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

    profileEntryAnimation: {
      type: String,
      trim: true,
      default: "",
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
      index: true,
    },
    age: {
      type: Number,
      min: 1,
      max: 120,
      default: null,
      index: true,
    },

    city: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
      index: true,
    },

    privacy: {
      profileVisible: { type: Boolean, default: true },
      showLastActive: { type: Boolean, default: true },
      showMedia: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true },
    },

    notifications: {
      messages: { type: Boolean, default: true },
      likes: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
    },

    partnerPreferences: {
      ageRange: { type: String, trim: true, default: "" },
      location: { type: String, trim: true, default: "" },
      maritalStatus: { type: String, trim: true, default: "" },
      religiosity: { type: String, trim: true, default: "" },
    },

    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

UserSchema.index({ username: "text", atUsername: "text", displayName: "text" });
UserSchema.index({ followersCount: -1 });
UserSchema.index({ totalLikesReceived: -1 });
UserSchema.index({ isOnline: 1, lastSeen: -1 });
UserSchema.index({ isBot: 1, botType: 1 });
UserSchema.index({ isOfficial: 1, isBot: 1 });
UserSchema.index({ verificationType: 1 });
UserSchema.index({ "privacy.profileVisible": 1 });
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    sparse: true,
  }
);
UserSchema.index({ tags: 1 });
UserSchema.index({ "stories.expiresAt": 1 });
UserSchema.index({ "stories.createdAt": -1 });
UserSchema.index({ "stories.privacy": 1 });

const MODEL_NAME = "User";

if (process.env.NODE_ENV !== "production") {
  if (mongoose.models[MODEL_NAME]) {
    delete mongoose.models[MODEL_NAME];
    const ms = (mongoose as any).modelSchemas;
    if (ms?.[MODEL_NAME]) delete ms[MODEL_NAME];
  }
}

export default mongoose.model<IUser>(MODEL_NAME, UserSchema);