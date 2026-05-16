
// export default mongoose.model<IRoomMessage>("RoomMessage", RoomMessageSchema);

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
  | "gift"
  | "song"
  | "game";

export type RoomRole = "creator" | "owner" | "admin" | "member";

export type RoomSystemAction =
  | "role:set"
  | "role:transferCreator"
  | "user:ban"
  | "user:unban"
  | "room:announcement"
  | "";

export type RoomGameType =
  | ""
  | "cricket"
  | "chess"
  | "quiz"
  | "xo"
  | "cards"
  | "luck"
  | "duel"
  | "bomb"
  | "shot";

/* =====================================================
   MESSAGE LENGTH LIMITS
===================================================== */

const MAX_ROOM_MESSAGE_CONTENT_LENGTH = 2000;

// الرسائل العادية
const MAX_ROOM_TEXT_MESSAGE_LENGTH = 1000;

// الرسالة المثبتة / الإعلان
const MAX_ROOM_ANNOUNCEMENT_LENGTH = 500;

// رسائل النظام مثل دخول/خروج/ترقية/حظر
const MAX_ROOM_SYSTEM_MESSAGE_LENGTH = 700;

// كابشن الميديا والملفات
const MAX_ROOM_MEDIA_CAPTION_LENGTH = 300;

// رسائل الهدايا
const MAX_ROOM_GIFT_CONTENT_LENGTH = 200;

// رسائل الأغاني
const MAX_ROOM_SONG_CONTENT_LENGTH = 500;

// رسائل الألعاب
const MAX_ROOM_GAME_CONTENT_LENGTH = 1200;

function getMaxContentLengthByType(type: string) {
  switch (type) {
    case "text":
      return MAX_ROOM_TEXT_MESSAGE_LENGTH;

    case "announcement":
      return MAX_ROOM_ANNOUNCEMENT_LENGTH;

    case "system":
    case "join":
    case "leave":
    case "promotion":
    case "ban":
      return MAX_ROOM_SYSTEM_MESSAGE_LENGTH;

    case "image":
    case "video":
    case "audio":
    case "file":
      return MAX_ROOM_MEDIA_CAPTION_LENGTH;

    case "gift":
      return MAX_ROOM_GIFT_CONTENT_LENGTH;

    case "song":
      return MAX_ROOM_SONG_CONTENT_LENGTH;

    case "game":
      return MAX_ROOM_GAME_CONTENT_LENGTH;

    default:
      return MAX_ROOM_MESSAGE_CONTENT_LENGTH;
  }
}

/* =====================================================
   INTERFACE
===================================================== */

export interface IRoomMessage extends Document {
  room: Types.ObjectId;
  sender?: Types.ObjectId;
  clientId?: string;
  type: RoomMessageType;
  content: string;

  senderSnapshot?: {
    _id: string;
    username: string;
    atUsername?: string;
    avatar?: string;
avatarGif?: string;
coverImage?: string;
usernameColor?: string;
messageTextColor?: string;

activeBadgesResolved?: {
  key?: string;
  name?: string;
  iconUrl?: string;
  lottieUrl?: string;
  isAnimated?: boolean;
}[];
activeCustomization?: {
  avatarFrame?: string;
  avatarGif?: string;
  usernameColor?: string;
  messageTextColor?: string;
  messageEffect?: string;
  profileEntryAnimation?: string;
  badges: string[];
  verificationType: "none" | "blue" | "gold" | "business";
};

    customEmojiBadge?: {
      emoji?: string;
      isActive?: boolean;
      purchasedAt?: Date | null;
      expiresAt?: Date | null;
    };

    verificationType?: "none" | "blue" | "gold" | "business";
    avatarFrame?: string;
    badges?: string[];
    profileEntryAnimation?: string;
  };

  action?: RoomSystemAction;

  actorId?: Types.ObjectId;
  targetId?: Types.ObjectId;

  actorName?: string;
  targetName?: string;

  role?: RoomRole | "";

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

  song?: {
    title?: string;
    audioUrl?: string;
    youtubeUrl?: string;
    thumbnail?: string;
    channelTitle?: string;
    provider?: string;
    filename?: string;
    expiresInMs?: number;
  };

  gameType?: RoomGameType;

  game?: {
    gameId?: string;
    title?: string;
    state?: string;
    turnUserId?: string;
    winnerUserId?: string;
    payload?: any;
  };

  gift?: {
    key: string;
    icon?: string;
    count?: number;
    targetId?: string;
    targetName?: string;
    name?: string;
    value?: number;
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

const SongSchema = new Schema(
  {
    title: { type: String, trim: true, default: "" },
    audioUrl: { type: String, trim: true, default: "" },
    youtubeUrl: { type: String, trim: true, default: "" },
    thumbnail: { type: String, trim: true, default: "" },
    channelTitle: { type: String, trim: true, default: "" },
    provider: { type: String, trim: true, default: "" },
    filename: { type: String, trim: true, default: "" },
    expiresInMs: { type: Number, min: 0, default: 0 },

    // ✅ مهم لزر الإعجاب
    songCode: { type: String, trim: true, uppercase: true, default: "", index: true },
    loveCommand: { type: String, trim: true, default: "" },

    playedById: { type: String, trim: true, default: "" },
    playedByName: { type: String, trim: true, default: "" },
    playedByAtUsername: { type: String, trim: true, default: "" },

    sourceRoomId: { type: String, trim: true, default: "" },
    sourceRoomName: { type: String, trim: true, default: "" },

    roomId: { type: String, trim: true, default: "" },
    roomName: { type: String, trim: true, default: "" },

    lovesCount: { type: Number, min: 0, default: 0 },
    lovedBy: [{ type: String, trim: true }]
  },
  { _id: false }
);
const GameSchema = new Schema(
  {
    gameId: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    turnUserId: { type: String, trim: true, default: "" },
    winnerUserId: { type: String, trim: true, default: "" },
    payload: { type: Schema.Types.Mixed, default: undefined }
  },
  { _id: false }
);

const GiftSchema = new Schema(
  {
    key: { type: String, trim: true, default: "" },
    icon: { type: String, trim: true, default: "" },
    count: { type: Number, min: 0, default: 0 },

    targetId: { type: String, trim: true, default: "" },
    targetName: { type: String, trim: true, default: "" },

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

const SystemMetaSchema = new Schema(
  {
    action: { type: String, default: "", trim: true },

    actorId: { type: String, default: "", trim: true },
    actorName: { type: String, default: "", trim: true },

    targetId: { type: String, default: "", trim: true },
    targetName: { type: String, default: "", trim: true },

    role: { type: String, default: "", trim: true }
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
        "gift",
        "song",
        "game"
      ],
      default: "text",
      required: true,
      index: true
    },

    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: [
        MAX_ROOM_MESSAGE_CONTENT_LENGTH,
        `Message content is too long. Max ${MAX_ROOM_MESSAGE_CONTENT_LENGTH} characters.`
      ]
    },

    senderSnapshot: {
      type: {
    _id: { type: String, default: "" },
username: { type: String, default: "", trim: true },
atUsername: { type: String, default: "", trim: true },
avatar: { type: String, default: "", trim: true },
avatarGif: { type: String, default: "", trim: true },
coverImage: { type: String, default: "", trim: true },
usernameColor: { type: String, default: "", trim: true },
messageTextColor: { type: String, default: "", trim: true },

activeCustomization: {
  avatarFrame: { type: String, default: "" },
  avatarGif: { type: String, default: "" },
  usernameColor: { type: String, default: "" },
  messageTextColor: { type: String, default: "" },
  messageEffect: { type: String, default: "" },
  profileEntryAnimation: { type: String, default: "" },
  badges: { type: [String], default: [] },
  verificationType: { type: String, default: "none" }
},

activeBadgesResolved: {
  type: [
    {
      key: { type: String, default: "", trim: true },
      name: { type: String, default: "", trim: true },
      iconUrl: { type: String, default: "", trim: true },
      lottieUrl: { type: String, default: "", trim: true },
      isAnimated: { type: Boolean, default: false },
    },
  ],
  default: [],
},

        customEmojiBadge: {
          emoji: { type: String, default: "" },
          isActive: { type: Boolean, default: false },
          purchasedAt: { type: Date, default: null },
          expiresAt: { type: Date, default: null }
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

    media: {
      type: MediaSchema,
      default: undefined
    },

    song: {
      type: SongSchema,
      default: undefined
    },

gameType: {
  type: String,
enum: ["", "cricket", "chess", "quiz", "xo", "cards", "luck", "duel","bomb","shot"],
  default: "",
  trim: true,
  index: true
},
    game: {
      type: GameSchema,
      default: undefined
    },

    gift: {
      type: GiftSchema,
      default: undefined
    },

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
      default: undefined
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
  const type = String(this.type || "").trim();
  const content = String(this.content || "").trim();

  const optionalContentTypes: RoomMessageType[] = [
    "system",
    "join",
    "leave",
    "promotion",
    "ban"
  ];

  if (optionalContentTypes.includes(this.type)) {
    return true;
  }

  if (type === "announcement") {
    return content.length > 0;
  }

  if (["image", "video", "audio", "file"].includes(type)) {
    return Boolean(this.media?.url) || content.length > 0;
  }

  if (type === "song") {
    return (
      Boolean(this.song?.audioUrl) ||
      Boolean(this.media?.url) ||
      content.length > 0
    );
  }

  if (type === "game") {
    return (
      Boolean(this.gameType) ||
      Boolean(this.game?.gameId) ||
      content.length > 0
    );
  }

  if (type === "gift") {
    const key = String(this.gift?.key || "").trim();
    const name = String(this.gift?.name || "").trim();

    return Boolean(key) || Boolean(name) || content.length > 0;
  }

  return content.length > 0;
}, "Invalid message payload for the given type.");

RoomMessageSchema.pre("validate", function () {
  const type = String(this.type || "").trim();
  const content = String(this.content || "").trim();

  this.content = content;

  const maxLength = getMaxContentLengthByType(type);

  if (content.length > maxLength) {
    this.invalidate(
      "content",
      `${type || "Message"} content is too long. Max ${maxLength} characters.`
    );
  }

  if (Array.isArray(this.mentions) && this.mentions.length) {
    const uniq = new Set(this.mentions.map(String));

    // @ts-ignore
    this.mentions = Array.from(uniq).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
  }

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
   INDEXES
===================================================== */

RoomMessageSchema.index(
  { room: 1, createdAt: -1 },
  { partialFilterExpression: { deletedForEveryone: false } }
);

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
RoomMessageSchema.index({ room: 1, type: 1, createdAt: -1 });
RoomMessageSchema.index({ room: 1, gameType: 1, createdAt: -1 });

/* =====================================================
   SOFT DELETE FILTER
===================================================== */

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

RoomMessageSchema.pre("aggregate", function () {
  const pipeline = this.pipeline();

  const hasMatch = pipeline.some(
    (stage: any) => stage?.$match?.deletedForEveryone !== undefined
  );

  if (!hasMatch) {
    pipeline.unshift({ $match: { deletedForEveryone: false } });
  }
});

/* =====================================================
   MESSAGE COUNT SAFE UPDATE + DEBUG
===================================================== */

RoomMessageSchema.pre("save", function () {
  // @ts-ignore
  this.$locals = this.$locals || {};

  // @ts-ignore
  this.$locals.wasNew = this.isNew;

  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  }

  const t = String((this as any).type || "");

  if (
    [
      "promotion",
      "join",
      "leave",
      "ban",
      "announcement",
      "system",
      "song",
      "game"
    ].includes(t)
  ) {
    console.log("[RoomMessage][pre-save]", {
      _id: String((this as any)._id),
      type: (this as any).type,
      content: (this as any).content,
      gameType: (this as any).gameType,
      song: (this as any).song,
      game: (this as any).game
    });
  }
});

RoomMessageSchema.post("save", async function (doc: any) {
  const t = String(doc?.type || "");

  if (
    [
      "promotion",
      "join",
      "leave",
      "ban",
      "announcement",
      "system",
      "song",
      "game"
    ].includes(t)
  ) {
    console.log("[RoomMessage][post-save]", {
      _id: String(doc?._id),
      type: doc?.type,
      content: doc?.content,
      gameType: doc?.gameType,
      song: doc?.song,
      game: doc?.game
    });
  }

  // @ts-ignore
  const wasNew = Boolean(doc?.$locals?.wasNew);

  if (!wasNew) return;
  if (doc.deletedForEveryone) return;

  await mongoose.model("Room").updateOne(
    { _id: doc.room },
    { $inc: { messagesCount: 1 } }
  );
});

RoomMessageSchema.post("findOneAndDelete", async function (doc: any) {
  if (!doc) return;
  if (doc.deletedForEveryone) return;

  await mongoose.model("Room").updateOne(
    { _id: doc.room },
    { $inc: { messagesCount: -1 } }
  );
});

RoomMessageSchema.post("findOneAndUpdate", async function (doc: any) {
  if (!doc) return;

  const update: any = this.getUpdate() || {};
  const set = update.$set || update;

  if (set?.deletedForEveryone !== true) return;
  if (doc.deletedForEveryone === true) return;

  await mongoose.model("Room").updateOne(
    { _id: doc.room },
    { $inc: { messagesCount: -1 } }
  );
});

/* =====================================================
   EXPORT
===================================================== */

export default mongoose.model<IRoomMessage>("RoomMessage", RoomMessageSchema);