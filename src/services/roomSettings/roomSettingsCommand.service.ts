// src/services/roomSettings/roomSettingsCommand.service.ts
import mongoose from "mongoose";
import Room, { RoomType, RoomBotLanguage } from "../../models/Room";
import RoomMessage from "../../models/RoomMessage";

type CommandLang = "ar" | "en";

type RoomSettingsCommandResult = {
  handled: boolean;
  success?: boolean;
  message?: any;
  text?: string;
  reason?: string;
};

type ParsedCommand = {
  raw: string;
  key: string;
  value: string;
  lang: CommandLang;
};

const BOT_NAME = "Room Controller";
const BOT_NAME_AR = "متحكم الغرفة";

const MAX_ANNOUNCEMENT_CONTENT_LENGTH = 490;

function normalizeText(value?: string) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function isArabicText(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

function detectLang(value: string): CommandLang {
  return isArabicText(value) ? "ar" : "en";
}

function limitAnnouncementText(text: string, max = MAX_ANNOUNCEMENT_CONTENT_LENGTH) {
  const value = String(text || "").trim();

  if (value.length <= max) {
    return value;
  }

  return value.slice(0, max - 3).trim() + "...";
}

function normalizeOnOff(value: string): boolean | null {
  const v = String(value || "").trim().toLowerCase();

  if (["on", "open", "true", "1", "yes", "enable", "enabled"].includes(v)) {
    return true;
  }

  if (["off", "close", "false", "0", "no", "disable", "disabled"].includes(v)) {
    return false;
  }

  if (["تشغيل", "فتح", "تفعيل", "نعم"].includes(v)) {
    return true;
  }

  if (["ايقاف", "إيقاف", "قفل", "تعطيل", "لا"].includes(v)) {
    return false;
  }

  return null;
}

function isHelpCommand(text: string) {
  const v = text.trim().toLowerCase();

  return [
    "help",
    "مساعدة",
    "مساعده",
    "الاوامر",
    "الأوامر",
    "اوامر",
    "أوامر",
  ].includes(v);
}

function isHelpPage2Command(text: string) {
  const v = text.trim().toLowerCase();

  return [
    "help1",
    "help2",
    "مساعدة1",
    "مساعده1",
    "الاوامر1",
    "الأوامر1",
    "اوامر1",
    "أوامر1",
  ].includes(v);
}

function parseCommand(content: string): ParsedCommand | null {
  const text = normalizeText(content);
  if (!text) return null;

  if (isHelpCommand(text)) {
    return {
      raw: text,
      key: "help",
      value: "",
      lang: detectLang(text),
    };
  }

  if (isHelpPage2Command(text)) {
    return {
      raw: text,
      key: "help1",
      value: "",
      lang: detectLang(text),
    };
  }

  /**
   * الشكل الأساسي:
   * game@On
   * bot@Off
   * slow@30
   * name@My Room
   */
  const match = text.match(/^([A-Za-z\u0600-\u06FF0-9_-]+)\s*@\s*([\s\S]+)$/);

  if (!match) return null;

  const key = String(match[1] || "").trim().toLowerCase();
  const value = String(match[2] || "").trim();

  if (!key || !value) return null;

  return {
    raw: text,
    key,
    value,
    lang: detectLang(text),
  };
}

function getRole(room: any, userId: string) {
  const uid = String(userId || "");

  if (!room || !uid) return "none";

  if (String(room.creator || "") === uid) return "creator";

  if (Array.isArray(room.owners) && room.owners.some((x: any) => String(x) === uid)) {
    return "owner";
  }

  if (Array.isArray(room.admins) && room.admins.some((x: any) => String(x) === uid)) {
    return "admin";
  }

  if (Array.isArray(room.members) && room.members.some((x: any) => String(x) === uid)) {
    return "member";
  }

  return "none";
}

function canControlRoom(room: any, userId: string) {
  const role = getRole(room, userId);
  return role === "creator" || role === "owner";
}

function cleanString(value: string, max = 250) {
  return String(value || "").trim().slice(0, max);
}

function boolLabel(value: boolean, lang: CommandLang) {
  if (lang === "ar") return value ? "مفعل" : "متوقف";
  return value ? "ON" : "OFF";
}

function buildHelpPage1(lang: CommandLang) {
  if (lang === "ar") {
    return [
      "🛠️ أوامر الغرفة 1/2",
      "للكريتور والمالك فقط.",
      "",
      "🎮 game@On / game@Off",
      "🤖 bot@On / bot@Off",
      "👋 welcome@On / welcome@Off",
      "💬 welcomeMsg@النص",
      "🌐 lang@ar / lang@en",
      "🔒 lock@On / lock@Off",
      "",
      "اكتب help1 للصفحة الثانية.",
    ].join("\n");
  }

  return [
    "🛠️ Room Commands 1/2",
    "Creator and owner only.",
    "",
    "🎮 game@On / game@Off",
    "🤖 bot@On / bot@Off",
    "👋 welcome@On / welcome@Off",
    "💬 welcomeMsg@text",
    "🌐 lang@ar / lang@en",
    "🔒 lock@On / lock@Off",
    "",
    "Type help1 for page 2.",
  ].join("\n");
}

function buildHelpPage2(lang: CommandLang) {
  if (lang === "ar") {
    return [
      "🛠️ أوامر الغرفة 2/2",
      "",
      "🐢 slow@30 / slow@0",
      "🛡️ anti@On / anti@Off / anti@10",
      "👥 max@50",
      "🚪 type@public",
      "🚪 type@private",
      "🚪 type@protected",
      "🚪 type@subscription",
      "🔑 pass@123456",
      "📝 name@اسم الغرفة",
      "📄 desc@وصف الغرفة",
      "🖼️ avatar@رابط",
      "🌄 cover@رابط",
      "🏷️ tags@chat,games",
    ].join("\n");
  }

  return [
    "🛠️ Room Commands 2/2",
    "",
    "🐢 slow@30 / slow@0",
    "🛡️ anti@On / anti@Off / anti@10",
    "👥 max@50",
    "🚪 type@public",
    "🚪 type@private",
    "🚪 type@protected",
    "🚪 type@subscription",
    "🔑 pass@123456",
    "📝 name@room name",
    "📄 desc@description",
    "🖼️ avatar@url",
    "🌄 cover@url",
    "🏷️ tags@chat,games",
  ].join("\n");
}

async function createControllerMessage(params: {
  roomId: string;
  content: string;
  lang: CommandLang;
  senderId?: string;
}) {
  const message = await RoomMessage.create({
    room: new mongoose.Types.ObjectId(params.roomId),
    sender:
      params.senderId && mongoose.Types.ObjectId.isValid(params.senderId)
        ? new mongoose.Types.ObjectId(params.senderId)
        : undefined,

    type: "announcement",

    /**
     * مهم:
     * RoomMessage عندك يرفض announcement لو زاد عن 500 حرف.
     */
    content: limitAnnouncementText(params.content),

    senderSnapshot: {
      _id: params.senderId || "room-controller",
      username: params.lang === "ar" ? BOT_NAME_AR : BOT_NAME,
      atUsername: "room_controller",
      avatar: "",
      activeCustomization: {
        avatarFrame: "",
        avatarGif: "",
        usernameColor: "",
        messageTextColor: "",
        messageEffect: "",
        profileEntryAnimation: "",
        badges: [],
        verificationType: "none",
      },
      customEmojiBadge: {
        emoji: "🛠️",
        isActive: true,
        purchasedAt: null,
        expiresAt: null,
      },
      verificationType: "none",
      avatarFrame: "",
      badges: [],
      profileEntryAnimation: "",
    },

    meta: {
      source: "room_settings_command",
    },
  } as any);

  return message;
}

function successText(lang: CommandLang, title: string, value?: string) {
  if (lang === "ar") {
    return value ? `✅ ${title}\n${value}` : `✅ ${title}`;
  }

  return value ? `✅ ${title}\n${value}` : `✅ ${title}`;
}

function failText(lang: CommandLang, text: string) {
  return lang === "ar" ? `⚠️ ${text}` : `⚠️ ${text}`;
}

function normalizeRoomType(value: string): RoomType | null {
  const v = value.trim().toLowerCase();

  if (["public", "عام", "عامة"].includes(v)) return RoomType.PUBLIC;
  if (["private", "خاص", "خاصة"].includes(v)) return RoomType.PRIVATE;
  if (["protected", "password", "محمي", "محمية", "باسورد"].includes(v)) return RoomType.PROTECTED;
  if (["subscription", "sub", "اشتراك"].includes(v)) return RoomType.SUBSCRIPTION;

  return null;
}

export async function executeRoomSettingsCommand(params: {
  roomId: string;
  userId: string;
  content: string;
}): Promise<RoomSettingsCommandResult> {
  const roomId = String(params.roomId || "");
  const userId = String(params.userId || "");
  const content = normalizeText(params.content);

  const parsed = parseCommand(content);

  if (!parsed) {
    return {
      handled: false,
    };
  }

  const lang = parsed.lang;

  const room: any = await Room.findById(roomId).select("+password");

  if (!room) {
    return {
      handled: true,
      success: false,
      reason: "ROOM_NOT_FOUND",
      text: lang === "ar" ? "الغرفة غير موجودة." : "Room not found.",
    };
  }

  if (!canControlRoom(room, userId)) {
    const text =
      lang === "ar"
        ? "هذا الأمر متاح للمنشئ أو المالك فقط."
        : "This command is only available for the creator or owner.";

    const message = await createControllerMessage({
      roomId,
      content: failText(lang, text),
      lang,
      senderId: userId,
    });

    return {
      handled: true,
      success: false,
      reason: "NOT_ALLOWED",
      message,
      text,
    };
  }

  if (parsed.key === "help") {
    const text = buildHelpPage1(lang);

    const message = await createControllerMessage({
      roomId,
      content: text,
      lang,
      senderId: userId,
    });

    return {
      handled: true,
      success: true,
      message,
      text,
    };
  }

  if (parsed.key === "help1") {
    const text = buildHelpPage2(lang);

    const message = await createControllerMessage({
      roomId,
      content: text,
      lang,
      senderId: userId,
    });

    return {
      handled: true,
      success: true,
      message,
      text,
    };
  }

  let reply = "";
  const changedEvents: Array<{ event: string; payload: any }> = [];

  room.roomBot ||= {
    enabled: true,
    welcomeEnabled: false,
    language: "ar",
    welcomeMessage: null,
  };

  room.roomGames ||= {
    luckEnabled: true,
  };

  const key = parsed.key;
  const value = parsed.value;

  if (["game", "games", "luck", "لعبة", "العاب", "ألعاب"].includes(key)) {
    const b = normalizeOnOff(value);

    if (b === null) {
      reply = failText(
        lang,
        lang === "ar" ? "استخدم game@On أو game@Off" : "Use game@On or game@Off"
      );
    } else {
      room.roomGames.luckEnabled = b;

      reply = successText(
        lang,
        lang === "ar" ? "تم تحديث الألعاب" : "Games setting updated",
        lang === "ar"
          ? `لعبة سُــــــكَّــــــر: ${boolLabel(b, lang)}`
          : `Sugar game: ${boolLabel(b, lang)}`
      );
    }
  } else if (["bot", "roombot", "بوت"].includes(key)) {
    const b = normalizeOnOff(value);

    if (b === null) {
      reply = failText(
        lang,
        lang === "ar" ? "استخدم bot@On أو bot@Off" : "Use bot@On or bot@Off"
      );
    } else {
      room.roomBot.enabled = b;

      reply = successText(
        lang,
        lang === "ar" ? "تم تحديث بوت الغرفة" : "Room bot setting updated",
        `${lang === "ar" ? "البوت" : "Bot"}: ${boolLabel(b, lang)}`
      );
    }
  } else if (["welcome", "ترحيب"].includes(key)) {
    const b = normalizeOnOff(value);

    if (b === null) {
      reply = failText(
        lang,
        lang === "ar"
          ? "استخدم welcome@On أو welcome@Off"
          : "Use welcome@On or welcome@Off"
      );
    } else {
      room.roomBot.welcomeEnabled = b;

      reply = successText(
        lang,
        lang === "ar" ? "تم تحديث الترحيب" : "Welcome setting updated",
        `${lang === "ar" ? "الترحيب" : "Welcome"}: ${boolLabel(b, lang)}`
      );
    }
  } else if (["welcomemsg", "welcome_msg", "رسالة", "رسالةترحيب"].includes(key)) {
    const msg = cleanString(value, 500);
    room.roomBot.welcomeMessage = msg || null;

    reply = successText(
      lang,
      lang === "ar" ? "تم تغيير رسالة الترحيب" : "Welcome message updated",
      msg || (lang === "ar" ? "تم حذف رسالة الترحيب الخاصة." : "Custom welcome message removed.")
    );
  } else if (["lang", "language", "لغة"].includes(key)) {
    const v = value.trim().toLowerCase();

    const nextLang: RoomBotLanguage | null =
      ["ar", "arabic", "عربي", "العربية"].includes(v)
        ? "ar"
        : ["en", "english", "انجليزي", "إنجليزي"].includes(v)
          ? "en"
          : null;

    if (!nextLang) {
      reply = failText(
        lang,
        lang === "ar" ? "استخدم lang@ar أو lang@en" : "Use lang@ar or lang@en"
      );
    } else {
      room.roomBot.language = nextLang;

      reply = successText(
        lang,
        lang === "ar" ? "تم تغيير اللغة" : "Language updated",
        nextLang === "ar" ? "العربية" : "English"
      );
    }
  } else if (["lock", "قفل"].includes(key)) {
    const b = normalizeOnOff(value);

    if (b === null) {
      reply = failText(
        lang,
        lang === "ar" ? "استخدم lock@On أو lock@Off" : "Use lock@On or lock@Off"
      );
    } else {
      room.isLocked = b;

      changedEvents.push({
        event: "room:lock:update",
        payload: {
          roomId,
          isLocked: b,
        },
      });

      reply = successText(
        lang,
        lang === "ar" ? "تم تحديث قفل الغرفة" : "Room lock updated",
        `${lang === "ar" ? "القفل" : "Lock"}: ${boolLabel(b, lang)}`
      );
    }
  } else if (["slow", "slowmode", "سلو", "بطء"].includes(key)) {
    const off = normalizeOnOff(value) === false;
    const seconds = off ? 0 : Math.max(0, Math.min(3600, Number(value) || 0));

    room.slowModeSeconds = seconds;

    changedEvents.push({
      event: "room:slowmode:update",
      payload: {
        roomId,
        slowModeSeconds: seconds,
      },
    });

    reply = successText(
      lang,
      lang === "ar" ? "تم تحديث السلو مود" : "Slow mode updated",
      seconds > 0
        ? `${seconds} ${lang === "ar" ? "ثانية" : "seconds"}`
        : lang === "ar"
          ? "متوقف"
          : "OFF"
    );
  } else if (["anti", "antispam", "spam", "مانع"].includes(key)) {
    const b = normalizeOnOff(value);

    if (b !== null) {
      room.antiSpamEnabled = b;
    } else {
      const max = Math.max(1, Math.min(100, Number(value) || 10));
      room.antiSpamEnabled = true;
      room.maxMessagesPerMinute = max;
    }

    changedEvents.push({
      event: "room:antispam:update",
      payload: {
        roomId,
        enabled: Boolean(room.antiSpamEnabled),
        max: Number(room.maxMessagesPerMinute || 10),
      },
    });

    reply = successText(
      lang,
      lang === "ar" ? "تم تحديث مانع السبام" : "Anti spam updated",
      `${lang === "ar" ? "الحالة" : "Status"}: ${boolLabel(
        Boolean(room.antiSpamEnabled),
        lang
      )}\n${lang === "ar" ? "الحد" : "Limit"}: ${Number(
        room.maxMessagesPerMinute || 10
      )}`
    );
  } else if (["max", "maxusers", "capacity", "عدد"].includes(key)) {
    const max = Math.max(1, Math.min(500, Number(value) || 0));

    if (!max) {
      reply = failText(
        lang,
        lang === "ar" ? "استخدم max@50 مثلاً" : "Use max@50 for example"
      );
    } else {
      room.maxUsers = max;

      reply = successText(
        lang,
        lang === "ar" ? "تم تغيير أقصى عدد للغرفة" : "Room capacity updated",
        `${max}`
      );
    }
  } else if (["type", "نوع"].includes(key)) {
    const nextType = normalizeRoomType(value);

    if (!nextType) {
      reply = failText(
        lang,
        lang === "ar"
          ? "الأنواع المتاحة: public / private / protected / subscription"
          : "Available types: public / private / protected / subscription"
      );
    } else {
      room.type = nextType;

      changedEvents.push({
        event: "room:type:update",
        payload: {
          roomId,
          type: nextType,
        },
      });

      reply = successText(
        lang,
        lang === "ar" ? "تم تغيير نوع الغرفة" : "Room type updated",
        String(nextType)
      );
    }
  } else if (["pass", "password", "باسورد", "كلمة"].includes(key)) {
    const pass = cleanString(value, 100);

    if (!pass) {
      reply = failText(lang, lang === "ar" ? "كلمة المرور فارغة." : "Password is empty.");
    } else {
      room.password = pass;
      room.type = RoomType.PROTECTED;

      changedEvents.push({
        event: "room:type:update",
        payload: {
          roomId,
          type: RoomType.PROTECTED,
        },
      });

      reply = successText(
        lang,
        lang === "ar"
          ? "تم تغيير كلمة المرور وجعل الغرفة محمية"
          : "Password updated and room set to protected",
        "********"
      );
    }
  } else if (["name", "اسم"].includes(key)) {
    const name = cleanString(value, 80);

    if (!name) {
      reply = failText(lang, lang === "ar" ? "اسم الغرفة فارغ." : "Room name is empty.");
    } else {
      room.name = name;

      reply = successText(
        lang,
        lang === "ar" ? "تم تغيير اسم الغرفة" : "Room name updated",
        name
      );
    }
  } else if (["desc", "description", "وصف"].includes(key)) {
    const desc = cleanString(value, 500);
    room.description = desc;

    reply = successText(
      lang,
      lang === "ar" ? "تم تغيير وصف الغرفة" : "Room description updated",
      desc || (lang === "ar" ? "تم حذف الوصف." : "Description removed.")
    );
  } else if (["avatar", "photo", "صورة"].includes(key)) {
    const avatar = cleanString(value, 1000);
    room.avatar = avatar;

    reply = successText(
      lang,
      lang === "ar" ? "تم تغيير صورة الغرفة" : "Room avatar updated"
    );
  } else if (["cover", "غلاف"].includes(key)) {
    const cover = cleanString(value, 1000);
    room.cover = cover;

    reply = successText(
      lang,
      lang === "ar" ? "تم تغيير غلاف الغرفة" : "Room cover updated"
    );
  } else if (["tags", "tag", "تاج", "تاجات"].includes(key)) {
    const tags = value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10);

    room.tags = tags;

    reply = successText(
      lang,
      lang === "ar" ? "تم تحديث التاجات" : "Tags updated",
      tags.join(", ") || (lang === "ar" ? "بدون تاجات" : "No tags")
    );
  } else {
    return {
      handled: false,
    };
  }

  /**
   * حماية إضافية:
   * لو أي رد طويل بسبب اسم/وصف طويل، لا نكسر RoomMessage validation.
   */
  reply = limitAnnouncementText(reply);

  await room.save();

  const roomLean = room.toObject ? room.toObject() : room;

  /**
   * تحديث عام للغرفة.
   * في RoomService يتم قراءة reason كـ JSON وبث هذه الأحداث.
   */
  changedEvents.push({
    event: "room:update",
    payload: {
      ...roomLean,
      password: undefined,
    },
  });

  const message = await createControllerMessage({
    roomId,
    content: reply,
    lang,
    senderId: userId,
  });

  return {
    handled: true,
    success: true,
    message,
    text: reply,
    reason: JSON.stringify(changedEvents),
  };
}