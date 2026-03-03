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

export type RoomRole = "creator" | "owner" | "admin" | "member";
export type RoomSystemAction =
  | "role:set"
  | "role:transferCreator"
  | "user:ban"
  | "user:unban"
  | "room:announcement"
  | ""; // للتوافق


/* =====================================================
   INTERFACE
===================================================== */

export interface IRoomMessage extends Document {
  room: Types.ObjectId;
  sender?: Types.ObjectId;
  clientId?: string; // ✅ لتوحيد optimistic message مع رسالة السيرفر ومنع التكرار
  type: RoomMessageType;
  content: string;
  senderSnapshot?: {
    _id: string;
    username: string;
    atUsername?: string;
    avatar?: string;

    activeCustomization?: {
      avatarFrame?: string;
      messageEffect?: string;
      profileEntryAnimation?: string;
      badges: string[];
      verificationType: "none" | "blue" | "gold" | "business";
    };

    verificationType?: "none" | "blue" | "gold" | "business";
    avatarFrame?: string;
    badges?: string[];
    profileEntryAnimation?: string;
  };
  // ✅ System meta (للترقيات والأحداث)
  action?: RoomSystemAction;

  actorId?: Types.ObjectId;
  targetId?: Types.ObjectId;

  actorName?: string;
  targetName?: string;

  role?: RoomRole | ""; // في رسائل promotion/role:set

  meta?: {
    action?: RoomSystemAction;
    actorId?: string;
    actorName?: string;
    targetId?: string;
    targetName?: string;
    role?: RoomRole | "";
  };

  replyTo?: Types.ObjectId;
  mentions: Types.ObjectId[];

  media?: {
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };

 gift?: {
  key: string;              // gift_rose | boost_rocket ...
  icon?: string;            // 🌹 ...
  count?: number;           // للـ overlay particles
  targetId?: string;        // كـ string لتبسيط التوافق مع الفرونت (أو Types.ObjectId)
  targetName?: string;

  // إن كنت لازلت تحتاجها (اختياري)
  name?: string;            // display name (Rose/Boost...)
  value?: number;           // قيمة/مستوى
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
   SUBSCHEMAS
===================================================== */

const MediaSchema = new Schema(
  {
    url: { type: String, trim: true },
    fileName: { type: String, trim: true },
    fileSize: { type: Number, min: 0 },
    mimeType: { type: String, trim: true }
  },
  { _id: false }
);

const GiftSchema = new Schema(
  {
    key: { type: String, trim: true, default: "" },   // ✅ أساسي
    icon: { type: String, trim: true, default: "" },
    count: { type: Number, min: 0, default: 0 },

    targetId: { type: String, trim: true, default: "" },
    targetName: { type: String, trim: true, default: "" },

    // اختياري للحفاظ على الموجود
    name: { type: String, trim: true, default: "" },
    value: { type: Number, min: 0, default: 0 },
    animation: { type: String, trim: true, default: "" }
  },
  { _id: false }
);
const ReactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

// ✅ Meta schema لرسائل النظام/الترقيات
const SystemMetaSchema = new Schema(
  {
    action: { type: String, default: "", trim: true },

    actorId: { type: String, default: "", trim: true },
    actorName: { type: String, default: "", trim: true },

    targetId: { type: String, default: "", trim: true },
    targetName: { type: String, default: "", trim: true },

    role: { type: String, default: "", trim: true } // creator|owner|admin|member
  },
  { _id: false }
);

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
      ref: "User",
      index: true
    },
clientId: {
  type: String,
  trim: true,
  default: undefined,
  index: true
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
      default: "text",
      required: true,
      index: true
    },

    content: {
      type: String,
      default: "",
      trim: true
    },

    /* ============================
       ✅ System / Promotion fields
       (حل مشكلة ضياع actor/target/role في strict mode)
    ============================ */
    senderSnapshot: {
      type: {
        _id: { type: String, default: "" },
        username: { type: String, default: "", trim: true },
        atUsername: { type: String, default: "", trim: true },
        avatar: { type: String, default: "", trim: true },

        activeCustomization: {
          avatarFrame: { type: String, default: "" },
          messageEffect: { type: String, default: "" },
          profileEntryAnimation: { type: String, default: "" },
          badges: { type: [String], default: [] },
          verificationType: { type: String, default: "none" }
        },

        verificationType: { type: String, default: "none" },
        avatarFrame: { type: String, default: "" },
        badges: { type: [String], default: [] },
        profileEntryAnimation: { type: String, default: "" }
      },
      default: undefined
    },
    action: {
      type: String,
      default: "",
      trim: true,
      index: true
    },

    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: undefined
    },

    targetId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: undefined
    },

    actorName: {
      type: String,
      default: "",
      trim: true
    },

    targetName: {
      type: String,
      default: "",
      trim: true
    },

    role: {
      type: String,
      default: "",
      trim: true,
      index: true
    },

    meta: {
      type: SystemMetaSchema,
      default: undefined
    },

    /* ============================
       Reply / Mentions
    ============================ */

    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "RoomMessage",
      index: true
    },

    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true
      }
    ],

    /* ============================
       Media / Gift
    ============================ */

    media: {
      type: MediaSchema,
      default: undefined
    },

    gift: {
      type: GiftSchema,
      default: undefined
    },

    /* ============================
       Flags
    ============================ */

    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },

    isHighlighted: {
      type: Boolean,
      default: false,
      index: true
    },

    expiresAt: {
      type: Date,
      default: undefined,
    },

    reactions: {
      type: [ReactionSchema],
      default: []
    },

    deletedForEveryone: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

/* =====================================================
   VALIDATION & NORMALIZATION
===================================================== */

RoomMessageSchema.path("content").validate(function (this: IRoomMessage) {
  const noContentTypes: RoomMessageType[] = ["system", "announcement", "join", "leave", "promotion", "ban"];

  if (noContentTypes.includes(this.type)) return true;

  if (["image", "video", "audio", "file"].includes(this.type)) {
    return Boolean(this.media?.url) || (this.content?.trim()?.length ?? 0) > 0;
  }

if (this.type === "gift") {
  const key = String(this.gift?.key || "").trim();
  const name = String(this.gift?.name || "").trim();

  // ✅ نقبل أي Gift إذا عندنا key أو name
  // (ولو عندك هدايا قديمة value موجودة ما زال OK)
  return Boolean(key) || Boolean(name);
}

  return (this.content?.trim()?.length ?? 0) > 0;
}, "Invalid message payload for the given type.");

// ✅ بدون next لتفادي أخطاء TS في overloads
RoomMessageSchema.pre("validate", function () {
  // mentions unique
  if (Array.isArray(this.mentions) && this.mentions.length) {
    const uniq = new Set(this.mentions.map(String));
    // @ts-ignore
    this.mentions = Array.from(uniq).map((id) => new mongoose.Types.ObjectId(id));
  }

  // reactions unique by (user, emoji)
  if (Array.isArray(this.reactions) && this.reactions.length) {
    const seen = new Set<string>();
    this.reactions = this.reactions.filter((r) => {
      const key = `${String(r.user)}::${String(r.emoji)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
});

/* =====================================================
   INDEXES (Performance Optimized)
===================================================== */

RoomMessageSchema.index({ room: 1, createdAt: -1 }, { partialFilterExpression: { deletedForEveryone: false } });
// ✅ يمنع إنشاء نفس الرسالة مرتين لنفس (room + sender + clientId)
RoomMessageSchema.index(
  { room: 1, sender: 1, clientId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientId: { $type: "string" }
    }
  }
);
RoomMessageSchema.index(
  { room: 1, isPinned: 1, createdAt: -1 },
  {
    partialFilterExpression: {
      isPinned: true,
      deletedForEveryone: false
    }
  }
);

RoomMessageSchema.index(
  { mentions: 1, room: 1, createdAt: -1 },
  { partialFilterExpression: { deletedForEveryone: false } }
);

RoomMessageSchema.index({ "reactions.user": 1 });
RoomMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* =====================================================
   SOFT DELETE FILTER
===================================================== */

// ✅ بدون next (الأبسط والأضمن مع TypeScript)
RoomMessageSchema.pre(/^find/, function (this: mongoose.Query<any, any>) {
  this.setQuery({
    ...this.getQuery(),
    deletedForEveryone: false
  });
});

RoomMessageSchema.pre(/^count/, function (this: mongoose.Query<any, any>) {
  this.setQuery({
    ...this.getQuery(),
    deletedForEveryone: false
  });
});

// aggregate لا يمر على find hooks
RoomMessageSchema.pre("aggregate", function () {
  const pipeline = this.pipeline();

  const hasMatch = pipeline.some((stage: any) => stage?.$match?.deletedForEveryone !== undefined);

  if (!hasMatch) {
    pipeline.unshift({ $match: { deletedForEveryone: false } });
  }
});

/* =====================================================
   MESSAGE COUNT SAFE UPDATE + ✅ DEBUG PRINTS
===================================================== */

// ✅ بدون next لتفادي SaveOptions overload
RoomMessageSchema.pre("save", function () {
  // @ts-ignore
  this.$locals = this.$locals || {};
  // @ts-ignore
  this.$locals.wasNew = this.isNew;
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  // ✅ DEBUG: اطبع فقط رسائل النظام/الترقية
  const t = String((this as any).type || "");
  if (["promotion", "join", "leave", "ban", "announcement", "system"].includes(t)) {
    console.log("[RoomMessage][pre-save] SYSTEM SNAPSHOT", {
      _id: String((this as any)._id),
      type: (this as any).type,
      content: (this as any).content,
      action: (this as any).action,
      actorId: (this as any).actorId ? String((this as any).actorId) : undefined,
      targetId: (this as any).targetId ? String((this as any).targetId) : undefined,
      actorName: (this as any).actorName,
      targetName: (this as any).targetName,
      role: (this as any).role,
      meta: (this as any).meta
    });
  }
});

RoomMessageSchema.post("save", async function (doc: any) {
  // ✅ DEBUG بعد الحفظ
  const t = String(doc?.type || "");
  if (["promotion", "join", "leave", "ban", "announcement", "system"].includes(t)) {
    console.log("[RoomMessage][post-save] SYSTEM SAVED", {
      _id: String(doc?._id),
      type: doc?.type,
      content: doc?.content,
      action: doc?.action,
      actorId: doc?.actorId ? String(doc.actorId) : undefined,
      targetId: doc?.targetId ? String(doc.targetId) : undefined,
      actorName: doc?.actorName,
      targetName: doc?.targetName,
      role: doc?.role,
      meta: doc?.meta
    });
  }

  // @ts-ignore
  const wasNew = Boolean(doc?.$locals?.wasNew);
  if (!wasNew) return;
  if (doc.deletedForEveryone) return;

  await mongoose.model("Room").updateOne({ _id: doc.room }, { $inc: { messagesCount: 1 } });
});

RoomMessageSchema.post("findOneAndDelete", async function (doc: any) {
  if (!doc) return;
  if (doc.deletedForEveryone) return;

  await mongoose.model("Room").updateOne({ _id: doc.room }, { $inc: { messagesCount: -1 } });
});

RoomMessageSchema.post("findOneAndUpdate", async function (doc: any) {
  if (!doc) return;

  const update: any = this.getUpdate() || {};
  const set = update.$set || update;

  if (set?.deletedForEveryone !== true) return;
  if (doc.deletedForEveryone === true) return;

  await mongoose.model("Room").updateOne({ _id: doc.room }, { $inc: { messagesCount: -1 } });
});

/* =====================================================
   EXPORT
===================================================== */

export default mongoose.model<IRoomMessage>("RoomMessage", RoomMessageSchema);