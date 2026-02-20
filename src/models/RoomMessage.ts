import mongoose, { Schema, Document, Types } from "mongoose";

/* =====================================================
   TYPES
===================================================== */

export type RoomMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "system"
  | "announcement"
  | "join"
  | "leave"
  | "promotion"
  | "ban"
  | "gift";

/* =====================================================
   INTERFACE
===================================================== */

export interface IRoomMessage extends Document {
  room: Types.ObjectId;
  sender?: Types.ObjectId;

  type: RoomMessageType;
  content: string;

  replyTo?: Types.ObjectId;

  mentions: Types.ObjectId[];

  media?: {
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };

  gift?: {
    name: string;
    value: number;
    animation?: string;
  };

  isPinned: boolean;
  isHighlighted: boolean;

  expiresAt?: Date;

  reactions: {
    user: Types.ObjectId;
    emoji: string;
    createdAt: Date;
  }[];

  deletedForEveryone: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/* =====================================================
   SCHEMA
===================================================== */

const RoomMessageSchema = new Schema<IRoomMessage>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User"
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
        "announcement",
        "join",
        "leave",
        "promotion",
        "ban",
        "gift"
      ],
      default: "text"
    },

    content: {
      type: String,
      default: ""
    },

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "RoomMessage"
    },

    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    media: {
      url: String,
      fileName: String,
      fileSize: Number,
      mimeType: String
    },

    gift: {
      name: String,
      value: Number,
      animation: String
    },

    isPinned: {
      type: Boolean,
      default: false
    },

    isHighlighted: {
      type: Boolean,
      default: false
    },

    expiresAt: Date,

    reactions: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        emoji: String,
        createdAt: { type: Date, default: Date.now }
      }
    ],

    deletedForEveryone: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

/* =====================================================
   INDEXES (Performance Optimized)
===================================================== */

// الرسائل الأحدث أولًا داخل الغرفة
RoomMessageSchema.index({ room: 1, createdAt: -1 });

// pinned فقط
RoomMessageSchema.index(
  { room: 1, isPinned: 1 },
  { partialFilterExpression: { isPinned: true } }
);

// reply support
RoomMessageSchema.index({ replyTo: 1 });

// mentions lookup
RoomMessageSchema.index({ mentions: 1 });

// reactions lookup
RoomMessageSchema.index({ "reactions.user": 1 });

// TTL for expiring messages
RoomMessageSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

/* =====================================================
   SOFT DELETE FILTER
===================================================== */

RoomMessageSchema.pre(/^find/, function (next) {
  this.where({ deletedForEveryone: false });
  next();
});

/* =====================================================
   MESSAGE COUNT SAFE UPDATE
===================================================== */

// زيادة العداد فقط عند الإنشاء
RoomMessageSchema.post("save", async function (doc) {
  if (this.isNew) {
    await mongoose.model("Room").updateOne(
      { _id: doc.room },
      { $inc: { messagesCount: 1 } }
    );
  }
});

// إنقاص العداد عند الحذف
RoomMessageSchema.post("findOneAndDelete", async function (doc: any) {
  if (!doc) return;

  await mongoose.model("Room").updateOne(
    { _id: doc.room },
    { $inc: { messagesCount: -1 } }
  );
});

/* =====================================================
   EXPORT
===================================================== */

export default mongoose.model<IRoomMessage>(
  "RoomMessage",
  RoomMessageSchema
);