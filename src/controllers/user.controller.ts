
import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Friend from "../models/Friend";
import Notification from "../models/Notification";
import userService from "../services/user.service";

/* ======================================================
   1️⃣ SEARCH USERS
====================================================== */


export const searchUsers = async (req: Request, res: Response) => {
  try {

    const query = (req.query.q as string)?.trim();
    const currentUserId = req.user.id;

    console.log("======================================");
    console.log("🔎 [SEARCH REQUEST]");
    console.log("👤 Searching User ID:", currentUserId);
    console.log("🔍 Query:", query);

    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }

    const users = await userService.search(currentUserId, query);

    console.log("📦 Total Results:", users.length);

    users.forEach((user, index) => {
      console.log(`----- Result ${index + 1} -----`);
      console.log("🆔 User ID:", user._id.toString());
      console.log("👤 Username:", user.username);
      console.log("📛 AtUsername:", user.atUsername);
      console.log("🔗 Relationship:", user.relationshipStatus);
    });

    console.log("======================================");

    res.json(users);

  } catch (error) {
    console.error("❌ SEARCH ERROR:", error);
    res.status(500).json({ message: "Search failed" });
  }
};




/* ======================================================
   2️⃣ GET USER PROFILE
====================================================== */

export const getUserProfile = async (req: Request, res: Response) => {
  try {

    const { userId } = req.params;

    console.log("👤 [Profile] Fetching profile for:", userId);

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("📦 [Profile] User found:", user.username);

    res.json(user);

  } catch (error) {
    console.error("❌ PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};



/* ======================================================
   3️⃣ GET FRIENDS
====================================================== */

export const getFriends = async (req: Request, res: Response) => {
  try {

    const userId = new mongoose.Types.ObjectId(req.user.id);

    console.log("👥 [Friends] Fetching friends for:", userId.toString());

    const relations = await Friend.find({
      status: "accepted",
      $or: [
        { requester: userId },
        { recipient: userId }
      ]
    }).populate("requester recipient", "username avatar isOnline lastSeen");

    console.log("📦 [Friends] Relations found:", relations.length);

    const friends = relations.map((relation: any) => {
      return relation.requester._id.equals(userId)
        ? relation.recipient
        : relation.requester;
    });

    console.log("👥 [Friends] Final friends list:", friends);

    res.json(friends);

  } catch (error) {
    console.error("❌ GET FRIENDS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch friends" });
  }
};



/* ======================================================
   4️⃣ GET UNREAD NOTIFICATIONS COUNT
====================================================== */

export const getUnreadNotificationCount = async (
  req: Request,
  res: Response
) => {
  try {

    console.log("🔔 [Notifications] Counting unread for:", req.user.id);

    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
      isDeleted: false
    });

    console.log("🔢 [Notifications] Unread count:", count);

    res.json({ unreadCount: count });

  } catch (error) {
    console.error("❌ NOTIFICATION COUNT ERROR:", error);
    res.status(500).json({ message: "Failed to count notifications" });
  }
};



/* ======================================================
   6️⃣ BLOCK USER
====================================================== */

export const blockUser = async (req: Request, res: Response) => {
  try {

    const userId = req.user.id;
    const { targetUserId } = req.body;

    console.log("🚫 [Block] User:", userId, "blocking:", targetUserId);

    if (userId === targetUserId) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: targetUserId }
    });

    await Friend.deleteMany({
      $or: [
        { requester: userId, recipient: targetUserId },
        { requester: targetUserId, recipient: userId }
      ]
    });

    console.log("✅ [Block] Completed successfully");

    res.json({ message: "User blocked successfully" });

  } catch (error) {
    console.error("❌ BLOCK ERROR:", error);
    res.status(500).json({ message: "Failed to block user" });
  }
};



/* ======================================================
   7️⃣ UNBLOCK USER
====================================================== */

export const unblockUser = async (req: Request, res: Response) => {
  try {

    console.log("♻️ [Unblock] User:", req.user.id, "unblocking:", req.body.targetUserId);

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { blockedUsers: req.body.targetUserId }
    });

    console.log("✅ [Unblock] Completed successfully");

    res.json({ message: "User unblocked successfully" });

  } catch (error) {
    console.error("❌ UNBLOCK ERROR:", error);
    res.status(500).json({ message: "Failed to unblock user" });
  }
};
