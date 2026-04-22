// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import User from "../models/User";
// import { hashPassword } from "../utils/hash";

// dotenv.config();

// const MONGO_URI = process.env.MONGO_URI!;

// // ===== أسماء البنات =====
// const FEMALE_NAMES = [
//   "منة", "آية", "يارا", "ملك", "نور",
//   "سلمى", "هنا", "دينا", "سارة", "مي",
//   "ريم", "ندى", "جنى", "رنا", "بسملة",
//   "فرح", "شيماء", "إسراء", "دعاء", "هبة",
//   "نانسي", "إيمان", "هدى", "جيهان", "نهى",
//   "مروة", "رانيا", "لبنى", "نجلاء", "سندس"
// ];

// // ===== أسماء الشباب =====
// const MALE_NAMES = [
//   "محمد", "أحمد", "محمود", "علي", "يوسف",
//   "حسن", "حسين", "مصطفى", "عبدالله", "إبراهيم",
//   "عمر", "خالد", "سعيد", "طارق", "رامي",
//   "كريم", "عمرو", "وليد", "شريف", "مينا"
// ];

// // دمج الكل
// const ALL_NAMES = [...FEMALE_NAMES, ...MALE_NAMES];

// async function generateUniqueUsername(base: string): Promise<string> {
//   let username = base;
//   let counter = 1;

//   while (true) {
//     const exists = await User.findOne({ username });
//     if (!exists) return username;

//     // لو الاسم مكرر نضيف _1 _2 فقط (بدون أرقام عشوائية)
//     username = `${base}_${counter}`;
//     counter++;
//   }
// }

// async function seedDemoUsers() {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log("✅ Connected to DB");

//     const password = await hashPassword("123456");

//     let created = 0;

//     for (const name of ALL_NAMES) {
//       const username = await generateUniqueUsername(name);

//       const user = {
//         username,
//         atUsername: username.toLowerCase(),
//         email: `${username}@demo.com`,
//         password,
//         isBot: true,
//         isOfficial: false,
//         role: "user",
//         avatar: `https://i.pravatar.cc/150?u=${username}`,
//         CoinzBalance: 0,
//       };

//       await User.create(user);
//       created++;
//       console.log("👤 Created:", username);
//     }

//     console.log(`🎉 Done. Created ${created} users`);
//     process.exit(0);
//   } catch (error) {
//     console.error("❌ Error:", error);
//     process.exit(1);
//   }
// }

// seedDemoUsers();

// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import User from "../models/User";

// dotenv.config();

// const MONGO_URI = process.env.MONGO_URI!;

// async function deleteTestUsers() {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log("✅ Connected to DB");

//     // (اختياري) عرض المستخدمين قبل الحذف
//     const usersToDelete = await User.find({
//       username: { $regex: /test/i }
//     }).select("username");

//     console.log("📋 Users to delete:");
//     usersToDelete.forEach(u => console.log(" -", u.username));

//     // حذف المستخدمين
//     const result = await User.deleteMany({
//       username: { $regex: /test/i }
//     });

//     console.log(`🗑️ Deleted ${result.deletedCount} users`);

//     process.exit(0);
//   } catch (error) {
//     console.error("❌ Error:", error);
//     process.exit(1);
//   }
// }

// deleteTestUsers();

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI!;

// ===== أسماء البنات =====
const FEMALE_NAMES = [
  "منة", "آية", "يارا", "ملك", "نور",
  "سلمى", "هنا", "دينا", "سارة", "مي",
  "ريم", "ندى", "جنى", "رنا", "بسملة",
  "فرح", "شيماء", "إسراء", "دعاء", "هبة",
  "نانسي", "إيمان", "هدى", "جيهان", "نهى",
  "مروة", "رانيا", "لبنى", "نجلاء", "سندس"
];

// ===== أسماء الشباب =====
const MALE_NAMES = [
  "محمد", "أحمد", "محمود", "علي", "يوسف",
  "حسن", "حسين", "مصطفى", "عبدالله", "إبراهيم",
  "عمر", "خالد", "سعيد", "طارق", "رامي",
  "كريم", "عمرو", "وليد", "شريف", "مينا"
];

// ===== روابط صور البنات =====
const FEMALE_AVATAR_URLS = [
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTsuoQ7vB5ArqFQUtjamvtRnM5bD9mHegSmJg&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTluVQHjh4yzOEgYWRmURRkJnKA5tCpTBu09Q&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8DMnMlO_wHcXEprEzqc5ZhNnNXLBLujc8Wg&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIlg2fS1vKvN7yYzBPBLqr_DEwGXyApm-ecQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSURWXEDFvgIr3WMFrGnccMUtKllekJuY5aEw&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQLM2AUMH0xhlh4239BymXYy8zpCmHUrNRKKA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTsuoQ7vB5ArqFQUtjamvtRnM5bD9mHegSmJg&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6ZnWxa_Iwckb77KilzL75C2061t3aymkXTA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRChXT_pfcn7N9520SucoOotVAlNBNtPcXAxw&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRI0ztlfBPsQvLlzWlAHM2svYaEXrn5WnS0cg&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSONaF5gHoqI0FWx7Q3__B0N0Kp9j_f6jXY4Q&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-QPlm3MZWGSTYVrveh5kj_0Ad98PcHvTTbA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT01J3qBnP49sIEucxE1NsDK_RR2q8eQVkrKg&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWae3CdisasravCWTelQ4t3vwerLcNqEoxYA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS0R9ELQ3VJiK__KKhBd9QJVDwTzENpDZAXtQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXa97TcUaHhJ7321USA3jPFW2ThgFkno2AWA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT9LaTyEf2SA5ZjIS4igLw02Ia-LylUBioaYA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVvGxjibS1N5YWQoAVJKKFwRAApL4XHGqUkA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTzOfgomMbNBJL1xGXpXfv8_SIo2q6bpP1poQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFPJEMUefSmb_NuOht-ji8udLmGDIWlO6aLQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSl1NMvsSEQlCkHJQxzDe1FByyLkU4p9-oAXQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTkJ86VypoxJNmfAfR_8zjusntKw01nITcn5Q&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT1Vl4Z_3oyDLLU2XWynR7OlTL2lArevg2yaw&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTo7H_KKxPocvOhisHtXTnRprCbkYwfTtPkkw&s",
];

// ===== روابط صور الشباب =====
const MALE_AVATAR_URLS = [
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNXLO5sZksM17eo52m5kkurSqd-LYcVzuh3g&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTpWS2Z8HZsvF-jNHwZZiaovbXNPATGYhW0MA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQ7P4dToMTncm-XpXF8lNZ-ySHgZNJo4Du8w&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSDussB2fqrQUgp04i3tGkwotKWHJWg441sTw&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQO-lWoF8RdpQmt49PjeZ7P5mpScJoJ-UHspQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS56xDMPy1zEaIdRKwKu9xrn2_JWXoufOaK4A&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGin4gFdBLkachK78PIllQp3J7CyCWVrQZ7Q&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSsOoCT4VnfK0d-cMds7ZUbxZYsvb3xBpsFMw&s",
  "https://t3.ftcdn.net/jpg/03/96/36/60/360_F_396366080_3OVh1fkYoSzttymUO6FPfOCXelLkMLsF.jpg",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTLPOU5Vh0YqHRSRlly6uO2uEETvl6JxeaupQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT7ynnZcJPUAm4cjZYb5_iX1MVockSI6W6vvA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ9T_gAl5sM4qZNkdB8JeSdIXGw8dimQL70Q&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpdkk9nZyXlKIsgBiCrxt4wQAsxgcXObJsQw&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlbgXlXqRCavjRa02NUMqYE3FIOo7Sbd9q8A&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTFNDzTew9WsJLH5LDCJhqOz67ir2PmLK6jw&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQwZ9mVfFMspUSN6ysxsWvBDIfZIOxkdKGYZA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkWti3KftWWBxBPSvgXhHcbOmCClrirq0AqA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-T_e5yAUaLOErHkFod5ehLleGpvLAdl4UvQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScX0nT7n0XQwFPxcBzeRWq9gAku3O7jk5mIw&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8JWQh24ajbOxNi4yCMoj4Qyy-6ZE8PNZT0w&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcROF7P8kZ2o1qnLMPHaV6NitBQWNnq_I-jr7A&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDCyFG1H_HBq1tJPrDjMGYGy-4iQjl7E8WVg&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCvKDRtxB1ZEdgQWQYj7j9ifvCl4Sm5dv2NQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS75PgMfvLGsGkJ-0l3hYS9cFQdim2T2TK_2A&s",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildUsernameRegex(name: string) {
  return new RegExp(`^${escapeRegExp(name)}(?:_\\d+)?$`, "i");
}

function shuffleArray<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function updateUsersByNames(names: string[], avatarPool: string[]) {
  let updated = 0;

  // إزالة الروابط المكررة أولًا
  const uniqueAvatarPool = [...new Set(avatarPool)];
  const availableAvatars = shuffleArray(uniqueAvatarPool);

  for (const name of names) {
    const regex = buildUsernameRegex(name);

    const users = await User.find({
      username: { $regex: regex },
    }).select("_id username");

    if (!users.length) {
      console.log(`⚠️ No users found for name: ${name}`);
      continue;
    }

    for (const user of users) {
      if (availableAvatars.length === 0) {
        console.log("⚠️ No more unique avatars left");
        return updated;
      }

      const avatar = availableAvatars.pop()!;

      await User.updateOne(
        { _id: user._id },
        { $set: { avatar } }
      );

      updated++;
      console.log(`🖼️ Updated avatar for: ${user.username} -> ${avatar}`);
    }
  }

  return updated;
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to DB");

    const femaleUpdated = await updateUsersByNames(FEMALE_NAMES, FEMALE_AVATAR_URLS);
    const maleUpdated = await updateUsersByNames(MALE_NAMES, MALE_AVATAR_URLS);

    console.log(`🎉 Done. Female updated: ${femaleUpdated}, Male updated: ${maleUpdated}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

run();