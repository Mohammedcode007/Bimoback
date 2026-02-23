import mongoose, { Schema, Document, Types, Query } from "mongoose";
import RoomMessage from "./RoomMessage";

/* =====================================================
   ENUMS
===================================================== */

export enum RoomType {
  PUBLIC = "public",
  PRIVATE = "private",
  PROTECTED = "protected",
  SUBSCRIPTION = "subscription"
}

export enum RoomPremiumLevel {
  FREE = 0,
  SILVER = 1,
  GOLD = 2,
  PLATINUM = 3,
  ELITE = 4
}

/* =====================================================
   INTERFACE
===================================================== */

export interface IRoom extends Document {
  name: string;
  description?: string;

  avatar?: string;
  cover?: string;
  boostPoints: number;

  creator: Types.ObjectId;
  type: RoomType;

  // Access / Limits
  maxUsers: number;
  password?: string; // PROTECTED rooms
  subscriptionPrice?: number; // SUBSCRIPTION rooms
  isLocked: boolean; // منع دخول أي شخص مؤقتًا
  slowModeSeconds: number; // منع الإرسال السريع (0 = off)

  // Roles & Lists
  owners: Types.ObjectId[];
  admins: Types.ObjectId[];
  members: Types.ObjectId[];
  blockeds: Types.ObjectId[];
  activeUsers: Types.ObjectId[];

  mutedUsers: {
    user: Types.ObjectId;
    until: Date;
    reason?: string;
  }[];

  vipUsers: {
    user: Types.ObjectId;
    expiresAt: Date;
  }[];

  /* Voice */
  maxVoiceSeats: number;
  voiceQueue: Types.ObjectId[];
  raisedHands: Types.ObjectId[];

  // من على المايك حاليًا (اختياري لكنه عملي)
  voiceSpeakers: Types.ObjectId[];

  /* Anti Spam */
  antiSpamEnabled: boolean;
  maxMessagesPerMinute: number;

  // تتبع معدل الإرسال لكل مستخدم (لتطبيق anti-spam/slowmode)
  // ملاحظة: Map في mongoose أفضل من Record داخل schema.
  userMessageCounters: Map<
    string,
    {
      count: number;
      resetAt: Date;
    }
  >;

  /* Poll */
  activePoll?: {
    question: string;
    options: {
      text: string;
      votes: number;
    }[];
    expiresAt: Date;
  };

  /* Level System */
  level: number;
  xp: number;

  /* Boost */
  boostLevel: number;
  boostExpiresAt?: Date;

  /* Stats */
  usersCount: number;
  messagesCount: number;

  /* Revenue */
  totalRevenue: number;

  premiumLevel: RoomPremiumLevel;

  // Metadata / Safety
  tags: string[];
  isVerified: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/* =====================================================
   SUBSCHEMAS
===================================================== */

const MutedUserSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    until: { type: Date, required: true, index: true },
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const VipUserSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { _id: false }
);

const PollSchema = new Schema(
  {
    question: { type: String, trim: true },
    options: [
      {
        text: { type: String, trim: true },
        votes: { type: Number, default: 0 }
      }
    ],
    expiresAt: { type: Date }
  },
  { _id: false }
);

/* =====================================================
   SCHEMA
===================================================== */

const RoomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },

    avatar: { type: String, trim: true },
    cover: { type: String, trim: true },
    boostPoints: { type: Number, default: 0, min: 0, index: true },

    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: Object.values(RoomType),
      default: RoomType.PUBLIC,
      index: true
    },

    owners: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    admins: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    members: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    blockeds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],

    activeUsers: [{ type: Schema.Types.ObjectId, ref: "User"}],

    mutedUsers: { type: [MutedUserSchema], default: [] },

    maxUsers: { type: Number, default: 50, min: 1 },
    password: { type: String, select: false }, // لا تُرجع الباسورد في الاستعلامات افتراضيًا

    subscriptionPrice: { type: Number, default: 0, min: 0 },

    vipUsers: { type: [VipUserSchema], default: [] },

    isLocked: { type: Boolean, default: false, index: true },
    slowModeSeconds: { type: Number, default: 0, min: 0, max: 3600 },

    maxVoiceSeats: { type: Number, default: 4, min: 0, max: 50 },
    voiceQueue: [{ type: Schema.Types.ObjectId, ref: "User" }],
    raisedHands: [{ type: Schema.Types.ObjectId, ref: "User" }],

    voiceSpeakers: [{ type: Schema.Types.ObjectId, ref: "User" }],

    antiSpamEnabled: { type: Boolean, default: false },
    maxMessagesPerMinute: { type: Number, default: 10, min: 1, max: 1000 },

    userMessageCounters: {
      type: Map,
      of: new Schema(
        {
          count: { type: Number, default: 0, min: 0 },
          resetAt: { type: Date, default: Date.now }
        },
        { _id: false }
      ),
      default: {}
    },

    activePoll: {
      type: PollSchema,
      default: undefined
    },

    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0, min: 0 },

    boostLevel: { type: Number, default: 0, min: 0, max: 10 },
    boostExpiresAt: { type: Date, default: undefined, index: true },

    usersCount: { type: Number, default: 0, min: 0 },
    messagesCount: { type: Number, default: 0, min: 0 },

    totalRevenue: { type: Number, default: 0, min: 0 },

premiumLevel: {
  type: Number,
  default: RoomPremiumLevel.FREE,
  enum: Object.values(RoomPremiumLevel).filter((v) => typeof v === "number"),
},

    tags: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

/* =====================================================
   VALIDATION / NORMALIZATION
===================================================== */

// تنظيف tags + منع التكرار
RoomSchema.pre("validate", function () {
  // tags: trim + unique + max length
  if (Array.isArray(this.tags)) {
    const clean = this.tags
      .map((t) => String(t || "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);

    this.tags = Array.from(new Set(clean));
  }

  // إذا الغرفة ليست PROTECTED -> امسح password
  if (this.type !== RoomType.PROTECTED) {
    this.password = undefined;
  }

  // إذا ليست SUBSCRIPTION -> امسح السعر
  if (this.type !== RoomType.SUBSCRIPTION) {
    this.subscriptionPrice = 0;
  }

  // ضمان مصفوفات
  this.owners ||= [];
  this.admins ||= [];
  this.members ||= [];
  this.blockeds ||= [];
  this.activeUsers ||= [];
  this.voiceQueue ||= [];
  this.raisedHands ||= [];
  this.voiceSpeakers ||= [];
  this.mutedUsers ||= [];
  this.vipUsers ||= [];
});
  const bp = Number((this as any).boostPoints);
  (this as any).boostPoints = Number.isFinite(bp) && bp > 0 ? Math.trunc(bp) : 0;


/* =====================================================
   INDEXES
===================================================== */

// Existing
RoomSchema.index({ usersCount: -1 });
RoomSchema.index({ level: -1 });
RoomSchema.index({ boostLevel: -1 });
RoomSchema.index({ boostPoints: -1 });

// Useful for discovery/search
RoomSchema.index({ type: 1, premiumLevel: -1, usersCount: -1 });
RoomSchema.index({ "vipUsers.user": 1 });
RoomSchema.index({ "mutedUsers.user": 1 });
RoomSchema.index({ activeUsers: 1 });
RoomSchema.index({ tags: 1 });

/* =====================================================
   CASCADE DELETE
===================================================== */

// ✅ بدون next لتفادي مشاكل TS Overloads
RoomSchema.pre(
  "findOneAndDelete",
  async function (this: Query<any, IRoom>) {
    const room = await this.model.findOne(this.getFilter()).select("_id");
    if (!room) return;
    await RoomMessage.deleteMany({ room: room._id });
  }
);

/* =====================================================
   EXPORT
===================================================== */

export default mongoose.model<IRoom>("Room", RoomSchema);