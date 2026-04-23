import "dotenv/config";
import mongoose from "mongoose";
import Room from "../models/Room";

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);

  const result = await Room.updateMany(
    {
      $or: [
        { roomBot: { $exists: false } },
        { "roomBot.enabled": { $ne: true } }
      ]
    },
    {
      $set: {
        "roomBot.enabled": true,
        "roomBot.welcomeEnabled": false,
        "roomBot.language": "ar"
      }
    }
  );

  console.log("matched:", result.matchedCount);
  console.log("modified:", result.modifiedCount);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});