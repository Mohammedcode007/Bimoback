import path from "path";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

/**
 * مهم:
 * هذا يضمن قراءة ملف .env من جذر المشروع
 * حتى لو تم تشغيل السيرفر من مسار مختلف.
 */
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error("[Cloudinary ENV Missing]", {
    cwd: process.cwd(),
    CLOUDINARY_CLOUD_NAME: !!CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: !!CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: !!CLOUDINARY_API_SECRET,
  });

  throw new Error("Cloudinary env variables are missing");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;