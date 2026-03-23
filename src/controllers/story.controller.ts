// // controllers/story.controller.ts
// import { Response } from "express";
// import storyService from "../services/story.service";

// class StoryController {
//   /* =====================================================
//      GET FRIENDS STORIES FEED
//      - أصدقاء فقط (accepted)
//      - قصص غير منتهية
//      - Pagination
//      - ✅ مع حالتي أيضًا
//   ===================================================== */
//   async getFriendsStoriesFeed(req: any, res: Response) {
//     try {
//       const userId = req.user?.id;
//       if (!userId) {
//         return res.status(401).json({ success: false, message: "Unauthorized" });
//       }

//       const page = Math.max(1, Number(req.query.page || 1));
//       const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));

//       // ✅ رجّع Feed الأصدقاء + حالتي
//       const data = await storyService.getFriendsStoriesFeed(userId, page, limit);

//       return res.status(200).json({
//         success: true,
//         page,
//         limit,
//         count: data.length,
//         data,
//       });
//     } catch (err: any) {
//       return res.status(400).json({
//         success: false,
//         message: err.message || "Failed to load stories",
//       });
//     }
//   }

//   /* =====================================================
//      VIEW STORY
//      - تسجيل مشاهدة
//      - منع التكرار
//      - تحقق الصداقة
//   ===================================================== */
//   async viewStory(req: any, res: Response) {
//     try {
//       const userId = req.user?.id;
//       if (!userId) {
//         return res.status(401).json({ success: false, message: "Unauthorized" });
//       }

//       const { storyId } = req.params;
//       if (!storyId) {
//         return res.status(400).json({ success: false, message: "Story id is required" });
//       }

//       const result = await storyService.viewStory(userId, storyId);

//       return res.status(200).json({
//         success: true,
//         viewedNow: result.viewedNow,
//       });
//     } catch (err: any) {
//       console.error("[viewStory]", err);
//       return res.status(400).json({
//         success: false,
//         message: err.message || "Failed to view story",
//       });
//     }
//   }

//   /* =====================================================
//      CREATE STORY
//      - ✅ منع إضافة أكثر من حالتين نشطتين لكل مستخدم
//      - إذا حذف أي قصة يمكنه إضافة أخرى
//      - يدعم durationMs + thumbUrl
//   ===================================================== */
//   async createStory(req: any, res: Response) {
//     try {
//       const userId = req.user?.id;
//       if (!userId) {
//         return res.status(401).json({ success: false, message: "Unauthorized" });
//       }

//       const { type, text, mediaUrl, privacy, durationMs, thumbUrl } = req.body;

//       if (!["image", "video", "text"].includes(type)) {
//         return res.status(400).json({ success: false, message: "Invalid story type" });
//       }

//       if (privacy && !["public", "followers", "private"].includes(privacy)) {
//         return res.status(400).json({ success: false, message: "Invalid privacy" });
//       }

//       // ✅ service سيمنع تجاوز 2 قصص نشطة
//       const story = await storyService.createStory(userId, {
//         type,
//         text,
//         mediaUrl,
//         privacy,
//         durationMs,
//         thumbUrl,
//       });

//       return res.status(201).json({
//         success: true,
//         data: story,
//       });
//     } catch (err: any) {
//       console.error("[createStory]", err);
//       return res.status(400).json({
//         success: false,
//         message: err.message || "Failed to create story",
//       });
//     }
//   }

//   /* =====================================================
//      DELETE STORY
//      - صاحبها فقط
//   ===================================================== */
//   async deleteStory(req: any, res: Response) {
//     try {
//       const userId = req.user?.id;
//       if (!userId) {
//         return res.status(401).json({ success: false, message: "Unauthorized" });
//       }

//       const { storyId } = req.params;
//       if (!storyId) {
//         return res.status(400).json({ success: false, message: "Story id is required" });
//       }

//       await storyService.deleteStory(userId, storyId);

//       return res.status(200).json({
//         success: true,
//         message: "Story deleted",
//       });
//     } catch (err: any) {
//       console.error("[deleteStory]", err);
//       return res.status(400).json({
//         success: false,
//         message: err.message || "Failed to delete story",
//       });
//     }
//   }

//   /* =====================================================
//      GET STORY VIEWERS
//      - من شاهد الحالة (لصاحبها فقط)
//      - Pagination
//   ===================================================== */
//   async getStoryViewers(req: any, res: Response) {
//     try {
//       const userId = req.user?.id;
//       if (!userId) {
//         return res.status(401).json({ success: false, message: "Unauthorized" });
//       }

//       const { storyId } = req.params;
//       if (!storyId) {
//         return res.status(400).json({ success: false, message: "Story id is required" });
//       }

//       const page = Math.max(1, Number(req.query.page || 1));
//       const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

//       const data = await storyService.getStoryViewers(userId, storyId, page, limit);

//       return res.status(200).json({
//         success: true,
//         ...data,
//       });
//     } catch (err: any) {
//       console.error("[getStoryViewers]", err);
//       return res.status(400).json({
//         success: false,
//         message: err.message || "Failed to load viewers",
//       });
//     }
//   }

//   /* =====================================================
//      GET MY ACTIVE STORIES
//      - ✅ جلب حالتي (قصصي الفعالة)
//      - GET /stories/me
//   ===================================================== */
//   async getMyStories(req: any, res: Response) {
//     try {
//       const userId = req.user?.id;
//       if (!userId) {
//         return res.status(401).json({ success: false, message: "Unauthorized" });
//       }

//       const data = await storyService.getMyStories(userId);

//       return res.status(200).json({
//         success: true,
//         data,
//       });
//     } catch (err: any) {
//       console.error("[getMyStories]", err);
//       return res.status(400).json({
//         success: false,
//         message: err.message || "Failed to load my stories",
//       });
//     }
//   }
// }

// export default new StoryController();
// controllers/story.controller.ts
import { Response } from "express";
import storyService from "../services/story.service";

class StoryController {
  /* =====================================================
     GET FRIENDS STORIES FEED
     - أصدقاء فقط (accepted)
     - قصص غير منتهية
     - Pagination
     - ✅ مع حالتي أيضًا
     - ✅ مع preview جاهز من الـ service
  ===================================================== */
  async getFriendsStoriesFeed(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));

      const data = await storyService.getFriendsStoriesFeed(userId, page, limit);

      return res.status(200).json({
        success: true,
        page,
        limit,
        count: Array.isArray(data) ? data.length : 0,
        data,
      });
    } catch (err: any) {
      console.error("[getFriendsStoriesFeed]", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to load stories",
      });
    }
  }

  /* =====================================================
     VIEW STORY
     - تسجيل مشاهدة
     - منع التكرار
     - تحقق الصداقة
  ===================================================== */
  async viewStory(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { storyId } = req.params;
      if (!storyId) {
        return res.status(400).json({
          success: false,
          message: "Story id is required",
        });
      }

      const result = await storyService.viewStory(userId, storyId);

      return res.status(200).json({
        success: true,
        viewedNow: result.viewedNow,
      });
    } catch (err: any) {
      console.error("[viewStory]", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to view story",
      });
    }
  }

  /* =====================================================
     CREATE STORY
     - ✅ منع إضافة أكثر من حالتين نشطتين لكل مستخدم
     - إذا حذف أي قصة يمكنه إضافة أخرى
     - يدعم durationMs + thumbUrl
     - ✅ يرجّع preview جاهز
  ===================================================== */
  async createStory(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { type, text, mediaUrl, privacy, durationMs, thumbUrl } = req.body;

      if (!["image", "video", "text"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid story type",
        });
      }

      if (privacy && !["public", "followers", "private"].includes(privacy)) {
        return res.status(400).json({
          success: false,
          message: "Invalid privacy",
        });
      }

      const story = await storyService.createStory(userId, {
        type,
        text,
        mediaUrl,
        privacy,
        durationMs,
        thumbUrl,
      });

      return res.status(201).json({
        success: true,
        data: story,
      });
    } catch (err: any) {
      console.error("[createStory]", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to create story",
      });
    }
  }

  /* =====================================================
     DELETE STORY
     - صاحبها فقط
  ===================================================== */
  async deleteStory(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { storyId } = req.params;
      if (!storyId) {
        return res.status(400).json({
          success: false,
          message: "Story id is required",
        });
      }

      await storyService.deleteStory(userId, storyId);

      return res.status(200).json({
        success: true,
        message: "Story deleted",
      });
    } catch (err: any) {
      console.error("[deleteStory]", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to delete story",
      });
    }
  }

  /* =====================================================
     GET STORY VIEWERS
     - من شاهد الحالة (لصاحبها فقط)
     - Pagination
  ===================================================== */
  async getStoryViewers(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const { storyId } = req.params;
      if (!storyId) {
        return res.status(400).json({
          success: false,
          message: "Story id is required",
        });
      }

      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

      const data = await storyService.getStoryViewers(userId, storyId, page, limit);

      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (err: any) {
      console.error("[getStoryViewers]", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to load viewers",
      });
    }
  }

  /* =====================================================
     GET MY ACTIVE STORIES
     - ✅ جلب حالتي (قصصي الفعالة)
     - ✅ مع preview جاهز:
       - video => previewImage من thumbUrl
       - image => previewImage من mediaUrl
       - text  => previewText
     - GET /stories/me
  ===================================================== */
  async getMyStories(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await storyService.getMyStories(userId);

      return res.status(200).json({
        success: true,
        count: Array.isArray(data?.stories) ? data.stories.length : 0,
        data,
      });
    } catch (err: any) {
      console.error("[getMyStories]", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to load my stories",
      });
    }
  }
}

export default new StoryController();