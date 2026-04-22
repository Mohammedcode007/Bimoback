import { Types } from "mongoose";

/* =====================================================
   COMMAND TYPES
===================================================== */

export type RoomAgentCommandType =
  | "login"
  | "exit"
  | "unknown";

/* =====================================================
   PARSED COMMAND
===================================================== */

export type ParsedRoomAgentCommand =
  | {
      type: "login";
      username: string;
      password: string;
      roomRef: string;
    }
  | {
      type: "exit";
      username: string;
      roomRef: string;
    }
  | {
      type: "unknown";
      raw: string;
    };

/* =====================================================
   EXECUTION INPUT
===================================================== */

export type ExecuteRoomAgentCommandInput = {
  roomId: string;
  raw: string;
};

/* =====================================================
   EXECUTION RESULT
===================================================== */

export type RoomAgentExecutionResult = {
  handled: boolean;
  success?: boolean;
  message?: string;
  meta?: {
    action?: "agent_login" | "agent_exit";
    userId?: string;
    username?: string;
    roomId?: string;
    error?: string;
    [key: string]: any;
  };
};

/* =====================================================
   ROOM AGENT STATE (FROM DB)
===================================================== */

export type RoomAgentState = {
  enabled: boolean;
  userId?: Types.ObjectId | null;
  username?: string | null;
  joinedAt?: Date | null;
};

/* =====================================================
   ROOM SNAPSHOT FOR AGENT
===================================================== */

export type RoomAgentSnapshot = {
  _id: Types.ObjectId;
  name: string;

  roomAgent: RoomAgentState;

  activeUsers: Types.ObjectId[];
  members?: Types.ObjectId[];

  isLocked?: boolean;
  type?: string;
};

/* =====================================================
   SERVICE INPUT TYPES
===================================================== */

export type HandleRoomAgentMessageInput = {
  roomId: string;
  content: string;
};

export type RoomAgentStatusInput = {
  roomId: string;
};

/* =====================================================
   SERVICE RESULT TYPES
===================================================== */

export type HandleRoomAgentMessageResult = {
  handled: boolean;
  success?: boolean;
  message?: string;
  meta?: Record<string, any>;
};

export type RoomAgentStatusResult = {
  sent: boolean;
  reason?: string;
};

/* =====================================================
   VALIDATION RESULTS
===================================================== */

export type AgentLoginValidationResult = {
  ok: boolean;
  reason?:
    | "INVALID_FORMAT"
    | "USER_NOT_FOUND"
    | "INVALID_PASSWORD"
    | "ALREADY_HAS_AGENT"
    | "AGENT_ALREADY_IN_ANOTHER_ROOM"
    | "ROOM_NOT_FOUND"
    | string;
  userId?: string;
  username?: string;
  roomName?: string;
};

export type AgentExitValidationResult = {
  ok: boolean;
  reason?:
    | "INVALID_FORMAT"
    | "NO_AGENT"
    | "USER_NOT_MATCH_AGENT"
    | "ROOM_NOT_FOUND"
    | string;
  userId?: string;
  username?: string;
};

/* =====================================================
   INTERNAL STRUCTURES
===================================================== */

export type AgentLinkPayload = {
  roomId: string;
  userId: string;
  username: string;
};

export type AgentUnlinkPayload = {
  roomId: string;
  userId?: string;
};

/* =====================================================
   CONSTANTS
===================================================== */

export const ROOM_AGENT_DEFAULT: RoomAgentState = {
  enabled: false,
  userId: null,
  username: null,
  joinedAt: null,
};

/* =====================================================
   HELPERS (OPTIONAL TYPES)
===================================================== */

export type AgentCommandParts = {
  parts: string[];
  length: number;
};

export type AgentSystemMessage = {
  text: string;
  type?: "system" | "announcement";
  meta?: Record<string, any>;
};