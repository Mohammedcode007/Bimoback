import Friend from "../models/Friend";
import mongoose from "mongoose";
import User, { IUser } from "../models/User";
import { Types } from "mongoose";
type UpdateProfilePayload = {
  displayName?: string;
  bio?: string;
  country?: string;
  city?: string;
  dateOfBirth?: Date;

  avatar?: string;
  coverImage?: string;

  tags?: string[];

  privacy?: {
    profileVisible?: boolean;
    showLastActive?: boolean;
    showMedia?: boolean;
    allowMessages?: boolean;
  };

  notifications?: {
    messages?: boolean;
    likes?: boolean;
    follows?: boolean;
  };

  partnerPreferences?: {
    ageRange?: string;
    location?: string;
    maritalStatus?: string;
    religiosity?: string;
  };

  notificationSound?: boolean;
  readReceiptsEnabled?: boolean;
};
class UserService {
// services/user.service.ts


  async getMyFullUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user id");
    }

    const user = await User.findById(userId)
      .select("-password -__v") // ✅ يرجّع كل شيء ما عدا password و __v
      .lean();

    if (!user) throw new Error("User not found");
    return user;
  }

// داخل class UserService

async updateFullProfileSettings(
  userId: string,
  payload: UpdateProfilePayload
): Promise<IUser> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user id");
  }

  const updateData: Record<string, any> = {};

  // Helper: string
  const setStr = (key: string, v: any, maxLen?: number) => {
    if (typeof v !== "string") return;
    const s = v.trim();
    if (!s && s !== "") return;
    updateData[key] = maxLen ? s.slice(0, maxLen) : s;
  };

  // Helper: boolean
  const setBool = (key: string, v: any) => {
    if (typeof v !== "boolean") return;
    updateData[key] = v;
  };

  /* =============================
     ✅ Basic Editable Fields
     (🚫 لا يوجد username / atUsername هنا)
  ============================= */

  setStr("displayName", payload.displayName, 80);
  setStr("bio", payload.bio, 2000);
  setStr("country", payload.country, 50);
  setStr("city", payload.city, 60);

  // dateOfBirth: يقبل Date أو string ISO
  if (payload.dateOfBirth) {
    const d =
      payload.dateOfBirth instanceof Date
        ? payload.dateOfBirth
        : new Date(payload.dateOfBirth as any);

    if (!isNaN(d.getTime())) {
      updateData.dateOfBirth = d;
    }
  }

  if (typeof payload.avatar === "string") updateData.avatar = payload.avatar;
  if (typeof payload.coverImage === "string") updateData.coverImage = payload.coverImage;

  // tags: تنظيف + منع التكرار + حد أقصى
  if (Array.isArray(payload.tags)) {
    const cleaned = payload.tags
      .filter((x) => typeof x === "string")
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
      .slice(0, 30);

    // unique
    updateData.tags = Array.from(new Set(cleaned));
  }

  /* =============================
     ✅ Privacy (nested)
  ============================= */

  if (payload.privacy) {
    setBool("privacy.profileVisible", payload.privacy.profileVisible);
    setBool("privacy.showLastActive", payload.privacy.showLastActive);
    setBool("privacy.showMedia", payload.privacy.showMedia);
    setBool("privacy.allowMessages", payload.privacy.allowMessages);
  }

  /* =============================
     ✅ Notifications (nested)
  ============================= */

  if (payload.notifications) {
    setBool("notifications.messages", payload.notifications.messages);
    setBool("notifications.likes", payload.notifications.likes);
    setBool("notifications.follows", payload.notifications.follows);
  }

  /* =============================
     ✅ Partner Preferences (nested)
  ============================= */

  if (payload.partnerPreferences) {
    setStr("partnerPreferences.ageRange", payload.partnerPreferences.ageRange, 40);
    setStr("partnerPreferences.location", payload.partnerPreferences.location, 120);
    setStr("partnerPreferences.maritalStatus", payload.partnerPreferences.maritalStatus, 40);
    setStr("partnerPreferences.religiosity", payload.partnerPreferences.religiosity, 60);
  }

  /* =============================
     ✅ Other settings (existing in schema)
  ============================= */

  setBool("notificationSound", payload.notificationSound);
  setBool("readReceiptsEnabled", payload.readReceiptsEnabled);

  /* =============================
     ✅ حماية إضافية
     - لو المستخدم أرسل username/atUsername لن يتم استخدامهم أصلاً
     - ولا يتم تمرير req.body كما هو
  ============================= */

  // لو مفيش أي تحديث
  if (Object.keys(updateData).length === 0) {
    const me = await User.findById(userId);
    if (!me) throw new Error("User not found");
    return me;
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new Error("User not found");
  }

  return updated;
}
  async search(currentUserId: string, query: string) {

    const currentObjectId = new mongoose.Types.ObjectId(currentUserId);

    /* ================= FIND USERS ================= */

    const users = await User.find({
      _id: { $ne: currentObjectId },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { atUsername: { $regex: query, $options: "i" } }
      ]
    }).limit(20);

    const userIds = users.map(u => u._id);

    /* ================= FIND RELATIONS ================= */

    const relations = await Friend.find({
      $or: [
        { requester: currentObjectId, recipient: { $in: userIds } },
        { recipient: currentObjectId, requester: { $in: userIds } }
      ]
    });

    const currentUser = await User.findById(currentObjectId);

    /* ================= MAP RELATIONS ================= */

    const relationMap = new Map<string, any>();

    relations.forEach(relation => {

      const otherUserId =
        relation.requester.toString() === currentUserId
          ? relation.recipient.toString()
          : relation.requester.toString();

      relationMap.set(otherUserId, relation);
    });

    /* ================= BUILD RESPONSE ================= */

    return users.map(user => {

      let status:
        | "none"
        | "pending_sent"
        | "pending_received"
        | "accepted"
        | "blocked_by_me"
        | "blocked_me" = "none";

      /* ===== BLOCK CHECK ===== */

      if (currentUser?.blockedUsers.some(id => id.equals(user._id))) {
        status = "blocked_by_me";
      }

      else if (user.blockedUsers.some(id => id.equals(currentObjectId))) {
        status = "blocked_me";
      }

      /* ===== RELATION CHECK ===== */

      const relation = relationMap.get(user._id.toString());

      if (relation) {

        if (relation.status === "accepted") {
          status = "accepted";
        }

        else if (relation.status === "pending") {

          if (relation.requester.toString() === currentUserId)
            status = "pending_sent";
          else
            status = "pending_received";
        }

        else if (relation.status === "blocked") {

          if (relation.blockedBy?.toString() === currentUserId)
            status = "blocked_by_me";
          else
            status = "blocked_me";
        }
      }

      return {
        _id: user._id,
        username: user.username,
        atUsername: user.atUsername,
        avatar: user.avatar,
        isOnline: user.isOnline,
        relationshipStatus: status
      };
    });
  }
}

export default new UserService();
