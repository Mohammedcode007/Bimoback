
// // models/Comment.ts
// import mongoose, { Schema, Document, Types } from "mongoose";

// export interface IComment extends Document {
//   tweet: Types.ObjectId;
//   user: Types.ObjectId;
//   content: string;

//   isHidden: boolean;
//   hiddenReason?: string | null;
//   hiddenAt?: Date | null;
//   hiddenBy?: "system" | "admin" | null;

//   createdAt: Date;
//   updatedAt: Date;
// }

// const CommentSchema = new Schema<IComment>(
//   {
//     tweet: {
//       type: Schema.Types.ObjectId,
//       ref: "Tweet",
//       required: true,
//       index: true
//     },

//     user: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       required: true
//     },

//     content: {
//       type: String,
//       required: true,
//       maxlength: 280
//     },

//     /* ================= MODERATION ================= */

//     isHidden: {
//       type: Boolean,
//       default: false,
//       index: true
//     },

//     hiddenReason: {
//       type: String,
//       trim: true,
//       default: null
//     },

//     hiddenAt: {
//       type: Date,
//       default: null
//     },

//     hiddenBy: {
//       type: String,
//       enum: ["system", "admin"],
//       default: null
//     }
//   },
//   { timestamps: true }
// );

// CommentSchema.index({ tweet: 1 });
// CommentSchema.index({ tweet: 1, isHidden: 1 });

// export default mongoose.model<IComment>("Comment", CommentSchema);
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComment extends Document {
  tweet: Types.ObjectId;
  user: Types.ObjectId;
  content: string;

  parentComment?: Types.ObjectId | null;
  mentions: Types.ObjectId[];

  likesCount: number;
  repliesCount: number;

  isHidden: boolean;
  hiddenReason?: string | null;
  hiddenAt?: Date | null;
  hiddenBy?: "system" | "admin" | null;

  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
      required: true,
      index: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      maxlength: 280,
      trim: true,
    },

    /* ================= THREADING ================= */

    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },

    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    /* ================= COUNTERS ================= */

    likesCount: {
      type: Number,
      default: 0,
    },

    repliesCount: {
      type: Number,
      default: 0,
    },

    /* ================= MODERATION ================= */

    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },

    hiddenReason: {
      type: String,
      trim: true,
      default: null,
    },

    hiddenAt: {
      type: Date,
      default: null,
    },

    hiddenBy: {
      type: String,
      enum: ["system", "admin"],
      default: null,
    },
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

CommentSchema.index({ tweet: 1 });
CommentSchema.index({ tweet: 1, isHidden: 1 });
CommentSchema.index({ tweet: 1, parentComment: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1, isHidden: 1, createdAt: 1 });
CommentSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model<IComment>("Comment", CommentSchema);