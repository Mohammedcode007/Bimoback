import { Request, Response } from "express";
import tweetService from "../services/tweet.service";

interface TweetParams {
  id: string;
}

interface CommentParams {
  commentId: string;
}

interface CommentReplyParams {
  commentId: string;
}
interface UserTweetsParams {
  userId: string;
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
   GET TWEET LIKES USERS
====================================================== */
/* ======================================================
   GET USER TWEETS
====================================================== */

export const getUserTweets = async (
  req: Request<UserTweetsParams>,
  res: Response
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await tweetService.getUserTweets(
      req.user!.id,
      req.params.userId,
      page,
      limit
    );

    res.json(result);
  } catch (error: any) {
    console.error("❌ GET USER TWEETS ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};
export const getTweetLikesUsers = async (
  req: Request<TweetParams>,
  res: Response
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const users = await tweetService.getTweetLikesUsers(
      req.params.id,
      page,
      limit
    );

    res.json(users);
  } catch (error: any) {
    console.error("❌ GET TWEET LIKES USERS ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   GET COMMENT LIKES USERS
====================================================== */

export const getCommentLikesUsers = async (
  req: Request<CommentParams>,
  res: Response
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const users = await tweetService.getCommentLikesUsers(
      req.params.commentId,
      page,
      limit
    );

    res.json(users);
  } catch (error: any) {
    console.error("❌ GET COMMENT LIKES USERS ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   LIKE
====================================================== */
/* ======================================================
   TOGGLE COMMENT LIKE
====================================================== */

export const likeComment = async (
  req: Request<CommentParams>,
  res: Response
) => {
  try {
    const result = await tweetService.toggleCommentLike(
      req.user!.id,
      req.params.commentId
    );

    res.json(result);
  } catch (error: any) {
    console.error("❌ COMMENT LIKE ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================================
   REPLY TO COMMENT
====================================================== */

export const replyToComment = async (
  req: Request<CommentReplyParams>,
  res: Response
) => {
  try {
    const result = await tweetService.replyToComment(
      req.user!.id,
      req.params.commentId,
      req.body.content
    );

    res.json(result);
  } catch (error: any) {
    console.error("❌ REPLY TO COMMENT ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};
/* ======================================================
   GET COMMENT REPLIES
====================================================== */

export const getCommentReplies = async (
  req: Request<CommentParams>,
  res: Response
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const replies = await tweetService.getCommentReplies(
      req.params.commentId,
      page,
      limit,
      req.user!.id
    );

    res.json(replies);
  } catch (error: any) {
    console.error("❌ GET COMMENT REPLIES ERROR:", error.message);
    res.status(500).json({ message: error.message });
  }
};
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
