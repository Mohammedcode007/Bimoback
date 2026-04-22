import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import StoreItem from "../models/StoreItem";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";
const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

type BadgeSeed = {
  type: "badge";
  key: string;
  name: string;
  description: string;
  priceCoinz: number;
  isActive: boolean;
  isConsumable: boolean;
  isStackable: boolean;
  durationDays: number;
  meta: {
    lottieUrl: string;
    iconUrl: string;
    previewUrl: string;
    isAnimated: boolean;
    rarity: "common" | "rare" | "epic" | "legendary";
  };
};

const badgesDir = path.join(process.cwd(), "public", "uploads", "badges");

function ensureMongoUri() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is missing in .env");
  }
}

function ensureBadgesDir() {
  if (!fs.existsSync(badgesDir)) {
    throw new Error(`Badges directory not found: ${badgesDir}`);
  }
}

function getJsonFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
}

function fileNameToKey(fileName: string): string {
  return fileName
    .replace(/\.json$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function fileNameToTitle(fileName: string): string {
  const base = fileName.replace(/\.json$/i, "").trim();
  return base
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferRarity(index: number): "common" | "rare" | "epic" | "legendary" {
  if (index % 10 === 0) return "legendary";
  if (index % 5 === 0) return "epic";
  if (index % 3 === 0) return "rare";
  return "common";
}

function buildBadge(fileName: string, index: number): BadgeSeed {
  const key = fileNameToKey(fileName);
  const title = fileNameToTitle(fileName);
  const publicUrl = `${APP_BASE_URL}/uploads/badges/${encodeURIComponent(fileName)}`;

  return {
    type: "badge",
    key,
    name: title,
    description: `شارة متحركة ${title}`,
    priceCoinz: 2000,
    isActive: true,
    isConsumable: false,
    isStackable: false,
    durationDays: 30,
    meta: {
      lottieUrl: publicUrl,
      iconUrl: publicUrl,
      previewUrl: publicUrl,
      isAnimated: true,
      rarity: inferRarity(index),
    },
  };
}

async function seedStoreBadges() {
  ensureMongoUri();
  ensureBadgesDir();

  const jsonFiles = getJsonFiles(badgesDir);

  if (!jsonFiles.length) {
    throw new Error(`No .json badge files found in: ${badgesDir}`);
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅ Mongo connected");

  let created = 0;
  let updated = 0;

  for (let i = 0; i < jsonFiles.length; i++) {
    const fileName = jsonFiles[i];
    const badge = buildBadge(fileName, i + 1);

    const existing = await StoreItem.findOne({ key: badge.key });

    if (existing) {
      await StoreItem.updateOne(
        { key: badge.key },
        { $set: badge }
      );
      updated++;
      console.log(`🔄 Updated badge: ${badge.key}`);
    } else {
      await StoreItem.create(badge);
      created++;
      console.log(`✅ Created badge: ${badge.key}`);
    }
  }

  console.log("🎉 Badge seeding completed");
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);

  await mongoose.disconnect();
  console.log("✅ Mongo disconnected");
}


seedStoreBadges()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("❌ Seed failed:", error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });