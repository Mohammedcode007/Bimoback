import Friend from "../models/Friend";
import mongoose from "mongoose";
import User, { IUser } from "../models/User";
import { Types } from "mongoose";
type UpdateProfilePayload = {
  displayName?: string;
  bio?: string;
  country?: string;
  city?: string;
  dateOfBirth?: Date | string;
  age?: number;
  gender?: string;

  avatar?: string;
  avatarPublicId?: string;

  avatarGif?: string;
  avatarGifPublicId?: string;

  coverImage?: string;
  cover?: string;
  coverImagePublicId?: string;
  customImageBadge?: {
    url?: string;
    isActive?: boolean;
    purchasedAt?: Date | string | null;
    expiresAt?: Date | string | null;
  };
  activeCustomization?: {
    avatarFrame?: string;
    avatarGif?: string;
    usernameColor?: string;
    messageTextColor?: string;
    messageEffect?: string;
    profileEntryAnimation?: string;
    badges?: string[];
    verificationType?: string;
  };

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
function escapeRegex(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSearchAtUsername(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}
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
  async getUserProfileWithView(viewerId: string, profileUserId: string) {
    if (
      !Types.ObjectId.isValid(viewerId) ||
      !Types.ObjectId.isValid(profileUserId)
    ) {
      throw new Error("Invalid user id");
    }

    const user = await User.findById(profileUserId).select("-password -__v");

    if (!user) {
      throw new Error("User not found");
    }

    const profileObjectId = new Types.ObjectId(profileUserId);

    const friendsCount = await Friend.countDocuments({
      status: "accepted",
      $or: [
        { requester: profileObjectId },
        { recipient: profileObjectId },
      ],
    });

    // لا تحتسب مشاهدة الشخص لنفسه
    if (viewerId === profileUserId) {
      return {
        ...user.toObject(),
        friendsCount,
      };
    }

    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;

    user.profileViewTimestamps = (user.profileViewTimestamps || []).filter(
      (entry: any) => {
        if (!entry?.viewedAt) return false;

        return now.getTime() - new Date(entry.viewedAt).getTime() < DAY_MS;
      }
    );

    const alreadyViewedInLast24h = user.profileViewTimestamps.some(
      (entry: any) => entry?.viewer?.toString() === viewerId
    );

    if (!alreadyViewedInLast24h) {
      user.profileViews = (user.profileViews || 0) + 1;

      user.profileViewTimestamps.push({
        viewer: new Types.ObjectId(viewerId),
        viewedAt: now,
      } as any);

      await user.save();
    }

    return {
      ...user.toObject(),
      friendsCount,
    };
  }

  async updateFullProfileSettings(
    userId: string,
    payload: UpdateProfilePayload
  ): Promise<IUser> {
    const debugId = `profile-update-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`;



    if (!Types.ObjectId.isValid(userId)) {
      console.log(`🔴 [${debugId}] Invalid user id`, { userId });
      throw new Error("Invalid user id");
    }

    const updateData: Record<string, any> = {};

    const setStr = (key: string, v: any, maxLen?: number) => {


      if (typeof v !== "string") return;

      const s = v.trim();

      if (!s && s !== "") return;

      updateData[key] = maxLen ? s.slice(0, maxLen) : s;


    };

    const setBool = (key: string, v: any) => {


      if (typeof v !== "boolean") return;

      updateData[key] = v;


    };

    setStr("displayName", payload.displayName, 80);
    setStr("bio", payload.bio, 2000);
    setStr("country", payload.country, 50);
    setStr("city", payload.city, 60);

    if (payload.age !== undefined) {
      const ageNum = Number(payload.age);



      if (Number.isFinite(ageNum) && ageNum >= 1 && ageNum <= 120) {
        updateData.age = Math.floor(ageNum);


      }
    }

    if (typeof payload.gender === "string") {
      const g = payload.gender.trim().toLowerCase();



      if (g === "male" || g === "female") {
        updateData.gender = g;


      }
    }

    if (payload.dateOfBirth) {
      const d =
        payload.dateOfBirth instanceof Date
          ? payload.dateOfBirth
          : new Date(payload.dateOfBirth as any);



      if (!isNaN(d.getTime())) {
        updateData.dateOfBirth = d;


      }
    }

    if (typeof payload.avatar === "string") {
      updateData.avatar = payload.avatar;


    }

    if (typeof payload.avatarPublicId === "string") {
      updateData.avatarPublicId = payload.avatarPublicId;


    }

    if (typeof payload.avatarGif === "string") {
      updateData.avatarGif = payload.avatarGif;


    } else {

    }

    if (typeof payload.avatarGifPublicId === "string") {
      updateData.avatarGifPublicId = payload.avatarGifPublicId;

      console.log(`✅ [${debugId}] avatarGifPublicId added`, {
        avatarGifPublicId: updateData.avatarGifPublicId,
      });
    } else {

    }

    if (typeof payload.coverImage === "string") {
      updateData.coverImage = payload.coverImage;


    }

    if (typeof payload.cover === "string") {
      updateData.cover = payload.cover;


    }

    if (typeof payload.coverImagePublicId === "string") {
      updateData.coverImagePublicId = payload.coverImagePublicId;


    }


    if (
      payload.activeCustomization &&
      typeof payload.activeCustomization === "object"
    ) {
      if (typeof payload.activeCustomization.avatarGif === "string") {
        updateData["activeCustomization.avatarGif"] =
          payload.activeCustomization.avatarGif;

      } else {

      }

      if (typeof payload.activeCustomization.avatarFrame === "string") {
        updateData["activeCustomization.avatarFrame"] =
          payload.activeCustomization.avatarFrame;
      }

      if (typeof payload.activeCustomization.usernameColor === "string") {
        updateData["activeCustomization.usernameColor"] =
          payload.activeCustomization.usernameColor;
      }

      if (typeof payload.activeCustomization.messageTextColor === "string") {
        updateData["activeCustomization.messageTextColor"] =
          payload.activeCustomization.messageTextColor;
      }

      if (typeof payload.activeCustomization.messageEffect === "string") {
        updateData["activeCustomization.messageEffect"] =
          payload.activeCustomization.messageEffect;
      }

      if (typeof payload.activeCustomization.profileEntryAnimation === "string") {
        updateData["activeCustomization.profileEntryAnimation"] =
          payload.activeCustomization.profileEntryAnimation;
      }

      if (typeof payload.activeCustomization.verificationType === "string") {
        updateData["activeCustomization.verificationType"] =
          payload.activeCustomization.verificationType;
      }

      if (Array.isArray(payload.activeCustomization.badges)) {
        updateData["activeCustomization.badges"] =
          payload.activeCustomization.badges.map(String);
      }
    }
if (payload.customImageBadge && typeof payload.customImageBadge === "object") {
  const badge = payload.customImageBadge;

  if (typeof badge.url === "string") {
    updateData["customImageBadge.url"] = badge.url.trim();
  }

  if (typeof badge.isActive === "boolean") {
    updateData["customImageBadge.isActive"] = badge.isActive;
  }

  if (badge.purchasedAt !== undefined) {
    if (badge.purchasedAt === null) {
      updateData["customImageBadge.purchasedAt"] = null;
    } else {
      const d = new Date(badge.purchasedAt as any);
      if (!Number.isNaN(d.getTime())) {
        updateData["customImageBadge.purchasedAt"] = d;
      }
    }
  }

  if (badge.expiresAt !== undefined) {
    if (badge.expiresAt === null) {
      updateData["customImageBadge.expiresAt"] = null;
    } else {
      const d = new Date(badge.expiresAt as any);
      if (!Number.isNaN(d.getTime())) {
        updateData["customImageBadge.expiresAt"] = d;
      }
    }
  }

  console.log(`✅ [${debugId}] customImageBadge added`, {
    customImageBadge: {
      url: updateData["customImageBadge.url"],
      isActive: updateData["customImageBadge.isActive"],
      purchasedAt: updateData["customImageBadge.purchasedAt"],
      expiresAt: updateData["customImageBadge.expiresAt"],
    },
  });
}
    if (Array.isArray(payload.tags)) {
      const cleaned = payload.tags
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
        .slice(0, 30);

      updateData.tags = Array.from(new Set(cleaned));

      console.log(`✅ [${debugId}] tags added`, {
        tags: updateData.tags,
      });
    }

    if (payload.privacy) {
      console.log(`🟣 [${debugId}] privacy incoming`, payload.privacy);

      setBool("privacy.profileVisible", payload.privacy.profileVisible);
      setBool("privacy.showLastActive", payload.privacy.showLastActive);
      setBool("privacy.showMedia", payload.privacy.showMedia);
      setBool("privacy.allowMessages", payload.privacy.allowMessages);
    }

    if (payload.notifications) {
      console.log(`🟣 [${debugId}] notifications incoming`, payload.notifications);

      setBool("notifications.messages", payload.notifications.messages);
      setBool("notifications.likes", payload.notifications.likes);
      setBool("notifications.follows", payload.notifications.follows);
    }

    if (payload.partnerPreferences) {
      console.log(
        `🟣 [${debugId}] partnerPreferences incoming`,
        payload.partnerPreferences
      );

      setStr(
        "partnerPreferences.ageRange",
        payload.partnerPreferences.ageRange,
        40
      );
      setStr(
        "partnerPreferences.location",
        payload.partnerPreferences.location,
        120
      );
      setStr(
        "partnerPreferences.maritalStatus",
        payload.partnerPreferences.maritalStatus,
        40
      );
      setStr(
        "partnerPreferences.religiosity",
        payload.partnerPreferences.religiosity,
        60
      );
    }

    setBool("notificationSound", payload.notificationSound);
    setBool("readReceiptsEnabled", payload.readReceiptsEnabled);

    console.log(`🟢 [${debugId}] FINAL updateData`, {
      updateKeys: Object.keys(updateData),
      updateData,
    });

    if (Object.keys(updateData).length === 0) {
      console.log(`⚠️ [${debugId}] No updateData. Returning current user.`);

      const me = await User.findById(userId);

      console.log(`🟡 [${debugId}] current user result`, {
        found: Boolean(me),
        avatar: me?.avatar,
        avatarGif: me?.avatarGif,
        activeCustomizationAvatarGif: me?.activeCustomization?.avatarGif,
      });

      if (!me) throw new Error("User not found");

      return me;
    }

    console.log(`🟡 [${debugId}] Before findByIdAndUpdate`, {
      userId,
      set: updateData,
    });

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(`🟢 [${debugId}] After findByIdAndUpdate`, {
      found: Boolean(updated),
      id: updated?._id?.toString?.(),
      username: updated?.username,

      avatar: updated?.avatar,
      avatarPublicId: (updated as any)?.avatarPublicId,

      avatarGif: updated?.avatarGif,
      avatarGifPublicId: (updated as any)?.avatarGifPublicId,

      coverImage: updated?.coverImage,
      cover: (updated as any)?.cover,
      coverImagePublicId: (updated as any)?.coverImagePublicId,

      activeCustomization: updated?.activeCustomization,
      activeCustomizationAvatarGif: updated?.activeCustomization?.avatarGif,
    });

    if (!updated) {
      console.log(`🔴 [${debugId}] User not found after update`, {
        userId,
      });

      throw new Error("User not found");
    }

    console.log(`✅ [${debugId}] updateFullProfileSettings DONE`);

    return updated;
  }
  async incrementProfileView(viewerId: string, profileUserId: string) {
    if (!Types.ObjectId.isValid(viewerId) || !Types.ObjectId.isValid(profileUserId)) {
      throw new Error("Invalid user id");
    }

    // لا تحتسب مشاهدة الشخص لنفسه
    if (viewerId === profileUserId) {
      return await User.findById(profileUserId).select("-password -__v").lean();
    }

    const updatedUser = await User.findByIdAndUpdate(
      profileUserId,
      { $inc: { profileViews: 1 } },
      { new: true }
    ).select("-password -__v").lean();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }
  async changeMyEmail(userId: string, newEmail: string): Promise<IUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user id");
    }

    if (typeof newEmail !== "string" || !newEmail.trim()) {
      throw new Error("Email is required");
    }

    const email = newEmail.trim().toLowerCase();

    // فحص بسيط لصيغة البريد
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // تأكد أن المستخدم موجود
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    // لو هو نفس البريد الحالي
    if ((currentUser.email || "").trim().toLowerCase() === email) {
      throw new Error("This email is already your current email");
    }

    // التأكد أن البريد unique
    const existingUser = await User.findOne({
      email,
      _id: { $ne: userId },
    });

    if (existingUser) {
      throw new Error("Email already in use");
    }

    currentUser.email = email;
    await currentUser.save();

    return currentUser;
  }
 async search(currentUserId: string, query: string) {
  const debugId = `user-search-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;

  console.log(`🟡 [${debugId}] search START`, {
    currentUserId,
    query,
  });

  const currentObjectId = new mongoose.Types.ObjectId(currentUserId);

  /* ================= FIND USERS ================= */

  const rawQuery = String(query || "").trim();

  console.log(`🔎 [${debugId}] raw query`, {
    rawQuery,
    length: rawQuery.length,
  });

  if (!rawQuery) {
    console.log(`⚠️ [${debugId}] empty query - return []`);
    return [];
  }

  const safeRawRegex = escapeRegex(rawQuery);
  const safeAtUsername = normalizeSearchAtUsername(rawQuery);

  console.log(`🧹 [${debugId}] normalized query`, {
    rawQuery,
    safeRawRegex,
    safeAtUsername,
  });

  const orConditions: any[] = [
    // يبحث عن الاسم المعروض كما هو، وهذا يدعم ❤️ والإيموجي والعربي
    { username: { $regex: safeRawRegex, $options: "i" } },

    // لو عندك displayName
    { displayName: { $regex: safeRawRegex, $options: "i" } },
  ];

  // يبحث في atUsername فقط لو بعد التنظيف بقي شيء
  // لأن ❤️ بعد التنظيف يصبح فارغًا
  if (safeAtUsername) {
    const safeAtRegex = escapeRegex(safeAtUsername);

    orConditions.push({
      atUsername: { $regex: safeAtRegex, $options: "i" },
    });
  }

  console.log(`🧩 [${debugId}] Mongo OR conditions`, {
    orConditions,
  });

  const users = await User.find({
    _id: { $ne: currentObjectId },
    $or: orConditions,
  })
    .select(
      "_id username atUsername displayName avatar avatarGif activeCustomization customEmojiBadge isOnline blockedUsers"
    )
    .limit(20);

  console.log(`🟢 [${debugId}] users found`, {
    count: users.length,
    users: users.map((u: any) => ({
      id: u._id?.toString?.(),
      username: u.username,
      atUsername: u.atUsername,
      displayName: u.displayName,
      isOnline: u.isOnline,
      blockedUsersCount: Array.isArray(u.blockedUsers)
        ? u.blockedUsers.length
        : 0,
    })),
  });

  const userIds = users.map((u) => u._id);

  /* ================= FIND RELATIONS ================= */

  console.log(`🟡 [${debugId}] finding friend relations`, {
    currentUserId,
    targetUserIds: userIds.map((id: any) => id?.toString?.()),
  });

  const relations = await Friend.find({
    $or: [
      { requester: currentObjectId, recipient: { $in: userIds } },
      { recipient: currentObjectId, requester: { $in: userIds } },
    ],
  });

  console.log(`🟢 [${debugId}] relations found`, {
    count: relations.length,
    relations: relations.map((r: any) => ({
      id: r._id?.toString?.(),
      requester: r.requester?.toString?.(),
      recipient: r.recipient?.toString?.(),
      status: r.status,
      blockedBy: r.blockedBy?.toString?.(),
    })),
  });

  const currentUser = await User.findById(currentObjectId);

  console.log(`👤 [${debugId}] current user loaded`, {
    found: Boolean(currentUser),
    id: currentUser?._id?.toString?.(),
    username: currentUser?.username,
    blockedUsersCount: Array.isArray(currentUser?.blockedUsers)
      ? currentUser?.blockedUsers.length
      : 0,
  });

  /* ================= MAP RELATIONS ================= */

  const relationMap = new Map<string, any>();

  relations.forEach((relation: any) => {
    const otherUserId =
      relation.requester.toString() === currentUserId
        ? relation.recipient.toString()
        : relation.requester.toString();

    relationMap.set(otherUserId, relation);

    console.log(`🔗 [${debugId}] relation mapped`, {
      otherUserId,
      status: relation.status,
      requester: relation.requester?.toString?.(),
      recipient: relation.recipient?.toString?.(),
      blockedBy: relation.blockedBy?.toString?.(),
    });
  });

  /* ================= BUILD RESPONSE ================= */

  const result = users.map((user: any) => {
    let status:
      | "none"
      | "pending_sent"
      | "pending_received"
      | "accepted"
      | "blocked_by_me"
      | "blocked_me" = "none";

    const userId = user._id.toString();

    console.log(`🧪 [${debugId}] checking user`, {
      userId,
      username: user.username,
      atUsername: user.atUsername,
    });

    /* ===== BLOCK CHECK ===== */

    const blockedByMe = Boolean(
      currentUser?.blockedUsers?.some((id: any) => id.equals(user._id))
    );

    const blockedMe = Boolean(
      user.blockedUsers?.some((id: any) => id.equals(currentObjectId))
    );

    console.log(`🚫 [${debugId}] block check`, {
      userId,
      username: user.username,
      blockedByMe,
      blockedMe,
    });

    if (blockedByMe) {
      status = "blocked_by_me";
    } else if (blockedMe) {
      status = "blocked_me";
    }

    /* ===== RELATION CHECK ===== */

    const relation = relationMap.get(userId);

    console.log(`🤝 [${debugId}] relation check`, {
      userId,
      username: user.username,
      hasRelation: Boolean(relation),
      relationStatus: relation?.status,
      requester: relation?.requester?.toString?.(),
      recipient: relation?.recipient?.toString?.(),
      blockedBy: relation?.blockedBy?.toString?.(),
      statusBeforeRelation: status,
    });

    if (relation) {
      if (relation.status === "accepted") {
        status = "accepted";
      } else if (relation.status === "pending") {
        if (relation.requester.toString() === currentUserId) {
          status = "pending_sent";
        } else {
          status = "pending_received";
        }
      } else if (relation.status === "blocked") {
        if (relation.blockedBy?.toString() === currentUserId) {
          status = "blocked_by_me";
        } else {
          status = "blocked_me";
        }
      }
    }

    const item = {
      _id: user._id,
      username: user.username,
      atUsername: user.atUsername,
      avatar: user.avatar,
      isOnline: user.isOnline,
      relationshipStatus: status,
    };

    console.log(`✅ [${debugId}] final user result`, {
      userId,
      username: user.username,
      relationshipStatus: status,
    });

    return item;
  });

  console.log(`🟢 [${debugId}] search DONE`, {
    total: result.length,
    result: result.map((u: any) => ({
      id: u._id?.toString?.(),
      username: u.username,
      atUsername: u.atUsername,
      relationshipStatus: u.relationshipStatus,
      isOnline: u.isOnline,
    })),
  });

  return result;
}
}

export default new UserService();
