// src/middlewares/upload.middleware.ts

import multer from "multer";
import type { Request } from "express";

const storage = multer.memoryStorage();

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "application/pdf",
];

function fileFilter(
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Unsupported file type"));
  }

  cb(null, true);
}

export const uploadSingleFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
}).single("file");

export const uploadMultipleFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10,
  },
}).array("files", 10);