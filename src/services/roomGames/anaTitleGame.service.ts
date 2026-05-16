import RoomMessage from "../../models/RoomMessage";
import anaTitles from "./data/anaTitles.json";

type ExecuteAnaTitleGameInput = {
  roomId: string;
  content: string;

  // اسم المستخدم الذي كتب "انا"
  username?: string;
};

type ExecuteAnaTitleGameResult = {
  handled: boolean;
  message?: any;
};

function normalizeText(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[؟?!.،,]/g, "");
}

function pickRandomTitle() {
  const titles = Array.isArray(anaTitles) ? anaTitles : [];

  if (!titles.length) {
    return "الأسطورة";
  }

  const index = Math.floor(Math.random() * titles.length);
  return String(titles[index] || "الأسطورة");
}

export async function executeAnaTitleGame(
  input: ExecuteAnaTitleGameInput
): Promise<ExecuteAnaTitleGameResult> {
  const roomId = String(input.roomId || "").trim();
  const text = normalizeText(input.content);

  if (!roomId || !text) {
    return { handled: false };
  }

  // الأمر المطلوب: المستخدم يكتب "انا"
  // يدعم: انا / أنا
  const isAnaCommand = text === "انا" || text === "أنا";

  if (!isAnaCommand) {
    return { handled: false };
  }

  const title = pickRandomTitle();
  const targetUsername = String(input.username || "").trim() || "مستخدم";

  console.log("🎮 [ANA_TITLE_SERVICE] BEFORE CREATE:", {
    roomId,
    content: input.content,
    normalizedText: text,
    title,
    targetUsername,
  });

  const message = await RoomMessage.create({
    room: roomId,

    // نخليها رسالة عادية وليست system
    type: "text",

    // النتيجة فقط بدون كلمة "أنت"
    content: title,

    // لا نضع sender حقيقي
    // لكن نضع senderSnapshot حتى تظهر كأنها من مستخدم اسمه game
    senderSnapshot: {
      _id: "game-bot",
      username: "game",
      atUsername: "game",
      avatar: "",
      avatarGif: "",
      usernameColor: "#F59E0B",
      messageTextColor: "",

      activeCustomization: {
        avatarFrame: "",
        avatarGif: "",
        usernameColor: "#F59E0B",
        messageTextColor: "",
        messageEffect: "",
        profileEntryAnimation: "",
        badges: [],
        verificationType: "none",
      },

      customEmojiBadge: {
        emoji: "🎮",
        isActive: true,
        purchasedAt: null,
        expiresAt: null,
      },

      verificationType: "none",
      avatarFrame: "",
      badges: [],
      profileEntryAnimation: "",
    },

    /*
      مهم:
      RoomMessageSchema عندك لا يحفظ meta.source / meta.botName / meta.title / meta.targetUsername
      لذلك نستخدم المفاتيح الموجودة فعليًا:
      action / actorId / actorName / targetId / targetName / role
    */

    // حقول على الجذر للاحتياط لو الفرونت يقرأ منها
    action: "ana_title_game",
    actorName: "game",
    targetName: targetUsername,
    role: title,

    meta: {
      action: "ana_title_game",
      actorId: "game-bot",
      actorName: "game",

      // اسم المستخدم الذي كتب "انا"
      targetId: "",
      targetName: targetUsername,

      // اللقب المختار
      role: title,
    },
  } as any);

  console.log("🎮 [ANA_TITLE_SERVICE] AFTER CREATE:", {
    messageId: String(message._id),
    content: message.content,

    action: (message as any).action,
    actorName: (message as any).actorName,
    targetName: (message as any).targetName,
    role: (message as any).role,

    meta: (message as any).meta,
    senderSnapshot: (message as any).senderSnapshot,
  });

  return {
    handled: true,
    message,
  };
}