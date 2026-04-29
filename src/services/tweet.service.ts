
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
import { extractFirstUrl } from "../utils/link.util";
import { getLinkPreview } from "../utils/linkPreview.util";
import CommentLike from "../models/CommentLike";
import tweetDemoEngagementService from "./tweetDemoEngagement.service";

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

  async create(userId: string, data: any) {
    if (!data.content && !data.media?.length) {
      throw new Error("Tweet must contain text or media");
    }

    const content = data.content?.trim() || "";

    /* ================= FORMAT MEDIA ================= */
const senderUser = await User.findById(userId).select("username");
const senderName = senderUser?.username || "Someone";
    const formattedMedia = (data.media || []).map((url: string) => {
      const isVideo = url.includes("/video/");

      return {
        url,
        type: isVideo ? "video" : "image",
        publicId: this.extractPublicId(url)
      };
    });

    /* ================= LINK PREVIEW ================= */

    let linkPreview: any = undefined;

    const firstUrl = extractFirstUrl(content);

    console.log("🟡 [CREATE TWEET] content:", content);
    console.log("🔗 [CREATE TWEET] firstUrl:", firstUrl);

    if (firstUrl) {
      try {
        const preview = await getLinkPreview(firstUrl);

        console.log("📦 [CREATE TWEET] raw preview:", preview);

        linkPreview = {
          url: preview?.url || firstUrl,
          title: preview?.title || "",
          description: preview?.description || "",
          image: preview?.image || "",
          siteName: preview?.siteName || "",
        };

        console.log("✅ [CREATE TWEET] saved linkPreview:", linkPreview);
      } catch (error: any) {
        console.log("❌ [CREATE TWEET] link preview error:", error?.message);

        linkPreview = {
          url: firstUrl,
          title: "",
          description: "",
          image: "",
          siteName: "",
        };
      }
    }
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
      linkPreview,
      hashtags,
      mentions: mentionedUsers.map((u) => u._id),
      parentTweet: data.parentTweet,
      quoteTweet: data.quoteTweet,
      poll: data.poll
    });
try {
  await tweetDemoEngagementService.scheduleLikesForTweet(
    tweet._id.toString(),
    userId,
    {
      minDelayMs: 30_000,
      maxDelayMs: 60_000,
      maxLikes: 15,
    }
  );
} catch (error) {
  console.log("❌ schedule demo engagement failed:", error);
}
    /* ================= NOTIFICATIONS ================= */

    for (const user of mentionedUsers) {
      if (user._id.toString() !== userId) {
        await notificationService.create({
          recipient: user._id,
          sender: userId,
          type: "mention",
          relatedTweet: tweet._id,
      body: `${senderUser?.username || "Someone"} mentioned you in a tweet`
        });
      }
    }

    // return tweet;
const populatedTweet = await Tweet.findById(tweet._id)
  .populate(
    "author",
    "username atUsername avatar isVerified badges verificationType activeCustomization customEmojiBadge"
  )
  .lean();

if (!populatedTweet) {
  throw new Error("Tweet created but not found");
}

const author: any = populatedTweet.author;

return {
  ...populatedTweet,

  author: {
    ...author,

    displayBadges:
      Array.isArray(author?.activeCustomization?.badges) &&
      author.activeCustomization.badges.length > 0
        ? author.activeCustomization.badges
        : author?.badges || [],

    displayVerificationType:
      author?.activeCustomization?.verificationType ||
      author?.verificationType ||
      "none",
  },

  likesCount: populatedTweet.likesCount ?? 0,
  retweetsCount: populatedTweet.retweetsCount ?? 0,
  repliesCount: populatedTweet.repliesCount ?? 0,
  isLiked: false,
  isRetweeted: false,
  isBookmarked: false,
};
  }

  /* ======================================================
     TOGGLE LIKE
  ====================================================== */

  async toggleLike(userId: string, tweetId: string) {
    const tweet = await Tweet.findOne({
      _id: tweetId,
      deleted: false,
      isHidden: false
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
      deleted: false,
      isHidden: false
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

//   async comment(userId: string, tweetId: string, content: string) {
//     const tweet = await Tweet.findOne({
//       _id: tweetId,
//       deleted: false,
//       isHidden: false
//     });

//     if (!tweet) throw new Error("Tweet not found");

//     const cleanContent = content.trim();
// const senderUser = await User.findById(userId).select("username");
// const senderName = senderUser?.username || "Someone";
//     const mentionedUsernames = extractMentions(cleanContent);

//     const mentionedUsers = await User.find({
//       atUsername: { $in: mentionedUsernames }
//     }).select("_id");

//     const comment = await Comment.create({
//       tweet: tweetId,
//       user: userId,
//       content: cleanContent
//     });

//     await Tweet.updateOne(
//       { _id: tweetId },
//       { $inc: { repliesCount: 1 } }
//     );

//     if (tweet.author.toString() !== userId) {
//       await notificationService.create({
//         recipient: tweet.author,
//         sender: userId,
//         type: "tweet_reply",
//         relatedTweet: tweetId,
//         body: "قام بالرد على تويتتك"
//       });
//     }

//     for (const user of mentionedUsers) {
//       if (user._id.toString() !== userId) {
//         await notificationService.create({
//           recipient: user._id,
//           sender: userId,
//           type: "mention",
//           relatedTweet: tweetId,
//       body: `${senderUser?.username || "Someone"} mentioned you in a comment`

//     });
//       }
//     }

//     return comment;
//   }
async comment(userId: string, tweetId: string, content: string) {
  const tweet = await Tweet.findOne({
    _id: tweetId,
    deleted: false,
    isHidden: false,
  });

  if (!tweet) throw new Error("Tweet not found");

  const cleanContent = content.trim();
  if (!cleanContent) throw new Error("Comment content is required");

  const senderUser = await User.findById(userId).select("username");
  const senderName = senderUser?.username || "Someone";

  const mentionedUsernames = extractMentions(cleanContent);

  const mentionedUsers = await User.find({
    atUsername: { $in: mentionedUsernames },
  }).select("_id");

  const comment = await Comment.create({
    tweet: tweetId,
    user: userId,
    content: cleanContent,
    mentions: mentionedUsers.map((u) => u._id),
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
      body: `${senderName} replied to your tweet`,
    });
  }

  for (const user of mentionedUsers) {
    if (user._id.toString() !== userId) {
      await notificationService.create({
        recipient: user._id,
        sender: userId,
        type: "mention",
        relatedTweet: tweetId,
        body: `${senderName} mentioned you in a comment`,
      });
    }
  }

  const populatedComment = await Comment.findById(comment._id)
    .populate(
      "user",
      "username atUsername avatar isVerified badges verificationType activeCustomization customEmojiBadge"
    )
    .lean();

  if (!populatedComment) {
    throw new Error("Comment created but not found");
  }

  const commentUser: any = populatedComment.user;

  return {
    ...populatedComment,

    user: {
      ...commentUser,

      displayBadges:
        Array.isArray(commentUser?.activeCustomization?.badges) &&
        commentUser.activeCustomization.badges.length > 0
          ? commentUser.activeCustomization.badges
          : commentUser?.badges || [],

      displayVerificationType:
        commentUser?.activeCustomization?.verificationType ||
        commentUser?.verificationType ||
        "none",
    },

    likesCount: populatedComment.likesCount ?? 0,
    repliesCount: populatedComment.repliesCount ?? 0,
    isLiked: false,
  };
}
  async toggleCommentLike(userId: string, commentId: string) {
  const comment = await Comment.findOne({
    _id: commentId,
    isHidden: false
  });

  if (!comment) throw new Error("Comment not found");

  const existing = await CommentLike.findOne({
    user: userId,
    comment: commentId
  });

  if (existing) {
    await existing.deleteOne();

    await Comment.updateOne(
      { _id: commentId, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } }
    );

    return { liked: false };
  }

  await CommentLike.create({
    user: userId,
    comment: commentId
  });

  await Comment.updateOne(
    { _id: commentId },
    { $inc: { likesCount: 1 } }
  );

  if (comment.user.toString() !== userId) {
    const senderUser = await User.findById(userId).select("username");
    const senderName = senderUser?.username || "Someone";

    try {
      await notificationService.create({
        recipient: comment.user,
        sender: userId,
        type: "comment_like",
        relatedTweet: comment.tweet,
        relatedMessage: comment._id,
        body: `${senderName} liked your comment`
      });
    } catch (error) {
      console.log("❌ comment like notification error:", error);
    }
  }

  return { liked: true };
}
/* ======================================================
   GET COMMENT REPLIES
====================================================== */

async getCommentReplies(
  commentId: string,
  page: number = 1,
  limit: number = 10,
  userId: string
) {
  const skip = (page - 1) * limit;

  const commentObjectId = new mongoose.Types.ObjectId(commentId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const replies = await Comment.aggregate([
    {
      $match: {
        parentComment: commentObjectId,
        isHidden: false,
      },
    },

    { $sort: { createdAt: 1 } },
    { $skip: skip },
    { $limit: limit },

    /* ================= USER ================= */

    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $project: {
              username: 1,
              atUsername: 1,
              avatar: 1,
              isVerified: 1,
              badges: 1,
              verificationType: 1,
              activeCustomization: {
                badges: 1,
                verificationType: 1,
              },
            },
          },
        ],
      },
    },

    { $unwind: "$user" },

    /* ================= DISPLAY BADGES ================= */

    {
      $addFields: {
        "user.displayBadges": {
          $cond: [
            {
              $gt: [
                { $size: { $ifNull: ["$user.activeCustomization.badges", []] } },
                0,
              ],
            },
            "$user.activeCustomization.badges",
            { $ifNull: ["$user.badges", []] },
          ],
        },
        "user.displayVerificationType": {
          $ifNull: [
            "$user.activeCustomization.verificationType",
            "$user.verificationType",
          ],
        },
      },
    },

    /* ================= IS LIKED ================= */

    {
      $lookup: {
        from: "commentlikes",
        let: { commentId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$comment", "$$commentId"] },
                  { $eq: ["$user", userObjectId] },
                ],
              },
            },
          },
        ],
        as: "liked",
      },
    },

    {
      $addFields: {
        isLiked: { $gt: [{ $size: "$liked" }, 0] },
      },
    },

    {
      $project: {
        liked: 0,
      },
    },
  ]);

  return replies;
}

/* ======================================================
   GET TWEET LIKES USERS
====================================================== */

async getTweetLikesUsers(tweetId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const tweet = await Tweet.findOne({
    _id: tweetId,
    deleted: false,
    isHidden: false,
  }).select("_id");

  if (!tweet) throw new Error("Tweet not found");

  const likes = await Like.find({ tweet: tweetId })
    .populate(
      "user",
      "username atUsername avatar isVerified badges verificationType activeCustomization"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return likes
    .map((item: any) => item.user)
    .filter(Boolean);
}

/* ======================================================
   GET COMMENT LIKES USERS
====================================================== */

async getCommentLikesUsers(commentId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const comment = await Comment.findOne({
    _id: commentId,
    isHidden: false,
  }).select("_id");

  if (!comment) throw new Error("Comment not found");

  const likes = await CommentLike.find({ comment: commentId })
    .populate(
      "user",
      "username atUsername avatar isVerified badges verificationType activeCustomization"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return likes
    .map((item: any) => item.user)
    .filter(Boolean);
}
async getUserTweets(
  currentUserId: string,
  profileUserId: string,
  page: number = 1,
  limit: number = 10
) {
  const skip = (page - 1) * limit;

  const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
  const profileUserObjectId = new mongoose.Types.ObjectId(profileUserId);

  const currentUser = await User.findById(currentUserObjectId).select("blockedUsers");
  const blockedIds = currentUser?.blockedUsers || [];

  if (blockedIds.some((id: any) => id.toString() === profileUserId)) {
    return { tweets: [], total: 0, page, limit };
  }

  const total = await Tweet.countDocuments({
    author: profileUserObjectId,
    deleted: false,
    isHidden: false,
  });

  const tweets = await Tweet.aggregate([
    {
      $match: {
        author: profileUserObjectId,
        deleted: false,
        isHidden: false,
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },

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
              isVerified: 1,
              badges: 1,
              verificationType: 1,
              activeCustomization: {
                badges: 1,
                verificationType: 1,
              },
              blockedUsers: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$author" },

    {
      $match: {
        "author.blockedUsers": { $ne: currentUserObjectId },
      },
    },

    {
      $addFields: {
        "author.displayBadges": {
          $cond: [
            {
              $gt: [
                { $size: { $ifNull: ["$author.activeCustomization.badges", []] } },
                0,
              ],
            },
            "$author.activeCustomization.badges",
            { $ifNull: ["$author.badges", []] },
          ],
        },
        "author.displayVerificationType": {
          $ifNull: [
            "$author.activeCustomization.verificationType",
            "$author.verificationType",
          ],
        },
      },
    },

    {
      $lookup: {
        from: "follows",
        let: { authorId: "$author._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$follower", currentUserObjectId] },
                  { $eq: ["$following", "$$authorId"] },
                ],
              },
            },
          },
        ],
        as: "followRelation",
      },
    },

    {
      $addFields: {
        "author.isFollowing": {
          $gt: [{ $size: "$followRelation" }, 0],
        },
      },
    },

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
                  { $eq: ["$user", currentUserObjectId] },
                ],
              },
            },
          },
        ],
        as: "liked",
      },
    },
    {
      $addFields: {
        isLiked: { $gt: [{ $size: "$liked" }, 0] },
      },
    },

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
                  { $eq: ["$user", currentUserObjectId] },
                ],
              },
            },
          },
        ],
        as: "retweeted",
      },
    },
    {
      $addFields: {
        isRetweeted: { $gt: [{ $size: "$retweeted" }, 0] },
      },
    },

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
                  { $eq: ["$user", currentUserObjectId] },
                ],
              },
            },
          },
        ],
        as: "bookmarked",
      },
    },
    {
      $addFields: {
        isBookmarked: { $gt: [{ $size: "$bookmarked" }, 0] },
      },
    },

    {
      $project: {
        followRelation: 0,
        liked: 0,
        retweeted: 0,
        bookmarked: 0,
        "author.blockedUsers": 0,
      },
    },
  ]);

  return {
    tweets,
    total,
    page,
    limit,
    hasMore: skip + tweets.length < total,
  };
}
async replyToComment(userId: string, commentId: string, content: string) {
  const parentComment = await Comment.findOne({
    _id: commentId,
    isHidden: false,
  });

  if (!parentComment) throw new Error("Comment not found");

  const cleanContent = content.trim();
  if (!cleanContent) throw new Error("Reply content is required");

  const senderUser = await User.findById(userId).select("username");
  const senderName = senderUser?.username || "Someone";

  const mentionedUsernames = extractMentions(cleanContent);

  const mentionedUsers = await User.find({
    atUsername: { $in: mentionedUsernames },
  }).select("_id");

  const reply = await Comment.create({
    tweet: parentComment.tweet,
    user: userId,
    content: cleanContent,
    parentComment: parentComment._id,
    mentions: mentionedUsers.map((u) => u._id),
  });

  await Comment.updateOne(
    { _id: parentComment._id },
    { $inc: { repliesCount: 1 } }
  );

  if (parentComment.user.toString() !== userId) {
    try {
      await notificationService.create({
        recipient: parentComment.user,
        sender: userId,
        type: "comment_reply",
        relatedTweet: parentComment.tweet,
        relatedMessage: reply._id,
        body: `${senderName} replied to your comment`,
      });
    } catch (error) {
      console.log("❌ comment reply notification error:", error);
    }
  }

  for (const user of mentionedUsers) {
    if (
      user._id.toString() !== userId &&
      user._id.toString() !== parentComment.user.toString()
    ) {
      try {
        await notificationService.create({
          recipient: user._id,
          sender: userId,
          type: "mention",
          relatedTweet: parentComment.tweet,
          relatedMessage: reply._id,
          body: `${senderName} mentioned you in a comment`,
        });
      } catch (error) {
        console.log("❌ mention in comment reply notification error:", error);
      }
    }
  }

  const populatedReply = await Comment.findById(reply._id)
    .populate(
      "user",
      "username atUsername avatar isVerified badges verificationType activeCustomization customEmojiBadge"
    )
    .lean();

  if (!populatedReply) {
    throw new Error("Reply created but not found");
  }

  const replyUser: any = populatedReply.user;

  return {
    ...populatedReply,

    user: {
      ...replyUser,

      displayBadges:
        Array.isArray(replyUser?.activeCustomization?.badges) &&
        replyUser.activeCustomization.badges.length > 0
          ? replyUser.activeCustomization.badges
          : replyUser?.badges || [],

      displayVerificationType:
        replyUser?.activeCustomization?.verificationType ||
        replyUser?.verificationType ||
        "none",
    },

    likesCount: populatedReply.likesCount ?? 0,
    repliesCount: populatedReply.repliesCount ?? 0,
    isLiked: false,
  };
}
  /* ======================================================
     TOGGLE BOOKMARK
  ====================================================== */

  async toggleBookmark(userId: string, tweetId: string) {
    const tweet = await Tweet.findOne({
      _id: tweetId,
      deleted: false,
      isHidden: false
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
  const [tweet, actor] = await Promise.all([
    Tweet.findById(tweetId),
    User.findById(userId).select("role isBot botType"),
  ]);

  if (!tweet) throw new Error("Tweet not found");
  if (!actor) throw new Error("User not found");

  const isOwner = tweet.author.toString() === userId;
  const isAdmin = actor.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new Error("Unauthorized");
  }

  tweet.deleted = true;
  await tweet.save();

  return {
    success: true,
    deletedBy: isAdmin && !isOwner ? "admin" : "owner",
  };
}

  /* ======================================================
     GET TWEET COMMENTS
  ====================================================== */
  async getTweetComments(tweetId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    return Comment.find({
      tweet: tweetId,
      isHidden: false,
    })
      .populate(
        "user",
        "username atUsername avatar isVerified badges verificationType activeCustomization"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }
  /* ======================================================
     SHARED FEED PIPELINE
  ====================================================== */

  private async buildFeedPipeline(
    authorIds: mongoose.Types.ObjectId[] | null,
    userObjectId: mongoose.Types.ObjectId,
    skip: number,
    limit: number
  ) {
    const currentUser = await User.findById(userObjectId).select("blockedUsers");
    const blockedIds = currentUser?.blockedUsers || [];

    const matchStage: any = {
      deleted: false,
      isHidden: false,
      author: { $nin: blockedIds }
    };

    if (authorIds && authorIds.length > 0) {
      matchStage.author = {
        $in: authorIds,
        $nin: blockedIds
      };
    }

    if (authorIds && authorIds.length === 0) {
      return [];
    }

    const tweets = await Tweet.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // {
      //   $lookup: {
      //     from: "users",
      //     localField: "author",
      //     foreignField: "_id",
      //     as: "author",
      //     pipeline: [
      //       {
      //         $project: {
      //           username: 1,
      //           atUsername: 1,
      //           avatar: 1,
      //           isVerified: 1,
      //           badges: 1,
      //           verificationType: 1,
      //           activeCustomization: {
      //             badges: 1,
      //             verificationType: 1
      //           }
      //         }
      //       }
      //     ]
      //   }
      // },
{
  $lookup: {
    from: "users",
    localField: "author",
    foreignField: "_id",
    as: "author",
    pipeline: [
      {
        $lookup: {
          from: "userinventories",
          localField: "_id",
          foreignField: "user",
          as: "inventory",
          pipeline: [
            {
              $lookup: {
                from: "storeitems",
                localField: "item",
                foreignField: "_id",
                as: "item"
              }
            },
            {
              $unwind: {
                path: "$item",
                preserveNullAndEmptyArrays: true
              }
            }
          ]
        }
      },
      {
        $project: {
          username: 1,
          atUsername: 1,
          avatar: 1,
          isVerified: 1,
          badges: 1,
          verificationType: 1,
          customEmojiBadge: 1,
          activeCustomization: {
            badges: 1,
            verificationType: 1
          },
          inventory: 1
        }
      }
    ]
  }
},
      { $unwind: "$author" },
{
  $addFields: {
    "author.displayBadges": {
      $cond: [
        {
          $gt: [
            { $size: { $ifNull: ["$author.activeCustomization.badges", []] } },
            0
          ]
        },
        "$author.activeCustomization.badges",
        { $ifNull: ["$author.badges", []] }
      ]
    },
    "author.displayVerificationType": {
      $ifNull: [
        "$author.activeCustomization.verificationType",
        "$author.verificationType"
      ]
    }
  }
},
{
  $addFields: {
    "author.displayBadgesDetailed": {
      $map: {
        input: { $ifNull: ["$author.displayBadges", []] },
        as: "badgeKey",
        in: {
          $let: {
            vars: {
              matchedInventory: {
                $first: {
                  $filter: {
                    input: { $ifNull: ["$author.inventory", []] },
                    as: "inv",
                    cond: {
                      $and: [
                        { $eq: ["$$inv.itemType", "badge"] },
                        { $eq: ["$$inv.itemKey", "$$badgeKey"] }
                      ]
                    }
                  }
                }
              }
            },
            in: {
              key: "$$badgeKey",
              name: "$$matchedInventory.item.name",
              iconUrl: {
                $ifNull: [
                  "$$matchedInventory.item.iconUrl",
                  {
                    $ifNull: [
                      "$$matchedInventory.item.coverUrl",
                      "$$matchedInventory.item.previewUrl"
                    ]
                  }
                ]
              },
              lottieUrl: "$$matchedInventory.item.meta.lottieUrl",
              emoji: "$$matchedInventory.item.meta.emoji"
            }
          }
        }
      }
    }
  }
},
      // {
      //   $addFields: {
      //     "author.displayBadges": {
      //       $cond: [
      //         {
      //           $gt: [
      //             { $size: { $ifNull: ["$author.activeCustomization.badges", []] } },
      //             0
      //           ]
      //         },
      //         "$author.activeCustomization.badges",
      //         { $ifNull: ["$author.badges", []] }
      //       ]
      //     },
      //     "author.displayVerificationType": {
      //       $ifNull: [
      //         "$author.activeCustomization.verificationType",
      //         "$author.verificationType"
      //       ]
      //     }
      //   }
      // },

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

      const followingIds = following.map((f) => f.following);
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
        null,
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
          deleted: false,
          isHidden: false
        }
      },

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
                isVerified: 1,
                badges: 1,
                verificationType: 1,
                activeCustomization: {
                  badges: 1,
                  verificationType: 1
                }
              }
            }
          ]
        }
      },

      { $unwind: "$author" },

      {
        $addFields: {
          "author.displayBadges": {
            $cond: [
              {
                $gt: [
                  { $size: { $ifNull: ["$author.activeCustomization.badges", []] } },
                  0
                ]
              },
              "$author.activeCustomization.badges",
              { $ifNull: ["$author.badges", []] }
            ]
          },
          "author.displayVerificationType": {
            $ifNull: [
              "$author.activeCustomization.verificationType",
              "$author.verificationType"
            ]
          }
        }
      },

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