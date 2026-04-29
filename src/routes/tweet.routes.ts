
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

// /* ======================
//    COMMENTS SYSTEM (NEW 🔥)
// ====================== */

// // ❤️ لايك كومنت
// router.post("/comments/:commentId/like", controller.likeComment);

// // 💬 الرد على كومنت
// router.post("/comments/:commentId/reply", controller.replyToComment);

// // 📥 جلب الردود على كومنت
// router.get("/comments/:commentId/replies", controller.getCommentReplies);
// router.get("/:id/likes", controller.getTweetLikesUsers);
// router.get("/comments/:commentId/likes", controller.getCommentLikesUsers);
// // 👤 User Profile Tweets
// router.get("/user/:userId", controller.getUserTweets);
// /* ======================
//    DELETE (Soft Delete)
// ====================== */

// router.delete("/:id", controller.deleteTweet);

// /* ======================
//    GET COMMENTS
// ====================== */

// router.get("/:id/comments", controller.getTweetComments);

// export default router;

import { Router, RequestHandler } from "express";
import * as controller from "../controllers/tweet.controller";
import { protect } from "../middlewares/auth.middleware";
import { blockGuard } from "../middlewares/blockGuard";

const router = Router();

const asHandler = (handler: any) => handler as RequestHandler;

router.use(protect as RequestHandler);

// ✅ حظر التطبيق كله
router.use(blockGuard("app"));

/* ======================
   CREATE
====================== */

router.post(
  "/",
  blockGuard("tweets"),
  asHandler(controller.createTweet)
);

/* ======================
   FEEDS
====================== */

router.get(
  "/feed/following",
  asHandler(controller.getFollowingFeed)
);

router.get(
  "/feed/foryou",
  asHandler(controller.getForYouFeed)
);

/* ======================
   COMMENTS SYSTEM (NEW 🔥)
   مهم: ضع routes الخاصة بالكومنت قبل /:id
====================== */

router.post(
  "/comments/:commentId/like",
  blockGuard("tweets"),
  asHandler(controller.likeComment)
);

router.post(
  "/comments/:commentId/reply",
  blockGuard("tweets"),
  asHandler(controller.replyToComment)
);

router.get(
  "/comments/:commentId/replies",
  asHandler(controller.getCommentReplies)
);

router.get(
  "/comments/:commentId/likes",
  asHandler(controller.getCommentLikesUsers)
);

/* ======================
   USER PROFILE TWEETS
   مهم: قبل /:id
====================== */

router.get(
  "/user/:userId",
  asHandler(controller.getUserTweets)
);

/* ======================
   GET SINGLE TWEET
====================== */

router.get(
  "/:id",
  asHandler(controller.getTweetById)
);

/* ======================
   INTERACTIONS
====================== */

router.post(
  "/:id/like",
  blockGuard("tweets"),
  asHandler(controller.likeTweet)
);

router.post(
  "/:id/retweet",
  blockGuard("tweets"),
  asHandler(controller.retweet)
);

router.post(
  "/:id/comment",
  blockGuard("tweets"),
  asHandler(controller.comment)
);

router.post(
  "/:id/bookmark",
  blockGuard("tweets"),
  asHandler(controller.bookmark)
);

router.get(
  "/:id/likes",
  asHandler(controller.getTweetLikesUsers)
);

/* ======================
   DELETE
====================== */

router.delete(
  "/:id",
  blockGuard("tweets"),
  asHandler(controller.deleteTweet)
);

/* ======================
   GET COMMENTS
====================== */

router.get(
  "/:id/comments",
  asHandler(controller.getTweetComments)
);

export default router;