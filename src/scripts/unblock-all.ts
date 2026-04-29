import mongoose from "mongoose";
import dotenv from "dotenv";

import BlockRule from "../models/BlockRule";
import Room from "../models/Room";

// لو عندك موديل BannedDevice موجود فعلًا
// اتركه كما هو، ولو ظهر خطأ import احذفه من السكربت
import BannedDevice from "../models/BannedDevice";

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  "";

async function main() {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    console.log("✅ Connected");

    console.log("======================================");
    console.log("🚫 START UNBLOCK ALL");
    console.log("======================================");

    /**
     * 1) فك كل حظر النظام المركزي BlockRule
     * بدل حذف السجلات، نخليها isActive=false حتى يبقى عندك سجل تاريخي
     */
    const blockRulesResult = await BlockRule.updateMany(
      { isActive: true },
      {
        $set: {
          isActive: false,
        },
      }
    );

    console.log("✅ BlockRule deactivated:", {
      matched: blockRulesResult.matchedCount,
      modified: blockRulesResult.modifiedCount,
    });

    /**
     * 2) تفريغ blockeds من كل الغرف
     * هذا هو حظر الغرف القديم داخل Room
     */
    const roomsResult = await Room.updateMany(
      {},
      {
        $set: {
          blockeds: [],
        },
      }
    );

    console.log("✅ Room blockeds cleared:", {
      matched: roomsResult.matchedCount,
      modified: roomsResult.modifiedCount,
    });

    /**
     * 3) حذف أو تعطيل BannedDevice
     * لو موديل BannedDevice عندك فيه isActive استخدم updateMany
     * لو لا يوجد isActive، استخدم deleteMany
     */
    try {
      const bannedDeviceResult = await BannedDevice.deleteMany({});

      console.log("✅ BannedDevice cleared:", {
        deleted: bannedDeviceResult.deletedCount,
      });
    } catch (error: any) {
      console.log("⚠️ BannedDevice skipped:", error?.message || error);
    }

    console.log("======================================");
    console.log("✅ ALL BLOCKS HAVE BEEN REMOVED");
    console.log("======================================");
  } catch (error: any) {
    console.error("❌ unblock-all failed:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected");
  }
}

main();