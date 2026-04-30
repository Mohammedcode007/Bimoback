// // models/Retweet.ts
// import mongoose, { Schema } from "mongoose";

// const RetweetSchema = new Schema(
//   {
//     user: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       required: true
//     },
//     tweet: {
//       type: Schema.Types.ObjectId,
//       ref: "Tweet",
//       required: true
//     }
//   },
//   { timestamps: true }
// );

// RetweetSchema.index({ user: 1, tweet: 1 }, { unique: true });

// export default mongoose.model("Retweet", RetweetSchema);
// models/Retweet.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IRetweet extends Document {
  user: Types.ObjectId;
  tweet: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RetweetSchema = new Schema<IRetweet>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * يمنع نفس المستخدم يعمل ريتويت لنفس التويتة أكثر من مرة
 */
RetweetSchema.index(
  { user: 1, tweet: 1 },
  { unique: true }
);

/**
 * مهم للـ timeline
 * لأننا سنجلب الريتويتات مرتبة من الأحدث للأقدم
 */
RetweetSchema.index({ createdAt: -1 });

/**
 * مفيد لو أردت جلب كل الريتويتات الخاصة بتويتة معينة
 */
RetweetSchema.index({ tweet: 1, createdAt: -1 });

/**
 * مفيد لو أردت جلب كل الريتويتات التي عملها مستخدم معين
 */
RetweetSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model<IRetweet>("Retweet", RetweetSchema);