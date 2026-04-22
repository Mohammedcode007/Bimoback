import { Types } from "mongoose";

/* =====================================================
   LANGUAGE
===================================================== */

export type RoomBotLang = "ar" | "en";

/* =====================================================
   USER ROLE IN ROOM
===================================================== */

export type RoomBotRole =
  | "creator"
  | "owner"
  | "admin"
  | "member"
  | "none";

/* =====================================================
   BOT ACTIONS
===================================================== */

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
  | "status"
  | "unknown";

/* =====================================================
   PARSED COMMAND STRUCTURE
===================================================== */

export type ParsedRoomBotCommand =
  | {
      action: "welcome_toggle";
      enabled: boolean;
    }
  | {
      action: "lock_toggle";
      enabled: boolean;
    }
  | {
      action: "antispam_toggle";
      enabled: boolean;
    }
  | {
      action: "slow_mode";
      seconds: number;
    }
  | {
      action: "kick_user";
      username: string;
    }
  | {
      action: "ban_user";
      username: string;
      reason?: string;
    }
  | {
      action: "mute_user";
      username: string;
      minutes: number;
      reason?: string;
    }
  | {
      action: "unmute_user";
      username: string;
    }
  | {
      action: "set_role";
      username: string;
      role: "owner" | "admin" | "member";
    }
  | {
      action: "status";
    }
  | {
      action: "unknown";
    };

/* =====================================================
   EXECUTION INPUT
===================================================== */

export type ExecuteRoomBotCommandInput = {
  roomId: string;
  actorId: string;
  raw: string;
  lang: RoomBotLang;
};

/* =====================================================
   EXECUTION RESULT
===================================================== */

export type RoomBotExecutionResult = {
  handled: boolean;
  intent: "room_bot_command";
  text?: string;
  meta?: {
    action?: RoomBotAction;
    targetId?: string;
    targetUsername?: string;
    role?: string;
    seconds?: number;
    minutes?: number;
    enabled?: boolean;
    error?: string;
    [key: string]: any;
  };
};

/* =====================================================
   ACCESS CHECK RESULT
===================================================== */

export type RoomBotAccessCheck = {
  ok: boolean;
  reason:
    | "ROOM_NOT_FOUND"
    | "ROOM_BOT_DISABLED"
    | "NOT_IN_ROOM"
    | "ACTOR_NOT_ALLOWED"
    | string
    | null;
  role: RoomBotRole;
};

/* =====================================================
   TARGET VALIDATION RESULT
===================================================== */

export type RoomBotTargetCheck = {
  ok: boolean;
  reason:
    | "TARGET_NOT_IN_ROOM"
    | "CANNOT_TARGET_SELF"
    | "CANNOT_TARGET_CREATOR"
    | "OWNER_CANNOT_TARGET_OWNER"
    | "ADMIN_CANNOT_TARGET_HIGHER_OR_EQUAL"
    | "ACTOR_NOT_ALLOWED"
    | string
    | null;
  actorRole: RoomBotRole;
  targetRole: RoomBotRole;
};

/* =====================================================
   ROLE VALIDATION RESULT
===================================================== */

export type RoomBotRoleAssignCheck = {
  ok: boolean;
  reason:
    | "CANNOT_CHANGE_SELF_ROLE"
    | "CANNOT_CHANGE_CREATOR_ROLE"
    | "OWNER_CANNOT_PROMOTE_TO_OWNER"
    | "OWNER_CANNOT_CHANGE_OWNER"
    | "ONLY_CREATOR_OR_OWNER_CAN_SET_ROLE"
    | string
    | null;
  actorRole: RoomBotRole;
  targetRole: RoomBotRole;
};

/* =====================================================
   ROOM BOT SETTINGS (FROM DB)
===================================================== */

export type RoomBotSettings = {
  enabled: boolean;
  welcomeEnabled: boolean;
  language: RoomBotLang;
};

/* =====================================================
   ROOM AGENT (SILENT BOT ACCOUNT)
===================================================== */

export type RoomAgentInfo = {
  enabled: boolean;
  userId?: Types.ObjectId | null;
  username?: string | null;
  joinedAt?: Date | null;
};

/* =====================================================
   ROOM SNAPSHOT FOR BOT
===================================================== */

export type RoomBotSnapshot = {
  _id: Types.ObjectId;
  creator: Types.ObjectId;

  owners: Types.ObjectId[];
  admins: Types.ObjectId[];
  members: Types.ObjectId[];
  activeUsers: Types.ObjectId[];

  roomBot: RoomBotSettings;
  roomAgent?: RoomAgentInfo;

  isLocked?: boolean;
  mutedUsers?: any[];
  blockeds?: Types.ObjectId[];
};

/* =====================================================
   SERVICE INPUT TYPES
===================================================== */

export type HandleRoomBotMessageInput = {
  roomId: string;
  actorId: string;
  content: string;
};

export type WelcomeMessageInput = {
  roomId: string;
  joinedUserId: string;
};

/* =====================================================
   SERVICE RESPONSE TYPES
===================================================== */

export type HandleRoomBotMessageResult = {
  handled: boolean;
  ok?: boolean;
  text?: string;
  result?: RoomBotExecutionResult;
};

export type WelcomeMessageResult = {
  sent: boolean;
  reason?: string;
};

/* =====================================================
   INTERNAL HELPERS TYPES
===================================================== */

export type RoomBotSystemMessage = {
  text: string;
  type?: "system" | "announcement";
  meta?: Record<string, any>;
};

/* =====================================================
   CONSTANTS (OPTIONAL)
===================================================== */

export const ROOM_BOT_DEFAULTS: RoomBotSettings = {
  enabled: false,
  welcomeEnabled: true,
  language: "ar",
};

export const ROOM_BOT_PREFIX = "!";