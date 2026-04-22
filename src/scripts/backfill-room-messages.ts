import mongoose from "mongoose";
import dotenv from "dotenv";
import RoomMessage from "../models/RoomMessage";

dotenv.config();

async function backfillExpiresAt() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("Mongo connected");

  const now = Date.now();

  const cursor = RoomMessage.collection.find(
    { expiresAt: { $exists: false } },
    { projection: { _id: 1, createdAt: 1 } }
  );

  const bulk: any[] = [];
  let i = 0;

  while (await cursor.hasNext()) {
    const doc: any = await cursor.next();
    const created = doc.createdAt
      ? new Date(doc.createdAt).getTime()
      : now;

    bulk.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            expiresAt: new Date(created + 24 * 60 * 60 * 1000)
          }
        }
      }
    });

    i++;

    if (bulk.length >= 1000) {
      await RoomMessage.collection.bulkWrite(bulk);
      bulk.length = 0;
      console.log("updated", i);
    }
  }

  if (bulk.length) {
    await RoomMessage.collection.bulkWrite(bulk);
  }

  console.log("done", i);
  await mongoose.disconnect();
  process.exit(0);
}

backfillExpiresAt().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});