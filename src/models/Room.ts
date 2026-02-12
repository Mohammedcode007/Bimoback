// Room.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type RoomType = "public" | "private";
export type MessagePermission =
  | "everyone"
  | "admins"
  | "moderators";

export interface IRoom extends Document {
  name: string;
  description?: string;

  type: RoomType;

  avatar?: string;
  coverImage?: string;

  owner: Types.ObjectId;

  admins: Types.ObjectId[];
  moderators: Types.ObjectId[];
  members: Types.ObjectId[];

  pendingRequests: Types.ObjectId[];
  bannedUsers: Types.ObjectId[];
  mutedUsers: Types.ObjectId[];

  pinnedMessages: Types.ObjectId[];

  category?: string;

  inviteLink?: string;
  joinApprovalRequired: boolean;

  messagePermission: MessagePermission;

  membersCount: number;
  messagesCount: number;

  lastActivity?: Date;

  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      maxlength: 500
    },

    type: {
      type: String,
      enum: ["public", "private"],
      default: "public"
    },

    avatar: String,
    coverImage: String,

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    moderators: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    pendingRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    bannedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    mutedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    pinnedMessages: [
      {
        type: Schema.Types.ObjectId,
        ref: "Message"
      }
    ],

    category: {
      type: String,
      index: true
    },

    inviteLink: {
      type: String,
      unique: true,
      sparse: true
    },

    joinApprovalRequired: {
      type: Boolean,
      default: false
    },

    messagePermission: {
      type: String,
      enum: ["everyone", "admins", "moderators"],
      default: "everyone"
    },

    membersCount: {
      type: Number,
      default: 0
    },

    messagesCount: {
      type: Number,
      default: 0
    },

    lastActivity: Date,

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

RoomSchema.index({ name: 1 });
RoomSchema.index({ type: 1 });
RoomSchema.index({ category: 1 });
RoomSchema.index({ membersCount: -1 });
RoomSchema.index({ lastActivity: -1 });

export default mongoose.model<IRoom>("Room", RoomSchema);
