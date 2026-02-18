import Chat from "../models/Chats";
import mongoose from "mongoose";
import Message from "../models/Message";
import User from "../models/User";
import { getIO } from "../config/socket";

class ChatService {

  /* =====================================================
     CREATE OR GET PRIVATE CHAT
  ===================================================== */

  async createOrGetPrivateChat(userId: string, targetId: string) {

  if (userId === targetId)
    throw new Error("Cannot create chat with yourself");

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const existing = await Chat.findOne({
    participants: { $all: [userId, targetId] }
  });

  if (existing) {

    if (existing.deletedFor?.some(id => id.equals(userObjectId))) {

      await Chat.updateOne(
        { _id: existing._id },
        {
          $pull: { deletedFor: userObjectId }
        }
      );

      const restored = await Chat.findById(existing._id);

      return restored;
    }

    return existing;
  }

  const chat = await Chat.create({
    participants: [userId, targetId],
    unreadCounts: {
      [userId]: 0,
      [targetId]: 0
    }
  });

  return chat;
}


  /* =====================================================
     GET USER CHATS
  ===================================================== */

  async getUserChats(userId: string) {

    const chats = await Chat.find({
      participants: userId,
      deletedFor: { $ne: userId }
    })
      .populate(
        "participants",
        "username avatar isOnline isInvisible lastSeen"
      )
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();

    return chats.map(chat => {

      const unreadCount =
        chat.unreadCounts?.[userId] || 0;

      return {
        ...chat,
        unreadCount
      };
    });
  }

  /* =====================================================
     DELETE CHAT FOR ME
  ===================================================== */

async deleteForMe(chatId: string, userId: string) {

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const chatObjectId = new mongoose.Types.ObjectId(chatId);

  /* ==========================================
     1) Mark chat deleted for this user
        + Reset unread counter
  ========================================== */

  const chat = await Chat.findOneAndUpdate(
    {
      _id: chatObjectId,
      participants: userObjectId
    },
    {
      $addToSet: { deletedFor: userObjectId },
      $set: {
        [`unreadCounts.${userId}`]: 0
      }
    },
    { new: true }
  );

  if (!chat) {
    throw new Error("Chat not found or access denied");
  }

  /* ==========================================
     2) Mark ALL messages deleted for this user
  ========================================== */

  await Message.updateMany(
    {
      chat: chatObjectId,
      deletedFor: { $ne: userObjectId }
    },
    {
      $addToSet: { deletedFor: userObjectId }
    }
  );

  return { success: true };
}


/* =====================================================
   MARK CHAT AS SEEN
===================================================== */

async markAsSeen(chatId: string, userId: string) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👀 [markAsSeen] START");
  console.log("ChatId:", chatId);
  console.log("UserId:", userId);

  try {

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return { success: false };
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const chatObjectId = new mongoose.Types.ObjectId(chatId);

    /* ==========================================
       0) CHECK USER
    ========================================== */

    const user = await User.findById(userObjectId)
      .select("isInvisible");

    if (!user) {
      console.log("❌ User not found");
      return { success: false };
    }

    /* ==========================================
       1) INVISIBLE MODE
    ========================================== */

    if (user.isInvisible) {

      console.log("🚫 User is invisible → Skip seen update");

      await Chat.updateOne(
        { _id: chatObjectId },
        { $set: { [`unreadCounts.${userId}`]: 0 } }
      );

      return { success: true };
    }

    /* ==========================================
       2) CHECK MEMBERSHIP
    ========================================== */

    const chat = await Chat.findOne({
      _id: chatObjectId,
      participants: userObjectId
    });

    if (!chat) {
      console.log("❌ Chat not found or access denied");
      throw new Error("Access denied");
    }

    /* ==========================================
       3) GET MESSAGE IDS TO UPDATE
    ========================================== */

    const messagesToUpdate = await Message.find({
      chat: chatObjectId,
      sender: { $ne: userObjectId },       // ليس رسائلي
      deletedForEveryone: false,
      deletedFor: { $ne: userObjectId },   // غير محذوفة لي
      "deliveryStatus.seenBy": { $ne: userObjectId }
    }).select("_id");

    const messageIds = messagesToUpdate.map(m => m._id);

    /* ==========================================
       4) UPDATE IF NEEDED
    ========================================== */

    if (messageIds.length > 0) {

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

      const io = getIO();

      io.to(`chat:${chatId}`).emit(
        "chat:seen:update",
        {
          chatId,
          userId,
          messageIds   // 🔥 مهم جداً للفرونت
        }
      );

      console.log("Seen messages updated:", messageIds.length);
    }

    /* ==========================================
       5) RESET UNREAD
    ========================================== */

    await Chat.updateOne(
      { _id: chatObjectId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    );

    console.log("👀 [markAsSeen] SUCCESS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return { success: true };

  } catch (error: any) {

    console.log("❌ [markAsSeen] ERROR");
    console.log(error.message);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    throw error;
  }
}




  /* =====================================================
     GET TOTAL UNREAD
  ===================================================== */

  async getTotalUnread(userId: string) {

    const chats = await Chat.find({
      participants: userId,
      deletedFor: { $ne: userId }
    }).lean();

    let total = 0;

    chats.forEach(chat => {
      total += chat.unreadCounts?.[userId] || 0;
    });

    return total;
  }

}

export default new ChatService();
