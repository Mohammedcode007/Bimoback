// // models/User.ts
// import mongoose, { Schema, Document, Types } from "mongoose";

// export interface IUser extends Document {
//   username: string;
//   atUsername: string;
//   password: string;
//   email?: string;

//   isOnline: boolean;
//   lastSeen?: Date;

//   chats: Types.ObjectId[];
//   tweets: Types.ObjectId[];
//   rooms: Types.ObjectId[];
//   badges: Types.ObjectId[];

//   blockedUsers: Types.ObjectId[];

//   avatar?: string;
//   coverImage?: string;
//   bio?: string;
//   country?: string;   // ✅ تمت الإضافة

//   isVerified: boolean;
//   notificationSound: boolean;
//   readReceiptsEnabled: boolean;

//   createdAt: Date;
//   updatedAt: Date;
// }

// const UserSchema = new Schema<IUser>(
//   {
//     username: {
//       type: String,
//       required: true,
//       trim: true
//     },

//     atUsername: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true
//     },

//     password: {
//       type: String,
//       required: true
//     },

//     email: {
//       type: String,
//       trim: true,
//       lowercase: true,
//       index: true // ليس unique
//     },

//     isOnline: {
//       type: Boolean,
//       default: false
//     },
//     country: {
//   type: String,
//   trim: true,
//   maxlength: 50
// },


//     lastSeen: {
//       type: Date
//     },

//     chats: [{ type: Schema.Types.ObjectId, ref: "Chat" }],
//     tweets: [{ type: Schema.Types.ObjectId, ref: "Tweet" }],
//     rooms: [{ type: Schema.Types.ObjectId, ref: "Room" }],
//     badges: [{ type: Schema.Types.ObjectId, ref: "Badge" }],

//     blockedUsers: [
//       {
//         type: Schema.Types.ObjectId,
//         ref: "User"
//       }
//     ],

//     avatar: String,
//     coverImage: String,

//     bio: {
//       type: String,
//       maxlength: 250
//     },

//     isVerified: {
//       type: Boolean,
//       default: false
//     },

//     notificationSound: {
//       type: Boolean,
//       default: true
//     },

//     readReceiptsEnabled: {
//       type: Boolean,
//       default: true
//     }
//   },
//   { timestamps: true }
// );

// /* ================= PERFORMANCE INDEXES ================= */

// // بحث سريع
// UserSchema.index({ username: "text", atUsername: "text" });

// // ترتيب أونلاين
// UserSchema.index({ isOnline: 1, lastSeen: -1 });

// // تحقق سريع من الحظر
// UserSchema.index({ blockedUsers: 1 });

// export default mongoose.model<IUser>("User", UserSchema);

// models/User.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  atUsername: string;
  password: string;
  email?: string;

  isOnline: boolean;
  lastSeen?: Date;
blockedUsers: mongoose.Types.ObjectId[];

  dateOfBirth?: Date;
  country?: string;
  bio?: string;

  avatar?: string;
  coverImage?: string;

  /* ===== Counters Only ===== */

  followersCount: number;
  followingCount: number;
  totalLikesReceived: number;     // مجموع اللايكات على كل التويتات
  totalRetweetsReceived: number;  // مجموع الريتويت
  profileViews: number;

  isVerified: boolean;
  notificationSound: boolean;
  readReceiptsEnabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true
    },

    atUsername: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },

    /* ===== Basic Info ===== */

    dateOfBirth: Date,

    country: {
      type: String,
      trim: true,
      maxlength: 50
    },

    bio: {
      type: String,
      maxlength: 2000
    },

    avatar: String,
    coverImage: String,

    /* ===== Online ===== */

    isOnline: {
      type: Boolean,
      default: false
    },
blockedUsers: [
  {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
],

    lastSeen: Date,

    /* ===== Counters ===== */

    followersCount: {
      type: Number,
      default: 0
    },

    followingCount: {
      type: Number,
      default: 0
    },

    totalLikesReceived: {
      type: Number,
      default: 0
    },

    totalRetweetsReceived: {
      type: Number,
      default: 0
    },

    profileViews: {
      type: Number,
      default: 0
    },

    /* ===== Settings ===== */

    isVerified: {
      type: Boolean,
      default: false
    },

    notificationSound: {
      type: Boolean,
      default: true
    },

    readReceiptsEnabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

/* ===== Performance Indexes ===== */

UserSchema.index({ username: "text", atUsername: "text" });
UserSchema.index({ followersCount: -1 });
UserSchema.index({ totalLikesReceived: -1 });
UserSchema.index({ isOnline: 1, lastSeen: -1 });

export default mongoose.model<IUser>("User", UserSchema);
