// src/middlewares/upload.middleware.ts

import multer from "multer";
import type { Request } from "express";
import path from "path";

const storage = multer.memoryStorage();

const allowedMimeTypes = [
  // images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",

  // videos
  "video/mp4",
  "video/webm",
  "video/quicktime",

  // audio
  "audio/m4a",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-caf",
  "audio/3gpp",
  "audio/amr",

  // files
  "application/pdf",
];

const allowedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",

  ".mp4",
  ".webm",
  ".mov",

  ".m4a",
  ".aac",
  ".mp3",
  ".wav",
  ".caf",
  ".3gp",
  ".amr",

  ".pdf",
];

function fileFilter(
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const traceId = `upload-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;

  const mimetype = String(file.mimetype || "").toLowerCase().trim();
  const originalname = String(file.originalname || "");
  const ext = path.extname(originalname).toLowerCase().trim();

  const mimeAllowed = allowedMimeTypes.includes(mimetype);
  const extAllowed = allowedExtensions.includes(ext);

  console.log("========================================");
  console.log("📥 [upload.middleware][START]", {
    traceId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
  });

  console.log("📦 [upload.middleware][FILE]", {
    traceId,
    fieldname: file.fieldname,
    originalname: file.originalname,
    encoding: file.encoding,
    mimetype: file.mimetype,
    normalizedMimeType: mimetype,
    extension: ext,
    size: file.size,
  });

  console.log("🧪 [upload.middleware][CHECK]", {
    traceId,
    mimeAllowed,
    extAllowed,
    allowedBy: mimeAllowed ? "mime" : extAllowed ? "extension" : "none",
    allowedMimeTypes,
    allowedExtensions,
  });

  if (!mimeAllowed && !extAllowed) {
    console.log("❌ [upload.middleware][REJECTED]", {
      traceId,
      reason: "Unsupported file type",
      mimetype,
      ext,
      originalname,
    });

    console.log("========================================");

    return cb(
      new Error(`Unsupported file type: ${mimetype || "unknown"} ${ext}`)
    );
  }

  console.log("✅ [upload.middleware][ACCEPTED]", {
    traceId,
    mimetype,
    ext,
    originalname,
  });

  console.log("========================================");

  cb(null, true);
}

export const uploadSingleFile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
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