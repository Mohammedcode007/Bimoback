import Friend from "../models/Friend";
import User from "../models/User";
import mongoose from "mongoose";

export const checkRelationship = async (
  userId: string,
  targetId: string
) => {

  if (!mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(targetId)) {
    throw new Error("Invalid user id");
  }

  if (userId === targetId) {
    return { blocked: false, isFriend: false };
  }

  const [user, target] = await Promise.all([
    User.findById(userId).select("blockedUsers"),
    User.findById(targetId).select("blockedUsers")
  ]);

  if (!user || !target)
    throw new Error("User not found");

  /* ================= BLOCK CHECK ================= */

  const isBlockedByMe =
    user.blockedUsers.some(id => id.equals(target._id));

  const isBlockedMe =
    target.blockedUsers.some(id => id.equals(user._id));

  if (isBlockedByMe || isBlockedMe) {
    return { blocked: true, isFriend: false };
  }

  /* ================= FRIEND CHECK ================= */

  const relation = await Friend.findOne({
    $or: [
      { requester: userId, recipient: targetId, status: "accepted" },
      { requester: targetId, recipient: userId, status: "accepted" }
    ]
  }).select("_id");

  return {
    blocked: false,
    isFriend: !!relation
  };
};
