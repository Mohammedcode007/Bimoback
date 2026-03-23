// // routes/story.routes.ts
// import { Router } from "express";
// import storyController from "../controllers/story.controller";
// import { protect } from "../middlewares/auth.middleware";

// const router = Router();

// /** =========================
//  *  My Stories (Active)
//  *  GET /stories/me
//  *  ========================= */
// router.get("/me", protect, storyController.getMyStories);

// /** =========================
//  *  Feed (Friends Only) + My stories included
//  *  GET /stories/feed?page=1&limit=30
//  *  ========================= */
// router.get("/feed", protect, storyController.getFriendsStoriesFeed);

// /** =========================
//  *  View Story (register view, no duplicates)
//  *  POST /stories/:storyId/view
//  *  ========================= */
// router.post("/:storyId/view", protect, storyController.viewStory);

// /** =========================
//  *  Viewers (Owner only)
//  *  GET /stories/:storyId/viewers?page=1&limit=50
//  *  ========================= */
// router.get("/:storyId/viewers", protect, storyController.getStoryViewers);

// /** =========================
//  *  Create Story
//  *  POST /stories
//  *  body: { type, text?, mediaUrl?, privacy?, durationMs?, thumbUrl? }
//  *  - Max 2 active stories per user (enforced in service)
//  *  ========================= */
// router.post("/", protect, storyController.createStory);

// /** =========================
//  *  Delete Story (Owner only)
//  *  DELETE /stories/:storyId
//  *  ========================= */
// router.delete("/:storyId", protect, storyController.deleteStory);

// export default router;
// routes/story.routes.ts
import { Router } from "express";
import storyController from "../controllers/story.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

/** =========================
 *  My Stories (Active)
 *  GET /stories/me
 *  - يرجّع حالاتي الفعالة فقط
 *  - مع preview جاهز:
 *    - video => previewImage من thumbUrl
 *    - image => previewImage من mediaUrl
 *    - text  => previewText
 *  ========================= */
router.get("/me", protect, storyController.getMyStories);

/** =========================
 *  Feed (Friends Only) + My stories included
 *  GET /stories/feed?page=1&limit=30
 *  - يرجّع Feed الأصدقاء + حالتي
 *  - مع latestPreview و preview جاهز لكل حالة
 *  ========================= */
router.get("/feed", protect, storyController.getFriendsStoriesFeed);

/** =========================
 *  View Story (register view, no duplicates)
 *  POST /stories/:storyId/view
 *  - تسجيل مشاهدة بدون تكرار
 *  ========================= */
router.post("/:storyId/view", protect, storyController.viewStory);

/** =========================
 *  Viewers (Owner only)
 *  GET /stories/:storyId/viewers?page=1&limit=50
 *  - جلب من شاهد الحالة
 *  ========================= */
router.get("/:storyId/viewers", protect, storyController.getStoryViewers);

/** =========================
 *  Create Story
 *  POST /stories
 *  body: { type, text?, mediaUrl?, privacy?, durationMs?, thumbUrl? }
 *  - Max 2 active stories per user (enforced in service)
 *  - video يحتاج mediaUrl ويفضّل معه thumbUrl للمعاينة
 *  - image يحتاج mediaUrl
 *  - text يحتاج text
 *  ========================= */
router.post("/", protect, storyController.createStory);

/** =========================
 *  Delete Story (Owner only)
 *  DELETE /stories/:storyId
 *  ========================= */
router.delete("/:storyId", protect, storyController.deleteStory);

export default router;