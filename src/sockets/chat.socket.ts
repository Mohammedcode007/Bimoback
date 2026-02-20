import { Server, Socket } from "socket.io";
import Chat from "../models/Chats";
import messageService from "../services/message.service";
import { checkRelationship } from "../utils/relationship";
import mongoose from "mongoose";
import { activeChats } from "./socketState";
// key = userId
// value = chatId المفتوح حاليًا

export const chatSocket = (io: Server, socket: Socket) => {

  const userId: string = socket.data.userId;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🟢 SOCKET CONNECTED");
  console.log("🔌 Socket ID:", socket.id);
  console.log("👤 User ID:", userId);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!userId) {
    console.log("❌ No userId in socket.data");
    return;
  }

  /* =====================================================
     IMPORTANT: PERSONAL ROOM
  ===================================================== */

  socket.join(userId); // 🔥 مهم جدا للإشعارات
  console.log("🏠 Joined personal room:", userId);

  /* =====================================================
     JOIN CHAT ROOM
  ===================================================== */
socket.on("chat:join", async ({ chatId }) => {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📥 CHAT JOIN REQUEST");
  console.log("👤 User:", userId);
  console.log("💬 Chat ID:", chatId);

  try {

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      console.log("❌ Invalid chat id");
      return;
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      console.log("❌ Chat not found or access denied");
      return;
    }

    /* =========================
       🔥 إزالة الشات النشط السابق
    ========================= */

    activeChats.delete(userId);

    /* =========================
       🔥 تسجيل الشات الحالي كنشط
    ========================= */

activeChats.set(userId, chatId.toString());

    /* =========================
       Join Room
    ========================= */

    socket.join(`chat:${chatId}`);

    console.log("✅ Joined room:", `chat:${chatId}`);

    /* =========================
       Delivery Only
    ========================= */

    await messageService.markAsDelivered(
      chatId,
      userId
    );

    console.log("📬 markAsDelivered executed");

    /* =========================
       🔥 Seen لأن المستخدم فعلاً فتح المحادثة
    ========================= */

    await messageService.markAsSeen(
      chatId,
      userId
    );

    console.log("👁 markAsSeen executed");

  } catch (error) {
    console.error("❌ chat:join error:", error);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

  // socket.on("chat:join", async ({ chatId }) => {

  //   console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  //   console.log("📥 CHAT JOIN REQUEST");
  //   console.log("👤 User:", userId);
  //   console.log("💬 Chat ID:", chatId);

  //   try {

  //     if (!mongoose.Types.ObjectId.isValid(chatId)) {
  //       console.log("❌ Invalid chat id");
  //       return;
  //     }

  //     const chat = await Chat.findOne({
  //       _id: chatId,
  //       participants: userId
  //     });

  //     if (!chat) {
  //       console.log("❌ Chat not found or access denied");
  //       return;
  //     }

  //     socket.join(`chat:${chatId}`);

  //     const roomSize =
  //       io.sockets.adapter.rooms.get(`chat:${chatId}`)?.size || 0;

  //     console.log("✅ Joined room:", `chat:${chatId}`);
  //     console.log("👥 Room socket count:", roomSize);

  //     await messageService.markAsDelivered(
  //       chatId,
  //       userId
  //     );

  //     console.log("📬 markAsDelivered executed");

  //   } catch (error) {
  //     console.error("❌ chat:join error:", error);
  //   }

  //   console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  // });

/* =====================================================
   SEND MESSAGE
===================================================== */

socket.on("chat:send", async (data) => {

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📤 CHAT SEND EVENT START");
  console.log("👤 Sender:", userId);
  console.log("📦 Payload:", data);

  try {

    const {
      chatId,
      content,
      type,
      media,
      replyTo,
      clientTempId
    } = data;

    console.log("🔎 Parsed values:");
    console.log("ChatId:", chatId);
    console.log("Content:", content);
    console.log("ClientTempId:", clientTempId);

    if (!chatId || !content) {
      console.log("❌ Invalid payload");
      return;
    }

    /* =========================
       1️⃣ حفظ الرسالة
    ========================= */

    console.log("💾 Saving message to DB...");

    const message = await messageService.send(
      chatId,
      userId,
      content,
      type,
      media,
      replyTo,
      clientTempId
    );

    console.log("✅ Message saved");
    console.log("🆔 Message ID:", message._id);
    console.log("🕒 CreatedAt:", message.createdAt);

    /* =========================
       2️⃣ تحويل إلى Object
    ========================= */

    const messageObject = {
      ...message.toObject(),
      clientTempId
    };

    console.log("📦 Message Object Prepared:");
    console.log("ID:", messageObject._id);
    console.log("Chat:", messageObject.chat);
    console.log("UpdatedAt:", messageObject.updatedAt);

    /* =========================
       3️⃣ فحص الغرفة
    ========================= */

    const roomName = `chat:${chatId}`;

    const room = io.sockets.adapter.rooms.get(roomName);

    const roomSize = room ? room.size : 0;

    console.log("🏠 Room:", roomName);
    console.log("👥 Room socket count:", roomSize);

    console.log("📋 Active Chats Map:");
    console.log(activeChats);

    /* =========================
       4️⃣ البث
    ========================= */

    console.log("📡 Broadcasting chat:new ...");

    io.to(roomName).emit("chat:new", messageObject);

    console.log("✅ Broadcast completed");

  } catch (error) {

    console.error("❌ chat:send ERROR");
    console.error(error);

  }

  console.log("📤 CHAT SEND EVENT END");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

socket.on("chat:leave", ({ chatId }) => {

  console.log("🚪 CHAT LEAVE");
  console.log("User:", userId);
  console.log("Chat:", chatId);

  socket.leave(`chat:${chatId}`);

  if (activeChats.get(userId) === chatId) {
    activeChats.delete(userId);
  }

});

  /* =====================================================
     SEEN
  ===================================================== */

  socket.on("chat:seen", async ({ chatId }) => {

    console.log("👁️ SEEN EVENT");
    console.log("👤 User:", userId);
    console.log("💬 Chat:", chatId);

    try {

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        console.log("❌ Invalid chat id");
        return;
      }

      const chat = await Chat.findOne({
        _id: chatId,
        participants: userId
      });

      if (!chat) {
        console.log("❌ Seen denied");
        return;
      }

      await messageService.markAsSeen(chatId, userId);

      console.log("✅ markAsSeen executed");

    } catch (error) {
      console.error("❌ chat:seen error:", error);
    }
  });

  /* =====================================================
     TYPING
  ===================================================== */

/* =====================================================
   TYPING (PRODUCTION READY)
===================================================== */

const typingMap = new Map<string, Set<string>>();
// key = chatId
// value = Set of userIds typing

socket.on("chat:typing", async ({ chatId, typing }) => {

  console.log("⌨️ TYPING EVENT");
  console.log("👤 User:", userId);
  console.log("💬 Chat:", chatId);
  console.log("🟢 Typing:", typing);

  try {

    if (!mongoose.Types.ObjectId.isValid(chatId))
      return;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      console.log("❌ Typing denied");
      return;
    }

    if (!typingMap.has(chatId)) {
      typingMap.set(chatId, new Set());
    }

    const roomTyping = typingMap.get(chatId)!;

    /* ===== START TYPING ===== */

    if (typing === true) {

      if (roomTyping.has(userId)) {
        // لا نعيد الإرسال إذا كان بالفعل يكتب
        return;
      }

      roomTyping.add(userId);

      socket.to(`chat:${chatId}`).emit("chat:typing", {
        chatId,
        userId,
        typing: true
      });

      console.log("📡 typing:true emitted");
    }

    /* ===== STOP TYPING ===== */

    if (typing === false) {

      if (!roomTyping.has(userId)) return;

      roomTyping.delete(userId);

      socket.to(`chat:${chatId}`).emit("chat:typing", {
        chatId,
        userId,
        typing: false
      });

      console.log("📡 typing:false emitted");
    }

  } catch (error) {
    console.error("❌ chat:typing error:", error);
  }

});


  /* =====================================================
     REACTION
  ===================================================== */

  socket.on("chat:reaction", async ({ messageId, emoji }) => {

    console.log("❤️ REACTION EVENT");
    console.log("👤 User:", userId);
    console.log("📝 Message:", messageId);
    console.log("😀 Emoji:", emoji);

    try {

      if (!mongoose.Types.ObjectId.isValid(messageId))
        return;

      await messageService.toggleReaction(
        messageId,
        userId,
        emoji
      );

      console.log("✅ Reaction processed");

    } catch (error) {
      console.error("❌ chat:reaction error:", error);
    }
  });

  /* =====================================================
     DELETE MESSAGE
  ===================================================== */

  socket.on("chat:delete", async ({ messageId, type }) => {

    console.log("🗑️ DELETE EVENT");
    console.log("👤 User:", userId);
    console.log("📝 Message:", messageId);
    console.log("📌 Type:", type);

    try {

      if (!mongoose.Types.ObjectId.isValid(messageId))
        return;

      if (type === "me") {
        await messageService.deleteForMe(
          messageId,
          userId
        );
      }

      if (type === "everyone") {
        await messageService.deleteForEveryone(
          messageId,
          userId
        );
      }

      console.log("✅ Delete processed");

    } catch (error) {
      console.error("❌ chat:delete error:", error);
    }
  });

  /* =====================================================
     DISCONNECT
  ===================================================== */

socket.on("disconnect", (reason) => {

  console.log("🔴 SOCKET DISCONNECTED");
  console.log("👤 User:", userId);
  console.log("📌 Reason:", reason);

  /* ================= CLEAN TYPING ================= */
  activeChats.delete(userId);

  typingMap.forEach((users, chatId) => {

    if (users.has(userId)) {

      users.delete(userId);

      socket.to(`chat:${chatId}`).emit("chat:typing", {
        chatId,
        userId,
        typing: false
      });

      console.log("🧹 Cleaned typing for:", chatId);
    }

  });

});


};
