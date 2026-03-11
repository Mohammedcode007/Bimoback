import Message from "../models/Message";
import Chat from "../models/Chats";
import Notification from "../models/Notification";
import { checkRelationship } from "../utils/relationship";
import { getIO } from "../config/socket";
import mongoose from "mongoose";
import User from "../models/User";
import { activeChats } from "../sockets/socketState";
import notificationService from "./notification.service";

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
  replyTo?: string,
  clientTempId?: string
) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat id");
  }
  if (!mongoose.Types.ObjectId.isValid(senderId)) {
    throw new Error("Invalid sender id");
  }

  const chatObjectId = new mongoose.Types.ObjectId(chatId);
  const senderObjectId = new mongoose.Types.ObjectId(senderId);

  const chat = await Chat.findById(chatObjectId);
  if (!chat) throw new Error("Chat not found");

  const targetId =
    chat.participants.find((id) => id.toString() !== senderId)?.toString();

  if (!targetId) throw new Error("Target not found");
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new Error("Invalid target id");
  }

  const relation = await checkRelationship(senderId, targetId);
  if (relation.blocked) {
    throw new Error("You cannot send message");
  }

  /* =====================================================
     CREATE MESSAGE
  ===================================================== */

  const message = await Message.create({
    chat: chatObjectId,
    sender: senderObjectId,
    type,
    content,
    clientTempId,
    media: media || undefined,
    replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : undefined,
    reactions: [],
    deliveryStatus: {
      deliveredTo: [],
      seenBy: [],
      deliveredAt: undefined,
      seenAt: undefined,
    },
    status: "sent",
    deletedForEveryone: false,
    deletedFor: [],
    edited: false,
    isSystemMessage: false,
  });

  const io = getIO();

  /* =====================================================
     TARGET STATUS
  ===================================================== */

  const targetUser = await User.findById(targetId).select("isInvisible");

  const targetSockets = io.sockets.adapter.rooms.get(targetId);
  const isTargetOnline = !!targetSockets && targetSockets.size > 0;

  /* =====================================================
     CHECK IF TARGET INSIDE CHAT ROOM
  ===================================================== */

  let isTargetInsideRoom = false;

  const room = io.sockets.adapter.rooms.get(`chat:${chatId}`);
  if (room) {
    for (const socketId of room) {
      const s = io.sockets.sockets.get(socketId);
      if (s?.data.userId === targetId) {
        isTargetInsideRoom = true;
        break;
      }
    }
  }

  /* =====================================================
     DELIVERY / SEEN LOGIC
  ===================================================== */

  if (!targetUser?.isInvisible && isTargetOnline && isTargetInsideRoom) {
    message.deliveryStatus.deliveredTo.push(new mongoose.Types.ObjectId(targetId));
    message.deliveryStatus.seenBy.push(new mongoose.Types.ObjectId(targetId));

    message.status = "seen";
    message.deliveryStatus.deliveredAt = new Date();
    message.deliveryStatus.seenAt = new Date();

    await message.save();
  } else if (!targetUser?.isInvisible && relation.isFriend && isTargetOnline) {
    message.deliveryStatus.deliveredTo.push(new mongoose.Types.ObjectId(targetId));

    message.status = "delivered";
    message.deliveryStatus.deliveredAt = new Date();

    await message.save();
  }

  /* =====================================================
     UPDATE CHAT META + RESTORE IF DELETED (Atomic)
  ===================================================== */

  await Chat.updateOne(
    { _id: chatObjectId },
    {
      $set: {
        lastMessage: message._id,
        lastMessagePreview: content,
        lastMessageType: type,
        updatedAt: new Date(),
      },
      // ✅ استرجاع المحادثة للطرفين لو كانت محذوفة عند أحدهما
      $pull: {
        deletedFor: {
          $in: [new mongoose.Types.ObjectId(targetId), senderObjectId],
        },
      },
    }
  );

  /* =====================================================
     ATOMIC UNREAD INCREMENT
  ===================================================== */

  let updatedUnread = 0;

  if (!isTargetInsideRoom) {
    const updatedChat = await Chat.findByIdAndUpdate(
      chatObjectId, // ✅ استخدم ObjectId
      { $inc: { [`unreadCounts.${targetId}`]: 1 } },
      { new: true }
    );

    updatedUnread = updatedChat?.unreadCounts?.[targetId] || 0;

    io.to(targetId).emit("chat:unread:update", {
      chatId,
      unreadCount: updatedUnread,
    });
  }

  /* =====================================================
     ✅ BUILD CHAT SNAPSHOT FOR INBOX (حل أول مرة)
  ===================================================== */

  const chatSnap = await Chat.findById(chatObjectId)
    .populate("participants", "username avatar isOnline isInvisible lastSeen")
    .populate("lastMessage")
    .lean();

  /* =====================================================
     🔥 INBOX REALTIME UPDATE (FULL CHAT SNAP)
  ===================================================== */

  io.to(targetId).emit("chat:inbox:update", {
    chat: chatSnap,
    unreadCount: updatedUnread,
  });

  io.to(senderId).emit("chat:inbox:update", {
    chat: chatSnap,
    unreadCount: 0,
  });

  /* =====================================================
     ✅ EMIT MESSAGE (ACTIVE CHAT ROOM)
  ===================================================== */

  io.to(`chat:${chatId}`).emit("chat:new", message);

  /* =====================================================
     EMIT SEEN IF ACTIVE
  ===================================================== */

  if (isTargetInsideRoom && isTargetOnline && !targetUser?.isInvisible) {
    io.to(`chat:${chatId}`).emit("chat:seen:update", {
      chatId,
      userId: targetId,
      messageIds: [message._id],
    });
  }

  /* =====================================================
     OFFLINE NOTIFICATION
  ===================================================== */

 
// if (!isTargetOnline) {
//   await notificationService.create({
//     recipient: targetId,
//     sender: senderId,
//     type: "message",
//     body: content,
//     relatedChat: chatId,
//     isRead: false,
//     isDeleted: false,
//   });

//   const chats = await Chat.find({
//     participants: targetId,
//     deletedFor: { $ne: targetId },
//   }).lean();

//   let totalUnread = 0;
//   chats.forEach((c) => {
//     totalUnread += c.unreadCounts?.[targetId] || 0;
//   });

//   io.to(targetId).emit("notification:unreadTotal", totalUnread);
// }
/* =====================================================
   NOTIFICATION LOGIC
   - inside same chat => no notification
   - outside same chat => create notification
   - offline => create notification
===================================================== */

/* =====================================================
   NOTIFICATION / PUSH LOGIC
   داخل نفس الشات => لا إشعار
   خارج نفس الشات => إشعار + Push
   Offline => إشعار + Push
===================================================== */

if (!isTargetInsideRoom) {
  await notificationService.create({
    recipient: targetId,
    sender: senderId,
    type: "message",
    body: content,
    relatedChat: chatId,
    isRead: false,
    isDeleted: false,
  });

  const chats = await Chat.find({
    participants: targetId,
    deletedFor: { $ne: targetId },
  }).lean();

  let totalUnread = 0;
  chats.forEach((c) => {
    totalUnread += c.unreadCounts?.[targetId] || 0;
  });

  io.to(targetId).emit("notification:unreadTotal", totalUnread);
}
  return message;
}


  /* =====================================================
     MARK AS DELIVERED (ON JOIN)
  ===================================================== */

  async markAsDelivered(chatId: string, userId: string) {

    const messagesToUpdate = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      "deliveryStatus.deliveredTo": { $ne: userId }
    }).select("_id");

    if (messagesToUpdate.length === 0) return;

    const messageIds = messagesToUpdate.map(m => m._id);

    await Message.updateMany(
      { _id: { $in: messageIds } },
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
      { chatId, userId, messageIds }
    );
  }

  async markAsSeen(chatId: string, userId: string) {


    if (!mongoose.Types.ObjectId.isValid(chatId))
      return;

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const chatObjectId = new mongoose.Types.ObjectId(chatId);

    /* =====================================================
       🔥 ACTIVE CHAT CHECK (الأهم)
    ===================================================== */

   const activeChatId = activeChats.get(userId);

if (!activeChatId || activeChatId.toString() !== chatId.toString()) {
  return;
}


    /* ================= CHECK USER ================= */

    const user = await User.findById(userObjectId)
      .select("isInvisible");

    if (!user) return;

    /* ================= INVISIBLE MODE ================= */

    if (user.isInvisible) {


      await Chat.updateOne(
        { _id: chatObjectId },
        { $set: { [`unreadCounts.${userId}`]: 0 } }
      );

      return;
    }

    /* ================= CHECK CHAT ================= */

    const chat = await Chat.findOne({
      _id: chatObjectId,
      participants: userObjectId
    });

    if (!chat) return;

    /* ================= GET MESSAGE IDS ================= */

    const messagesToUpdate = await Message.find({
      chat: chatObjectId,
      sender: { $ne: userObjectId },
      deletedForEveryone: false,
      deletedFor: { $ne: userObjectId },
      "deliveryStatus.seenBy": { $ne: userObjectId }
    }).select("_id");

    if (messagesToUpdate.length === 0) {

      await Chat.updateOne(
        { _id: chatObjectId },
        { $set: { [`unreadCounts.${userId}`]: 0 } }
      );

      return;
    }

    const messageIds = messagesToUpdate.map(m => m._id);

    /* ================= UPDATE MESSAGES ================= */

    await Message.updateMany(
      { _id: { $in: messageIds } },
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

    /* ================= RESET UNREAD ================= */

    await Chat.updateOne(
      { _id: chatObjectId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    );

    /* ================= EMIT SOCKET ================= */

    const io = getIO();

    io.to(`chat:${chatId}`).emit(
      "chat:seen:update",
      {
        chatId,
        userId,
        messageIds
      }
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
// داخل MessageService class

async sendContactUsText(senderId: string, content: string) {
 

  try {
    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      console.log("[sendContactUsText] ❌ Invalid sender id");
      throw new Error("Invalid sender id");
    }

    const text = (content ?? "").trim();

    if (!text) {
      throw new Error("Message content is required");
    }

    if (text.length > 2000) {
      throw new Error("Message too long");
    }

    const contactKey = process.env.CONTACT_US_USER_ID; // ممكن يكون ObjectId أو username مثل "contact"

    if (!contactKey) {
      throw new Error("CONTACT_US_USER_ID is missing");
    }

    // ✅ resolve contact user: إذا ObjectId استخدمه، غير ذلك اعتبره username
    let supportUserIdObj: mongoose.Types.ObjectId;
    if (mongoose.Types.ObjectId.isValid(contactKey)) {
      supportUserIdObj = new mongoose.Types.ObjectId(contactKey);
    } else {

      const supportUser = await User.findOne({ username: contactKey }).select("_id username");
      if (!supportUser) {
        throw new Error("Contact us account not found");
      }

      supportUserIdObj = supportUser._id as any;
    }

    const contactUsId = supportUserIdObj.toString();

    // منع إرسال المستخدم لنفسه لو حدث خطأ في الإعداد
    if (contactUsId === senderId.toString()) {
      throw new Error("Invalid contact us user");
    }

    const senderObjectId = new mongoose.Types.ObjectId(senderId);

    /* =====================================================
       FIND EXISTING CHAT
    ===================================================== */

    let chat = await Chat.findOne({
      participants: { $all: [senderObjectId, supportUserIdObj] },
      // لو عندك type للخاص أضفها هنا:
      // type: "private",
    });

    if (chat) {
    }

    /* =====================================================
       CREATE CHAT IF NOT EXISTS
    ===================================================== */
    if (!chat) {

      chat = await Chat.create({
        participants: [senderObjectId, supportUserIdObj],
        unreadCounts: {
          [contactUsId]: 0,
          [senderId]: 0,
        },
        deletedFor: [],
        // لو عندك حقول إلزامية أضفها هنا
      });

    }

    /* =====================================================
       SEND MESSAGE (TEXT ONLY)
    ===================================================== */

    const message = await this.send(
      chat._id.toString(),
      senderId,
      text,
      "text",
      undefined, // media ممنوعة
      undefined, // replyTo
      undefined  // clientTempId
    );

 

    return message;
  } catch (error: any) {
 
    throw error;
  }
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

    return messages;
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
