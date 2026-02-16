// import Chat from "../models/Chats";
// import Friend from "../models/Friend";
// import Message from "../models/Message";
// import User from "../models/User";
// import mongoose from "mongoose";

// class ChatService {

//   /* ================= PERMISSION CHECK ================= */

//   private async validatePermission(userId: string, targetId: string) {

//     const userObjectId = new mongoose.Types.ObjectId(userId);
//     const targetObjectId = new mongoose.Types.ObjectId(targetId);

//     if (userObjectId.equals(targetObjectId))
//       throw new Error("Cannot chat with yourself");

//     const relation = await Friend.findOne({
//       $or: [
//         { requester: userObjectId, recipient: targetObjectId, status: "accepted" },
//         { requester: targetObjectId, recipient: userObjectId, status: "accepted" }
//       ]
//     });

//     if (!relation)
//       throw new Error("You can only chat with friends");

//     const targetUser = await User.findById(targetObjectId);

//     if (!targetUser)
//       throw new Error("User not found");

//     if (targetUser.blockedUsers.some(id => id.equals(userObjectId)))
//       throw new Error("You are blocked");

//     return true;
//   }

//   /* ================= GET OR CREATE ================= */

//   async getOrCreateChat(userId: string, targetId: string) {

//     await this.validatePermission(userId, targetId);

//     const userObjectId = new mongoose.Types.ObjectId(userId);
//     const targetObjectId = new mongoose.Types.ObjectId(targetId);

//     let chat = await Chat.findOne({
//       participants: {
//         $all: [userObjectId, targetObjectId],
//         $size: 2
//       }
//     });

//     if (chat) {

//       if (chat.deletedFor?.some(id => id.equals(userObjectId))) {
//         chat.deletedFor = chat.deletedFor.filter(
//           id => !id.equals(userObjectId)
//         );
//         await chat.save();
//       }

//       return chat;
//     }

//     chat = await Chat.create({
//       participants: [userObjectId, targetObjectId],
//       unreadCounts: new Map([
//         [userId, 0],
//         [targetId, 0]
//       ])
//     });

//     return chat;
//   }

//   /* ================= LIST CHATS ================= */

//   async listChats(userId: string) {

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     const chats = await Chat.find({
//       participants: userObjectId,
//       deletedFor: { $ne: userObjectId }
//     })
//       .sort({ updatedAt: -1 });

//     if (!chats.length) return [];

//     const lastMessageIds = chats
//       .map(c => c.lastMessage)
//       .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

//     const lastMessages = await Message.find({
//       _id: { $in: lastMessageIds },
//       deletedForEveryone: false
//     })
//       .select("content type createdAt reactions deliveryStatus")
//       .lean();

//     const lastMessageMap = new Map(
//       lastMessages.map(m => [m._id.toString(), m])
//     );

//     return chats.map(chat => {

//       const unread = chat.unreadCounts?.get(userId) ?? 0;

//       return {
//         _id: chat._id,
//         participants: chat.participants,
//         updatedAt: chat.updatedAt,
//         unreadCount: unread,
//         lastMessage: chat.lastMessage
//           ? lastMessageMap.get(chat.lastMessage.toString()) ?? null
//           : null
//       };
//     });
//   }

//   /* ================= GET SINGLE CHAT ================= */

//   async getChatById(chatId: string) {

//     const chat = await Chat.findById(chatId)
//       .populate("participants", "username avatar isOnline isInvisible lastSeen");

//     if (!chat) return null;

//     const participants = chat.participants.map((p: any) => {
//       if (p.isInvisible) {
//         return { ...p.toObject(), isOnline: false };
//       }
//       return p;
//     });

//     return {
//       ...chat.toObject(),
//       participants
//     };
//   }

//   /* ================= TOTAL UNREAD ================= */

//   async getTotalUnread(userId: string) {

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     const chats = await Chat.find({
//       participants: userObjectId,
//       deletedFor: { $ne: userObjectId }
//     }).select("unreadCounts");

//     let total = 0;

//     chats.forEach(chat => {
//       total += chat.unreadCounts?.get(userId) ?? 0;
//     });

//     return total;
//   }

//   /* ================= DELETE CHAT ================= */

//   async deleteChatForUser(userId: string, chatId: string) {

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     const chat = await Chat.findById(chatId);

//     if (!chat)
//       throw new Error("Chat not found");

//     if (!chat.participants.some(id => id.equals(userObjectId)))
//       throw new Error("Access denied");

//     if (!chat.deletedFor.some(id => id.equals(userObjectId))) {
//       chat.deletedFor.push(userObjectId);
//       await chat.save();
//     }

//     return true;
//   }

//   /* ================= TOGGLE MUTE ================= */

//   async toggleMute(userId: string, chatId: string) {

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     const chat = await Chat.findById(chatId);
//     if (!chat) throw new Error("Chat not found");

//     const isMuted = chat.mutedBy.some(id => id.equals(userObjectId));

//     if (isMuted) {
//       chat.mutedBy = chat.mutedBy.filter(id => !id.equals(userObjectId));
//     } else {
//       chat.mutedBy.push(userObjectId);
//     }

//     await chat.save();

//     return { muted: !isMuted };
//   }

//   /* ================= TOGGLE ARCHIVE ================= */

//   async toggleArchive(userId: string, chatId: string) {

//     const userObjectId = new mongoose.Types.ObjectId(userId);

//     const chat = await Chat.findById(chatId);
//     if (!chat) throw new Error("Chat not found");

//     const isArchived = chat.archivedBy.some(id => id.equals(userObjectId));

//     if (isArchived) {
//       chat.archivedBy = chat.archivedBy.filter(id => !id.equals(userObjectId));
//     } else {
//       chat.archivedBy.push(userObjectId);
//     }

//     await chat.save();

//     return { archived: !isArchived };
//   }

// }

// export default new ChatService();
import Chat from "../models/Chats";
import Friend from "../models/Friend";
import Message from "../models/Message";
import User from "../models/User";
import mongoose from "mongoose";

class ChatService {

  /* ================= PERMISSION CHECK ================= */

  private async validatePermission(userId: string, targetId: string) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔐 VALIDATE PERMISSION START");
    console.log("👤 User:", userId);
    console.log("🎯 Target:", targetId);

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const targetObjectId = new mongoose.Types.ObjectId(targetId);

    if (userObjectId.equals(targetObjectId)) {
      console.log("❌ Cannot chat with yourself");
      throw new Error("Cannot chat with yourself");
    }

    const relation = await Friend.findOne({
      $or: [
        { requester: userObjectId, recipient: targetObjectId, status: "accepted" },
        { requester: targetObjectId, recipient: userObjectId, status: "accepted" }
      ]
    });

    if (!relation) {
      console.log("❌ Users are not friends");
      throw new Error("You can only chat with friends");
    }

    const targetUser = await User.findById(targetObjectId);

    if (!targetUser) {
      console.log("❌ Target user not found");
      throw new Error("User not found");
    }

    if (targetUser.blockedUsers.some(id => id.equals(userObjectId))) {
      console.log("❌ User is blocked");
      throw new Error("You are blocked");
    }

    console.log("✅ Permission granted");
    console.log("🔐 VALIDATE PERMISSION END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return true;
  }

  /* ================= GET OR CREATE ================= */

  async getOrCreateChat(userId: string, targetId: string) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💬 GET OR CREATE CHAT START");
    console.log("👤 User:", userId);
    console.log("🎯 Target:", targetId);

    await this.validatePermission(userId, targetId);

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const targetObjectId = new mongoose.Types.ObjectId(targetId);

    let chat = await Chat.findOne({
      participants: {
        $all: [userObjectId, targetObjectId],
        $size: 2
      }
    });

    if (chat) {

      console.log("ℹ️ Existing chat found:", chat._id);

      if (chat.deletedFor?.some(id => id.equals(userObjectId))) {
        chat.deletedFor = chat.deletedFor.filter(
          id => !id.equals(userObjectId)
        );
        await chat.save();
        console.log("♻️ Reactivated deleted chat");
      }

      console.log("💬 GET OR CREATE CHAT END");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      return chat;
    }

    chat = await Chat.create({
      participants: [userObjectId, targetObjectId],
      unreadCounts: new Map([
        [userId, 0],
        [targetId, 0]
      ])
    });

    console.log("🆕 New chat created:", chat._id);
    console.log("💬 GET OR CREATE CHAT END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return chat;
  }

  /* ================= LIST CHATS ================= */

 async listChats(userId: string) {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 LIST CHATS START");
  console.log("👤 User:", userId);

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const chats = await Chat.find({
    participants: userObjectId,
    deletedFor: { $ne: userObjectId }
  })
    .populate("participants", "username avatar isOnline isInvisible lastSeen")
    .sort({ updatedAt: -1 });

  console.log("📊 Chats found:", chats.length);

  if (!chats.length) {
    console.log("⚠ No chats");
    return [];
  }

  const lastMessageIds = chats
    .map(c => c.lastMessage)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

  const lastMessages = await Message.find({
    _id: { $in: lastMessageIds },
    deletedForEveryone: false
  })
    .select("content type createdAt deliveryStatus")
    .lean();

  const lastMessageMap = new Map(
    lastMessages.map(m => [m._id.toString(), m])
  );

  const result = chats.map(chat => {

    const unread = chat.unreadCounts?.get(userId) ?? 0;

    const participants = chat.participants.map((p: any) => {

      if (p.isInvisible) {
        return { ...p.toObject(), isOnline: false };
      }

      return p;
    });

    return {
      _id: chat._id,
      participants,
      updatedAt: chat.updatedAt,
      unreadCount: unread,
      lastMessage: chat.lastMessage
        ? lastMessageMap.get(chat.lastMessage.toString()) ?? null
        : null
    };
  });

  console.log("📋 LIST CHATS END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return result;
}


  /* ================= GET SINGLE CHAT ================= */

  async getChatById(chatId: string) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔎 GET CHAT BY ID START");
    console.log("💬 Chat:", chatId);

    const chat = await Chat.findById(chatId)
      .populate("participants", "username avatar isOnline isInvisible lastSeen");

    if (!chat) {
      console.log("❌ Chat not found");
      return null;
    }

    const participants = chat.participants.map((p: any) => {
      if (p.isInvisible) {
        return { ...p.toObject(), isOnline: false };
      }
      return p;
    });

    console.log("✅ Chat fetched");
    console.log("🔎 GET CHAT BY ID END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return {
      ...chat.toObject(),
      participants
    };
  }

  /* ================= TOTAL UNREAD ================= */

  async getTotalUnread(userId: string) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 GET TOTAL UNREAD START");
    console.log("👤 User:", userId);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const chats = await Chat.find({
      participants: userObjectId,
      deletedFor: { $ne: userObjectId }
    }).select("unreadCounts");

    let total = 0;

    chats.forEach(chat => {
      total += chat.unreadCounts?.get(userId) ?? 0;
    });

    console.log("📊 Total unread:", total);
    console.log("📊 GET TOTAL UNREAD END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return total;
  }

  /* ================= DELETE CHAT ================= */

  async deleteChatForUser(userId: string, chatId: string) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🗑 DELETE CHAT START");
    console.log("👤 User:", userId);
    console.log("💬 Chat:", chatId);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const chat = await Chat.findById(chatId);

    if (!chat) {
      console.log("❌ Chat not found");
      throw new Error("Chat not found");
    }

    if (!chat.participants.some(id => id.equals(userObjectId))) {
      console.log("❌ Access denied");
      throw new Error("Access denied");
    }

    if (!chat.deletedFor.some(id => id.equals(userObjectId))) {
      chat.deletedFor.push(userObjectId);
      await chat.save();
      console.log("✅ Chat soft deleted");
    }

    console.log("🗑 DELETE CHAT END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return true;
  }

  /* ================= TOGGLE MUTE ================= */

  async toggleMute(userId: string, chatId: string) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔕 TOGGLE MUTE START");
    console.log("👤 User:", userId);
    console.log("💬 Chat:", chatId);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const chat = await Chat.findById(chatId);
    if (!chat) throw new Error("Chat not found");

    const isMuted = chat.mutedBy.some(id => id.equals(userObjectId));

    if (isMuted) {
      chat.mutedBy = chat.mutedBy.filter(id => !id.equals(userObjectId));
      console.log("🔔 Unmuted");
    } else {
      chat.mutedBy.push(userObjectId);
      console.log("🔕 Muted");
    }

    await chat.save();

    console.log("🔕 TOGGLE MUTE END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return { muted: !isMuted };
  }

  /* ================= TOGGLE ARCHIVE ================= */

  async toggleArchive(userId: string, chatId: string) {

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 TOGGLE ARCHIVE START");
    console.log("👤 User:", userId);
    console.log("💬 Chat:", chatId);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const chat = await Chat.findById(chatId);
    if (!chat) throw new Error("Chat not found");

    const isArchived = chat.archivedBy.some(id => id.equals(userObjectId));

    if (isArchived) {
      chat.archivedBy = chat.archivedBy.filter(id => !id.equals(userObjectId));
      console.log("📤 Unarchived");
    } else {
      chat.archivedBy.push(userObjectId);
      console.log("📥 Archived");
    }

    await chat.save();

    console.log("📦 TOGGLE ARCHIVE END");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return { archived: !isArchived };
  }

}

export default new ChatService();
