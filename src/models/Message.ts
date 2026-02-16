import mongoose, { Schema, Document, Types } from "mongoose";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "system"
  | "date_separator";

export interface IMessage extends Document {

  chat: Types.ObjectId;
  sender?: Types.ObjectId;

  type: MessageType;
  content: string;

  media?: {
    url: string;
    publicId?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    thumbnail?: string;
    duration?: number;
  };

  /* ================= REPLY ================= */

  replyTo?: Types.ObjectId;

  replySnapshot?: {
    content?: string;
    type?: MessageType;
    sender?: Types.ObjectId;
  };

  /* ================= FORWARD ================= */

  forwardedFrom?: Types.ObjectId;

  /* ================= REACTIONS ================= */

  reactions: {
    user: Types.ObjectId;
    emoji: string;
    createdAt: Date;
  }[];

  /* ================= DELIVERY ================= */

  deliveryStatus: {
    deliveredTo: Types.ObjectId[];
    seenBy: Types.ObjectId[];
    deliveredAt?: Date;
    seenAt?: Date;
  };

  status: "sent" | "delivered" | "seen";

  /* ================= DELETE ================= */

  deletedForEveryone: boolean;
  deletedFor: Types.ObjectId[];

  /* ================= EDIT ================= */

  edited: boolean;
  editedAt?: Date;

  /* ================= SYSTEM ================= */

  isSystemMessage: boolean;

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
      required: function (this: IMessage) {
        return !this.isSystemMessage;
      }
    },

    type: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "file",
        "system",
        "date_separator"
      ],
      default: "text"
    },

    content: {
      type: String,
      trim: true,
      default: ""
    },

    media: {
      url: String,
      publicId: String,
      fileName: String,
      fileSize: Number,
      mimeType: String,
      thumbnail: String,
      duration: Number
    },

    /* ================= REPLY ================= */

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      index: true
    },

    replySnapshot: {
      content: String,
      type: {
        type: String,
        enum: [
          "text",
          "image",
          "video",
          "audio",
          "file",
          "system",
          "date_separator"
        ]
      },
      sender: {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    },

    /* ================= FORWARD ================= */

    forwardedFrom: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    /* ================= REACTIONS ================= */

    reactions: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        emoji: {
          type: String,
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    /* ================= DELIVERY ================= */

    deliveryStatus: {
      deliveredTo: [
        {
          type: Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      seenBy: [
        {
          type: Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      deliveredAt: Date,
      seenAt: Date
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent"
    },

    /* ================= DELETE ================= */

    deletedForEveryone: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    /* ================= EDIT ================= */

    edited: {
      type: Boolean,
      default: false
    },

    editedAt: Date,

    /* ================= SYSTEM ================= */

    isSystemMessage: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

/* ================= PERFORMANCE INDEXES ================= */

/* أسرع جلب رسائل المحادثة */
MessageSchema.index({ chat: 1, createdAt: -1 });

/* تسريع الردود */

/* تسريع البحث */
MessageSchema.index({ content: "text" });

/* تسريع seen */
MessageSchema.index({
  chat: 1,
  "deliveryStatus.seenBy": 1
});

/* فلترة الحذف */
MessageSchema.index({
  chat: 1,
  deletedForEveryone: 1
});

export default mongoose.model<IMessage>("Message", MessageSchema);
