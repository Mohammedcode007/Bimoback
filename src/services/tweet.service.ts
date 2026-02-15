import mongoose from "mongoose";
import Tweet from "../models/Tweet";
import Like from "../models/Like";
import Retweet from "../models/Retweet";
import Comment from "../models/Comment";
import Bookmark from "../models/Bookmark";
import Follow from "../models/Follow";
import User from "../models/User";
import notificationService from "./notification.service";
import { extractHashtags, extractMentions } from "../utils/mention.util";

class TweetService {
private extractPublicId(url: string): string | null {

  try {
    const parts = url.split("/");
    const file = parts[parts.length - 1];
    return file.split(".")[0];
  } catch {
    return null;
  }
}

  /* ======================================================
     CREATE TWEET
  ====================================================== */

  // async create(userId: string, data: any) {

  //   if (!data.content && !data.media?.length) {
  //     throw new Error("Tweet must contain text or media");
  //   }

  //   const content = data.content?.trim() || "";

  //   const mentionedUsernames = extractMentions(content);
  //   const hashtags = extractHashtags(content);

  //   const mentionedUsers = await User.find({
  //     atUsername: { $in: mentionedUsernames }
  //   }).select("_id");

  //   const tweet = await Tweet.create({
  //     author: userId,
  //     content,
  //     media: data.media || [],
  //     hashtags,
  //     mentions: mentionedUsers.map(u => u._id),
  //     parentTweet: data.parentTweet,
  //     quoteTweet: data.quoteTweet,
  //     poll: data.poll
  //   });

  //   for (const user of mentionedUsers) {
  //     if (user._id.toString() !== userId) {
  //       await notificationService.create({
  //         recipient: user._id,
  //         sender: userId,
  //         type: "mention",
  //         relatedTweet: tweet._id,
  //         body: "قام بذكرك في تويتة"
  //       });
  //     }
  //   }

  //   return tweet;
  // }

  async create(userId: string, data: any) {

  if (!data.content && !data.media?.length) {
    throw new Error("Tweet must contain text or media");
  }

  const content = data.content?.trim() || "";

  /* ================= FORMAT MEDIA ================= */

  const formattedMedia = (data.media || []).map((url: string) => {

    const isVideo = url.includes("/video/");

    return {
      url,
      type: isVideo ? "video" : "image",
      publicId: this.extractPublicId(url)
    };
  });

  /* ================= EXTRACT TAGS ================= */

  const mentionedUsernames = extractMentions(content);
  const hashtags = extractHashtags(content);

  const mentionedUsers = await User.find({
    atUsername: { $in: mentionedUsernames }
  }).select("_id");

  /* ================= CREATE ================= */

  const tweet = await Tweet.create({
    author: userId,
    content,
    media: formattedMedia,
    hashtags,
    mentions: mentionedUsers.map(u => u._id),
    parentTweet: data.parentTweet,
    quoteTweet: data.quoteTweet,
    poll: data.poll
  });

  /* ================= NOTIFICATIONS ================= */

  for (const user of mentionedUsers) {
    if (user._id.toString() !== userId) {
      await notificationService.create({
        recipient: user._id,
        sender: userId,
        type: "mention",
        relatedTweet: tweet._id,
        body: "قام بذكرك في تويتة"
      });
    }
  }

  return tweet;
}

  /* ======================================================
     TOGGLE LIKE
  ====================================================== */

  async toggleLike(userId: string, tweetId: string) {

    const tweet = await Tweet.findOne({
      _id: tweetId,
      deleted: false
    });

    if (!tweet) throw new Error("Tweet not found");

    const existing = await Like.findOne({
      user: userId,
      tweet: tweetId
    });

    if (existing) {
      await existing.deleteOne();
      await Tweet.updateOne(
        { _id: tweetId, likesCount: { $gt: 0 } },
        { $inc: { likesCount: -1 } }
      );
      return { liked: false };
    }

    await Like.create({ user: userId, tweet: tweetId });

    await Tweet.updateOne(
      { _id: tweetId },
      { $inc: { likesCount: 1 } }
    );

    if (tweet.author.toString() !== userId) {
      await notificationService.create({
        recipient: tweet.author,
        sender: userId,
        type: "tweet_like",
        relatedTweet: tweetId,
        body: "أعجب بتويتتك"
      });
    }

    return { liked: true };
  }

  /* ======================================================
     TOGGLE RETWEET
  ====================================================== */

  async toggleRetweet(userId: string, tweetId: string) {

    const tweet = await Tweet.findOne({
      _id: tweetId,
      deleted: false
    });

    if (!tweet) throw new Error("Tweet not found");

    const existing = await Retweet.findOne({
      user: userId,
      tweet: tweetId
    });

    if (existing) {
      await existing.deleteOne();
      await Tweet.updateOne(
        { _id: tweetId, retweetsCount: { $gt: 0 } },
        { $inc: { retweetsCount: -1 } }
      );
      return { retweeted: false };
    }

    await Retweet.create({ user: userId, tweet: tweetId });

    await Tweet.updateOne(
      { _id: tweetId },
      { $inc: { retweetsCount: 1 } }
    );

    if (tweet.author.toString() !== userId) {
      await notificationService.create({
        recipient: tweet.author,
        sender: userId,
        type: "tweet_retweet",
        relatedTweet: tweetId,
        body: "قام بإعادة نشر تويتتك"
      });
    }

    return { retweeted: true };
  }

  /* ======================================================
     COMMENT
  ====================================================== */

  async comment(userId: string, tweetId: string, content: string) {

    const tweet = await Tweet.findOne({
      _id: tweetId,
      deleted: false
    });

    if (!tweet) throw new Error("Tweet not found");

    const cleanContent = content.trim();

    const mentionedUsernames = extractMentions(cleanContent);

    const mentionedUsers = await User.find({
      atUsername: { $in: mentionedUsernames }
    }).select("_id");

    const comment = await Comment.create({
      tweet: tweetId,
      user: userId,
      content: cleanContent
    });

    await Tweet.updateOne(
      { _id: tweetId },
      { $inc: { repliesCount: 1 } }
    );

    if (tweet.author.toString() !== userId) {
      await notificationService.create({
        recipient: tweet.author,
        sender: userId,
        type: "tweet_reply",
        relatedTweet: tweetId,
        body: "قام بالرد على تويتتك"
      });
    }

    for (const user of mentionedUsers) {
      if (user._id.toString() !== userId) {
        await notificationService.create({
          recipient: user._id,
          sender: userId,
          type: "mention",
          relatedTweet: tweetId,
          body: "قام بذكرك في تعليق"
        });
      }
    }

    return comment;
  }

  /* ======================================================
     TOGGLE BOOKMARK
  ====================================================== */

  async toggleBookmark(userId: string, tweetId: string) {

    const tweet = await Tweet.findOne({
      _id: tweetId,
      deleted: false
    });

    if (!tweet) throw new Error("Tweet not found");

    const existing = await Bookmark.findOne({
      user: userId,
      tweet: tweetId
    });

    if (existing) {
      await existing.deleteOne();
      return { bookmarked: false };
    }

    await Bookmark.create({ user: userId, tweet: tweetId });
    return { bookmarked: true };
  }

  /* ======================================================
     DELETE TWEET (Soft Delete)
  ====================================================== */

  async deleteTweet(userId: string, tweetId: string) {

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) throw new Error("Tweet not found");

    if (tweet.author.toString() !== userId) {
      throw new Error("Unauthorized");
    }

    tweet.deleted = true;
    await tweet.save();
  }

  /* ======================================================
     GET TWEET COMMENTS
  ====================================================== */

  async getTweetComments(tweetId: string, page = 1, limit = 10) {

    const skip = (page - 1) * limit;

    return Comment.find({ tweet: tweetId })
      .populate("user", "username atUsername avatar isVerified")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  /* ======================================================
     HOME FEED
  ====================================================== */
/* ======================================================
   SHARED FEED PIPELINE
====================================================== */

private async buildFeedPipeline(
  authorIds: mongoose.Types.ObjectId[] | null,
  userObjectId: mongoose.Types.ObjectId,
  skip: number,
  limit: number
) {

  /* ===== Get Current User Block List ===== */

  const currentUser = await User.findById(userObjectId)
    .select("blockedUsers");

  const blockedIds = currentUser?.blockedUsers || [];

  /* ===== Base Match ===== */

  const matchStage: any = {
    deleted: false,
    author: { $nin: blockedIds } // استبعاد المحظورين
  };

  /* ===== Following Feed Filter ===== */

  if (authorIds && authorIds.length > 0) {
    matchStage.author = {
      $in: authorIds,
      $nin: blockedIds
    };
  }

  if (authorIds && authorIds.length === 0) {
    return [];
  }

  /* ================= AGGREGATION ================= */

  const tweets = await Tweet.aggregate([

    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },

    /* ===== Author Data ===== */

    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        pipeline: [
          {
            $project: {
              username: 1,
              atUsername: 1,
              avatar: 1,
              isVerified: 1
            }
          }
        ]
      }
    },

    { $unwind: "$author" },

    /* ===== Prevent Showing If Author Blocked You ===== */

    {
      $lookup: {
        from: "users",
        let: { authorId: "$author._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$authorId"] },
                  { $in: [userObjectId, "$blockedUsers"] }
                ]
              }
            }
          }
        ],
        as: "blockedByAuthor"
      }
    },

    {
      $match: {
        blockedByAuthor: { $size: 0 }
      }
    },

    /* ===== Check Follow Status ===== */

    {
      $lookup: {
        from: "follows",
        let: { authorId: "$author._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$follower", userObjectId] },
                  { $eq: ["$following", "$$authorId"] }
                ]
              }
            }
          }
        ],
        as: "followRelation"
      }
    },

    {
      $addFields: {
        "author.isFollowing": {
          $gt: [{ $size: "$followRelation" }, 0]
        }
      }
    },

    /* ===== Like Check ===== */

    {
      $lookup: {
        from: "likes",
        let: { tweetId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$tweet", "$$tweetId"] },
                  { $eq: ["$user", userObjectId] }
                ]
              }
            }
          }
        ],
        as: "liked"
      }
    },

    {
      $addFields: {
        isLiked: { $gt: [{ $size: "$liked" }, 0] }
      }
    },

    /* ===== Cleanup ===== */

    {
      $project: {
        followRelation: 0,
        liked: 0,
        blockedByAuthor: 0
      }
    }

  ]);

  return tweets;
}




/* ======================================================
   FOLLOWING FEED
====================================================== */

async getFollowingFeed(userId: string, page: number = 1, limit: number = 10) {

  try {

    const skip = (page - 1) * limit;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const following = await Follow.find({
      follower: userObjectId
    }).select("following");

    const followingIds = following.map(f => f.following);

    // إضافة نفسي
    followingIds.push(userObjectId);

    const tweets = await this.buildFeedPipeline(
      followingIds,
      userObjectId,
      skip,
      limit
    );

    return tweets;

  } catch (error: any) {
    console.error("❌ getFollowingFeed ERROR:", error.message);
    throw new Error("Failed to load following feed");
  }
}
/* ======================================================
   FOR YOU FEED
====================================================== */

async getForYouFeed(userId: string, page: number = 1, limit: number = 10) {

  try {

    const skip = (page - 1) * limit;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const tweets = await this.buildFeedPipeline(
      null, // null = كل التويتات
      userObjectId,
      skip,
      limit
    );

    return tweets;

  } catch (error: any) {
    console.error("❌ getForYouFeed ERROR:", error.message);
    throw new Error("Failed to load for you feed");
  }
}


  /* ======================================================
     GET TWEET BY ID
  ====================================================== */

  async getById(userId: string, tweetId: string) {

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const tweetObjectId = new mongoose.Types.ObjectId(tweetId);

  const tweet = await Tweet.aggregate([

    {
      $match: {
        _id: tweetObjectId,
        deleted: false
      }
    },

    /* ===== Author ===== */

    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
        pipeline: [
          {
            $project: {
              username: 1,
              atUsername: 1,
              avatar: 1,
              isVerified: 1
            }
          }
        ]
      }
    },

    { $unwind: "$author" },

    /* ===== Follow Check ===== */

    {
      $lookup: {
        from: "follows",
        let: { authorId: "$author._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$follower", userObjectId] },
                  { $eq: ["$following", "$$authorId"] }
                ]
              }
            }
          }
        ],
        as: "followRelation"
      }
    },

    {
      $addFields: {
        "author.isFollowing": {
          $gt: [{ $size: "$followRelation" }, 0]
        }
      }
    },

    /* ===== Like Check ===== */

    {
      $lookup: {
        from: "likes",
        let: { tweetId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$tweet", "$$tweetId"] },
                  { $eq: ["$user", userObjectId] }
                ]
              }
            }
          }
        ],
        as: "liked"
      }
    },

    {
      $addFields: {
        isLiked: { $gt: [{ $size: "$liked" }, 0] }
      }
    },

    /* ===== Retweet Check ===== */

    {
      $lookup: {
        from: "retweets",
        let: { tweetId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$tweet", "$$tweetId"] },
                  { $eq: ["$user", userObjectId] }
                ]
              }
            }
          }
        ],
        as: "retweeted"
      }
    },

    {
      $addFields: {
        isRetweeted: { $gt: [{ $size: "$retweeted" }, 0] }
      }
    },

    /* ===== Bookmark Check ===== */

    {
      $lookup: {
        from: "bookmarks",
        let: { tweetId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$tweet", "$$tweetId"] },
                  { $eq: ["$user", userObjectId] }
                ]
              }
            }
          }
        ],
        as: "bookmarked"
      }
    },

    {
      $addFields: {
        isBookmarked: { $gt: [{ $size: "$bookmarked" }, 0] }
      }
    },

    {
      $project: {
        followRelation: 0,
        liked: 0,
        retweeted: 0,
        bookmarked: 0
      }
    }

  ]);

  if (!tweet.length) throw new Error("Tweet not found");

  return tweet[0];
}

}

export default new TweetService();
