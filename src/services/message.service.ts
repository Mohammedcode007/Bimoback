import Message from "../models/Message";
import Chat from "../models/Chats";
import Notification from "../models/Notification";
import { checkRelationship } from "../utils/relationship";
import { getIO } from "../config/socket";
import mongoose from "mongoose";

class MessageService {

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

 async send(
  chatId: string,
  senderId: string,
  content: string,
  type: string = "text",
  media?: any,
  replyTo?: string
) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📤 SEND MESSAGE START");
  console.log("💬 Chat:", chatId);
  console.log("👤 Sender:", senderId);
  console.log("📝 Content:", content);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    console.log("❌ Invalid chat id");
    throw new Error("Invalid chat id");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    console.log("❌ Chat not found");
    throw new Error("Chat not found");
  }

  console.log("👥 Participants:", chat.participants);

  const targetId = chat.participants.find(
    id => id.toString() !== senderId
  )?.toString();

  if (!targetId) {
    console.log("❌ Target not found");
    throw new Error("Target not found");
  }

  console.log("🎯 Target:", targetId);

  const relation = await checkRelationship(senderId, targetId);

  console.log("🤝 Relationship:", relation);

  if (relation.blocked) {
    console.log("🚫 Blocked");
    throw new Error("You cannot send message");
  }

  /* ================= CREATE MESSAGE ================= */

  const message = await Message.create({
    chat: chatId,
    sender: senderId,
    content,
    type,
    media,
    replyTo,
    deliveryStatus: {
      deliveredTo: [],
      seenBy: []
    },
    status: "sent"
  });

  console.log("✅ Message Created:", message._id);

  const io = getIO();

  /* ================= DELIVERY CHECK ================= */

  const targetSockets =
    io.sockets.adapter.rooms.get(targetId);

  const isTargetOnline =
    !!targetSockets && targetSockets.size > 0;

  console.log("🟢 Target Online:", isTargetOnline);
  console.log("🔌 Target Socket Count:", targetSockets?.size || 0);

  if (relation.isFriend && isTargetOnline) {

    message.deliveryStatus.deliveredTo.push(targetId as any);
    message.status = "delivered";
    message.deliveryStatus.deliveredAt = new Date();

    await message.save();

    console.log("📬 Marked as delivered");
  }

  /* ================= UPDATE CHAT ================= */

  chat.lastMessage = message._id;
  chat.lastMessagePreview = content;
  chat.lastMessageType = type;
  chat.updatedAt = new Date();

  const room = io.sockets.adapter.rooms.get(`chat:${chatId}`);

  console.log("🏠 Room chat:", `chat:${chatId}`);
  console.log("👥 Room socket count:", room?.size || 0);

  let isTargetInRoom = false;

  if (room) {
    for (const socketId of room) {
      const s = io.sockets.sockets.get(socketId);
      console.log("🔎 Checking socket:", socketId, "User:", s?.data.userId);

      if (s?.data.userId === targetId) {
        isTargetInRoom = true;
        break;
      }
    }
  }

  console.log("👀 Is target inside same room:", isTargetInRoom);

  if (!isTargetInRoom) {

    const currentUnread =
      chat.unreadCounts?.[targetId] || 0;

    chat.unreadCounts[targetId] = currentUnread + 1;

    console.log("🔢 Unread incremented:", chat.unreadCounts[targetId]);
  }

  await chat.save();

  console.log("💾 Chat updated");

  /* ================= EMIT MESSAGE ================= */

  console.log("📡 Emitting chat:new to room:", `chat:${chatId}`);

console.log("📡 Emitting to room:", `chat:${chatId}`);
io.to(`chat:${chatId}`).emit("chat:new", message);

console.log("📡 Emitting directly to target:", targetId);
io.to(targetId).emit("chat:new", message);

  console.log("✅ Emit done");

  /* ================= OFFLINE NOTIFICATION ================= */

  if (!isTargetOnline) {

    console.log("📴 Target offline → Creating notification");

    await Notification.create({
      recipient: targetId,
      sender: senderId,
      type: "message",
      body: content,
      relatedChat: chatId
    });

    const chats = await Chat.find({
      participants: targetId,
      deletedFor: { $ne: targetId }
    }).lean();

    let totalUnread = 0;

    chats.forEach(c => {
      totalUnread += c.unreadCounts?.[targetId] || 0;
    });

    console.log("🔔 Total unread for target:", totalUnread);

    io.to(targetId).emit(
      "notification:unreadTotal",
      totalUnread
    );
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📤 SEND MESSAGE END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return message;
}


  /* =====================================================
     MARK AS DELIVERED (ON JOIN)
  ===================================================== */

  async markAsDelivered(chatId: string, userId: string) {

    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        "deliveryStatus.deliveredTo": { $ne: userId }
      },
      {
        $addToSet: { "deliveryStatus.deliveredTo": userId },
        $set: {
          status: "delivered",
          "deliveryStatus.deliveredAt": new Date()
        }
      }
    );

    const io = getIO();

    io.to(`chat:${chatId}`).emit(
      "chat:delivery:update",
      { chatId, userId }
    );
  }

  /* =====================================================
     MARK AS SEEN
  ===================================================== */

  async markAsSeen(chatId: string, userId: string) {

    const chat = await Chat.findById(chatId);
    if (!chat) return;

    const targetId = chat.participants.find(
      id => id.toString() !== userId
    )?.toString();

    if (!targetId) return;

    const relation = await checkRelationship(userId, targetId);
    if (!relation.isFriend) return;

    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        "deliveryStatus.seenBy": { $ne: userId }
      },
      {
        $addToSet: { "deliveryStatus.seenBy": userId },
        $set: {
          status: "seen",
          "deliveryStatus.seenAt": new Date()
        }
      }
    );

    chat.unreadCounts[userId] = 0;
    await chat.save();

    const io = getIO();

    io.to(`chat:${chatId}`).emit(
      "chat:seen:update",
      { chatId, userId }
    );

    io.to(userId).emit(
      "chat:unread:update",
      { chatId, unreadCount: 0 }
    );
  }

  /* =====================================================
     REACTIONS
  ===================================================== */

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
  ) {

    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    const existing = message.reactions.find(
      r => r.user.toString() === userId && r.emoji === emoji
    );

    if (existing) {
      message.reactions = message.reactions.filter(
        r => !(r.user.toString() === userId && r.emoji === emoji)
      );
    } else {
      message.reactions.push({
        user: userId as any,
        emoji,
        createdAt: new Date()
      });
    }

    await message.save();

    const io = getIO();

    io.to(`chat:${message.chat}`).emit(
      "chat:reaction:update",
      {
        messageId,
        reactions: message.reactions
      }
    );

    return message.reactions;
  }

  /* =====================================================
     DELETE FOR ME
  ===================================================== */

  async deleteForMe(messageId: string, userId: string) {

    await Message.findOneAndUpdate(
      { _id: messageId },
      { $addToSet: { deletedFor: userId } }
    );

    return { success: true };
  }

  /* =====================================================
     DELETE FOR EVERYONE
  ===================================================== */

  async deleteForEveryone(
    messageId: string,
    userId: string
  ) {

    const message = await Message.findById(messageId);
    if (!message) throw new Error("Message not found");

    if (message.sender?.toString() !== userId)
      throw new Error("Not allowed");

    message.deletedForEveryone = true;
    message.content = "This message was deleted";
    message.media = undefined;

    await message.save();

    const io = getIO();

    io.to(`chat:${message.chat}`).emit(
      "chat:message:deleted",
      { messageId }
    );

    return { success: true };
  }

  /* =====================================================
     PAGINATION
  ===================================================== */

 async getMessages(
    chatId: string,
    userId: string,
    page: number = 1
  ) {

    const limit = 20; // عدد الرسائل لكل صفحة
    const skip = (page - 1) * limit;

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const chatObjectId = new mongoose.Types.ObjectId(chatId);

    const messages = await Message.find({
      chat: chatObjectId,
      deletedFor: { $ne: userObjectId },
      deletedForEveryone: false
    })
      .sort({ createdAt: -1 }) // الأحدث أولاً للـ pagination
      .skip(skip)
      .limit(limit)
      .lean();

    /* =============================
       نعكس الترتيب ليظهر من الأقدم للأحدث
    ============================== */

    return messages.reverse();
  }

  /* =====================================================
     SEARCH
  ===================================================== */

  async search(
    chatId: string,
    userId: string,
    query: string
  ) {

    return Message.find({
      chat: chatId,
      content: { $regex: query, $options: "i" },
      deletedForEveryone: false,
      deletedFor: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
  }
}

export default new MessageService();
