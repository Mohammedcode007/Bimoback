import mongoose, { Schema, Document, Types } from "mongoose";

export interface IChat extends Document {

  participants: Types.ObjectId[];

  lastMessage?: Types.ObjectId;
  lastMessagePreview?: string;
  lastMessageType?: string;

  unreadCounts: Record<string, number>;

  deletedFor: Types.ObjectId[];
  mutedBy: Types.ObjectId[];
  archivedBy: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

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

 unreadCounts: {
  type: Object,
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
    ]
  },
  { timestamps: true }
);

/* ======================================================
   VALIDATION FOR 1-1 CHAT
====================================================== */

ChatSchema.pre<IChat>("validate", function () {

  if (this.participants.length !== 2) {
    throw new Error("Private chat must have exactly 2 participants");
  }
});


/* ======================================================
   INDEXES
====================================================== */

ChatSchema.index({ participants: 1 });
ChatSchema.index({ updatedAt: -1 });

export default mongoose.model<IChat>("Chat", ChatSchema);
