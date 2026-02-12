// models/Friend.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type FriendStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "blocked"
  | "cancelled";

export interface IFriend extends Document {
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: FriendStatus;
  blockedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FriendSchema = new Schema<IFriend>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "blocked", "cancelled"],
      default: "pending"
    },

    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

/* ================= منع التكرار باتجاهين ================= */

FriendSchema.pre("validate", function (this: IFriend) {
  if (!this.requester || !this.recipient) return;

  const requesterStr = this.requester.toString();
  const recipientStr = this.recipient.toString();

  if (requesterStr > recipientStr) {
    const temp = this.requester;
    this.requester = this.recipient;
    this.recipient = temp;
  }
});


/* ================= UNIQUE RELATION ================= */

FriendSchema.index(
  { requester: 1, recipient: 1 },
  { unique: true }
);

/* ================= PERFORMANCE INDEXES ================= */

FriendSchema.index({ recipient: 1, status: 1 });
FriendSchema.index({ requester: 1, status: 1 });
FriendSchema.index({ status: 1 });

export default mongoose.model<IFriend>("Friend", FriendSchema);
