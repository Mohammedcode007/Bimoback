import Room from "../../../models/Room";
import roomService from "../../room.service";
import { handleRoomAgentCommand } from "./roomAgent.commands";


type HandleRoomAgentMessageInput = {
  roomId: string;
  content: string;
};

type HandleRoomAgentMessageResult = {
  handled: boolean;
  success?: boolean;
  message?: string;
  meta?: Record<string, any>;
};

class RoomAgentService {
  /* =====================================================
     HELPERS
  ===================================================== */

  private normalizeText(value?: string) {
    return String(value || "").trim();
  }

  private async sendSystemMessage(
    roomId: string,
    text: string,
    type: "system" | "announcement" = "system",
    extra: Record<string, any> = {}
  ) {
    return roomService["system"]?.(roomId, text, type, {
      systemType: "room_agent",
      ...extra,
    });
  }

  private looksLikeAgentCommand(text?: string) {
    const value = this.normalizeText(text);
    if (!value) return false;

    const parts = value.split("@").map((p) => p.trim()).filter(Boolean);

    // exit@username@room
    if (parts.length === 3 && parts[0].toLowerCase() === "exit") {
      return true;
    }

    // username@password@room
    if (parts.length === 3 && parts[0].toLowerCase() !== "botleave") {
      return true;
    }

    return false;
  }

  /* =====================================================
     ROOM AGENT STATE
  ===================================================== */

  async getRoomAgentState(roomId: string) {
    const room = await Room.findById(roomId).select("name roomAgent");
    if (!room) return null;

    return {
      roomId: String(room._id),
      roomName: String((room as any).name || ""),
      enabled: Boolean((room as any)?.roomAgent?.enabled),
      userId: (room as any)?.roomAgent?.userId
        ? String((room as any).roomAgent.userId)
        : null,
      username: (room as any)?.roomAgent?.username || null,
      joinedAt: (room as any)?.roomAgent?.joinedAt || null,
    };
  }

  async hasAgent(roomId: string) {
    const state = await this.getRoomAgentState(roomId);
    return Boolean(state?.enabled && state?.userId);
  }

  async getAgentUserId(roomId: string) {
    const state = await this.getRoomAgentState(roomId);
    return state?.userId || null;
  }

  /* =====================================================
     LINK / UNLINK
  ===================================================== */

  async unlinkAgentFromRoom(roomId: string) {
    await Room.updateOne(
      { _id: roomId },
      {
        $set: {
          "roomAgent.enabled": false,
          "roomAgent.userId": null,
          "roomAgent.username": null,
          "roomAgent.joinedAt": null,
        },
      }
    );

    return { success: true };
  }

  async setAgentForRoom(params: {
    roomId: string;
    userId: string;
    username: string;
  }) {
    const { roomId, userId, username } = params;

    await Room.updateOne(
      { _id: roomId },
      {
        $set: {
          "roomAgent.enabled": true,
          "roomAgent.userId": userId,
          "roomAgent.username": username,
          "roomAgent.joinedAt": new Date(),
        },
      }
    );

    return { success: true };
  }

  /* =====================================================
     MAIN ENTRY
  ===================================================== */

  async handleIncomingRoomMessage(
    input: HandleRoomAgentMessageInput
  ): Promise<HandleRoomAgentMessageResult> {
    const { roomId, content } = input;

    const text = this.normalizeText(content);

    if (!this.looksLikeAgentCommand(text)) {
      return { handled: false };
    }

    const result = await handleRoomAgentCommand({
      roomId,
      raw: text,
    });

    if (result.handled && result.message) {
      await this.sendSystemMessage(roomId, result.message, "system", {
        action: result?.meta?.action || "room_agent:command",
        meta: result?.meta || {},
      });
    }

    return result;
  }

  /* =====================================================
     OPTIONAL STATUS MESSAGE
  ===================================================== */

  async sendStatusMessage(roomId: string) {
    const state = await this.getRoomAgentState(roomId);

    if (!state) {
      return { sent: false, reason: "room_not_found" };
    }

    const text = state.enabled && state.userId
      ? `Room Agent status:
- enabled: yes
- username: ${state.username}
- joinedAt: ${state.joinedAt || "unknown"}`
      : `Room Agent status:
- enabled: no
- username: none`;

    await this.sendSystemMessage(roomId, text, "system", {
      action: "room_agent:status",
    });

    return { sent: true };
  }

  /* =====================================================
     CLEANUP HELPERS
  ===================================================== */

  async ensureConsistency(roomId: string) {
    const room = await Room.findById(roomId).select("roomAgent activeUsers");
    if (!room) {
      return { success: false, reason: "room_not_found" };
    }

    const enabled = Boolean((room as any)?.roomAgent?.enabled);
    const userId = (room as any)?.roomAgent?.userId
      ? String((room as any).roomAgent.userId)
      : null;

    if (!enabled || !userId) {
      return { success: true, consistent: true };
    }

    const activeUsers = Array.isArray((room as any)?.activeUsers)
      ? (room as any).activeUsers.map((x: any) => String(x))
      : [];

    const inside = activeUsers.includes(userId);

    if (!inside) {
      await this.unlinkAgentFromRoom(roomId);

      await this.sendSystemMessage(
        roomId,
        `تم فصل ربط الحساب الصامت لأن الحساب لم يعد داخل الغرفة.`,
        "system",
        {
          action: "room_agent:auto_unlink",
          userId,
        }
      );

      return {
        success: true,
        consistent: false,
        fixed: true,
      };
    }

    return {
      success: true,
      consistent: true,
    };
  }
}

export default new RoomAgentService();