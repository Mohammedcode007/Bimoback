// src/utils/deviceFingerprint.ts
import crypto from "crypto";

type DevicePayload = {
  installationId?: string;
  platform?: string;
  brand?: string;
  modelName?: string;
  osName?: string;
  osVersion?: string;
};

export function buildDeviceFingerprint(input: DevicePayload) {
  const raw = [
    input.installationId || "",
    input.platform || "",
    input.brand || "",
    input.modelName || "",
    input.osName || "",
    input.osVersion || "",
  ].join("|");

  return crypto.createHash("sha256").update(raw).digest("hex");
}