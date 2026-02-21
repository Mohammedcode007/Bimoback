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



  if (!userId) {
    return;
  }

  /* =====================================================
     IMPORTANT: PERSONAL ROOM
  ===================================================== */

  socket.join(userId); // 🔥 مهم جدا للإشعارات

  /* =====================================================
     JOIN CHAT ROOM
  ===================================================== */
socket.on("chat:join", async ({ chatId }) => {

 

  try {

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return;
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
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


    /* =========================
       Delivery Only
    ========================= */

    await messageService.markAsDelivered(
      chatId,
      userId
    );


    /* =========================
       🔥 Seen لأن المستخدم فعلاً فتح المحادثة
    ========================= */

    await messageService.markAsSeen(
      chatId,
      userId
    );


  } catch (error) {
    console.error("❌ chat:join error:", error);
  }

});



/* =====================================================
   SEND MESSAGE
===================================================== */

socket.on("chat:send", async (data) => {

  

  try {

    const {
      chatId,
      content,
      type,
      media,
      replyTo,
      clientTempId
    } = data;

   

    if (!chatId || !content) {
      return;
    }

    /* =========================
       1️⃣ حفظ الرسالة
    ========================= */


    const message = await messageService.send(
      chatId,
      userId,
      content,
      type,
      media,
      replyTo,
      clientTempId
    );



    /* =========================
       2️⃣ تحويل إلى Object
    ========================= */

    const messageObject = {
      ...message.toObject(),
      clientTempId
    };

 

    /* =========================
       3️⃣ فحص الغرفة
    ========================= */

    const roomName = `chat:${chatId}`;

    const room = io.sockets.adapter.rooms.get(roomName);

    const roomSize = room ? room.size : 0;


    /* =========================
       4️⃣ البث
    ========================= */


    io.to(roomName).emit("chat:new", messageObject);


  } catch (error) {

    console.error("❌ chat:send ERROR");
    console.error(error);

  }

 
});

socket.on("chat:leave", ({ chatId }) => {

 

  socket.leave(`chat:${chatId}`);

  if (activeChats.get(userId) === chatId) {
    activeChats.delete(userId);
  }

});

  /* =====================================================
     SEEN
  ===================================================== */

  socket.on("chat:seen", async ({ chatId }) => {



    try {

      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return;
      }

      const chat = await Chat.findOne({
        _id: chatId,
        participants: userId
      });

      if (!chat) {
        return;
      }

      await messageService.markAsSeen(chatId, userId);


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



  try {

    if (!mongoose.Types.ObjectId.isValid(chatId))
      return;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
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

    }

  } catch (error) {
    console.error("❌ chat:typing error:", error);
  }

});


  /* =====================================================
     REACTION
  ===================================================== */

  socket.on("chat:reaction", async ({ messageId, emoji }) => {

   

    try {

      if (!mongoose.Types.ObjectId.isValid(messageId))
        return;

      await messageService.toggleReaction(
        messageId,
        userId,
        emoji
      );


    } catch (error) {
      console.error("❌ chat:reaction error:", error);
    }
  });

  /* =====================================================
     DELETE MESSAGE
  ===================================================== */

  socket.on("chat:delete", async ({ messageId, type }) => {

   

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


    } catch (error) {
      console.error("❌ chat:delete error:", error);
    }
  });

  /* =====================================================
     DISCONNECT
  ===================================================== */

socket.on("disconnect", (reason) => {



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

    }

  });

});


};
