import mongoose from "mongoose";
import Follow from "../models/Follow";
import User from "../models/User";
import notificationService from "./notification.service";

class FollowService {

  /* =========================
     TOGGLE FOLLOW
  ========================= */

  async toggleFollow(userId: string, targetId: string) {

    if (!mongoose.Types.ObjectId.isValid(targetId))
      throw new Error("Invalid user id");

    if (userId === targetId)
      throw new Error("You cannot follow yourself");

    const targetUser = await User.findById(targetId)
      .select("_id blockedUsers");

    if (!targetUser)
      throw new Error("User not found");

    const existing = await Follow.findOne({
      follower: userId,
      following: targetId
    });

    /* ===== UNFOLLOW ===== */

    if (existing) {

      await Follow.deleteOne({ _id: existing._id });

      await User.updateOne(
        { _id: targetId, followersCount: { $gt: 0 } },
        { $inc: { followersCount: -1 } }
      );

      await User.updateOne(
        { _id: userId, followingCount: { $gt: 0 } },
        { $inc: { followingCount: -1 } }
      );

      return { following: false };
    }

    /* ===== FOLLOW ===== */

    await Follow.create({
      follower: userId,
      following: targetId
    });

    await User.updateOne(
      { _id: targetId },
      { $inc: { followersCount: 1 } }
    );

    await User.updateOne(
      { _id: userId },
      { $inc: { followingCount: 1 } }
    );

    if (userId !== targetId) {
      await notificationService.create({
        recipient: targetId,
        sender: userId,
        type: "follow",
        body: "بدأ متابعتك"
      });
    }

    return { following: true };
  }

  /* =========================
     GET FOLLOWERS
  ========================= */

  async getFollowers(userId: string, page = 1, limit = 20) {

    const skip = (page - 1) * limit;

    const followers = await Follow.find({ following: userId })
      .populate("follower", "username atUsername avatar isVerified")
      .skip(skip)
      .limit(limit);

    return followers.map(f => f.follower);
  }

  /* =========================
     GET FOLLOWING
  ========================= */

  async getFollowing(userId: string, page = 1, limit = 20) {

    const skip = (page - 1) * limit;

    const following = await Follow.find({ follower: userId })
      .populate("following", "username atUsername avatar isVerified")
      .skip(skip)
      .limit(limit);

    return following.map(f => f.following);
  }

  /* =========================
   BLOCK USER
========================= */

async blockUser(userId: string, targetId: string) {

  if (!mongoose.Types.ObjectId.isValid(targetId))
    throw new Error("Invalid user id");

  if (userId === targetId)
    throw new Error("Invalid operation");

  const user = await User.findById(userId);
  const target = await User.findById(targetId);

  if (!target)
    throw new Error("User not found");

  /* ===== Add To Block List ===== */

  if (!user?.blockedUsers.includes(target._id)) {
    user?.blockedUsers.push(target._id);
    await user?.save();
  }

  /* ===== Remove Follow If Exists ===== */

  const existingFollow = await Follow.findOne({
    follower: userId,
    following: targetId
  });

  if (existingFollow) {

    await Follow.deleteOne({ _id: existingFollow._id });

    await User.updateOne(
      { _id: targetId, followersCount: { $gt: 0 } },
      { $inc: { followersCount: -1 } }
    );

    await User.updateOne(
      { _id: userId, followingCount: { $gt: 0 } },
      { $inc: { followingCount: -1 } }
    );
  }

  /* ===== Remove Reverse Follow If Exists ===== */

  const reverseFollow = await Follow.findOne({
    follower: targetId,
    following: userId
  });

  if (reverseFollow) {

    await Follow.deleteOne({ _id: reverseFollow._id });

    await User.updateOne(
      { _id: userId, followersCount: { $gt: 0 } },
      { $inc: { followersCount: -1 } }
    );

    await User.updateOne(
      { _id: targetId, followingCount: { $gt: 0 } },
      { $inc: { followingCount: -1 } }
    );
  }

  return { blocked: true };
}

  /* =========================
     CHECK STATUS
  ========================= */

  async isFollowing(userId: string, targetId: string) {

    const relation = await Follow.findOne({
      follower: userId,
      following: targetId
    });

    return { isFollowing: !!relation };
  }

}

export default new FollowService();
