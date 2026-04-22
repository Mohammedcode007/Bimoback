
// // models/Tweet.ts
// import mongoose, { Schema, Document, Types } from "mongoose";

// export type ReplyPermission =
//   | "everyone"
//   | "followers"
//   | "mentioned";

// export interface ITweet extends Document {
//   author: Types.ObjectId;
//   content?: string;

//   media: {
//     url: string;
//     publicId?: string;
//     type: "image" | "video";
//   }[];

//   linkPreview?: {
//     url: string;
//     title?: string;
//     description?: string;
//     image?: string;
//     siteName?: string;
//   };

//   hashtags: string[];
//   mentions: Types.ObjectId[];
//   isHidden: boolean;
//   hiddenReason?: string | null;
//   hiddenAt?: Date | null;
//   hiddenBy?: "system" | "admin" | null;
//   repliesCount: number;
//   retweetsCount: number;
//   likesCount: number;
//   viewsCount: number;

//   parentTweet?: Types.ObjectId;
//   quoteTweet?: Types.ObjectId;

//   poll?: {
//     question: string;
//     options: {
//       text: string;
//       votes: number;
//     }[];
//     expiresAt: Date;
//   };

//   replyPermission: ReplyPermission;

//   pinned: boolean;
//   edited: boolean;
//   deleted: boolean;

//   createdAt: Date;
//   updatedAt: Date;
// }

// const TweetSchema = new Schema<ITweet>(
//   {
//     author: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//       index: true
//     },

//     content: {
//       type: String,
//       maxlength: 280
//     },

//     media: [
//       {
//         url: {
//           type: String,
//           required: true
//         },
//         publicId: {
//           type: String
//         },
//         type: {
//           type: String,
//           enum: ["image", "video"],
//           required: true
//         }
//       }
//     ],

//     linkPreview: {
//       url: {
//         type: String
//       },
//       title: {
//         type: String
//       },
//       description: {
//         type: String
//       },
//       image: {
//         type: String
//       },
//       siteName: {
//         type: String
//       }
//     },

//     hashtags: [
//       {
//         type: String
//       }
//     ],

//     mentions: [
//       {
//         type: Schema.Types.ObjectId,
//         ref: "User"
//       }
//     ],
//         isHidden: {
//       type: Boolean,
//       default: false,
//       index: true,
//     },

//     hiddenReason: {
//       type: String,
//       trim: true,
//       default: null,
//     },

//     hiddenAt: {
//       type: Date,
//       default: null,
//     },

//     hiddenBy: {
//       type: String,
//       enum: ["system", "admin"],
//       default: null,
//     },

//     repliesCount: {
//       type: Number,
//       default: 0
//     },
//     retweetsCount: {
//       type: Number,
//       default: 0
//     },
//     likesCount: {
//       type: Number,
//       default: 0
//     },
//     viewsCount: {
//       type: Number,
//       default: 0
//     },

//     parentTweet: {
//       type: Schema.Types.ObjectId,
//       ref: "Tweet"
//     },
//     quoteTweet: {
//       type: Schema.Types.ObjectId,
//       ref: "Tweet"
//     },

//     poll: {
//       question: String,
//       options: [
//         {
//           text: String,
//           votes: {
//             type: Number,
//             default: 0
//           }
//         }
//       ],
//       expiresAt: Date
//     },

//     replyPermission: {
//       type: String,
//       enum: ["everyone", "followers", "mentioned"],
//       default: "everyone"
//     },

//     pinned: {
//       type: Boolean,
//       default: false
//     },
//     edited: {
//       type: Boolean,
//       default: false
//     },
//     deleted: {
//       type: Boolean,
//       default: false
//     }
//   },
//   { timestamps: true }
// );

// TweetSchema.index({ author: 1, createdAt: -1 });
// TweetSchema.index({ hashtags: 1 });
// TweetSchema.index({ parentTweet: 1 });

// export default mongoose.model<ITweet>("Tweet", TweetSchema);
// models/Tweet.ts
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

  linkPreview?: {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  };

  hashtags: string[];
  mentions: Types.ObjectId[];

  isHidden: boolean;
  hiddenReason?: string | null;
  hiddenAt?: Date | null;
  hiddenBy?: "system" | "admin" | null;

  repliesCount: number;
  retweetsCount: number;
  likesCount: number;
  viewsCount: number;

  parentTweet?: Types.ObjectId;
  quoteTweet?: Types.ObjectId;

  poll?: {
    question: string;
    options: {
      text: string;
      votes: number;
    }[];
    expiresAt: Date;
  };

  replyPermission: ReplyPermission;

  pinned: boolean;
  edited: boolean;
  deleted: boolean;

  // ✅ حقل الحذف التلقائي
  expireAt: Date;

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
        url: {
          type: String,
          required: true
        },
        publicId: {
          type: String
        },
        type: {
          type: String,
          enum: ["image", "video"],
          required: true
        }
      }
    ],

    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String,
      siteName: String
    },

    hashtags: [{ type: String }],

    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },

    hiddenReason: {
      type: String,
      trim: true,
      default: null,
    },

    hiddenAt: {
      type: Date,
      default: null,
    },

    hiddenBy: {
      type: String,
      enum: ["system", "admin"],
      default: null,
    },

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
          }
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
    },

    // 🔥 أهم جزء: الحذف بعد 3 أيام
 expireAt: {
  type: Date,
  default: () =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  index: { expires: 0 } // TTL
}
  },
  { timestamps: true }
);

// Indexes
TweetSchema.index({ author: 1, createdAt: -1 });
TweetSchema.index({ hashtags: 1 });
TweetSchema.index({ parentTweet: 1 });

export default mongoose.model<ITweet>("Tweet", TweetSchema);