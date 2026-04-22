// import { Router } from "express";
// import * as controller from "../controllers/tweet.controller";
// import { protect } from "../middlewares/auth.middleware";

// const router = Router();

// router.use(protect);

// /* ======================
//    CREATE
// ====================== */

// router.post("/", controller.createTweet);

// /* ======================
//    FEEDS
// ====================== */

// // 👥 Following Feed
// router.get("/feed/following", controller.getFollowingFeed);

// // 🌍 For You Feed
// router.get("/feed/foryou", controller.getForYouFeed);

// /* ======================
//    GET SINGLE TWEET
// ====================== */

// router.get("/:id", controller.getTweetById);

// /* ======================
//    INTERACTIONS
// ====================== */

// router.post("/:id/like", controller.likeTweet);
// router.post("/:id/retweet", controller.retweet);
// router.post("/:id/comment", controller.comment);
// router.post("/:id/bookmark", controller.bookmark);
// // ❤️ لايك كومنت
// router.post("/comments/:commentId/like", controller.likeComment);

// // 💬 الرد على كومنت
// router.post("/comments/:commentId/reply", controller.replyToComment);

// // 📥 جلب الردود على كومنت
// router.get("/comments/:commentId/replies", controller.getCommentReplies);
// /* ======================
//    DELETE (Soft Delete)
// ====================== */

// router.delete("/:id", controller.deleteTweet);

// /* ======================
//    GET COMMENTS
// ====================== */

// router.get("/:id/comments", controller.getTweetComments);

// export default router;

import { Router } from "express";
import * as controller from "../controllers/tweet.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.use(protect);

/* ======================
   CREATE
====================== */

router.post("/", controller.createTweet);

/* ======================
   FEEDS
====================== */

// 👥 Following Feed
router.get("/feed/following", controller.getFollowingFeed);

// 🌍 For You Feed
router.get("/feed/foryou", controller.getForYouFeed);

/* ======================
   GET SINGLE TWEET
====================== */

router.get("/:id", controller.getTweetById);

/* ======================
   INTERACTIONS
====================== */

router.post("/:id/like", controller.likeTweet);
router.post("/:id/retweet", controller.retweet);
router.post("/:id/comment", controller.comment);
router.post("/:id/bookmark", controller.bookmark);

/* ======================
   COMMENTS SYSTEM (NEW 🔥)
====================== */

// ❤️ لايك كومنت
router.post("/comments/:commentId/like", controller.likeComment);

// 💬 الرد على كومنت
router.post("/comments/:commentId/reply", controller.replyToComment);

// 📥 جلب الردود على كومنت
router.get("/comments/:commentId/replies", controller.getCommentReplies);
router.get("/:id/likes", controller.getTweetLikesUsers);
router.get("/comments/:commentId/likes", controller.getCommentLikesUsers);
// 👤 User Profile Tweets
router.get("/user/:userId", controller.getUserTweets);
/* ======================
   DELETE (Soft Delete)
====================== */

router.delete("/:id", controller.deleteTweet);

/* ======================
   GET COMMENTS
====================== */

router.get("/:id/comments", controller.getTweetComments);

export default router;