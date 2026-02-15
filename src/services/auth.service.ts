// // auth.service.ts
// import User from "../models/User";
// import { hashPassword, comparePassword } from "../utils/hash";
// import { signToken } from "../config/jwt";

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
//     atUsername: `@${username}`,
//     password: hashed
//   });

//   const token = signToken(user._id.toString());

//   return { user, token };
// };

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

//   const token = signToken(user._id.toString());

//   return { user, token };
// };

// export const logoutUser = async (userId: string) => {
//   const user = await User.findById(userId);
//   if (!user) throw new Error("User not found");

//   user.isOnline = false;
//   await user.save();

//   return { message: "Logged out successfully" };
// };

// auth.service.ts
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import jwt from "jsonwebtoken";

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

/* ================= REGISTER ================= */

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
      isVerified: user.isVerified
    }
  };
};

/* ================= LOGIN ================= */

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

  user.isOnline = true;
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
      profileViews: user.profileViews
    }
  };
};

/* ================= LOGOUT ================= */

export const logoutUser = async (userId: string) => {

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  user.isOnline = false;
  await user.save();

  return { message: "Logged out successfully" };
};
