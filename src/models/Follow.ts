import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFollow extends Document {
  follower: Types.ObjectId;
  following: Types.ObjectId;
  createdAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

/* منع التكرار */
FollowSchema.index(
  { follower: 1, following: 1 },
  { unique: true }
);

export default mongoose.model<IFollow>("Follow", FollowSchema);
