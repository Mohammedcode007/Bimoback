import Message from "../models/Message";
import Chat from "../models/Chats";
import Friend from "../models/Friend";
import User from "../models/User";
import Notification from "../models/Notification";
import mongoose from "mongoose";
import { getIO } from "../config/socket";
import { activeChats } from "../sockets/socketState";

class MessageService {

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  async sendMessage(
    userId: string,
    chatId: string,
    content: string,
    type: string,
    media?: any,
    replyTo?: string
  ) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📨 SEND MESSAGE START");
    console.log("👤 Sender:", userId);
    console.log("💬 Chat:", chatId);
    console.log("📝 Type:", type);
    console.log("📎 Has Media:", !!media);
    console.log("↩ ReplyTo:", replyTo);

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      console.log("❌ Invalid Chat ID");
      throw new Error("Invalid Chat ID");
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const chatObjectId = new mongoose.Types.ObjectId(chatId);

    const chat = await Chat.findById(chatObjectId);
    if (!chat) {
      console.log("❌ Chat not found");
      throw new Error("Chat not found");
    }

    if (!chat.participants.some(id => id.equals(userObjectId))) {
      console.log("❌ Access denied");
      throw new Error("Access denied");
    }

    const targetObjectId = chat.participants.find(
      id => !id.equals(userObjectId)
    );

    if (!targetObjectId) {
      console.log("❌ Invalid chat participants");
      throw new Error("Invalid chat");
    }

    const targetId = targetObjectId.toString();

    console.log("🎯 Target:", targetId);

    /* FRIEND CHECK */

    const relation = await Friend.exists({
      $or: [
        { requester: userId, recipient: targetId, status: "accepted" },
        { requester: targetId, recipient: userId, status: "accepted" }
      ]
    });

    if (!relation) {
      console.log("❌ Not friends");
      throw new Error("You can only message friends");
    }

    /* BLOCK CHECK */

    const targetUser = await User.findById(targetId);
    if (targetUser?.blockedUsers.some(id => id.equals(userObjectId))) {
      console.log("❌ You are blocked");
      throw new Error("You are blocked");
    }

    /* REPLY SNAPSHOT */

    let replySnapshot;

    if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
      const original = await Message.findById(replyTo);
      if (original) {
        replySnapshot = {
          content: original.content,
          type: original.type,
          sender: original.sender
        };
        console.log("↩ Reply snapshot created");
      }
    }

    /* CREATE MESSAGE */

    const message = await Message.create({
      chat: chatObjectId,
      sender: userObjectId,
      type,
      content,
      media,
      replyTo,
      replySnapshot,
      status: "sent",
      deliveryStatus: {
        deliveredTo: [],
        seenBy: []
      }
    });

    console.log("✅ Message created:", message._id);

    /* UPDATE CHAT */

    chat.lastMessage = message._id;

    chat.lastMessagePreview =
      type === "text"
        ? content
        : type === "image"
        ? "📷 Image"
        : type === "video"
        ? "🎥 Video"
        : type === "audio"
        ? "🎤 Audio"
        : "📎 File";

    chat.lastMessageType = type;

    const currentUnread =
      chat.unreadCounts.get(targetId) ?? 0;

    chat.unreadCounts.set(targetId, currentUnread + 1);

    await chat.save();

    console.log("📊 Updated unread:", currentUnread + 1);

    const io = getIO();

    /* SOCKET EMIT */

    io.to(`chat:${chatId}`).emit("chat:new", message);
    console.log("📡 Emitted chat:new");

    io.to(targetId).emit("unread:update", {
      chatId,
      unreadCount: chat.unreadCounts.get(targetId) ?? 0
    });
    console.log("📡 Emitted unread:update");

    /* SMART NOTIFICATION */

    const isActive =
      activeChats.get(targetId) === chatId;

    console.log("👁 Is target active:", isActive);

    if (!isActive) {

      await Notification.create({
        recipient: targetId,
        sender: userId,
        type: "message",
        body: content || "New message",
        relatedChat: chatId,
        isRead: false,
        isDeleted: false,
        priority: 1,
        isSilent: false
      });

      const unreadNotificationCount =
        await Notification.countDocuments({
          recipient: targetId,
          isRead: false,
          isDeleted: false
        });

      io.to(targetId).emit(
        "notification:unreadCount",
        unreadNotificationCount
      );

      console.log("🔔 Notification created");
    }

    console.log("📨 SEND MESSAGE END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return message;
  }

  /* =======================================================
     MARK AS SEEN
  ======================================================= */

  async markAsSeen(userId: string, chatId: string) {

    console.log("👀 MARK AS SEEN:", userId, chatId);

    const io = getIO();
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userObjectId },
        "deliveryStatus.seenBy": { $ne: userObjectId }
      },
      {
        $addToSet: {
          "deliveryStatus.seenBy": userObjectId
        },
        $set: {
          status: "seen",
          "deliveryStatus.seenAt": new Date()
        }
      }
    );

    const chat = await Chat.findById(chatId);

    if (chat) {
      chat.unreadCounts.set(userId, 0);
      await chat.save();

      io.to(userId).emit("unread:update", {
        chatId,
        unreadCount: 0
      });

      console.log("📊 Unread reset");
    }

    io.to(`chat:${chatId}`).emit("message:seen", {
      userId
    });

    console.log("📡 Emitted message:seen");

    return true;
  }

  /* =======================================================
     MARK AS DELIVERED
  ======================================================= */

  async markAsDelivered(userId: string, messageId: string) {

    console.log("📦 MARK AS DELIVERED:", userId, messageId);

    const io = getIO();
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        $addToSet: {
          "deliveryStatus.deliveredTo": userObjectId
        },
        $set: {
          status: "delivered",
          "deliveryStatus.deliveredAt": new Date()
        }
      },
      { new: true }
    );

    if (!message) {
      console.log("❌ Message not found");
      throw new Error("Message not found");
    }

    if (message.sender && !message.sender.equals(userObjectId)) {

      io.to(message.sender.toString()).emit(
        "message:delivered",
        {
          messageId,
          deliveredBy: userId
        }
      );

      console.log("📡 Emitted message:delivered");
    }

    return true;
  }
/* =======================================================
   TOGGLE REACTION
======================================================= */

async toggleReaction(
  userId: string,
  messageId: string,
  emoji: string
) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("😊 TOGGLE REACTION START");
  console.log("👤 User:", userId);
  console.log("💬 Message:", messageId);
  console.log("😀 Emoji:", emoji);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    console.log("❌ Invalid Message ID");
    throw new Error("Invalid Message ID");
  }

  const io = getIO();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const message = await Message.findById(messageId);
  if (!message) {
    console.log("❌ Message not found");
    throw new Error("Message not found");
  }

  const existing = message.reactions.find(r =>
    r.user.equals(userObjectId)
  );

  if (existing) {

    if (existing.emoji === emoji) {
      message.reactions = message.reactions.filter(
        r => !r.user.equals(userObjectId)
      );
      console.log("🗑 Reaction removed");
    } else {
      existing.emoji = emoji;
      console.log("🔄 Reaction updated");
    }

  } else {

    message.reactions.push({
      user: userObjectId,
      emoji,
      createdAt: new Date()
    });

    console.log("➕ Reaction added");
  }

  await message.save();

  io.to(`chat:${message.chat}`).emit(
    "message:reaction",
    {
      chatId: message.chat,
      messageId,
      reactions: message.reactions
    }
  );

  console.log("📡 Emitted message:reaction");
  console.log("😊 TOGGLE REACTION END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return message.reactions;
}
/* =======================================================
   DELETE FOR ME
======================================================= */

async deleteForMe(userId: string, messageId: string) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🗑 DELETE FOR ME START");
  console.log("👤 User:", userId);
  console.log("💬 Message:", messageId);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    console.log("❌ Invalid Message ID");
    throw new Error("Invalid Message ID");
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const message = await Message.findById(messageId);

  if (!message) {
    console.log("❌ Message not found");
    throw new Error("Message not found");
  }

  const alreadyDeleted = message.deletedFor.some(id =>
    id.equals(userObjectId)
  );

  if (!alreadyDeleted) {

    await Message.findByIdAndUpdate(messageId, {
      $addToSet: { deletedFor: userObjectId }
    });

    console.log("✅ Message hidden for user");

  } else {

    console.log("⚠ Already deleted for this user");

  }

  console.log("🗑 DELETE FOR ME END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return true;
}

/* =======================================================
   DELETE FOR EVERYONE
======================================================= */

async deleteForEveryone(
  userId: string,
  messageId: string
) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔥 DELETE FOR EVERYONE START");
  console.log("👤 User:", userId);
  console.log("💬 Message:", messageId);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    console.log("❌ Invalid Message ID");
    throw new Error("Invalid Message ID");
  }

  const io = getIO();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const message = await Message.findById(messageId);

  if (!message) {
    console.log("❌ Message not found");
    throw new Error("Message not found");
  }

  if (!message.sender?.equals(userObjectId)) {
    console.log("❌ Unauthorized delete");
    throw new Error("Unauthorized");
  }

  message.deletedForEveryone = true;
  message.content = "";
  message.media = undefined;
  message.reactions = [];

  await message.save();

  io.to(`chat:${message.chat}`).emit(
    "message:deleted",
    {
      chatId: message.chat,
      messageId
    }
  );

  console.log("📡 Emitted message:deleted");
  console.log("🔥 DELETE FOR EVERYONE END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return true;
}
/* =======================================================
   SEARCH MESSAGES
======================================================= */

async searchMessages(
  chatId: string,
  userId: string,
  query: string,
  page = 1,
  limit = 20
) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔎 SEARCH MESSAGES START");
  console.log("💬 Chat:", chatId);
  console.log("👤 User:", userId);
  console.log("🔍 Query:", query);
  console.log("📄 Page:", page);

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    console.log("❌ Invalid Chat ID");
    throw new Error("Invalid Chat ID");
  }

  if (!query || !query.trim()) {
    console.log("❌ Empty search query");
    throw new Error("Search query required");
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find(
    {
      chat: chatId,
      deletedForEveryone: false,
      deletedFor: { $ne: userId },
      $text: { $search: query }
    },
    {
      score: { $meta: "textScore" }
    }
  )
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit)
    .populate("sender", "username avatar")
    .populate("replyTo", "content type")
    .lean();

  console.log("📊 Search results:", messages.length);
  console.log("🔎 SEARCH MESSAGES END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return messages;
}
/* =======================================================
   GET MESSAGES
======================================================= */

async getMessages(
  chatId: string,
  userId: string,
  page = 1,
  limit = 30
) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📥 GET MESSAGES START");
  console.log("💬 Chat:", chatId);
  console.log("👤 User:", userId);
  console.log("📄 Page:", page);
  console.log("📦 Limit:", limit);

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    console.log("❌ Invalid Chat ID");
    throw new Error("Invalid Chat ID");
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    chat: chatId,
    deletedForEveryone: false,
    deletedFor: { $ne: userId }
  })
    .sort({ createdAt: -1 }) // نجيب الأحدث أولاً
    .skip(skip)
    .limit(limit)
    .populate("sender", "username avatar")
    .populate("replyTo", "content type")
    .lean();

  console.log("📊 Messages fetched:", messages.length);

  const result = messages.reverse(); // ترتيب طبيعي للشات

  console.log("📥 GET MESSAGES END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return result;
}

/* =======================================================
   EDIT MESSAGE
======================================================= */

async editMessage(
  userId: string,
  messageId: string,
  newContent: string
) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✏️ EDIT MESSAGE START");
  console.log("👤 User:", userId);
  console.log("💬 Message:", messageId);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    console.log("❌ Invalid Message ID");
    throw new Error("Invalid Message ID");
  }

  if (!newContent || !newContent.trim()) {
    console.log("❌ Empty content");
    throw new Error("Message content required");
  }

  const io = getIO();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const message = await Message.findById(messageId);

  if (!message) {
    console.log("❌ Message not found");
    throw new Error("Message not found");
  }

  if (!message.sender?.equals(userObjectId)) {
    console.log("❌ Unauthorized edit");
    throw new Error("Unauthorized");
  }

  if (message.deletedForEveryone) {
    console.log("❌ Cannot edit deleted message");
    throw new Error("Message already deleted");
  }

  if (message.type !== "text") {
    console.log("❌ Only text messages editable");
    throw new Error("Only text messages can be edited");
  }

  /* ========== UPDATE CONTENT ========== */

  message.content = newContent.trim();
  message.edited = true;
  message.editedAt = new Date();

  await message.save();

  console.log("✅ Message updated");

  /* ========== UPDATE CHAT PREVIEW IF NEEDED ========== */

  const chat = await Chat.findById(message.chat);

  if (chat && chat.lastMessage?.equals(message._id)) {

    chat.lastMessagePreview = newContent.trim();
    await chat.save();

    console.log("📌 Updated lastMessagePreview");
  }

  /* ========== SOCKET EMIT ========== */

  io.to(`chat:${message.chat}`).emit(
    "message:edited",
    {
      chatId: message.chat,
      messageId,
      content: newContent.trim(),
      edited: true,
      editedAt: message.editedAt
    }
  );

  console.log("📡 Emitted message:edited");
  console.log("✏️ EDIT MESSAGE END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return message;
}

}

export default new MessageService();
