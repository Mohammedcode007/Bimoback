// models/Retweet.ts
import mongoose, { Schema } from "mongoose";

const RetweetSchema = new Schema(
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

RetweetSchema.index({ user: 1, tweet: 1 }, { unique: true });

export default mongoose.model("Retweet", RetweetSchema);
