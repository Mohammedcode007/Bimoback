// Message.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "system";

export interface IMessage extends Document {
  chat: Types.ObjectId;
  sender: Types.ObjectId;

  type: MessageType;

  content?: string;

  media?: {
    url: string;
    publicId?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };

  replyTo?: Types.ObjectId;

  forwardedFrom?: Types.ObjectId;

  reactions: {
    user: Types.ObjectId;
    emoji: string;
  }[];

  readBy: Types.ObjectId[];

  deletedForEveryone: boolean;
  deletedFor: Types.ObjectId[];

  edited: boolean;
  editedAt?: Date;

  pinned: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file", "system"],
      default: "text"
    },

    content: {
      type: String,
      trim: true
    },

    media: {
      url: String,
      publicId: String,
      fileName: String,
      fileSize: Number,
      mimeType: String
    },

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message"
    },

    forwardedFrom: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    reactions: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User"
        },
        emoji: String
      }
    ],

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    deletedForEveryone: {
      type: Boolean,
      default: false
    },

    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    edited: {
      type: Boolean,
      default: false
    },

    editedAt: Date,

    pinned: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   Indexes for Performance
========================= */

MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ replyTo: 1 });

export default mongoose.model<IMessage>("Message", MessageSchema);
