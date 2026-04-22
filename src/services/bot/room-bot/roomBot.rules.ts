import Room from "../../../models/Room";

export type RoomBotRole = "creator" | "owner" | "admin" | "member" | "none";

export type RoomBotAction =
  | "welcome_toggle"
  | "lock_toggle"
  | "antispam_toggle"
  | "slow_mode"
  | "kick_user"
  | "ban_user"
  | "mute_user"
  | "unmute_user"
  | "set_role"
  | "unknown";

function asStringId(value: any) {
  return String(value?.toString?.() ?? value ?? "");
}

function containsId(list: any[] = [], userId: string) {
  const uid = String(userId);
  return Array.isArray(list) && list.some((item) => asStringId(item) === uid);
}

export function getRoomUserRole(room: any, userId: string): RoomBotRole {
  if (!room || !userId) return "none";

  const uid = String(userId);

  if (asStringId(room.creator) === uid) return "creator";
  if (containsId(room.owners, uid)) return "owner";
  if (containsId(room.admins, uid)) return "admin";
  if (containsId(room.members, uid)) return "member";

  return "none";
}

export function isUserInsideRoom(room: any, userId: string) {
  return containsId(room?.activeUsers || [], userId);
}

export function isRoomBotEnabled(room: any) {
  return Boolean(room?.roomBot?.enabled);
}

export function getRoomBotLanguage(room: any): "ar" | "en" {
  const lang = room?.roomBot?.language;
  return lang === "en" ? "en" : "ar";
}

export function canUseRoomBot(room: any, userId: string) {
  if (!room) {
    return {
      ok: false,
      reason: "ROOM_NOT_FOUND",
      role: "none" as RoomBotRole,
    };
  }

  if (!isRoomBotEnabled(room)) {
    return {
      ok: false,
      reason: "ROOM_BOT_DISABLED",
      role: getRoomUserRole(room, userId),
    };
  }

  const role = getRoomUserRole(room, userId);
  const inside = isUserInsideRoom(room, userId);

  if (!inside && role === "none") {
    return {
      ok: false,
      reason: "NOT_IN_ROOM",
      role,
    };
  }

  return {
    ok: true,
    reason: null,
    role,
  };
}

export function roleRank(role: RoomBotRole) {
  const map: Record<RoomBotRole, number> = {
    none: 0,
    member: 1,
    admin: 2,
    owner: 3,
    creator: 4,
  };

  return map[role] ?? 0;
}

export function canRunActionByRole(role: RoomBotRole, action: RoomBotAction) {
  if (role === "creator") return true;

  if (role === "owner") {
    return [
      "welcome_toggle",
      "lock_toggle",
      "antispam_toggle",
      "slow_mode",
      "kick_user",
      "ban_user",
      "mute_user",
      "unmute_user",
      "set_role",
    ].includes(action);
  }

  if (role === "admin") {
    return [
      "welcome_toggle",
      "slow_mode",
      "kick_user",
      "ban_user",
      "mute_user",
      "unmute_user",
    ].includes(action);
  }

  if (role === "member") {
    return false;
  }

  return false;
}

export function canTargetUser(room: any, actorId: string, targetId: string, action: RoomBotAction) {
  const actorRole = getRoomUserRole(room, actorId);
  const targetRole = getRoomUserRole(room, targetId);

  if (targetRole === "none") {
    return {
      ok: false,
      reason: "TARGET_NOT_IN_ROOM",
      actorRole,
      targetRole,
    };
  }

  if (actorId === targetId) {
    return {
      ok: false,
      reason: "CANNOT_TARGET_SELF",
      actorRole,
      targetRole,
    };
  }

  if (actorRole === "none") {
    return {
      ok: false,
      reason: "ACTOR_NOT_ALLOWED",
      actorRole,
      targetRole,
    };
  }

  if (targetRole === "creator" && actorRole !== "creator") {
    return {
      ok: false,
      reason: "CANNOT_TARGET_CREATOR",
      actorRole,
      targetRole,
    };
  }

  if (actorRole === "creator") {
    return {
      ok: true,
      reason: null,
      actorRole,
      targetRole,
    };
  }

  if (actorRole === "owner") {
    if (targetRole === "owner") {
      return {
        ok: false,
        reason: "OWNER_CANNOT_TARGET_OWNER",
        actorRole,
        targetRole,
      };
    }

    return {
      ok: true,
      reason: null,
      actorRole,
      targetRole,
    };
  }

  if (actorRole === "admin") {
    if (["creator", "owner", "admin"].includes(targetRole)) {
      return {
        ok: false,
        reason: "ADMIN_CANNOT_TARGET_HIGHER_OR_EQUAL",
        actorRole,
        targetRole,
      };
    }

    if (action === "set_role") {
      return {
        ok: false,
        reason: "ADMIN_CANNOT_SET_ROLE",
        actorRole,
        targetRole,
      };
    }

    return {
      ok: true,
      reason: null,
      actorRole,
      targetRole,
    };
  }

  return {
    ok: false,
    reason: "ACTOR_NOT_ALLOWED",
    actorRole,
    targetRole,
  };
}

export function validateRoleAssignment(
  room: any,
  actorId: string,
  targetId: string,
  newRole: "owner" | "admin" | "member"
) {
  const actorRole = getRoomUserRole(room, actorId);
  const targetRole = getRoomUserRole(room, targetId);

  if (actorId === targetId) {
    return {
      ok: false,
      reason: "CANNOT_CHANGE_SELF_ROLE",
      actorRole,
      targetRole,
    };
  }

  if (targetRole === "creator") {
    return {
      ok: false,
      reason: "CANNOT_CHANGE_CREATOR_ROLE",
      actorRole,
      targetRole,
    };
  }

  if (actorRole === "creator") {
    return {
      ok: true,
      reason: null,
      actorRole,
      targetRole,
    };
  }

  if (actorRole === "owner") {
    if (newRole === "owner") {
      return {
        ok: false,
        reason: "OWNER_CANNOT_PROMOTE_TO_OWNER",
        actorRole,
        targetRole,
      };
    }

    if (targetRole === "owner") {
      return {
        ok: false,
        reason: "OWNER_CANNOT_CHANGE_OWNER",
        actorRole,
        targetRole,
      };
    }

    return {
      ok: true,
      reason: null,
      actorRole,
      targetRole,
    };
  }

  return {
    ok: false,
    reason: "ONLY_CREATOR_OR_OWNER_CAN_SET_ROLE",
    actorRole,
    targetRole,
  };
}

export function getRuleFailureMessage(reason: string, lang: "ar" | "en" = "ar") {
  const ar: Record<string, string> = {
    ROOM_NOT_FOUND: "الغرفة غير موجودة.",
    ROOM_BOT_DISABLED: "بوت الغرفة غير مفعل.",
    NOT_IN_ROOM: "يجب أن تكون داخل الغرفة لاستخدام هذا الأمر.",
    ACTOR_NOT_ALLOWED: "غير مسموح لك بتنفيذ هذا الأمر.",
    TARGET_NOT_IN_ROOM: "المستخدم الهدف ليس عضوًا في الغرفة.",
    CANNOT_TARGET_SELF: "لا يمكنك تنفيذ هذا الأمر على نفسك.",
    CANNOT_TARGET_CREATOR: "لا يمكن استهداف منشئ الغرفة.",
    OWNER_CANNOT_TARGET_OWNER: "المالك لا يمكنه استهداف مالك آخر.",
    ADMIN_CANNOT_TARGET_HIGHER_OR_EQUAL: "الأدمن لا يمكنه استهداف أدمن أو مالك أو منشئ.",
    ADMIN_CANNOT_SET_ROLE: "الأدمن لا يمكنه تغيير الرتب.",
    CANNOT_CHANGE_SELF_ROLE: "لا يمكنك تغيير رتبتك بنفسك.",
    CANNOT_CHANGE_CREATOR_ROLE: "لا يمكن تغيير رتبة منشئ الغرفة.",
    OWNER_CANNOT_PROMOTE_TO_OWNER: "المالك لا يمكنه ترقية مستخدم إلى مالك.",
    OWNER_CANNOT_CHANGE_OWNER: "المالك لا يمكنه تغيير رتبة مالك آخر.",
    ONLY_CREATOR_OR_OWNER_CAN_SET_ROLE: "فقط المنشئ أو المالك يمكنه تغيير الرتب.",
    UNKNOWN: "تم رفض الأمر.",
  };

  const en: Record<string, string> = {
    ROOM_NOT_FOUND: "Room not found.",
    ROOM_BOT_DISABLED: "Room bot is not enabled.",
    NOT_IN_ROOM: "You must be inside the room to use this command.",
    ACTOR_NOT_ALLOWED: "You are not allowed to run this command.",
    TARGET_NOT_IN_ROOM: "Target user is not in the room.",
    CANNOT_TARGET_SELF: "You cannot target yourself.",
    CANNOT_TARGET_CREATOR: "Cannot target the room creator.",
    OWNER_CANNOT_TARGET_OWNER: "Owner cannot target another owner.",
    ADMIN_CANNOT_TARGET_HIGHER_OR_EQUAL: "Admin cannot target admin, owner, or creator.",
    ADMIN_CANNOT_SET_ROLE: "Admin cannot change roles.",
    CANNOT_CHANGE_SELF_ROLE: "You cannot change your own role.",
    CANNOT_CHANGE_CREATOR_ROLE: "Cannot change creator role.",
    OWNER_CANNOT_PROMOTE_TO_OWNER: "Owner cannot promote someone to owner.",
    OWNER_CANNOT_CHANGE_OWNER: "Owner cannot change another owner.",
    ONLY_CREATOR_OR_OWNER_CAN_SET_ROLE: "Only creator or owner can change roles.",
    UNKNOWN: "Command rejected.",
  };

  return lang === "en"
    ? en[reason] || en.UNKNOWN
    : ar[reason] || ar.UNKNOWN;
}

export async function loadRoomForBot(roomId: string) {
  return Room.findById(roomId).select(
    "creator owners admins members activeUsers roomBot isLocked mutedUsers blockeds"
  );
}