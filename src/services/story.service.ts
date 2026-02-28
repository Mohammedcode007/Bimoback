// services/story.service.ts
import mongoose, { Types } from "mongoose";
import User from "../models/User";
import friendService from "./friend.service";

type StoryType = "image" | "video" | "text";
type StoryPrivacy = "public" | "followers" | "private";

class StoryService {
  /** =========================================
   *  FEED: حالات الأصدقاء + حالتي
   *  ========================================= */
  async getFriendsStoriesFeed(viewerId: string, page = 1, limit = 30) {
    try {
      console.log("======================================");
      console.log("[getFriendsStoriesFeed] START");
      console.log("[getFriendsStoriesFeed] DB:", mongoose.connection.name);
      console.log("[getFriendsStoriesFeed] User collection:", User.collection.name);
      console.log("[getFriendsStoriesFeed] viewerId:", viewerId);
      console.log("[getFriendsStoriesFeed] page/limit:", page, limit);

      if (!Types.ObjectId.isValid(viewerId)) {
        console.log("[getFriendsStoriesFeed] ❌ Invalid viewerId");
        throw new Error("Invalid user id");
      }

      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
      const skip = Math.max(0, (safePage - 1) * safeLimit);

      // Snapshot للتأكد أني أقرأ نفس DB/Collection وأن stories موجودة في نفس الوثيقة
      const meSnap = await User.findById(viewerId).select("_id username stories").lean();

      console.log("[getFriendsStoriesFeed] me exists:", !!meSnap);
      console.log("[getFriendsStoriesFeed] me username:", (meSnap as any)?.username);
      console.log("[getFriendsStoriesFeed] me stories count:", (meSnap as any)?.stories?.length || 0);
      if ((meSnap as any)?.stories?.[0]) {
        const f = (meSnap as any).stories[0];
        console.log("[getFriendsStoriesFeed] me first story:", {
          _id: String(f?._id),
          expiresAt: f?.expiresAt,
          expiresAtType: typeof f?.expiresAt,
          expiresAtIsDate: f?.expiresAt instanceof Date,
          privacy: f?.privacy,
          isArchived: f?.isArchived,
          createdAt: f?.createdAt,
        });
      }

      const friendIds = await friendService.getFriendIds(viewerId);
      console.log("[getFriendsStoriesFeed] friendIds count:", friendIds?.length || 0);

      const idsToFetch = Array.from(new Set([viewerId, ...(friendIds || [])]));
      console.log("[getFriendsStoriesFeed] idsToFetch count:", idsToFetch.length);

      if (!idsToFetch.length) {
        console.log("[getFriendsStoriesFeed] DONE (no ids)");
        console.log("======================================");
        return [];
      }

      const viewerOid = new Types.ObjectId(viewerId);
      const targetOids = idsToFetch.map((id) => new Types.ObjectId(id));

      const rows = await User.aggregate([
        {
          $match: {
            _id: { $in: targetOids },
            blockedUsers: { $ne: viewerOid },
          },
        },
        {
          $project: {
            username: 1,
            atUsername: 1,
            avatar: 1,
            isOnline: 1,
            stories: {
              $filter: {
                input: { $ifNull: ["$stories", []] },
                as: "st",
                cond: {
                  $and: [
                    // ✅ نستخدم $$NOW لضمان نفس توقيت DB
                    { $gt: ["$$st.expiresAt", "$$NOW"] },
                    { $ne: ["$$st.isArchived", true] },
                    {
                      $cond: [
                        { $eq: ["$_id", viewerOid] },
                        true,
                        { $in: ["$$st.privacy", ["public", "followers"]] },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        { $match: { "stories.0": { $exists: true } } },
        { $addFields: { latestStoryAt: { $max: "$stories.createdAt" } } },
        { $sort: { latestStoryAt: -1 } },
        { $skip: skip },
        { $limit: safeLimit },
      ]);

      console.log("[getFriendsStoriesFeed] ✅ rows:", rows?.length || 0);
      if (!rows?.length) {
        console.log("[getFriendsStoriesFeed] ⚠️ rows=0 بعد الفلترة.");
      } else {
        console.log("[getFriendsStoriesFeed] sample:", {
          ownerId: String(rows[0]?._id),
          username: rows[0]?.username,
          storiesCount: rows[0]?.stories?.length || 0,
          firstStoryId: rows[0]?.stories?.[0]?._id ? String(rows[0].stories[0]._id) : undefined,
          firstExpiresAt: rows[0]?.stories?.[0]?.expiresAt,
        });
      }

      console.log("[getFriendsStoriesFeed] DONE");
      console.log("======================================");
      return rows;
    } catch (err: any) {
      console.log("======================================");
      console.error("[getFriendsStoriesFeed] ERROR:", err?.message || err);
      console.log("======================================");
      throw err;
    }
  }

  /** =========================================
   *  GET MY STORIES: قصصي الفعالة فقط
   *  ========================================= */
  async getMyStories(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user id");

    const now = new Date();
    const me = await User.findById(userId)
      .select("_id username atUsername avatar isOnline stories")
      .lean();

    if (!me) throw new Error("User not found");

    const stories = (me as any).stories || [];
    const active = stories.filter((st: any) => {
      const exp = st?.expiresAt ? new Date(st.expiresAt) : null;
      if (!exp) return false;
      if (exp <= now) return false;
      if (st?.isArchived) return false;
      return true;
    });

    active.sort((a: any, b: any) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return bt - at;
    });

    return {
      _id: (me as any)._id,
      username: (me as any).username,
      atUsername: (me as any).atUsername,
      avatar: (me as any).avatar,
      isOnline: (me as any).isOnline,
      stories: active,
    };
  }

  /** =========================================
   *  VIEW: مشاهدة Story
   *  ========================================= */
  async viewStory(viewerId: string, storyId: string) {
    if (!Types.ObjectId.isValid(viewerId)) throw new Error("Invalid user id");
    if (!Types.ObjectId.isValid(storyId)) throw new Error("Invalid story id");

    const now = new Date();
    const viewerOid = new Types.ObjectId(viewerId);
    const storyOid = new Types.ObjectId(storyId);

    const owner = await User.findOne(
      {
        "stories._id": storyOid,
        "stories.expiresAt": { $gt: now },
        "stories.isArchived": { $ne: true },
      },
      { "stories.$": 1 }
    ).select("_id blockedUsers");

    if (!owner) throw new Error("Story not found or expired");

    const ownerId = String(owner._id);
    const st: any = (owner as any).stories?.[0];
    const privacy: StoryPrivacy = (st?.privacy || "public") as StoryPrivacy;

    if ((owner as any).blockedUsers?.some((x: any) => String(x) === String(viewerId))) {
      throw new Error("You are blocked");
    }

    if (ownerId !== String(viewerId)) {
      const friendIds = await friendService.getFriendIds(viewerId);
      const isFriend = friendIds.includes(ownerId);

      if (!isFriend) throw new Error("Not allowed (friends only)");
      if (privacy === "private") throw new Error("Not allowed");
    } else {
      return { success: true, viewedNow: false };
    }

    const res = await User.updateOne(
      {
        _id: owner._id,
        "stories._id": storyOid,
        "stories.viewers": { $ne: viewerOid },
      },
      {
        $addToSet: { "stories.$.viewers": viewerOid },
        $inc: { "stories.$.viewsCount": 1 },
      }
    );

    const viewedNow = res.modifiedCount === 1;
    return { success: true, viewedNow };
  }

  /** =========================================
   *  CREATE: إنشاء Story
   *  - ✅ updateOne + طباعة matched/modified
   *  - ✅ قراءة القصة بالـ _id بدون Path collision
   *  ========================================= */
  async createStory(
    userId: string,
    payload: {
      type: StoryType;
      text?: string;
      mediaUrl?: string;
      thumbUrl?: string;
      durationMs?: number;
      privacy?: StoryPrivacy;
    }
  ) {
    try {
      console.log("======================================");
      console.log("[createStory] START");
      console.log("[createStory] DB:", mongoose.connection.name);
      console.log("[createStory] User collection:", User.collection.name);
      console.log("[createStory] userId:", userId);
      console.log("[createStory] payload:", {
        type: payload.type,
        textLength: payload.text?.length || 0,
        hasMedia: !!payload.mediaUrl,
        privacy: payload.privacy,
        durationMs: payload.durationMs,
      });

      if (!Types.ObjectId.isValid(userId)) {
        console.log("[createStory] ❌ Invalid user id");
        throw new Error("Invalid user id");
      }

      console.log("[createStory] has schema path stories?", !!User.schema.path("stories"));
      console.log("[createStory] stories instance:", (User.schema.path("stories") as any)?.instance);

      const now = new Date();

      const before = await User.findById(userId).select("_id stories").lean();
      console.log("[createStory] BEFORE save stories count:", (before as any)?.stories?.length || 0);

      const activeCount = ((before as any)?.stories || []).filter((st: any) => {
        const exp = st?.expiresAt ? new Date(st.expiresAt) : null;
        if (!exp) return false;
        if (exp <= now) return false;
        if (st?.isArchived) return false;
        return true;
      }).length;

      console.log("[createStory] Active stories count:", activeCount);

      if (activeCount >= 2) {
        console.log("[createStory] ❌ User exceeded active stories limit");
        throw new Error("You can only have 2 active stories");
      }

      const type = payload.type;
      const privacy: StoryPrivacy = (payload.privacy ?? "public") as StoryPrivacy;

      console.log("[createStory] Validating type & privacy...");

      if (!["image", "video", "text"].includes(type)) {
        console.log("[createStory] ❌ Invalid story type:", type);
        throw new Error("Invalid story type");
      }
      if (!["public", "followers", "private"].includes(privacy)) {
        console.log("[createStory] ❌ Invalid privacy:", privacy);
        throw new Error("Invalid privacy");
      }

      const text = typeof payload.text === "string" ? payload.text.trim().slice(0, 4000) : "";
      const mediaUrl = typeof payload.mediaUrl === "string" ? payload.mediaUrl.trim() : "";
      const thumbUrl = typeof payload.thumbUrl === "string" ? payload.thumbUrl.trim() : "";

      if (type === "text") {
        if (!text) {
          console.log("[createStory] ❌ Text story missing text");
          throw new Error("Text story requires text");
        }
      } else {
        if (!mediaUrl) {
          console.log(`[createStory] ❌ ${type} story missing mediaUrl`);
          throw new Error(`${type} story requires mediaUrl`);
        }
      }

      const durationMsRaw = Number(payload.durationMs ?? 6000);
      const durationMs = Math.min(60000, Math.max(1000, isNaN(durationMsRaw) ? 6000 : durationMsRaw));
      console.log("[createStory] durationMs (final):", durationMs);

      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

      const storyId = new Types.ObjectId();

      const storyDoc: any = {
        _id: storyId,
        type,
        text,
        mediaUrl,
        thumbUrl,
        durationMs,
        privacy,
        isArchived: false,
        viewsCount: 0,
        viewers: [],
        createdAt,
        expiresAt,
      };

      console.log("[createStory] storyDoc._id:", storyId.toString());
      console.log("[createStory] expiresAt:", expiresAt.toISOString(), "isDate:", expiresAt instanceof Date);
      console.log("[createStory] Pushing story to user document...");

     const writeRes = await User.updateOne(
  { _id: new Types.ObjectId(userId) },
  { $push: { stories: { $each: [storyDoc], $position: 0 } } },
  { strict: false } // ✅ مؤقتًا للتشخيص/الإنقاذ
);
      console.log("[createStory] writeRes:", {
        acknowledged: (writeRes as any).acknowledged,
        matchedCount: (writeRes as any).matchedCount,
        modifiedCount: (writeRes as any).modifiedCount,
      });

      if ((writeRes as any).matchedCount === 0) {
        console.log("[createStory] ❌ matchedCount=0 => user not found on update");
        throw new Error("User not found");
      }

      // ✅ قراءة مؤكدة بدون Path collision:
      // IMPORTANT: لا تستخدم select("stories") مع "stories.$" في projection
      const afterPick = await User.findOne(
        { _id: new Types.ObjectId(userId), "stories._id": storyId },
        { _id: 1, "stories.$": 1 } // ✅ projection هنا بالكامل
      ).lean();

      const picked = (afterPick as any)?.stories?.[0];

      console.log("[createStory] AFTER (picked by id) exists?", !!picked);
      console.log("[createStory] AFTER (picked) _id:", picked?._id?.toString?.());
      console.log("[createStory] AFTER (picked) type/privacy:", picked?.type, picked?.privacy);

      const after = await User.findById(userId).select("_id stories").lean();
      console.log("[createStory] AFTER (re-read) stories count:", (after as any)?.stories?.length || 0);

      console.log("[createStory] ✅ Story created successfully");
      console.log("======================================");

      return picked || storyDoc;
    } catch (err: any) {
      console.log("======================================");
      console.error("[createStory] ERROR:", err?.message || err);
      console.log("======================================");
      throw err;
    }
  }

  /** =========================================
   *  DELETE: حذف Story (صاحبها فقط)
   *  ========================================= */
  async deleteStory(userId: string, storyId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user id");
    if (!Types.ObjectId.isValid(storyId)) throw new Error("Invalid story id");

    const storyOid = new Types.ObjectId(storyId);

    const res = await User.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $pull: { stories: { _id: storyOid } } }
    );

    if (res.modifiedCount === 0) throw new Error("Story not found");
    return { success: true };
  }

  /** =========================================
   *  GET VIEWERS: من شاهد الحالة (لصاحبها فقط)
   *  ========================================= */
  async getStoryViewers(ownerId: string, storyId: string, page = 1, limit = 50) {
    if (!Types.ObjectId.isValid(ownerId)) throw new Error("Invalid user id");
    if (!Types.ObjectId.isValid(storyId)) throw new Error("Invalid story id");

    const ownerOid = new Types.ObjectId(ownerId);
    const storyOid = new Types.ObjectId(storyId);

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (safePage - 1) * safeLimit;

    const owner = await User.findOne(
      { _id: ownerOid, "stories._id": storyOid },
      { "stories.$": 1 }
    ).select("_id");

    if (!owner) throw new Error("Story not found");

    const st: any = (owner as any).stories?.[0];
    const viewersIds: Types.ObjectId[] = Array.isArray(st?.viewers) ? st.viewers : [];
    const total = viewersIds.length;

    const pageIds = viewersIds.slice(skip, skip + safeLimit);
    if (!pageIds.length) {
      return { page: safePage, limit: safeLimit, total, count: 0, viewers: [] };
    }

    const users = await User.find({ _id: { $in: pageIds } })
      .select("_id username atUsername avatar isOnline lastSeen verificationType")
      .lean();

    const map = new Map<string, any>();
    users.forEach((u: any) => map.set(String(u._id), u));
    const ordered = pageIds.map((id) => map.get(String(id))).filter(Boolean);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      count: ordered.length,
      viewers: ordered,
    };
  }
}

export default new StoryService();