

import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Friend from "../models/Friend";
import Notification from "../models/Notification";

/* ======================================================
   1️⃣ SEARCH USERS
====================================================== */

export const searchUsers = async (req: Request, res: Response) => {
  try {

    console.log("======================================");
    console.log("🔎 NEW SEARCH REQUEST");
    console.log("======================================");

    const q = (req.query.q as string)?.trim();
    const currentUserId = req.user.id;

    console.log("📌 Current User ID:", currentUserId);
    console.log("📌 Search Query:", q);

    if (!q) {
      console.log("❌ Empty search query");
      return res.status(400).json({ message: "Search query required" });
    }

    const currentObjectId = new mongoose.Types.ObjectId(currentUserId);

    const users = await User.aggregate([

      {
        $match: {
          _id: { $ne: currentObjectId },
          blockedUsers: { $ne: currentObjectId },
          $text: { $search: q }
        }
      },

      {
        $addFields: {
          currentUserId: currentObjectId
        }
      },

      {
        $lookup: {
          from: "friends",
          let: {
            targetUserId: "$_id",
            currentUserId: "$currentUserId"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $eq: ["$requester", "$$currentUserId"] },
                        { $eq: ["$recipient", "$$targetUserId"] }
                      ]
                    },
                    {
                      $and: [
                        { $eq: ["$requester", "$$targetUserId"] },
                        { $eq: ["$recipient", "$$currentUserId"] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: "relation"
        }
      },

      {
        $addFields: {
          relationDoc: { $arrayElemAt: ["$relation", 0] }
        }
      },

      {
        $addFields: {
          relationshipStatus: {
            $switch: {
              branches: [

                {
                  case: { $eq: ["$relationDoc.status", "accepted"] },
                  then: "accepted"
                },

                {
                  case: { $eq: ["$relationDoc.status", "pending"] },
                  then: {
                    $cond: [
                      {
                        $eq: [
                          "$relationDoc.requester",
                          "$currentUserId"
                        ]
                      },
                      "pending_sent",
                      "pending_received"
                    ]
                  }
                },

                {
                  case: { $eq: ["$relationDoc.status", "blocked"] },
                  then: {
                    $cond: [
                      {
                        $eq: [
                          "$relationDoc.blockedBy",
                          "$currentUserId"
                        ]
                      },
                      "blocked_by_me",
                      "blocked_me"
                    ]
                  }
                }

              ],
              default: "none"
            }
          }
        }
      },

      {
        $project: {
          username: 1,
          atUsername: 1,
          avatar: 1,
          isOnline: 1,
          lastSeen: 1,
          isVerified: 1,
          relationshipStatus: 1,
          relationDoc: 1 // 👈 مؤقتًا للفحص
        }
      },

      { $limit: 20 }

    ]);

    console.log("📊 Total Results:", users.length);

    users.forEach((user: any, index: number) => {
      console.log(`\n----- Result ${index + 1} -----`);
      console.log("User:", user.username);
      console.log("Relation Doc:", user.relationDoc || "No relation");
      console.log("Final Status:", user.relationshipStatus);
    });

    console.log("======================================\n");

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

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);

  } catch (error) {
    console.error("❌ PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

/* ======================================================
   3️⃣ GET FRIENDS (NEW LOGIC)
====================================================== */

export const getFriends = async (req: Request, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const relations = await Friend.find({
      status: "accepted",
      $or: [
        { userOne: userId },
        { userTwo: userId }
      ]
    })
      .populate("userOne userTwo", "username avatar isOnline lastSeen");

    const friends = relations.map((relation: any) => {
      return relation.userOne._id.equals(userId)
        ? relation.userTwo
        : relation.userOne;
    });

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
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      isRead: false,
      isDeleted: false
    });

    res.json({ unreadCount: count });

  } catch (error) {
    console.error("❌ NOTIFICATION COUNT ERROR:", error);
    res.status(500).json({ message: "Failed to count notifications" });
  }
};

/* ======================================================
   5️⃣ UPDATE PROFILE
====================================================== */

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { username, bio, avatar, coverImage } = req.body;

    if (username) {
      const exists = await User.findOne({
        username,
        _id: { $ne: userId }
      });

      if (exists) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, bio, avatar, coverImage },
      { new: true }
    ).select("-password");

    res.json(updatedUser);

  } catch (error) {
    console.error("❌ UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Profile update failed" });
  }
};

/* ======================================================
   6️⃣ BLOCK USER (UPDATED FOR userOne/userTwo)
====================================================== */

export const blockUser = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;

    if (userId === targetUserId) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: targetUserId }
    });

    /* ===== DELETE ANY RELATION ===== */

    await Friend.deleteMany({
      $or: [
        { userOne: userId, userTwo: targetUserId },
        { userOne: targetUserId, userTwo: userId }
      ]
    });

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
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { blockedUsers: req.body.targetUserId }
    });

    res.json({ message: "User unblocked successfully" });

  } catch (error) {
    console.error("❌ UNBLOCK ERROR:", error);
    res.status(500).json({ message: "Failed to unblock user" });
  }
};
