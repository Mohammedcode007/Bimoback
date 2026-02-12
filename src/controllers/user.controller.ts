// import { Request, Response } from "express";
// import mongoose from "mongoose";
// import User from "../models/User";
// import Friend from "../models/Friend";
// import Notification from "../models/Notification";

// /* ======================================================
//    1️⃣ SEARCH USERS
// ====================================================== */

// export const searchUsers = async (req: Request, res: Response) => {
//   try {
//     const q = (req.query.q as string)?.trim();
//     const currentUserId = req.user.id;

//     console.log("🔎 [SEARCH USERS]", {
//       by: currentUserId,
//       query: q,
//       time: new Date().toISOString()
//     });

//     if (!q) {
//       return res.status(400).json({ message: "Search query required" });
//     }

//     const currentObjectId = new mongoose.Types.ObjectId(currentUserId);

//     const users = await User.aggregate([

//       /* ================= EXCLUDE SELF ================= */

//       {
//         $match: {
//           // _id: { $ne: currentObjectId }, // ✅ استبعاد نفسك
//           blockedUsers: { $ne: currentObjectId },
//           $text: { $search: q }
//         }
//       },

//       /* ================= LOOKUP RELATION ================= */

//       {
//   $lookup: {
//     from: "friends",
//     let: { targetUserId: "$_id" },
//     pipeline: [
//       {
//         $match: {
//           $expr: {
//             $or: [
//               {
//                 $and: [
//                   { $eq: ["$requester", currentObjectId] },
//                   { $eq: ["$recipient", "$$targetUserId"] }
//                 ]
//               },
//               {
//                 $and: [
//                   { $eq: ["$recipient", currentObjectId] },
//                   { $eq: ["$requester", "$$targetUserId"] }
//                 ]
//               }
//             ]
//           }
//         }
//       }
//     ],
//     as: "relation"
//   }
// },
//      {
//   $addFields: {
//     relationshipStatus: {
//       $cond: [
//         { $eq: ["$relation.status", "accepted"] },
//         "accepted",
//         {
//           $cond: [
//             {
//               $and: [
//                 { $eq: ["$relation.status", "pending"] },
//                 { $eq: ["$relation.requester", currentObjectId] }
//               ]
//             },
//             "pending_sent",
//             {
//               $cond: [
//                 {
//                   $and: [
//                     { $eq: ["$relation.status", "pending"] },
//                     { $eq: ["$relation.recipient", currentObjectId] }
//                   ]
//                 },
//                 "pending_received",
//                 "none"
//               ]
//             }
//           ]
//         }
//       ]
//     }
//   }
// }
// ,

//       /* ================= CALCULATE RELATION STATUS ================= */

//       {
//         $addFields: {
//           relationshipStatus: {
//             $switch: {
//               branches: [

//                 /* ===== ACCEPTED ===== */
//                 {
//                   case: { $eq: ["$relation.status", "accepted"] },
//                   then: "accepted"
//                 },

//                 /* ===== YOU SENT REQUEST ===== */
//                 {
//                   case: {
//                     $and: [
//                       { $eq: ["$relation.status", "pending"] },
//                       { $eq: ["$relation.requester", currentObjectId] }
//                     ]
//                   },
//                   then: "pending_sent"
//                 },

//                 /* ===== HE SENT REQUEST ===== */
//                 {
//                   case: {
//                     $and: [
//                       { $eq: ["$relation.status", "pending"] },
//                       { $eq: ["$relation.recipient", currentObjectId] }
//                     ]
//                   },
//                   then: "pending_received"
//                 }

//               ],
//               default: "none"
//             }
//           }
//         }
//       },

//       /* ================= RETURN FIELDS ================= */

//       {
//         $project: {
//           username: 1,
//           atUsername: 1,
//           avatar: 1,
//           isOnline: 1,
//           lastSeen: 1,
//           isVerified: 1,
//           relationshipStatus: 1
//         }
//       },

//       { $limit: 20 }

//     ]);

//     console.log("✅ Search results:", users.length);

//     res.json(users);

//   } catch (error) {
//     console.error("❌ SEARCH ERROR:", error);
//     res.status(500).json({ message: "Search failed" });
//   }
// };


// /* ======================================================
//    2️⃣ GET USER PROFILE
// ====================================================== */

// export const getUserProfile = async (req: Request, res: Response) => {
//   try {
//     const { userId } = req.params;

//     console.log("👤 [GET PROFILE]", {
//       requestedBy: req.user.id,
//       targetUser: userId
//     });

//     const user = await User.findById(userId).select("-password");

//     if (!user) {
//       console.warn("⚠️ User not found:", userId);
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.json(user);

//   } catch (error) {
//     console.error("❌ PROFILE ERROR:", error);
//     res.status(500).json({ message: "Failed to fetch profile" });
//   }
// };

// /* ======================================================
//    3️⃣ GET FRIENDS
// ====================================================== */

// export const getFriends = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user.id;

//     console.log("👥 [GET FRIENDS]", userId);

//     const relations = await Friend.find({
//       $or: [
//         { requester: userId, status: "accepted" },
//         { recipient: userId, status: "accepted" }
//       ]
//     }).populate("requester recipient", "username avatar isOnline lastSeen");

//     const friends = relations.map((relation: any) =>
//       relation.requester._id.toString() === userId
//         ? relation.recipient
//         : relation.requester
//     );

//     console.log("✅ Friends count:", friends.length);

//     res.json(friends);

//   } catch (error) {
//     console.error("❌ GET FRIENDS ERROR:", error);
//     res.status(500).json({ message: "Failed to fetch friends" });
//   }
// };

// /* ======================================================
//    4️⃣ GET UNREAD NOTIFICATIONS COUNT
// ====================================================== */

// export const getUnreadNotificationCount = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     console.log("🔔 [UNREAD COUNT] for user:", req.user.id);

//     const count = await Notification.countDocuments({
//       recipient: req.user.id,
//       isRead: false,
//       isDeleted: false
//     });

//     console.log("✅ Unread notifications:", count);

//     res.json({ unreadCount: count });

//   } catch (error) {
//     console.error("❌ NOTIFICATION COUNT ERROR:", error);
//     res.status(500).json({ message: "Failed to count notifications" });
//   }
// };

// /* ======================================================
//    5️⃣ UPDATE PROFILE
// ====================================================== */

// export const updateProfile = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user.id;
//     const { username, bio, avatar, coverImage } = req.body;

//     console.log("✏️ [UPDATE PROFILE]", {
//       userId,
//       updates: { username, bio, avatar, coverImage }
//     });

//     if (username) {
//       const exists = await User.findOne({
//         username,
//         _id: { $ne: userId }
//       });

//       if (exists) {
//         console.warn("⚠️ Username already taken:", username);
//         return res.status(400).json({ message: "Username already taken" });
//       }
//     }

//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { username, bio, avatar, coverImage },
//       { new: true }
//     ).select("-password");

//     console.log("✅ Profile updated successfully");

//     res.json(updatedUser);

//   } catch (error) {
//     console.error("❌ UPDATE PROFILE ERROR:", error);
//     res.status(500).json({ message: "Profile update failed" });
//   }
// };

// /* ======================================================
//    6️⃣ BLOCK USER
// ====================================================== */

// export const blockUser = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user.id;
//     const { targetUserId } = req.body;

//     console.log("⛔ [BLOCK USER]", {
//       by: userId,
//       target: targetUserId
//     });

//     if (userId === targetUserId) {
//       console.warn("⚠️ User tried to block himself");
//       return res.status(400).json({ message: "Cannot block yourself" });
//     }

//     await User.findByIdAndUpdate(userId, {
//       $addToSet: { blockedUsers: targetUserId }
//     });

//     await Friend.deleteMany({
//       $or: [
//         { requester: userId, recipient: targetUserId },
//         { requester: targetUserId, recipient: userId }
//       ]
//     });

//     console.log("✅ User blocked successfully");

//     res.json({ message: "User blocked successfully" });

//   } catch (error) {
//     console.error("❌ BLOCK ERROR:", error);
//     res.status(500).json({ message: "Failed to block user" });
//   }
// };

// /* ======================================================
//    7️⃣ UNBLOCK USER
// ====================================================== */

// export const unblockUser = async (req: Request, res: Response) => {
//   try {
//     console.log("🔓 [UNBLOCK USER]", {
//       by: req.user.id,
//       target: req.body.targetUserId
//     });

//     await User.findByIdAndUpdate(req.user.id, {
//       $pull: { blockedUsers: req.body.targetUserId }
//     });

//     console.log("✅ User unblocked successfully");

//     res.json({ message: "User unblocked successfully" });

//   } catch (error) {
//     console.error("❌ UNBLOCK ERROR:", error);
//     res.status(500).json({ message: "Failed to unblock user" });
//   }
// };

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
    const q = (req.query.q as string)?.trim();
    const currentUserId = req.user.id;

    if (!q) {
      return res.status(400).json({ message: "Search query required" });
    }

    const currentObjectId = new mongoose.Types.ObjectId(currentUserId);

    const users = await User.aggregate([

      /* ===== EXCLUDE SELF + BLOCK LOGIC ===== */

      {
        $match: {
          _id: { $ne: currentObjectId },
          blockedUsers: { $ne: currentObjectId },
          $text: { $search: q }
        }
      },

      /* ===== LOOKUP RELATION (userOne/userTwo) ===== */

    {
  $lookup: {
    from: "friends",
    let: {
      targetUserId: "$_id",
      currentUserId: currentObjectId
    },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              {
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
            ]
          }
        }
      }
    ],
    as: "relation"
  }
}

      ,

      /* ===== EXTRACT FIRST RELATION ===== */

      {
        $addFields: {
          relationDoc: { $arrayElemAt: ["$relation", 0] }
        }
      },

      /* ===== CALCULATE RELATIONSHIP STATUS ===== */

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
                    currentObjectId
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
                    currentObjectId
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
}


      ,

      /* ===== FINAL FIELDS ===== */

      {
        $project: {
          username: 1,
          atUsername: 1,
          avatar: 1,
          isOnline: 1,
          lastSeen: 1,
          isVerified: 1,
          relationshipStatus: 1
        }
      },

      { $limit: 20 }

    ]);
    console.log("🔎 Search Results With Status:", users);

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
