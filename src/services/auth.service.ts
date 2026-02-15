
// // auth.service.ts
// import User from "../models/User";
// import { hashPassword, comparePassword } from "../utils/hash";
// import jwt from "jsonwebtoken";

// const generateToken = (user: any) => {
//   return jwt.sign(
//     {
//       id: user._id,
//       username: user.username,
//       atUsername: user.atUsername
//     },
//     process.env.JWT_SECRET as string,
//     { expiresIn: "7d" }
//   );
// };

// /* ================= REGISTER ================= */

// export const registerUser = async (
//   username: string,
//   password: string
// ) => {
//   const existing = await User.findOne({ username });

//   if (existing) {
//     throw new Error("Username already exists");
//   }

//   const hashed = await hashPassword(password);

//   const user = await User.create({
//     username,
//     atUsername: username.toLowerCase(),
//     password: hashed
//   });

//   const token = generateToken(user);

//   return {
//     token,
//     user: {
//       _id: user._id,
//       username: user.username,
//       atUsername: user.atUsername,
//       avatar: user.avatar,
//       isVerified: user.isVerified
//     }
//   };
// };

// /* ================= LOGIN ================= */

// export const loginUser = async (
//   username: string,
//   password: string
// ) => {

//   const user = await User.findOne({ username });

//   if (!user) {
//     throw new Error("Invalid credentials");
//   }

//   const isMatch = await comparePassword(
//     password,
//     user.password
//   );

//   if (!isMatch) {
//     throw new Error("Invalid credentials");
//   }

//   user.isOnline = true;
//   await user.save();

//   const token = generateToken(user);

//   return {
//     token,
//     user: {
//       _id: user._id,
//       username: user.username,
//       atUsername: user.atUsername,
//       avatar: user.avatar,
//       isVerified: user.isVerified,
//       bio: user.bio,
//       country: user.country,
//       followersCount: user.followersCount,
//       followingCount: user.followingCount,
//       totalLikesReceived: user.totalLikesReceived,
//       profileViews: user.profileViews
//     }
//   };
// };

// /* ================= LOGOUT ================= */

// export const logoutUser = async (userId: string) => {

//   const user = await User.findById(userId);

//   if (!user) {
//     throw new Error("User not found");
//   }

//   user.isOnline = false;
//   await user.save();

//   return { message: "Logged out successfully" };
// };

import { getIO } from "../config/socket";
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import jwt from "jsonwebtoken";
import Friend from "../models/Friend";


/* =====================================================
   TOKEN GENERATOR
===================================================== */

const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      atUsername: user.atUsername
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );
};

/* =====================================================
   REGISTER
===================================================== */

export const registerUser = async (
  username: string,
  password: string
) => {

  const existing = await User.findOne({ username });

  if (existing) {
    throw new Error("Username already exists");
  }

  const hashed = await hashPassword(password);

  const user = await User.create({
    username,
    atUsername: username.toLowerCase(),
    password: hashed
  });

  const token = generateToken(user);

  return {
    token,
    user: {
      _id: user._id,
      username: user.username,
      atUsername: user.atUsername,
      avatar: user.avatar,
      isVerified: user.isVerified,
      isOnline: false,
      isInvisible: false,
      lastSeen: null
    }
  };
};

/* =====================================================
   LOGIN
===================================================== */

export const loginUser = async (
  username: string,
  password: string
) => {

  const user = await User.findOne({ username });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await comparePassword(
    password,
    user.password
  );

  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  /* ===== Presence Update ===== */

  user.isOnline = true;
  // لا نغير isInvisible
  // لا نغير lastSeen هنا

  await user.save();

  const token = generateToken(user);

  return {
    token,
    user: {
      _id: user._id,
      username: user.username,
      atUsername: user.atUsername,
      avatar: user.avatar,
      isVerified: user.isVerified,
      bio: user.bio,
      country: user.country,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      totalLikesReceived: user.totalLikesReceived,
      profileViews: user.profileViews,
      isOnline: user.isOnline,
      isInvisible: user.isInvisible,
      lastSeen: user.lastSeen
    }
  };
};

/* =====================================================
   LOGOUT
===================================================== */

export const logoutUser = async (userId: string) => {

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  /* ===== Presence Update ===== */

  user.isOnline = false;
  user.lastSeen = new Date();

  await user.save();

  return {
    message: "Logged out successfully"
  };
};

/* =====================================================
   TOGGLE INVISIBLE
===================================================== */

export const toggleInvisibleStatus = async (
  userId: string,
  invisible: boolean
) => {

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.isInvisible = invisible;

  if (invisible === true && user.isOnline) {
    user.lastSeen = new Date();
  }

  await user.save();

  /* ===== Broadcast Presence Change ===== */

  const io = getIO();

  const relations = await Friend.find({
    $or: [
      { requester: userId, status: "accepted" },
      { recipient: userId, status: "accepted" }
    ]
  });

  const friendsIds = relations.map((relation: any) =>
    relation.requester.toString() === userId
      ? relation.recipient.toString()
      : relation.requester.toString()
  );

  friendsIds.forEach(friendId => {
    io.to(friendId).emit("presence:update", {
      userId,
      status: invisible ? "offline" : "online",
      lastSeen: user.lastSeen
    });
  });

  return {
    isInvisible: user.isInvisible
  };
};
