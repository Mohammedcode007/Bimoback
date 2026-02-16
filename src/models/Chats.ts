import mongoose, { Schema, Document, Types } from "mongoose";

/* ======================================================
   INTERFACE
====================================================== */

export interface IChat extends Document {
  participants: Types.ObjectId[];

  /* 🔥 آخر رسالة */
  lastMessage?: Types.ObjectId;
  lastMessagePreview?: string;
  lastMessageType?: string;

  /* 🔥 unread per user */
  unreadCounts: Map<string, number>;

  deletedFor: Types.ObjectId[];
  mutedBy: Types.ObjectId[];
  archivedBy: Types.ObjectId[];

  isBlocked: boolean;
  blockedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

/* ======================================================
   SCHEMA
====================================================== */

const ChatSchema = new Schema<IChat>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],

    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message"
    },

    lastMessagePreview: {
      type: String,
      default: ""
    },

    lastMessageType: {
      type: String,
      default: "text"
    },

    /* 🔥 Map unreadCounts */
    unreadCounts: {
      type: Map,
      of: Number,
      default: {}
    },

    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    mutedBy: [
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

    isBlocked: {
      type: Boolean,
      default: false
    },

    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

/* ======================================================
   PRE VALIDATE — منع تكرار وترتيب المشاركين
====================================================== */

ChatSchema.pre("validate", function () {

  if (this.participants.length !== 2) {
    throw new Error("Chat must contain exactly 2 participants");
  }

  this.participants = this.participants
    .map(id => id.toString())
    .sort()
    .map(id => new mongoose.Types.ObjectId(id));

});


/* ======================================================
   INDEXES
====================================================== */

/* منع تكرار المحادثة بين نفس الشخصين */
ChatSchema.index({ participants: 1 }, { unique: true });

/* تحسين ترتيب قائمة المحادثات */
ChatSchema.index({ participants: 1, updatedAt: -1 });

/* دعم الحذف الفردي */
ChatSchema.index({ deletedFor: 1 });

/* ======================================================
   EXPORT
====================================================== */

export default mongoose.model<IChat>("Chat", ChatSchema);
