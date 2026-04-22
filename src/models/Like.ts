// models/Like.ts
import mongoose, { Schema, Types } from "mongoose";

const LikeSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
      required: true
    }
  },
  { timestamps: true }
);

LikeSchema.index({ user: 1, tweet: 1 }, { unique: true });

export default mongoose.model("Like", LikeSchema);
