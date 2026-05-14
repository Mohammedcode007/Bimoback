import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFavoriteRoom extends Document {
  user: Types.ObjectId;
  room: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FavoriteRoomSchema = new Schema<IFavoriteRoom>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// يمنع تكرار نفس الغرفة في مفضلة نفس المستخدم
FavoriteRoomSchema.index(
  { user: 1, room: 1 },
  { unique: true }
);

// لجلب مفضلة المستخدم مرتبة بالأحدث
FavoriteRoomSchema.index({
  user: 1,
  createdAt: -1,
});

export default mongoose.model<IFavoriteRoom>(
  "FavoriteRoom",
  FavoriteRoomSchema
);