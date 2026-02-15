import { Request, Response } from "express";
import tweetService from "../services/tweet.service";

interface TweetParams {
  id: string;
}

/* ======================================================
   CREATE TWEET
====================================================== */

export const createTweet = async (req: Request, res: Response) => {
  try {
    console.log("📝 CREATE TWEET");
    console.log("User:", req.user?.id);
    console.log("Body:", req.body);

    const tweet = await tweetService.create(req.user!.id, req.body);

    console.log("✅ Tweet created:", tweet._id);

    res.json(tweet);
  } catch (error: any) {
    console.error("❌ CREATE TWEET ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   LIKE
====================================================== */

export const likeTweet = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {
    console.log("❤️ LIKE TWEET");
    console.log("User:", req.user?.id);
    console.log("Tweet:", req.params.id);

    const result = await tweetService.toggleLike(
      req.user!.id,
      req.params.id
    );

    console.log("✅ Like result:", result);

    res.json(result);
  } catch (error: any) {
    console.error("❌ LIKE ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   RETWEET
====================================================== */

export const retweet = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {
    console.log("🔁 RETWEET");
    console.log("User:", req.user?.id);
    console.log("Tweet:", req.params.id);

    const result = await tweetService.toggleRetweet(
      req.user!.id,
      req.params.id
    );

    console.log("✅ Retweet result:", result);

    res.json(result);
  } catch (error: any) {
    console.error("❌ RETWEET ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   COMMENT
====================================================== */

export const comment = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {
    console.log("💬 COMMENT");
    console.log("User:", req.user?.id);
    console.log("Tweet:", req.params.id);
    console.log("Content:", req.body.content);

    const result = await tweetService.comment(
      req.user!.id,
      req.params.id,
      req.body.content
    );

    console.log("✅ Comment created:", result._id);

    res.json(result);
  } catch (error: any) {
    console.error("❌ COMMENT ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   BOOKMARK
====================================================== */

export const bookmark = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {
    console.log("🔖 BOOKMARK");
    console.log("User:", req.user?.id);
    console.log("Tweet:", req.params.id);

    const result = await tweetService.toggleBookmark(
      req.user!.id,
      req.params.id
    );

    console.log("✅ Bookmark result:", result);

    res.json(result);
  } catch (error: any) {
    console.error("❌ BOOKMARK ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   HOME FEED
====================================================== */

/* ======================================================
   FOR YOU FEED
====================================================== */

export const getForYouFeed = async (
  req: Request,
  res: Response
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    console.log("🌍 FOR YOU FEED");
    console.log("User:", req.user?.id);
    console.log("Page:", page);
    console.log("Limit:", limit);

    const tweets = await tweetService.getForYouFeed(
      req.user!.id,
      page,
      limit
    );

    console.log("✅ ForYou Tweets returned:", tweets.length);

    res.json(tweets);
  } catch (error: any) {
    console.error("❌ FOR YOU FEED ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};


/* ======================================================
   FOLLOWING FEED
====================================================== */

export const getFollowingFeed = async (
  req: Request,
  res: Response
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    console.log("👥 FOLLOWING FEED");
    console.log("User:", req.user?.id);
    console.log("Page:", page);
    console.log("Limit:", limit);

    const tweets = await tweetService.getFollowingFeed(
      req.user!.id,
      page,
      limit
    );

    console.log("✅ Following Tweets returned:", tweets.length);

    res.json(tweets);
  } catch (error: any) {
    console.error("❌ FOLLOWING FEED ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};


/* ======================================================
   GET SINGLE TWEET
====================================================== */

export const getTweetById = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {

    const tweet = await tweetService.getById(
      req.user!.id,
      req.params.id
    );

    res.json(tweet);

  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};


/* ======================================================
   DELETE TWEET (Soft Delete)
====================================================== */

export const deleteTweet = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {
    console.log("🗑 DELETE TWEET");
    console.log("User:", req.user?.id);
    console.log("Tweet:", req.params.id);

    await tweetService.deleteTweet(
      req.user!.id,
      req.params.id
    );

    console.log("✅ Tweet deleted (soft)");

    res.json({ success: true });
  } catch (error: any) {
    console.error("❌ DELETE ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   GET TWEET COMMENTS
====================================================== */

export const getTweetComments = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    console.log("💬 GET COMMENTS");
    console.log("Tweet:", req.params.id);
    console.log("Page:", page);
    console.log("Limit:", limit);

    const comments = await tweetService.getTweetComments(
      req.params.id,
      page,
      limit
    );

    console.log("✅ Comments returned:", comments.length);

    res.json(comments);
  } catch (error: any) {
    console.error("❌ GET COMMENTS ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};
