// models/Notification.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType =
  | "message"
  | "friend_request"
  | "friend_accepted"
  | "tweet_like"
  | "tweet_reply"
  | "tweet_retweet"
  | "room_invite"
  | "badge_awarded"
  | "system";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  sender?: Types.ObjectId;
  type: NotificationType;
  title?: string;
  body: string;

  relatedUser?: Types.ObjectId;
  relatedChat?: Types.ObjectId;
  relatedMessage?: Types.ObjectId;
  relatedTweet?: Types.ObjectId;
  relatedRoom?: Types.ObjectId;
  relatedBadge?: Types.ObjectId;

  isRead: boolean;
  readAt?: Date;

  isSilent: boolean;
  priority: number;

  expiresAt?: Date;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    type: {
      type: String,
      enum: [
        "message",
        "friend_request",
        "friend_accepted",
        "tweet_like",
        "tweet_reply",
        "tweet_retweet",
        "room_invite",
        "badge_awarded",
        "system"
      ],
      required: true
    },

    title: String,

    body: {
      type: String,
      required: true
    },

    relatedUser: { type: Schema.Types.ObjectId, ref: "User" },
    relatedChat: { type: Schema.Types.ObjectId, ref: "Chat" },
    relatedMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    relatedTweet: { type: Schema.Types.ObjectId, ref: "Tweet" },
    relatedRoom: { type: Schema.Types.ObjectId, ref: "Room" },
    relatedBadge: { type: Schema.Types.ObjectId, ref: "Badge" },

    isRead: {
      type: Boolean,
      default: false
    },

    readAt: Date,

    isSilent: {
      type: Boolean,
      default: false
    },

    priority: {
      type: Number,
      default: 0
    },

    expiresAt: Date,

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

/* ================= PERFORMANCE ================= */

// جلب غير المقروء بسرعة
NotificationSchema.index({ recipient: 1, isRead: 1 });

// ترتيب الإشعارات
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// حذف تلقائي
NotificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export default mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
