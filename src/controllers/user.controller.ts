
import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Friend from "../models/Friend";
import Notification from "../models/Notification";
import userService from "../services/user.service";
import bcrypt from "bcrypt"; // ✅ أفضل من require داخل الدالة
import { comparePassword, hashPassword } from "../utils/hash";

/* ======================================================
   1️⃣ SEARCH USERS
====================================================== */



export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { oldPassword, newPassword } = req.body as {
      oldPassword?: string;
      newPassword?: string;
    };

    const oldP = String(oldPassword || "").trim();
    const newP = String(newPassword || "").trim();

    if (!oldP) return res.status(400).json({ message: "Old password required" });
    if (!newP) return res.status(400).json({ message: "New password required" });
    if (newP.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    if (oldP === newP) {
      return res.status(400).json({ message: "New password must be different" });
    }

    // ✅ لازم تجيب الباسورد من DB
    const user = await User.findById(userId).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ نفس طريقة المقارنة المستخدمة في loginUser
    const ok = await comparePassword(oldP, user.password);
    if (!ok) return res.status(400).json({ message: "Old password incorrect" });

    // ✅ هنا هو الفرق المهم: نعمل hash يدويًا (بدون الاعتماد على pre-save)
    const hashed = await hashPassword(newP);
    user.password = hashed;
    await user.save();

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (e) {
    console.error("❌ CHANGE PASSWORD ERROR:", e);
    return res.status(500).json({ message: "Failed to change password" });
  }
};
export const searchUsers = async (req: Request, res: Response) => {
  try {

    const query = (req.query.q as string)?.trim();
    const currentUserId = req.user.id;


    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }

    const users = await userService.search(currentUserId, query);


    users.forEach((user, index) => {
   
    });


    res.json(users);

  } catch (error) {
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
   3️⃣ GET FRIENDS
====================================================== */

export const getFriends = async (req: Request, res: Response) => {
  try {

    const userId = new mongoose.Types.ObjectId(req.user.id);


    const relations = await Friend.find({
      status: "accepted",
      $or: [
        { requester: userId },
        { recipient: userId }
      ]
    }).populate("requester recipient", "username avatar isOnline lastSeen");


    const friends = relations.map((relation: any) => {
      return relation.requester._id.equals(userId)
        ? relation.recipient
        : relation.requester;
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
   6️⃣ BLOCK USER
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

    await Friend.deleteMany({
      $or: [
        { requester: userId, recipient: targetUserId },
        { requester: targetUserId, recipient: userId }
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


/* ======================================================
   8️⃣ UPDATE PROFILE (Dynamic + Password + Unique atUsername)
====================================================== */

export const updateProfile = async (req: Request, res: Response) => {
  try {

    const userId = req.user.id;
    const updates = req.body;

    const allowedFields = [
      "username",
      "atUsername",
      "email",
      "avatar",
      "coverImage",
      "bio",
      "country",              // ✅ تمت إضافته
      "notificationSound",
      "readReceiptsEnabled"
    ];

    const updateData: any = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    /* ===== UNIQUE atUsername ===== */

    if (updateData.atUsername) {

      updateData.atUsername = updateData.atUsername.toLowerCase();

      const exists = await User.findOne({
        atUsername: updateData.atUsername,
        _id: { $ne: userId }
      });

      if (exists) {
        return res.status(400).json({
          message: "atUsername already taken"
        });
      }
    }

    /* ===== PASSWORD CHANGE ===== */

    if (updates.newPassword) {

      if (!updates.oldPassword) {
        return res.status(400).json({
          message: "Old password required"
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      const bcrypt = require("bcrypt");

      const isMatch = await bcrypt.compare(
        updates.oldPassword,
        user.password
      );

      if (!isMatch) {
        return res.status(400).json({
          message: "Old password incorrect"
        });
      }

      user.password = updates.newPassword; // سيتم تشفيرها عبر pre-save
      await user.save();

      delete updateData.password;
    }

    /* ===== UPDATE OTHER FIELDS ===== */

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password");

    res.json(updatedUser);

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};


/* ======================================================
   GET BLOCKED USERS
====================================================== */

export const getBlockedUsers = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("blockedUsers", "username atUsername avatar");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.blockedUsers);

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch blocked users" });
  }
};
export const getMyFullUser = async (req: Request, res: Response) => {
  try {
    const userId =
      (req as any).user?.id ||
      (req as any).user?._id?.toString();

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const data = await userService.getMyFullUser(userId);

    return res.json({
      success: true,
      data,
    });
  } catch (e: any) {
    return res.status(400).json({
      success: false,
      message: e?.message || "Failed to load user",
    });
  }
};
export const updateMyProfileSettings = async (req: Request, res: Response) => {
  const userId = (req as any).user.id; // من middleware protect

  const updatedUser = await userService.updateFullProfileSettings(userId, req.body);

  res.json({
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  });
};
/* ======================================================
   UPDATE ONLINE STATUS
====================================================== */

export const updateOnlineStatus = async (req: Request, res: Response) => {
  try {

    const userId = req.user.id;
    const { status } = req.body; // "online" | "offline"

    if (!["online", "offline"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updateData: any = {
      isOnline: status === "online"
    };

    if (status === "offline") {
      updateData.lastSeen = new Date();
    }

    await User.findByIdAndUpdate(userId, updateData);

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ message: "Failed to update status" });
  }
};
