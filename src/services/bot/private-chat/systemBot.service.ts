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