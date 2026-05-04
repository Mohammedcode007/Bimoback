// src/scripts/makeUserAdmin.ts
console.log("🔥 FILE LOADED makeUserAdmin.ts");

import dotenv from "dotenv";
dotenv.config();

import mongoose, { Types } from "mongoose";
import User from "../models/User";

function getArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  const userId = getArg("id");
  const username = getArg("username");

  if (!userId && !username) {
    throw new Error(
      "Please provide --id=<USER_ID> or --username=<USERNAME>"
    );
  }

  await mongoose.connect(mongoUri);

  console.log("✅ MongoDB connected");

  const query: any = {};

  if (userId) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user id");
    }

    query._id = new Types.ObjectId(userId);
  } else {
    query.$or = [
      { username },
      { atUsername: username },
    ];
  }

  const user: any = await User.findOne(query).select(
    "_id username atUsername role isVerified"
  );

  if (!user) {
    throw new Error("User not found");
  }

  console.log("👤 User found:", {
    id: String(user._id),
    username: user.username,
    atUsername: user.atUsername,
    oldRole: user.role,
  });

  user.role = "admin";

  await user.save();

  console.log("✅ User promoted to admin:", {
    id: String(user._id),
    username: user.username,
    atUsername: user.atUsername,
    newRole: user.role,
  });

  await mongoose.disconnect();

  console.log("✅ MongoDB disconnected");
}

main().catch(async (err) => {
  console.error("❌ makeUserAdmin error:", err?.message || err);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});