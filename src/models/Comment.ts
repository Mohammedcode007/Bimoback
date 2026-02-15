// models/Comment.ts
import mongoose, { Schema } from "mongoose";

const CommentSchema = new Schema(
  {
    tweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet",
      required: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 280
    }
  },
  { timestamps: true }
);

CommentSchema.index({ tweet: 1 });

export default mongoose.model("Comment", CommentSchema);
