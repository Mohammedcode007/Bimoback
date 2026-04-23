import mongoose from "mongoose";
import dotenv from "dotenv";
import RoomMessage from "../models/RoomMessage";
import Room from "../models/Room";

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in environment");
  }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const countBefore = await RoomMessage.countDocuments({});
  console.log("Room messages before delete:", countBefore);

  const deleteResult = await RoomMessage.deleteMany({});
  console.log("Deleted room messages:", deleteResult.deletedCount ?? 0);

  await Room.updateMany({}, { $set: { messagesCount: 0 } });
  console.log("✅ Reset messagesCount for all rooms to 0");

  const countAfter = await RoomMessage.countDocuments({});
  console.log("Room messages after delete:", countAfter);

  await mongoose.disconnect();
  console.log("✅ Done");
}

run().catch((err) => {
  console.error("❌ delete-all-room-messages failed:", err);
  process.exit(1);
});