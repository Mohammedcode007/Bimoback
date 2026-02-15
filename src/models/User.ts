
// models/User.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  atUsername: string;
  password: string;
  email?: string;

  isOnline: boolean;
  isInvisible?:boolean;
  lastSeen?: Date;
  blockedUsers: mongoose.Types.ObjectId[];

  dateOfBirth?: Date;
  country?: string;
  bio?: string;

  avatar?: string;
  coverImage?: string;

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
    isInvisible: {     // 👈 تحكم المستخدم
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

/* ===== Performance Indexes ===== */

UserSchema.index({ username: "text", atUsername: "text" });
UserSchema.index({ followersCount: -1 });
UserSchema.index({ totalLikesReceived: -1 });
UserSchema.index({ isOnline: 1, lastSeen: -1 });

export default mongoose.model<IUser>("User", UserSchema);
