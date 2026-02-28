// routes/appConfig.routes.ts
import { Router } from "express";
import { APP_VERSION_CONFIG } from "../config/appVersionConfig";

const r = Router();

/**
 * GET /api/app/config?platform=android|ios
 */
r.get("/app/config", (req, res) => {
  const platform = String(req.query.platform || "").toLowerCase();

  console.log("====================================");
  console.log("📱 /api/app/config called");
  console.log("👉 Query platform:", platform);

  const cfg = (APP_VERSION_CONFIG as any)[platform];

  if (!cfg) {
    console.log("❌ Invalid platform received:", platform);
    console.log("====================================");

    return res.status(400).json({
      success: false,
      message: "Invalid platform. Use android or ios",
    });
  }

  console.log("✅ Config Found For Platform:", platform);
  console.log("🔢 latestVersion:", cfg.latestVersion);
  console.log("🔐 minSupportedVersion:", cfg.minSupportedVersion);
  console.log("🔗 storeUrl:", cfg.storeUrl);
  console.log("====================================");

  return res.json({
    success: true,
    platform,
    latestVersion: cfg.latestVersion,
    minSupportedVersion: cfg.minSupportedVersion,
    storeUrl: cfg.storeUrl,
    message_ar: APP_VERSION_CONFIG.message.ar,
    message_en: APP_VERSION_CONFIG.message.en,
  });
});

export default r;