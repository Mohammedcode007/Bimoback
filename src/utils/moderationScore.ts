// src/utils/moderationScore.ts
import { ReportReason } from "../models/Report";

export function getBaseReasonScore(reason: ReportReason): number {
  switch (reason) {
    case "spam":
      return 20;
    case "fake_account":
      return 30;
    case "scam":
      return 45;
    case "harassment":
      return 45;
    case "sexual":
      return 60;
    case "violence":
      return 70;
    case "hate":
      return 75;
    case "other":
    default:
      return 10;
  }
}

export function getAutoActionFromScore(score: number) {
  if (score >= 90) return "ban_device_and_account";
  if (score >= 75) return "ban_account";
  if (score >= 60) return "mute_24h_and_hide_content";
  if (score >= 40) return "hide_content";
  return "none";
}