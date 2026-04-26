

import fs from "fs";
import path from "path";

export class CricketJsonStore {
  private ensureDir(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private ensureFile<T>(filePath: string, fallbackData: T) {
    this.ensureDir(filePath);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(
        filePath,
        JSON.stringify(fallbackData, null, 2),
        "utf-8"
      );
    }
  }

  private safeStringify(data: unknown) {
    return JSON.stringify(data, null, 2);
  }

  read<T>(filePath: string, fallbackData: T): T {
    this.ensureFile(filePath, fallbackData);

    try {
      const raw = fs.readFileSync(filePath, "utf-8");

      if (!raw || !raw.trim()) {
        this.write(filePath, fallbackData);
        return fallbackData;
      }

      return JSON.parse(raw) as T;
    } catch (error) {
      console.log("❌ cricketJsonStore.read parse error:", error);
      this.write(filePath, fallbackData);
      return fallbackData;
    }
  }

  write<T>(filePath: string, data: T) {
    this.ensureDir(filePath);

    const tempPath = `${filePath}.tmp`;
    const json = this.safeStringify(data);

    fs.writeFileSync(tempPath, json, "utf-8");
    fs.renameSync(tempPath, filePath);
  }

  update<T>(filePath: string, fallbackData: T, updater: (current: T) => T): T {
    const current = this.read<T>(filePath, fallbackData);
    const next = updater(current);
    this.write<T>(filePath, next);
    return next;
  }

  reset<T>(filePath: string, fallbackData: T) {
    this.write<T>(filePath, fallbackData);
    return fallbackData;
  }

  exists(filePath: string) {
    return fs.existsSync(filePath);
  }

  delete(filePath: string) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export const cricketJsonStore = new CricketJsonStore();