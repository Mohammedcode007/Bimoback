// Tweet.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type ReplyPermission =
  | "everyone"
  | "followers"
  | "mentioned";

export interface ITweet extends Document {
  author: Types.ObjectId;

  content?: string;

  media: {
    url: string;
    publicId?: string;
    type: "image" | "video";
  }[];

  hashtags: string[];
  mentions: Types.ObjectId[];

  likes: Types.ObjectId[];
  retweets: Types.ObjectId[];
  bookmarks: Types.ObjectId[];

  repliesCount: number;
  retweetsCount: number;
  likesCount: number;
  viewsCount: number;

  parentTweet?: Types.ObjectId; // Reply
  quoteTweet?: Types.ObjectId;  // Quote

  poll?: {
    question: string;
    options: {
      text: string;
      votes: number;
      voters: Types.ObjectId[];
    }[];
    expiresAt: Date;
  };

  replyPermission: ReplyPermission;

  pinned: boolean;
  edited: boolean;
  deleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const TweetSchema = new Schema<ITweet>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    content: {
      type: String,
      maxlength: 280
    },

    media: [
      {
        url: String,
        publicId: String,
        type: {
          type: String,
          enum: ["image", "video"]
        }
      }
    ],

    hashtags: [
      {
        type: String,
        index: true
      }
    ],

    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    retweets: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    bookmarks: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    repliesCount: {
      type: Number,
      default: 0
    },

    retweetsCount: {
      type: Number,
      default: 0
    },

    likesCount: {
      type: Number,
      default: 0
    },

    viewsCount: {
      type: Number,
      default: 0
    },

    parentTweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet"
    },

    quoteTweet: {
      type: Schema.Types.ObjectId,
      ref: "Tweet"
    },

    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: {
            type: Number,
            default: 0
          },
          voters: [
            {
              type: Schema.Types.ObjectId,
              ref: "User"
            }
          ]
        }
      ],
      expiresAt: Date
    },

    replyPermission: {
      type: String,
      enum: ["everyone", "followers", "mentioned"],
      default: "everyone"
    },

    pinned: {
      type: Boolean,
      default: false
    },

    edited: {
      type: Boolean,
      default: false
    },

    deleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

/* =========================
   Performance Indexes
========================= */

TweetSchema.index({ author: 1, createdAt: -1 });
TweetSchema.index({ hashtags: 1 });
TweetSchema.index({ parentTweet: 1 });
TweetSchema.index({ quoteTweet: 1 });

export default mongoose.model<ITweet>("Tweet", TweetSchema);
