// models/User.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  username: string;
  atUsername: string;
  password: string;
  email?: string;

  isOnline: boolean;
  lastSeen?: Date;

  chats: Types.ObjectId[];
  tweets: Types.ObjectId[];
  rooms: Types.ObjectId[];
  badges: Types.ObjectId[];

  blockedUsers: Types.ObjectId[];

  avatar?: string;
  coverImage?: string;
  bio?: string;

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
      lowercase: true
    },

    password: {
      type: String,
      required: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true // ليس unique
    },

    isOnline: {
      type: Boolean,
      default: false
    },

    lastSeen: {
      type: Date
    },

    chats: [{ type: Schema.Types.ObjectId, ref: "Chat" }],
    tweets: [{ type: Schema.Types.ObjectId, ref: "Tweet" }],
    rooms: [{ type: Schema.Types.ObjectId, ref: "Room" }],
    badges: [{ type: Schema.Types.ObjectId, ref: "Badge" }],

    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    avatar: String,
    coverImage: String,

    bio: {
      type: String,
      maxlength: 250
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    notificationSound: {
      type: Boolean,
      default: true
    },

    readReceiptsEnabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

/* ================= PERFORMANCE INDEXES ================= */

// بحث سريع
UserSchema.index({ username: "text", atUsername: "text" });

// ترتيب أونلاين
UserSchema.index({ isOnline: 1, lastSeen: -1 });

// تحقق سريع من الحظر
UserSchema.index({ blockedUsers: 1 });

export default mongoose.model<IUser>("User", UserSchema);
