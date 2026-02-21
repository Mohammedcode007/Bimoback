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
   

    const tweet = await tweetService.create(req.user!.id, req.body);


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
   

    const result = await tweetService.toggleLike(
      req.user!.id,
      req.params.id
    );


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
  

    const result = await tweetService.toggleRetweet(
      req.user!.id,
      req.params.id
    );


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
   
    const result = await tweetService.comment(
      req.user!.id,
      req.params.id,
      req.body.content
    );


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
   

    const result = await tweetService.toggleBookmark(
      req.user!.id,
      req.params.id
    );


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

  

    const tweets = await tweetService.getForYouFeed(
      req.user!.id,
      page,
      limit
    );


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

   

    const tweets = await tweetService.getFollowingFeed(
      req.user!.id,
      page,
      limit
    );


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
 

    await tweetService.deleteTweet(
      req.user!.id,
      req.params.id
    );


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


    const comments = await tweetService.getTweetComments(
      req.params.id,
      page,
      limit
    );


    res.json(comments);
  } catch (error: any) {
    console.error("❌ GET COMMENTS ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};
