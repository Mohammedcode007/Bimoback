import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICommentLike extends Document {
  user: Types.ObjectId;
  comment: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommentLikeSchema = new Schema<ICommentLike>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

CommentLikeSchema.index({ user: 1, comment: 1 }, { unique: true });

export default mongoose.model<ICommentLike>(
  "CommentLike",
  CommentLikeSchema
);