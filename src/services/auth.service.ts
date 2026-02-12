// auth.service.ts
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import { signToken } from "../config/jwt";

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
    atUsername: `@${username}`,
    password: hashed
  });

  const token = signToken(user._id.toString());

  return { user, token };
};

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

  const token = signToken(user._id.toString());

  return { user, token };
};

export const logoutUser = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.isOnline = false;
  await user.save();

  return { message: "Logged out successfully" };
};
