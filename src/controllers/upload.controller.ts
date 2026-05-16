// src/controllers/upload.controller.ts

import { Request, Response } from "express";
import { uploadBufferToCloudinary } from "../services/cloudinaryUpload.service";

export async function uploadSingle(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const folder = String(req.body.folder || "bimo/uploads").trim();

    const uploaded = await uploadBufferToCloudinary(req.file, {
      folder,
    });

    return res.json({
      success: true,
      data: {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        format: uploaded.format,
        bytes: uploaded.bytes,
        width: uploaded.width,
        height: uploaded.height,
        duration: uploaded.duration,
      },
    });
  } catch (error: any) {
    console.error("[uploadSingle] error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Upload failed",
    });
  }
}

export async function uploadMultiple(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || !files.length) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const folder = String(req.body.folder || "bimo/uploads").trim();

    const uploadedFiles = await Promise.all(
      files.map((file) =>
        uploadBufferToCloudinary(file, {
          folder,
        })
      )
    );

    return res.json({
      success: true,
      data: uploadedFiles.map((item) => ({
        url: item.secureUrl,
        publicId: item.publicId,
        resourceType: item.resourceType,
        format: item.format,
        bytes: item.bytes,
        width: item.width,
        height: item.height,
        duration: item.duration,
      })),
    });
  } catch (error: any) {
    console.error("[uploadMultiple] error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Upload failed",
    });
  }
}