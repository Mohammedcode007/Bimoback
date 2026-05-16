import RoomMessage from "../../models/RoomMessage";
import lookalikeTitles from "./data/lookalikeTitles.json";

type ExecuteLookalikeGameInput = {
  roomId: string;
  content: string;
};

type ExecuteLookalikeGameResult = {
  handled: boolean;
  message?: any;
};

type LookalikeItem = {
  title?: string;
  emoji?: string;
};

function normalizeText(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[؟?!.،,]/g, "");
}

function parseLookalikeCommand(rawText: string) {
  const text = normalizeText(rawText);

  /**
   * يدعم:
   * شبيه احمد
   * شبيه محمد علي
   */
  const match = text.match(/^شبيه\s+(.+)$/);

  if (!match) return null;

  const targetName = String(match[1] || "").trim();

  if (!targetName) return null;

  return {
    targetName,
  };
}

function pickRandomLookalike(): Required<LookalikeItem> {
  const items = Array.isArray(lookalikeTitles)
    ? (lookalikeTitles as LookalikeItem[])
    : [];

  if (!items.length) {
    return {
      title: "قرد",
      emoji: "🐒",
    };
  }

  const index = Math.floor(Math.random() * items.length);
  const item = items[index] || {};

  return {
    title: String(item.title || "قرد").trim() || "قرد",
    emoji: String(item.emoji || "🐒").trim() || "🐒",
  };
}

function getRandomLookalikePercent() {
  /**
   * نسبة شبه من 45% إلى 99%
   * لو تريدها من 1 إلى 100 استخدم:
   * return Math.floor(Math.random() * 100) + 1;
   */
  return Math.floor(Math.random() * (99 - 45 + 1)) + 45;
}

export async function executeLookalikeGame(
  input: ExecuteLookalikeGameInput
): Promise<ExecuteLookalikeGameResult> {
  const roomId = String(input.roomId || "").trim();
  const text = String(input.content || "").trim();

  if (!roomId || !text) {
    return { handled: false };
  }

  const parsed = parseLookalikeCommand(text);

  if (!parsed) {
    return { handled: false };
  }

  const result = pickRandomLookalike();

  const targetName = parsed.targetName;
  const title = result.title;
  const emoji = result.emoji;
  const percent = getRandomLookalikePercent();

  const resultText = `${title} ${emoji} بنسبة ${percent}%`;

const message = await RoomMessage.create({
  room: roomId,

  type: "game",
  content: resultText,

  senderSnapshot: {
    _id: "game-bot",
    username: "game",
    atUsername: "game",
    avatar:
      "https://res.cloudinary.com/dmejkp0m4/image/upload/v1778658281/k7pj9rdqhuipqr0ecu1v.jpg",
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

  game: {
    gameType: "lookalike",
    title: resultText,
    state: "finished",
    payload: {
      game: "lookalike_game",
      targetName,
      title: resultText,
      emoji,
      percent,
      avatar:
        "https://res.cloudinary.com/dmejkp0m4/image/upload/v1778658281/k7pj9rdqhuipqr0ecu1v.jpg",
    },
  },

  action: "lookalike_game",
  actorName: "game",
  targetName,
  role: resultText,

  meta: {
    action: "lookalike_game",
    actorId: "game-bot",
    actorName: "game",
    targetId: "",
    targetName,
    title,
    emoji,
    percent,
    role: resultText,
    avatar:
      "https://res.cloudinary.com/dmejkp0m4/image/upload/v1778658281/k7pj9rdqhuipqr0ecu1v.jpg",
  },
} as any);

  return {
    handled: true,
    message,
  };
}