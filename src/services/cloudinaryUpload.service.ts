// src/services/cloudinaryUpload.service.ts

import { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { Readable } from "stream";
import cloudinary from "../config/cloudinary";

export type CloudinaryUploadResult = {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
};

function bufferToStream(buffer: Buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export function getResourceType(mimeType: string): "image" | "video" | "raw" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "video";

  return "raw";
}

export function uploadBufferToCloudinary(
  file: Express.Multer.File,
  options: UploadApiOptions = {}
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const resourceType = getResourceType(file.mimetype);

    const uploadOptions: UploadApiOptions = {
      resource_type: resourceType,
      folder: options.folder || "bimo/uploads",
      use_filename: false,
      unique_filename: true,
      overwrite: false,
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result?: UploadApiResponse) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Cloudinary upload failed"));
        }

        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          duration: result.duration,
        });
      }
    );

    bufferToStream(file.buffer).pipe(uploadStream);
  });
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
) {
  if (!publicId) return null;

  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}