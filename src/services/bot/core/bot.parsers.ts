import {
  BotLang,
  ParsedBotCommand,
} from "./bot.types";

/* =====================================================
   HELPERS
===================================================== */

function normalizeText(value?: string) {
  return String(value || "").trim();
}

function normalizeAtUsername(value?: string) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function splitAndTrim(rawText?: string) {
  return String(rawText || "")
    .split("@")
    .map((part) => part.trim());
}

function hasExactAtCount(rawText: string, count: number) {
  return (rawText.match(/@/g) || []).length === count;
}

export function detectLangFromText(text?: string): BotLang {
  const t = normalizeText(text).toLowerCase();

  if (!t) return "ar";

  if (
    t === "english" ||
    t === "en" ||
    t === "eng" ||
    t === "الانجليزية" ||
    t === "انجليزي" ||
    t === "english please"
  ) {
    return "en";
  }

  if (
    t === "عربي" ||
    t === "العربية" ||
    t === "عربى" ||
    t === "ar" ||
    t === "arabic"
  ) {
    return "ar";
  }

  const hasArabic = /[\u0600-\u06FF]/.test(t);
  return hasArabic ? "ar" : "en";
}

export function isLanguageCommandText(text?: string) {
  const t = normalizeText(text).toLowerCase();

  return [
    "عربي",
    "العربية",
    "عربى",
    "arabic",
    "ar",
    "english",
    "en",
    "eng",
    "انجليزي",
    "الانجليزية",
    "تغيير اللغة",
    "اللغة",
    "change language",
    "language",
    "lang",
  ].includes(t);
}

export function isLanguagePickerRequest(text?: string) {
  const t = normalizeText(text).toLowerCase();

  return [
    "تغيير اللغة",
    "اللغة",
    "change language",
    "language",
    "lang",
  ].includes(t);
}

export function isHelpCommand(text?: string) {
  const t = normalizeText(text).toLowerCase();

  return [
    "مساعدة",
    "ساعدني",
    "help",
    "/help",
    "ابدأ",
    "start",
  ].includes(t);
}

/* =====================================================
   PRIVATE CHAT COMMAND PARSERS
===================================================== */

/**
 * bot@username@password@room
 */
export function parseBotJoinCommand(rawText?: string): ParsedBotCommand | null {
  const text = normalizeText(rawText);
  if (!/^bot@/i.test(text)) return null;

  if (!hasExactAtCount(text, 3)) return null;

  const parts = splitAndTrim(text);
  if (parts.length !== 4) return null;

  const [, usernameRaw, passwordRaw, roomRaw] = parts;

  const username = normalizeAtUsername(usernameRaw);
  const password = normalizeText(passwordRaw);
  const roomName = normalizeText(roomRaw);

  if (!username || !password || !roomName) return null;

  return {
    type: "join_room_by_credentials",
    payload: {
      username,
      password,
      roomName,
      source: "bot",
    },
  };
}

/**
 * botleave@username@room
 */
export function parseBotLeaveCommand(rawText?: string): ParsedBotCommand | null {
  const text = normalizeText(rawText);
  if (!/^botleave@/i.test(text)) return null;

  if (!hasExactAtCount(text, 2)) return null;

  const parts = splitAndTrim(text);
  if (parts.length !== 3) return null;

  const [, usernameRaw, roomRaw] = parts;

  const username = normalizeAtUsername(usernameRaw);
  const roomName = normalizeText(roomRaw);

  if (!username || !roomName) return null;

  return {
    type: "leave_room_by_credentials",
    payload: {
      username,
      roomName,
      source: "bot",
    },
  };
}
/**
 * transfercoinz@username@amount
 */
/**
 * transfercoinz@username@amount
 */
export function parseTransferCoinzCommand(
  rawText?: string
): ParsedBotCommand | null {
  const text = normalizeText(rawText);
  if (!/^transfercoinz@/i.test(text)) return null;

  if (!hasExactAtCount(text, 2)) return null;

  const parts = splitAndTrim(text);
  if (parts.length !== 3) return null;

  const [, usernameRaw, amountRaw] = parts;

  const username = normalizeAtUsername(usernameRaw);
  const amount = Number(normalizeText(amountRaw));

  if (!username || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    type: "transfer_coinz",
    payload: {
      username,
      amount: Math.floor(amount),
    },
  };
}
/**
 * createuser@username@password
 */
export function parseCreateUserCommand(rawText?: string): ParsedBotCommand | null {
  const text = normalizeText(rawText);
  if (!/^createuser@/i.test(text)) return null;

  if (!hasExactAtCount(text, 2)) return null;

  const parts = splitAndTrim(text);
  if (parts.length !== 3) return null;

  const [, usernameRaw, passwordRaw] = parts;

  const username = normalizeAtUsername(usernameRaw);
  const password = normalizeText(passwordRaw);

  if (!username || !password) return null;

  return {
    type: "create_user",
    payload: {
      username,
      password,
    },
  };
}

/* =====================================================
   SILENT LOGIN / ROOM AGENT PARSERS
===================================================== */

/**
 * username@password@room
 * مهم:
 * - لا يبدأ بـ bot@
 * - لا يبدأ بـ createuser@
 * - لا يبدأ بـ botleave@
 * - بالضبط 2 @
 */
export function parseSilentRoomAgentJoinCommand(
  rawText?: string
): ParsedBotCommand | null {
  const text = normalizeText(rawText);
  if (!text) return null;

  const lower = text.toLowerCase();

  if (
    lower.startsWith("bot@") ||
    lower.startsWith("createuser@") ||
    lower.startsWith("botleave@") ||
    lower.startsWith("exit@")
  ) {
    return null;
  }

  if (!hasExactAtCount(text, 2)) return null;

  const parts = splitAndTrim(text);
  if (parts.length !== 3) return null;

  const [usernameRaw, passwordRaw, roomRaw] = parts;

  const username = normalizeAtUsername(usernameRaw);
  const password = normalizeText(passwordRaw);
  const roomName = normalizeText(roomRaw);

  if (!username || !password || !roomName) return null;

  return {
    type: "join_room_by_credentials",
    payload: {
      username,
      password,
      roomName,
      source: "silent",
    },
  };
}

/**
 * exit@username@room
 */
export function parseSilentRoomAgentExitCommand(
  rawText?: string
): ParsedBotCommand | null {
  const text = normalizeText(rawText);
  if (!/^exit@/i.test(text)) return null;

  if (!hasExactAtCount(text, 2)) return null;

  const parts = splitAndTrim(text);
  if (parts.length !== 3) return null;

  const [, usernameRaw, roomRaw] = parts;

  const username = normalizeAtUsername(usernameRaw);
  const roomName = normalizeText(roomRaw);

  if (!username || !roomName) return null;

  return {
    type: "leave_room_by_credentials",
    payload: {
      username,
      roomName,
      source: "silent",
    },
  };
}

/* =====================================================
   ROOM BOT PARSER
===================================================== */

/**
 * أوامر الغرفة تبدأ بـ !
 * أمثلة:
 * !welcome on
 * !welcome off
 * !ban @username
 * !kick @username
 * !mute @username 10
 * !role @username admin
 */
export function parseRoomBotCommand(rawText?: string): ParsedBotCommand | null {
  const text = normalizeText(rawText);
  if (!text.startsWith("!")) return null;

  return {
    type: "room_bot_command",
    payload: {
      raw: text,
    },
  };
}

/* =====================================================
   MAIN PARSER
===================================================== */

export function parseBotCommand(rawText?: string): ParsedBotCommand {
  const text = normalizeText(rawText);

  const botJoin = parseBotJoinCommand(text);
  if (botJoin) return botJoin;

  const botLeave = parseBotLeaveCommand(text);
  if (botLeave) return botLeave;

  const createUser = parseCreateUserCommand(text);
  if (createUser) return createUser;
 const transferCoinz = parseTransferCoinzCommand(text);
  if (transferCoinz) return transferCoinz;

  const silentJoin = parseSilentRoomAgentJoinCommand(text);
  if (silentJoin) return silentJoin;

  const silentExit = parseSilentRoomAgentExitCommand(text);
  if (silentExit) return silentExit;

  const roomBot = parseRoomBotCommand(text);
  if (roomBot) return roomBot;

  return {
    type: "text",
    payload: {
      text,
    },
  };
}