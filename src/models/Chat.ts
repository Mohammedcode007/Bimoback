// Chat.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type ChatType = "private" | "group" | "room";

export interface IChat extends Document {
  type: ChatType;

  title?: string;
  description?: string;

  avatar?: string;

  participants: Types.ObjectId[];

  owner?: Types.ObjectId;
  admins: Types.ObjectId[];

  linkedRoom?: Types.ObjectId;

  lastMessage?: Types.ObjectId;
  lastActivity?: Date;

  pinnedMessages: Types.ObjectId[];

  mutedUsers: Types.ObjectId[];
  archivedBy: Types.ObjectId[];
  blockedBy: Types.ObjectId[];
  clearedBy: Types.ObjectId[];

  memberSettings: {
    user: Types.ObjectId;
    nickname?: string;
    muteUntil?: Date;
    customColor?: string;
  }[];

  isEncrypted: boolean;
  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    type: {
      type: String,
      enum: ["private", "group", "room"],
      default: "private",
      index: true
    },

    title: {
      type: String,
      trim: true
    },

    description: {
      type: String,
      maxlength: 300
    },

    avatar: String,

    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      }
    ],

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    linkedRoom: {
      type: Schema.Types.ObjectId,
      ref: "Room"
    },

    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message"
    },

    lastActivity: {
      type: Date,
      index: true
    },

    pinnedMessages: [
      {
        type: Schema.Types.ObjectId,
        ref: "Message"
      }
    ],

    mutedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    archivedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    blockedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    clearedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    memberSettings: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User"
        },
        nickname: String,
        muteUntil: Date,
        customColor: String
      }
    ],

    isEncrypted: {
      type: Boolean,
      default: false
    },

    isArchived: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   Performance Indexes
========================= */

ChatSchema.index({ participants: 1 });
ChatSchema.index({ lastActivity: -1 });
ChatSchema.index({ type: 1 });

export default mongoose.model<IChat>("Chat", ChatSchema);
