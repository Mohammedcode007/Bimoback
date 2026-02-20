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

  creator: Types.ObjectId;
  type: RoomType;
  maxUsers: number;
  password?: string;
  subscriptionPrice?: number;
  owners: Types.ObjectId[];
  admins: Types.ObjectId[];
  members: Types.ObjectId[];
  blockeds: Types.ObjectId[];
activeUsers: Types.ObjectId[];
  mutedUsers: {
    user: Types.ObjectId;
    until: Date;
  }[];

  vipUsers: {
    user: Types.ObjectId;
    expiresAt: Date;
  }[];

  /* Voice */
  maxVoiceSeats: number;
  voiceQueue: Types.ObjectId[];
  raisedHands: Types.ObjectId[];

  /* Anti Spam */
  antiSpamEnabled: boolean;
  maxMessagesPerMinute: number;

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

  createdAt: Date;
  updatedAt: Date;
}

/* =====================================================
   SCHEMA
===================================================== */

const RoomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: true },
    description: String,

    avatar: String,
    cover: String,

    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: Object.values(RoomType),
      default: RoomType.PUBLIC
    },

    owners: [{ type: Schema.Types.ObjectId, ref: "User" }],
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    blockeds: [{ type: Schema.Types.ObjectId, ref: "User" }],

    mutedUsers: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        until: Date
      }
    ],
    maxUsers: { type: Number, default: 50 },
    password: { type: String }, // للغرف Protected

    subscriptionPrice: { type: Number, default: 0 },
    vipUsers: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        expiresAt: Date
      }
    ],
activeUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    maxVoiceSeats: { type: Number, default: 4 },
    voiceQueue: [{ type: Schema.Types.ObjectId, ref: "User" }],
    raisedHands: [{ type: Schema.Types.ObjectId, ref: "User" }],

    antiSpamEnabled: { type: Boolean, default: false },
    maxMessagesPerMinute: { type: Number, default: 10 },

    activePoll: {
      question: String,
      options: [
        {
          text: String,
          votes: { type: Number, default: 0 }
        }
      ],
      expiresAt: Date
    },

    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },

    boostLevel: { type: Number, default: 0 },
    boostExpiresAt: Date,

    usersCount: { type: Number, default: 0 },
    messagesCount: { type: Number, default: 0 },

    totalRevenue: { type: Number, default: 0 },

    premiumLevel: {
      type: Number,
      default: RoomPremiumLevel.FREE
    }
  },
  { timestamps: true }
);

/* =====================================================
   INDEXES
===================================================== */

RoomSchema.index({ usersCount: -1 });
RoomSchema.index({ level: -1 });
RoomSchema.index({ boostLevel: -1 });

/* =====================================================
   CASCADE DELETE
===================================================== */

RoomSchema.pre(
  "findOneAndDelete",
  async function (this: Query<any, IRoom>) {
    const room = await this.model.findOne(this.getFilter());
    if (!room) return;
    await RoomMessage.deleteMany({ room: room._id });
  }
);

export default mongoose.model<IRoom>("Room", RoomSchema);