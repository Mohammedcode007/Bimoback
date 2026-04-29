import crypto from "crypto";
import { Request } from "express";

export function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

export function getClientIp(req: Request) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();

  return (
    forwarded ||
    String(req.headers["x-real-ip"] || "").trim() ||
    String(req.socket.remoteAddress || "").trim()
  );
}

export function getUserAgent(req: Request) {
  return String(req.headers["user-agent"] || "").trim();
}

export function getDeviceId(req: Request) {
  return String(
    req.headers["x-device-id"] ||
      req.headers["x-installation-id"] ||
      req.body?.deviceId ||
      ""
  ).trim();
}

export function getRequestIdentity(req: Request) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const deviceId = getDeviceId(req);

  return {
    deviceId,
    ipHash: ip ? sha256(ip) : "",
    userAgentHash: userAgent ? sha256(userAgent) : "",
  };
}