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
   DELETE (Soft Delete)
====================== */

router.delete("/:id", controller.deleteTweet);

/* ======================
   GET COMMENTS
====================== */

router.get("/:id/comments", controller.getTweetComments);

export default router;
