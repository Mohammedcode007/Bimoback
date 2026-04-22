

import { BotLang, BotReplyPayload } from "../core/bot.types";
import {
  getRoomBotCommandRejectedReply,
  getRoomBotCommandSuccessReply,
  getRoomBotNotEnabledReply,
  getRoomBotUnknownCommandReply,
  getWelcomeToggleReply,
  pickText,
} from "../core/bot.replies";
import User from "../../../models/User";
import Room from "../../../models/Room";
import roomService from "../../room.service";

type ParsedRoomBotAction =
  | { action: "welcome_toggle"; enabled: boolean }
  | { action: "lock_toggle"; enabled: boolean }
  | { action: "antispam_toggle"; enabled: boolean }
  | { action: "slow_mode"; seconds: number }
  | { action: "kick_user"; username: string }
  | { action: "ban_user"; username: string; reason?: string }
  | { action: "mute_user"; username: string; minutes: number; reason?: string }
  | { action: "unmute_user"; username: string }
  | { action: "set_role"; username: string; role: "owner" | "admin" | "member" }
  | { action: "unknown" };

function normalizeText(value?: string) {
  return String(value || "").trim();
}

function normalizeAtUsername(value?: string) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function parseOnOff(value?: string): boolean | null {
  const v = normalizeText(value).toLowerCase();

  if (["on", "true", "1", "enable", "enabled"].includes(v)) return true;
  if (["off", "false", "0", "disable", "disabled"].includes(v)) return false;

  if (["تشغيل", "شغل", "فتح", "تفعيل"].includes(v)) return true;
  if (["ايقاف", "إيقاف", "قفل", "تعطيل"].includes(v)) return false;

  return null;
}

async function findUserByMentionOrUsername(usernameOrMention: string) {
  const atUsername = normalizeAtUsername(usernameOrMention);
  if (!atUsername) return null;

  return User.findOne({ atUsername }).select("_id username atUsername");
}

function parseRoomBotRawCommand(raw: string): ParsedRoomBotAction {
  const text = normalizeText(raw);
  const parts = text.split(/\s+/).filter(Boolean);

  if (!parts.length || !parts[0].startsWith("!")) {
    return { action: "unknown" };
  }

  const command = parts[0].toLowerCase();

  /* ===============================
     !welcome on/off
  =============================== */
  if (command === "!welcome") {
    const enabled = parseOnOff(parts[1]);
    if (enabled === null) return { action: "unknown" };
    return { action: "welcome_toggle", enabled };
  }

  /* ===============================
     !lock on/off
  =============================== */
  if (command === "!lock") {
    const enabled = parseOnOff(parts[1]);
    if (enabled === null) return { action: "unknown" };
    return { action: "lock_toggle", enabled };
  }

  /* ===============================
     !antispam on/off
  =============================== */
  if (command === "!antispam") {
    const enabled = parseOnOff(parts[1]);
    if (enabled === null) return { action: "unknown" };
    return { action: "antispam_toggle", enabled };
  }

  /* ===============================
     !slow 10
  =============================== */
  if (command === "!slow") {
    const seconds = Number(parts[1] || 0);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return { action: "unknown" };
    }
    return { action: "slow_mode", seconds };
  }

  /* ===============================
     !kick @username
  =============================== */
  if (command === "!kick") {
    const username = parts[1];
    if (!username) return { action: "unknown" };
    return {
      action: "kick_user",
      username,
    };
  }

  /* ===============================
     !ban @username [reason...]
  =============================== */
  if (command === "!ban") {
    const username = parts[1];
    if (!username) return { action: "unknown" };

    const reason = parts.slice(2).join(" ").trim() || undefined;

    return {
      action: "ban_user",
      username,
      reason,
    };
  }

  /* ===============================
     !mute @username 10 [reason...]
  =============================== */
  if (command === "!mute") {
    const username = parts[1];
    const minutes = Number(parts[2] || 0);

    if (!username || !Number.isFinite(minutes) || minutes <= 0) {
      return { action: "unknown" };
    }

    const reason = parts.slice(3).join(" ").trim() || undefined;

    return {
      action: "mute_user",
      username,
      minutes,
      reason,
    };
  }

  /* ===============================
     !unmute @username
  =============================== */
  if (command === "!unmute") {
    const username = parts[1];
    if (!username) return { action: "unknown" };

    return {
      action: "unmute_user",
      username,
    };
  }

  /* ===============================
     !role @username admin/owner/member
  =============================== */
  if (command === "!role") {
    const username = parts[1];
    const roleRaw = normalizeText(parts[2]).toLowerCase();

    if (!username) return { action: "unknown" };

    let role: "owner" | "admin" | "member" | null = null;

    if (["owner", "مالك"].includes(roleRaw)) role = "owner";
    else if (["admin", "أدمن", "ادمن"].includes(roleRaw)) role = "admin";
    else if (["member", "عضو"].includes(roleRaw)) role = "member";

    if (!role) return { action: "unknown" };

    return {
      action: "set_role",
      username,
      role,
    };
  }

  return { action: "unknown" };
}

async function ensureRoomBotEnabled(roomId: string) {
  const room = await Room.findById(roomId).select("roomBot");
  if (!room) {
    throw new Error("Room not found");
  }

  const enabled = (room as any)?.roomBot?.enabled;
  if (!enabled) {
    throw new Error("ROOM_BOT_DISABLED");
  }

  return room;
}

export async function executeRoomBotCommand(params: {
  roomId: string;
  actorId: string;
  raw: string;
  lang: BotLang;
}): Promise<BotReplyPayload> {
  const { roomId, actorId, raw, lang } = params;

  try {
    await ensureRoomBotEnabled(roomId);

    const parsed = parseRoomBotRawCommand(raw);

    if (parsed.action === "unknown") {
      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotUnknownCommandReply(lang),
      };
    }

    /* ===============================
       welcome on/off
    =============================== */
    if (parsed.action === "welcome_toggle") {
      await Room.updateOne(
        { _id: roomId },
        { $set: { "roomBot.welcomeEnabled": parsed.enabled } }
      );

      return {
        handled: true,
        intent: "room_bot_command",
        text: getWelcomeToggleReply(lang, parsed.enabled),
        meta: {
          action: "welcome_toggle",
          enabled: parsed.enabled,
        },
      };
    }

    /* ===============================
       lock on/off
    =============================== */
    if (parsed.action === "lock_toggle") {
      await roomService.setRoomLock(roomId, actorId, parsed.enabled);

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          parsed.enabled
            ? pickText(lang, "تشغيل قفل الغرفة", "room lock enabled")
            : pickText(lang, "إيقاف قفل الغرفة", "room lock disabled")
        ),
        meta: {
          action: "lock_toggle",
          enabled: parsed.enabled,
        },
      };
    }

    /* ===============================
       antispam on/off
    =============================== */
    if (parsed.action === "antispam_toggle") {
      await roomService.toggleAntiSpam(roomId, actorId, parsed.enabled);

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          parsed.enabled
            ? pickText(lang, "تشغيل مانع السبام", "anti-spam enabled")
            : pickText(lang, "إيقاف مانع السبام", "anti-spam disabled")
        ),
        meta: {
          action: "antispam_toggle",
          enabled: parsed.enabled,
        },
      };
    }

    /* ===============================
       slow mode
    =============================== */
    if (parsed.action === "slow_mode") {
      await roomService.setSlowMode(roomId, actorId, parsed.seconds);

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          pickText(
            lang,
            `تفعيل الوضع البطيء ${parsed.seconds} ثانية`,
            `slow mode set to ${parsed.seconds} seconds`
          )
        ),
        meta: {
          action: "slow_mode",
          seconds: parsed.seconds,
        },
      };
    }

    /* ===============================
       kick
    =============================== */
    if (parsed.action === "kick_user") {
      const user = await findUserByMentionOrUsername(parsed.username);
      if (!user) {
        return {
          handled: true,
          intent: "room_bot_command",
          text: pickText(
            lang,
            `المستخدم غير موجود: ${normalizeAtUsername(parsed.username)}`,
            `User not found: ${normalizeAtUsername(parsed.username)}`
          ),
        };
      }

      await roomService.kickUser(roomId, actorId, String(user._id));

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          pickText(lang, `طرد ${user.username}`, `kicked ${user.username}`)
        ),
        meta: {
          action: "kick_user",
          targetId: String(user._id),
          targetUsername: user.username,
        },
      };
    }

    /* ===============================
       ban
    =============================== */
    if (parsed.action === "ban_user") {
      const user = await findUserByMentionOrUsername(parsed.username);
      if (!user) {
        return {
          handled: true,
          intent: "room_bot_command",
          text: pickText(
            lang,
            `المستخدم غير موجود: ${normalizeAtUsername(parsed.username)}`,
            `User not found: ${normalizeAtUsername(parsed.username)}`
          ),
        };
      }

      await roomService.banUser(
        roomId,
        actorId,
        String(user._id),
        parsed.reason || pickText(lang, "تم الحظر بواسطة البوت", "Banned by room bot")
      );

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          pickText(lang, `حظر ${user.username}`, `banned ${user.username}`)
        ),
        meta: {
          action: "ban_user",
          targetId: String(user._id),
          targetUsername: user.username,
        },
      };
    }

    /* ===============================
       mute
    =============================== */
    if (parsed.action === "mute_user") {
      const user = await findUserByMentionOrUsername(parsed.username);
      if (!user) {
        return {
          handled: true,
          intent: "room_bot_command",
          text: pickText(
            lang,
            `المستخدم غير موجود: ${normalizeAtUsername(parsed.username)}`,
            `User not found: ${normalizeAtUsername(parsed.username)}`
          ),
        };
      }

      await roomService.muteUser(
        roomId,
        actorId,
        String(user._id),
        parsed.minutes,
        parsed.reason || pickText(lang, "تم الكتم بواسطة البوت", "Muted by room bot")
      );

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          pickText(
            lang,
            `كتم ${user.username} لمدة ${parsed.minutes} دقيقة`,
            `muted ${user.username} for ${parsed.minutes} minute(s)`
          )
        ),
        meta: {
          action: "mute_user",
          targetId: String(user._id),
          targetUsername: user.username,
          minutes: parsed.minutes,
        },
      };
    }

    /* ===============================
       unmute
    =============================== */
    if (parsed.action === "unmute_user") {
      const user = await findUserByMentionOrUsername(parsed.username);
      if (!user) {
        return {
          handled: true,
          intent: "room_bot_command",
          text: pickText(
            lang,
            `المستخدم غير موجود: ${normalizeAtUsername(parsed.username)}`,
            `User not found: ${normalizeAtUsername(parsed.username)}`
          ),
        };
      }

      await roomService.unmuteUser(roomId, actorId, String(user._id));

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          pickText(lang, `إلغاء كتم ${user.username}`, `unmuted ${user.username}`)
        ),
        meta: {
          action: "unmute_user",
          targetId: String(user._id),
          targetUsername: user.username,
        },
      };
    }

    /* ===============================
       role
    =============================== */
    if (parsed.action === "set_role") {
      const user = await findUserByMentionOrUsername(parsed.username);
      if (!user) {
        return {
          handled: true,
          intent: "room_bot_command",
          text: pickText(
            lang,
            `المستخدم غير موجود: ${normalizeAtUsername(parsed.username)}`,
            `User not found: ${normalizeAtUsername(parsed.username)}`
          ),
        };
      }

      await roomService.setUserRole(
        roomId,
        actorId,
        String(user._id),
        parsed.role
      );

      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotCommandSuccessReply(
          lang,
          pickText(
            lang,
            `تعيين ${user.username} كـ ${parsed.role}`,
            `set ${user.username} as ${parsed.role}`
          )
        ),
        meta: {
          action: "set_role",
          targetId: String(user._id),
          targetUsername: user.username,
          role: parsed.role,
        },
      };
    }

    return {
      handled: true,
      intent: "room_bot_command",
      text: getRoomBotUnknownCommandReply(lang),
    };
  } catch (error: any) {
    if (String(error?.message || "") === "ROOM_BOT_DISABLED") {
      return {
        handled: true,
        intent: "room_bot_command",
        text: getRoomBotNotEnabledReply(lang),
      };
    }

    return {
      handled: true,
      intent: "room_bot_command",
      text: getRoomBotCommandRejectedReply(lang, error?.message),
      meta: {
        error: error?.message || "Unknown error",
      },
    };
  }
}