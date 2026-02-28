// config/appVersionConfig.ts
export const APP_VERSION_CONFIG = {
  android: {
    latestVersion: "1.0.0",
    minSupportedVersion: "1.0.0", // ✅ يسمح لنسخة 1.0.0 بالدخول
    storeUrl: "https://play.google.com/store/apps/details?id=com.bimochat.app",
  },
  ios: {
    latestVersion: "1.0.0",
    minSupportedVersion: "1.0.0",
    storeUrl: "https://apps.apple.com/app/idXXXXXXXXX",
  },
  message: {
    ar: "يوجد تحديث إلزامي لتطبيق بيمو شات. يرجى التحديث للمتابعة.",
    en: "A mandatory update is required. Please update to continue.",
  },
};