// models/Bookmark.ts
import mongoose, { Schema } from "mongoose";

const BookmarkSchema = new Schema(
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

BookmarkSchema.index({ user: 1, tweet: 1 }, { unique: true });

export default mongoose.model("Bookmark", BookmarkSchema);
