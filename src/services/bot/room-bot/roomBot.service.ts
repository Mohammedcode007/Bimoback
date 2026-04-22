

import { BotLang } from "../core/bot.types";
import { pickText } from "../core/bot.replies";

import { executeRoomBotCommand } from "./roomBot.commands";
import {
  canUseRoomBot,
  getRoomBotLanguage,
  getRuleFailureMessage,
  isRoomBotEnabled,
  loadRoomForBot,
} from "./roomBot.rules";
import Room from "../../../models/Room";
import roomService from "../../room.service";

type HandleRoomBotMessageParams = {
  roomId: string;
  actorId: string;
  content: string;
};

type WelcomeParams = {
  roomId: string;
  joinedUserId: string;
};

class RoomBotService {
  /* =====================================================
     HELPERS
  ===================================================== */

  private normalizeText(value?: string) {
    return String(value || "").trim();
  }

  private isCommandMessage(text?: string) {
    return this.normalizeText(text).startsWith("!");
  }

  private async getRoomBotState(roomId: string) {
    const room = await Room.findById(roomId).select("roomBot name");
    if (!room) return null;

    return {
      room,
      enabled: Boolean((room as any)?.roomBot?.enabled),
      welcomeEnabled: Boolean((room as any)?.roomBot?.welcomeEnabled),
      language: (((room as any)?.roomBot?.language === "en"
        ? "en"
        : "ar") as BotLang),
      roomName: String((room as any)?.name || ""),
    };
  }

  private async sendBotSystemMessage(
    roomId: string,
    text: string,
    type: "system" | "announcement" = "system",
    extra: Record<string, any> = {}
  ) {
    return roomService["system"]?.(roomId, text, type, {
      systemType: "room_bot",
      ...extra,
    });
  }

  /* =====================================================
     PUBLIC CHECKS
  ===================================================== */

  async isEnabled(roomId: string) {
    const room = await Room.findById(roomId).select("roomBot");
    if (!room) return false;
    return isRoomBotEnabled(room);
  }

  async getLanguage(roomId: string): Promise<BotLang> {
    const room = await Room.findById(roomId).select("roomBot");
    if (!room) return "ar";
    return getRoomBotLanguage(room);
  }

  /* =====================================================
     ROOM BOT COMMAND HANDLER
  ===================================================== */

  async handleIncomingRoomMessage(params: HandleRoomBotMessageParams) {
    const { roomId, actorId, content } = params;

    const text = this.normalizeText(content);
    if (!text) {
      return { handled: false };
    }

    // ليس أمرًا خاصًا ببوت الغرفة
    if (!this.isCommandMessage(text)) {
      return { handled: false };
    }

    const room = await loadRoomForBot(roomId);
    const lang = room ? getRoomBotLanguage(room) : "ar";

    const access = canUseRoomBot(room, actorId);

    if (!access.ok) {
      const message = getRuleFailureMessage(access.reason || "UNKNOWN", lang);

      await this.sendBotSystemMessage(roomId, message, "system", {
        action: "room_bot:rejected",
        actorId,
      });

      return {
        handled: true,
        ok: false,
        text: message,
      };
    }

    const result = await executeRoomBotCommand({
      roomId,
      actorId,
      raw: text,
      lang,
    });

    if (result?.text) {
      await this.sendBotSystemMessage(roomId, result.text, "system", {
        action: result?.meta?.action || "room_bot:command",
        actorId,
        meta: result?.meta || {},
      });
    }

    return {
      handled: true,
      ok: true,
      result,
    };
  }

  /* =====================================================
     WELCOME MESSAGE
  ===================================================== */

  async maybeSendWelcomeMessage(params: WelcomeParams) {
    const { roomId, joinedUserId } = params;

    const state = await this.getRoomBotState(roomId);
    if (!state || !state.enabled || !state.welcomeEnabled) {
      return { sent: false, reason: "disabled" };
    }

    const room = await Room.findById(roomId)
      .select("name roomBot")
      .populate("creator", "username");

    if (!room) {
      return { sent: false, reason: "room_not_found" };
    }

    const lang = getRoomBotLanguage(room);

    const joinedUser = await (await import("../../../models/User")).default
      .findById(joinedUserId)
      .select("username");

    const username = String((joinedUser as any)?.username || "User");
    const roomName = String((room as any)?.name || "Room");

    const text =
      lang === "en"
        ? `Welcome ${username} to ${roomName} 👋`
        : `أهلاً ${username} في غرفة ${roomName} 👋`;

    await this.sendBotSystemMessage(roomId, text, "announcement", {
      action: "room_bot:welcome",
      joinedUserId,
    });

    return { sent: true };
  }

  /* =====================================================
     TOGGLES / SETTINGS
  ===================================================== */

  async setEnabled(roomId: string, enabled: boolean) {
    await Room.updateOne(
      { _id: roomId },
      {
        $set: {
          "roomBot.enabled": Boolean(enabled),
        },
      }
    );

    return {
      success: true,
      enabled: Boolean(enabled),
    };
  }

  async setWelcomeEnabled(roomId: string, enabled: boolean) {
    await Room.updateOne(
      { _id: roomId },
      {
        $set: {
          "roomBot.welcomeEnabled": Boolean(enabled),
        },
      }
    );

    return {
      success: true,
      welcomeEnabled: Boolean(enabled),
    };
  }

  async setLanguage(roomId: string, language: BotLang) {
    const lang: BotLang = language === "en" ? "en" : "ar";

    await Room.updateOne(
      { _id: roomId },
      {
        $set: {
          "roomBot.language": lang,
        },
      }
    );

    return {
      success: true,
      language: lang,
    };
  }

  /* =====================================================
     OPTIONAL STATUS MESSAGE
  ===================================================== */

  async sendStatusMessage(roomId: string) {
    const state = await this.getRoomBotState(roomId);
    if (!state) return { sent: false, reason: "room_not_found" };

    const text = pickText(
      state.language,
      `حالة بوت الغرفة:
- التفعيل: ${state.enabled ? "مفعل" : "غير مفعل"}
- الترحيب: ${state.welcomeEnabled ? "مفعل" : "غير مفعل"}
- اللغة: ${state.language === "en" ? "الإنجليزية" : "العربية"}`,
      `Room bot status:
- enabled: ${state.enabled ? "yes" : "no"}
- welcome: ${state.welcomeEnabled ? "yes" : "no"}
- language: ${state.language}`
    );

    await this.sendBotSystemMessage(roomId, text, "system", {
      action: "room_bot:status",
    });

    return { sent: true };
  }
}

export default new RoomBotService();