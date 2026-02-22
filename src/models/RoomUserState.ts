import mongoose, { Schema, Types } from "mongoose";

const RoomUserStateSchema = new Schema(
  {
    room: { type: Types.ObjectId, ref: "Room", required: true, index: true },
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },

    clearedAt: { type: Date, default: null },

    // ✅ آخر رسالة مثبّتة كانت موجودة لحظة المسح/الدخول
    pinnedMessageIdAtClear: { type: Types.ObjectId, ref: "RoomMessage", default: null },
    pinnedMessageAtClear: { type: Date, default: null },
  },
  { timestamps: true }
);

RoomUserStateSchema.index({ room: 1, user: 1 }, { unique: true });

export default mongoose.models.RoomUserState ||
  mongoose.model("RoomUserState", RoomUserStateSchema);