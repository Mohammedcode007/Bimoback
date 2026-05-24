
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
// ✅ GET /users/block-status/:targetUserId
export const checkBlockStatus = async (req: Request, res: Response) => {
  try {
    const myId = req.user.id;

    const raw = (req.params as any).targetUserId as string | string[] | undefined;
    const targetUserId = Array.isArray(raw) ? raw[0] : raw;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "Invalid targetUserId" });
    }

    if (String(myId) === String(targetUserId)) {
      return res.json({ success: true, blockedByMe: false, blockedMe: false, anyBlocked: false });
    }

    const [blockedByMe, blockedMe] = await Promise.all([
      User.exists({ _id: myId, blockedUsers: targetUserId }),
      User.exists({ _id: targetUserId, blockedUsers: myId })
    ]);

    return res.json({
      success: true,
      blockedByMe: !!blockedByMe,
      blockedMe: !!blockedMe,
      anyBlocked: !!blockedByMe || !!blockedMe
    });
  } catch (e) {
    console.error("❌ CHECK BLOCK STATUS ERROR:", e);
    return res.status(500).json({ message: "Failed to check block status" });
  }
};
/* ======================================================
   DEBIT MY COINZ (User Self Debit)
====================================================== */

export const debitMyCoinz = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { amount, reason } = req.body;

    const debitAmount = Number(amount);
    if (!Number.isFinite(debitAmount) || debitAmount <= 0) {
      return res.status(400).json({ message: "Invalid debit amount" });
    }

    const updated = await User.findOneAndUpdate(
      { _id: userId, CoinzBalance: { $gte: debitAmount } },
      { $inc: { CoinzBalance: -debitAmount } },
      { new: true }
    ).select("CoinzBalance");

    if (!updated) {
      return res.status(400).json({ message: "Insufficient coinz balance" });
    }

    return res.json({
      success: true,
      debited: debitAmount,
      reason: reason || null,
      coinzBalance: Number(updated.CoinzBalance) || 0, // نرجعه للفرونت بنفس الاسم الصغير
    });
  } catch (error) {
    console.error("❌ DEBIT COINZ ERROR:", error);
    return res.status(500).json({ message: "Failed to debit coinz" });
  }
};

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
    if (!user.password) {
      return res.status(400).json({
        message: "This account uses Google sign-in and has no password yet",
      });
    }

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
export const changeMyEmail = async (req: Request, res: Response) => {
  try {
    const userId =
      (req as any).user?.id ||
      (req as any).user?._id?.toString();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { email } = req.body as { email?: string };

    const updatedUser = await userService.changeMyEmail(
      userId,
      String(email || "")
    );

    return res.status(200).json({
      success: true,
      message: "Email changed successfully",
      data: updatedUser,
    });
  } catch (error: any) {
    console.error("❌ CHANGE EMAIL ERROR:", error);

    const msg = error?.message || "Failed to change email";

    if (
      msg === "Invalid user id" ||
      msg === "Email is required" ||
      msg === "Invalid email format" ||
      msg === "This email is already your current email" ||
      msg === "Email already in use"
    ) {
      return res.status(400).json({
        success: false,
        message: msg,
      });
    }

    if (msg === "User not found") {
      return res.status(404).json({
        success: false,
        message: msg,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to change email",
    });
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
    const raw = req.params.userId as string | string[] | undefined;
    const userId = Array.isArray(raw) ? raw[0] : raw;

    if (!userId) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const viewerId = req.user.id;

    const user = await userService.getUserProfileWithView(viewerId, userId);

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
    const updates = req.body || {};



    const allowedFields = [
      "username",
      "atUsername",
      "email",

      // الصور العادية
      "avatar",
      "avatarPublicId",

      // صورة GIF
      "avatarGif",
      "avatarGifPublicId",

      // الغلاف
      "coverImage",
      "cover",
      "coverImagePublicId",

      "bio",
      "country",
      "notificationSound",
      "readReceiptsEnabled",
    ];

    const updateData: any = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    /**
     * ✅ مهم جدًا للـ GIF:
     * الفرونت يعرض غالبًا:
     * currentUser?.activeCustomization?.avatarGif || currentUser?.avatar
     *
     * لذلك يجب حفظ avatarGif داخل activeCustomization أيضًا.
     */
    if (
      updates.activeCustomization &&
      typeof updates.activeCustomization === "object"
    ) {
      if (typeof updates.activeCustomization.avatarGif === "string") {
        updateData["activeCustomization.avatarGif"] =
          updates.activeCustomization.avatarGif;
      }

      if (typeof updates.activeCustomization.avatarFrame === "string") {
        updateData["activeCustomization.avatarFrame"] =
          updates.activeCustomization.avatarFrame;
      }

      if (typeof updates.activeCustomization.usernameColor === "string") {
        updateData["activeCustomization.usernameColor"] =
          updates.activeCustomization.usernameColor;
      }

      if (typeof updates.activeCustomization.messageTextColor === "string") {
        updateData["activeCustomization.messageTextColor"] =
          updates.activeCustomization.messageTextColor;
      }

      if (typeof updates.activeCustomization.messageEffect === "string") {
        updateData["activeCustomization.messageEffect"] =
          updates.activeCustomization.messageEffect;
      }

      if (typeof updates.activeCustomization.profileEntryAnimation === "string") {
        updateData["activeCustomization.profileEntryAnimation"] =
          updates.activeCustomization.profileEntryAnimation;
      }

      if (typeof updates.activeCustomization.verificationType === "string") {
        updateData["activeCustomization.verificationType"] =
          updates.activeCustomization.verificationType;
      }

      if (Array.isArray(updates.activeCustomization.badges)) {
        updateData["activeCustomization.badges"] =
          updates.activeCustomization.badges.map(String);
      }
    }



    /* ===== UNIQUE atUsername ===== */

    if (updateData.atUsername) {
      updateData.atUsername = updateData.atUsername.toLowerCase();

      const exists = await User.findOne({
        atUsername: updateData.atUsername,
        _id: { $ne: userId },
      });

      if (exists) {
        return res.status(400).json({
          message: "atUsername already taken",
        });
      }
    }

    /* ===== PASSWORD CHANGE ===== */

    if (updates.newPassword) {
      if (!updates.oldPassword) {
        return res.status(400).json({
          message: "Old password required",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const bcrypt = require("bcrypt");

      const isMatch = await bcrypt.compare(
        updates.oldPassword,
        user.password
      );

      if (!isMatch) {
        return res.status(400).json({
          message: "Old password incorrect",
        });
      }

      user.password = updates.newPassword;
      await user.save();

      delete updateData.password;
    }

    /* ===== UPDATE OTHER FIELDS ===== */

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");



    return res.json(updatedUser);
  } catch (error: any) {


    return res.status(500).json({
      message: "Failed to update profile",
    });
  }
};
// export const updateProfile = async (req: Request, res: Response) => {
//   try {

//     const userId = req.user.id;
//     const updates = req.body;

//     const allowedFields = [
//       "username",
//       "atUsername",
//       "email",
//       "avatar",
//       "coverImage",
//       "bio",
//       "country",              // ✅ تمت إضافته
//       "notificationSound",
//       "readReceiptsEnabled"
//     ];

//     const updateData: any = {};

//     for (const field of allowedFields) {
//       if (updates[field] !== undefined) {
//         updateData[field] = updates[field];
//       }
//     }

//     /* ===== UNIQUE atUsername ===== */

//     if (updateData.atUsername) {

//       updateData.atUsername = updateData.atUsername.toLowerCase();

//       const exists = await User.findOne({
//         atUsername: updateData.atUsername,
//         _id: { $ne: userId }
//       });

//       if (exists) {
//         return res.status(400).json({
//           message: "atUsername already taken"
//         });
//       }
//     }

//     /* ===== PASSWORD CHANGE ===== */

//     if (updates.newPassword) {

//       if (!updates.oldPassword) {
//         return res.status(400).json({
//           message: "Old password required"
//         });
//       }

//       const user = await User.findById(userId);
//       if (!user) {
//         return res.status(404).json({
//           message: "User not found"
//         });
//       }

//       const bcrypt = require("bcrypt");

//       const isMatch = await bcrypt.compare(
//         updates.oldPassword,
//         user.password
//       );

//       if (!isMatch) {
//         return res.status(400).json({
//           message: "Old password incorrect"
//         });
//       }

//       user.password = updates.newPassword; // سيتم تشفيرها عبر pre-save
//       await user.save();

//       delete updateData.password;
//     }

//     /* ===== UPDATE OTHER FIELDS ===== */

//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $set: updateData },
//       { new: true }
//     ).select("-password");

//     res.json(updatedUser);

//   } catch (error) {
//     console.error("UPDATE PROFILE ERROR:", error);
//     res.status(500).json({ message: "Failed to update profile" });
//   }
// };


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

/* ======================================================
   UPDATE COUNTRY & CITY
====================================================== */

export const updateLocation = async (req: Request, res: Response) => {
  try {

    const userId = req.user.id;

    const { country, city } = req.body;

    if (!country && !city) {
      return res.status(400).json({
        message: "Country or city is required"
      });
    }

    const updateData: any = {};

    if (country !== undefined) {
      updateData.country = String(country).trim();
    }

    if (city !== undefined) {
      updateData.city = String(city).trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("country city");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "Location updated successfully",
      data: updatedUser
    });

  } catch (error) {
    console.error("❌ UPDATE LOCATION ERROR:", error);

    res.status(500).json({
      message: "Failed to update location"
    });
  }
};