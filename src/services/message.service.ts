import Message from "../models/Message";
import Chat from "../models/Chats";
import Notification from "../models/Notification";
import { checkRelationship } from "../utils/relationship";
import { getIO } from "../config/socket";
import mongoose from "mongoose";
import User from "../models/User";

class MessageService {

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

// async send(
//   chatId: string,
//   senderId: string,
//   content: string,
//   type: string = "text",
//   media?: any,
//   replyTo?: string,
//   clientTempId?: string
// ) {

//   if (!mongoose.Types.ObjectId.isValid(chatId)) {
//     throw new Error("Invalid chat id");
//   }

//   const chat = await Chat.findById(chatId);
//   if (!chat) throw new Error("Chat not found");

//   const targetId = chat.participants.find(
//     id => id.toString() !== senderId
//   )?.toString();

//   if (!targetId) throw new Error("Target not found");

//   const relation = await checkRelationship(senderId, targetId);
//   if (relation.blocked) {
//     throw new Error("You cannot send message");
//   }

//   /* ================= CREATE MESSAGE ================= */

//  const message = await Message.create({
//   chat: new mongoose.Types.ObjectId(chatId),

//   sender: new mongoose.Types.ObjectId(senderId),

//   type,
//   content,

//   clientTempId,

//   media: media || undefined,

//   replyTo: replyTo
//     ? new mongoose.Types.ObjectId(replyTo)
//     : undefined,

//   reactions: [],

//   deliveryStatus: {
//     deliveredTo: [],
//     seenBy: [],
//     deliveredAt: undefined,
//     seenAt: undefined
//   },

//   status: "sent",

//   deletedForEveryone: false,
//   deletedFor: [],

//   edited: false,

//   isSystemMessage: false
// });


//   const io = getIO();

//   /* ================= DELIVERY CHECK ================= */

// /* ================= DELIVERY CHECK ================= */

// const targetUser = await User.findById(targetId)
//   .select("isInvisible");

// const targetSockets =
//   io.sockets.adapter.rooms.get(targetId);

// const isTargetOnline =
//   !!targetSockets && targetSockets.size > 0;

// if (
//   relation.isFriend &&
//   isTargetOnline &&
//   !targetUser?.isInvisible
// ) {

//   message.deliveryStatus.deliveredTo.push(
//     new mongoose.Types.ObjectId(targetId)
//   );

//   message.status = "delivered";
//   message.deliveryStatus.deliveredAt = new Date();

//   await message.save();
// }


//   /* ================= UPDATE CHAT ================= */

//   chat.lastMessage = message._id;
//   chat.lastMessagePreview = content;
//   chat.lastMessageType = type;
//   chat.updatedAt = new Date();

//   const room = io.sockets.adapter.rooms.get(`chat:${chatId}`);

//   let isTargetInRoom = false;

//   if (room) {
//     for (const socketId of room) {
//       const s = io.sockets.sockets.get(socketId);
//       if (s?.data.userId === targetId) {
//         isTargetInRoom = true;
//         break;
//       }
//     }
//   }

//   if (!isTargetInRoom) {

//     const currentUnread =
//       chat.unreadCounts?.[targetId] || 0;

//     chat.unreadCounts[targetId] = currentUnread + 1;
//   }

//   await chat.save();

//   /* ================= EMIT MESSAGE ================= */

//   // 🔥 إرسال مرة واحدة فقط للغرفة
//   io.to(`chat:${chatId}`).emit("chat:new", message);

//   /* ================= OFFLINE NOTIFICATION ================= */

//   if (!isTargetOnline) {

//     await Notification.create({
//       recipient: targetId,
//       sender: senderId,
//       type: "message",
//       body: content,
//       relatedChat: chatId
//     });

//     const chats = await Chat.find({
//       participants: targetId,
//       deletedFor: { $ne: targetId }
//     }).lean();

//     let totalUnread = 0;

//     chats.forEach(c => {
//       totalUnread += c.unreadCounts?.[targetId] || 0;
//     });

//     io.to(targetId).emit(
//       "notification:unreadTotal",
//       totalUnread
//     );
//   }

//   return message;
// }


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

  const chatObjectId = new mongoose.Types.ObjectId(chatId);
  const senderObjectId = new mongoose.Types.ObjectId(senderId);

  const chat = await Chat.findById(chatObjectId);
  if (!chat) throw new Error("Chat not found");

  const targetId = chat.participants
    .find(id => id.toString() !== senderId)
    ?.toString();

  if (!targetId) throw new Error("Target not found");

  const relation = await checkRelationship(senderId, targetId);
  if (relation.blocked) {
    throw new Error("You cannot send message");
  }

  /* ================= CREATE MESSAGE ================= */

  const message = await Message.create({
    chat: chatObjectId,
    sender: senderObjectId,
    type,
    content,
    clientTempId,
    media: media || undefined,
    replyTo: replyTo
      ? new mongoose.Types.ObjectId(replyTo)
      : undefined,
    reactions: [],
    deliveryStatus: {
      deliveredTo: [],
      seenBy: [],
      deliveredAt: undefined,
      seenAt: undefined
    },
    status: "sent",
    deletedForEveryone: false,
    deletedFor: [],
    edited: false,
    isSystemMessage: false
  });

  const io = getIO();

  /* =====================================================
     CHECK TARGET STATUS
  ===================================================== */

  const targetUser = await User.findById(targetId)
    .select("isInvisible");

  const targetSockets =
    io.sockets.adapter.rooms.get(targetId);

  const isTargetOnline =
    !!targetSockets && targetSockets.size > 0;

  /* =====================================================
     CHECK IF TARGET INSIDE CHAT ROOM
  ===================================================== */

  const room = io.sockets.adapter.rooms.get(`chat:${chatId}`);

  let isTargetInRoom = false;

  if (room) {
    for (const socketId of room) {
      const s = io.sockets.sockets.get(socketId);
      if (s?.data.userId === targetId) {
        isTargetInRoom = true;
        break;
      }
    }
  }

  /* =====================================================
     DELIVERY / SEEN LOGIC
  ===================================================== */

  if (!targetUser?.isInvisible) {

    // الحالة 1: داخل الشات → Seen فوري
    if (isTargetInRoom) {

      message.deliveryStatus.deliveredTo.push(
        new mongoose.Types.ObjectId(targetId)
      );

      message.deliveryStatus.seenBy.push(
        new mongoose.Types.ObjectId(targetId)
      );

      message.status = "seen";
      message.deliveryStatus.deliveredAt = new Date();
      message.deliveryStatus.seenAt = new Date();

      await message.save();

    }

    // الحالة 2: Online خارج الشات → Delivered فقط
    else if (relation.isFriend && isTargetOnline) {

      message.deliveryStatus.deliveredTo.push(
        new mongoose.Types.ObjectId(targetId)
      );

      message.status = "delivered";
      message.deliveryStatus.deliveredAt = new Date();

      await message.save();
    }
  }

  /* =====================================================
     UPDATE CHAT META
  ===================================================== */

  chat.lastMessage = message._id;
  chat.lastMessagePreview = content;
  chat.lastMessageType = type;
  chat.updatedAt = new Date();

  if (!isTargetInRoom) {
    const currentUnread =
      chat.unreadCounts?.[targetId] || 0;

    chat.unreadCounts[targetId] = currentUnread + 1;
  }

  await chat.save();

  /* =====================================================
     EMIT EVENTS
  ===================================================== */

  io.to(`chat:${chatId}`).emit("chat:new", message);

  // إذا تم تسجيل seen فورًا
  if (isTargetInRoom && !targetUser?.isInvisible) {

    io.to(`chat:${chatId}`).emit(
      "chat:seen:update",
      {
        chatId,
        userId: targetId,
        messageIds: [message._id]
      }
    );
  }

  /* =====================================================
     OFFLINE NOTIFICATION
  ===================================================== */

  if (!isTargetOnline) {

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

    io.to(targetId).emit(
      "notification:unreadTotal",
      totalUnread
    );
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


  /* =====================================================
     MARK AS SEEN
  ===================================================== */

async markAsSeen(chatId: string, userId: string) {

  console.log("━━━━━━━━ MARK AS SEEN START ━━━━━━━━");

  if (!mongoose.Types.ObjectId.isValid(chatId))
    return;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const chatObjectId = new mongoose.Types.ObjectId(chatId);

  /* ================= CHECK USER ================= */

  const user = await User.findById(userObjectId)
    .select("isInvisible");

  if (!user) return;

  /* ================= INVISIBLE MODE ================= */

  if (user.isInvisible) {

    console.log("🚫 User is invisible → skip seen");

    // نصفر unread فقط بدون تعديل الرسائل
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

  /* ================= GET MESSAGE IDS TO UPDATE ================= */

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
      messageIds   // 🔥 مهم جدًا
    }
  );

  console.log("Seen messages:", messageIds.length);
  console.log("━━━━━━━━ MARK AS SEEN END ━━━━━━━━");
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
