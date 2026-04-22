import mongoose from "mongoose";
import Chat from "../models/Chats";
import Message from "../models/Message";
import User from "../models/User";

const OFFICIAL_WELCOME_MESSAGES_AR = [
  "هاي 👋 عاملة ايه؟ 😊 حبيت أتعرف عليكي/عليك شوية 😄",
  "أهلاً 😊 شكلك شخص لطيف، قولت أقولك هاي 👋",
  "هاي 🙂 أخبارك ايه؟ أنا بحب أتعرف على ناس جديدة هنا 💫",
  "إزيك 👋 عامل ايه؟ حاسة إنك حد interesting شوية 😄",
  "هاي 😊 كنت بلف هنا وحبيت أبدأ كلام معاك 👋",
  "أهلاً 🙂 تحب نتكلم شوية ونتعرف؟ 😊",
  "هاي 👋 عامل ايه النهاردة؟ 😊 حبيت أفتح كلام بس 😄",
  "إزيك 🙂 شكلك حد محترم، قولت أتعرف عليك 💫",
];

const OFFICIAL_WELCOME_MESSAGES_EN = [
  "Welcome to Bimo 👋",
  "Glad to have you with us.",
  "Start exploring chats and rooms.",
  "Welcome! Don’t forget to complete your profile.",
  "We’re happy to have you on Bimo.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWelcomeMessage() {
  return pickRandom(OFFICIAL_WELCOME_MESSAGES_AR);
  // لو أضفت language لاحقًا في User يمكنك التبديل بين ar / en
  // return language === "en"
  //   ? pickRandom(OFFICIAL_WELCOME_MESSAGES_EN)
  //   : pickRandom(OFFICIAL_WELCOME_MESSAGES_AR);
}

async function getRandomWelcomeSenders(limit: number, excludeUserId: string) {
  const excludeObjectId = new mongoose.Types.ObjectId(excludeUserId);

  const users = await User.aggregate([
    {
      $match: {
        _id: { $ne: excludeObjectId },
        isWelcomeSender: true,
        isBanned: { $ne: true },
      },
    },
    { $sample: { size: limit } },
  ]);

  return users;
}

async function createOrGetPrivateChat(userAId: string, userBId: string) {
  let chat = await Chat.findOne({
    participants: {
      $all: [
        new mongoose.Types.ObjectId(userAId),
        new mongoose.Types.ObjectId(userBId),
      ],
    },
  });

  if (chat) {
    return chat;
  }

  chat = await Chat.create({
    participants: [
      new mongoose.Types.ObjectId(userAId),
      new mongoose.Types.ObjectId(userBId),
    ],
    unreadCounts: {
      [userAId]: 0,
      [userBId]: 0,
    },
    deletedFor: [],
    mutedBy: [],
    archivedBy: [],
    lastMessagePreview: "",
    lastMessageType: "text",
  });

  return chat;
}

async function sendWelcomeMessageFromSender(senderId: string, newUserId: string) {
  const chat = await createOrGetPrivateChat(senderId, newUserId);

  const content = getWelcomeMessage();

  const message = await Message.create({
    chat: chat._id,
    sender: new mongoose.Types.ObjectId(senderId),
    type: "text",
    content,
    reactions: [],
    deliveryStatus: {
      deliveredTo: [],
      seenBy: [],
    },
    status: "sent",
    deletedForEveryone: false,
    deletedFor: [],
    edited: false,
    isSystemMessage: false,
    moderationHidden: false,
    moderationReason: null,
    moderationHiddenAt: null,
    moderationHiddenBy: null,
  });

  await Chat.updateOne(
    { _id: chat._id },
    {
      $set: {
        lastMessage: message._id,
        lastMessagePreview: content,
        lastMessageType: "text",
        updatedAt: new Date(),
      },
      $inc: {
        [`unreadCounts.${newUserId}`]: 1,
      },
      $pull: {
        deletedFor: {
          $in: [
            new mongoose.Types.ObjectId(senderId),
            new mongoose.Types.ObjectId(newUserId),
          ],
        },
      },
    }
  );

  return message;
}

export async function seedWelcomeMessagesForNewUser(newUserId: string) {
  try {
    if (!mongoose.Types.ObjectId.isValid(newUserId)) {
      return;
    }

    const newUser = await User.findById(newUserId);
    if (!newUser) return;

    if (newUser.welcomeMessagesSeeded) {
      return;
    }

    const senders = await getRandomWelcomeSenders(2, newUserId);

    if (!senders.length) {
      newUser.welcomeMessagesSeeded = true;
      await newUser.save();
      return;
    }

    for (const sender of senders) {
      await sendWelcomeMessageFromSender(String(sender._id), newUserId);
    }

    newUser.welcomeMessagesSeeded = true;
    await newUser.save();

    console.log("✅ Welcome messages seeded for user:", newUserId);
  } catch (error) {
    console.log("❌ seedWelcomeMessagesForNewUser error:", error);
  }
}