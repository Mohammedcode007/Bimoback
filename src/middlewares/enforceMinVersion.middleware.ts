// middlewares/enforceMinVersion.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { APP_VERSION_CONFIG } from "../config/appVersionConfig";
import { cmpSemver } from "../utils/semver";

function normalizePlatform(p: string) {
  const v = (p || "").toLowerCase();
  if (v === "android" || v === "ios") return v;
  return "";
}

export function enforceMinVersion(req: Request, res: Response, next: NextFunction) {
  // ✅ استثناءات عامة
  if (req.path === "/" || req.path.startsWith("/health")) return next();

  // ✅ استثناء endpoint config
  if (req.path.startsWith("/api/app/config")) return next();

  // ✅ طبّق فقط على /api
  if (!req.path.startsWith("/api")) return next();

  const platform = normalizePlatform(String(req.headers["x-platform"] || ""));
  const appVersion = String(req.headers["x-app-version"] || "").trim();

  if (!platform || !appVersion) {
    return res.status(400).json({
      success: false,
      code: "MISSING_APP_VERSION_HEADERS",
      message: "Missing x-platform or x-app-version headers",
    });
  }

  const cfg = (APP_VERSION_CONFIG as any)[platform];
  if (!cfg?.minSupportedVersion) return next();

  if (cmpSemver(appVersion, cfg.minSupportedVersion) < 0) {
    return res.status(426).json({
      success: false,
      code: "FORCE_UPDATE",
      message_ar: APP_VERSION_CONFIG.message.ar,
      message_en: APP_VERSION_CONFIG.message.en,
      platform,
      currentVersion: appVersion,
      minSupportedVersion: cfg.minSupportedVersion,
      latestVersion: cfg.latestVersion,
      storeUrl: cfg.storeUrl,
    });
  }

  return next();
}