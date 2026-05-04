
import { getIO } from "../config/socket";
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import jwt from "jsonwebtoken";
import Friend from "../models/Friend";
import { getFirebaseAdmin } from "../config/firebaseAdmin";
import { hashOtp, compareOtp } from "../utils/otpHash";
import { sendResetOtpEmail } from "./email.service";
import { generateOtp } from "../utils/generateOtp";
import { seedWelcomeMessagesForNewUser } from "./welcomeMessage.service";
import systemBotService from "./bot/private-chat/systemBot.service";
import roomService from "./room.service";
import Room from "../models/Room";
import mongoose from "mongoose";
type GoogleAuthInput = {
  idToken: string;
  username?: string;
  email?: string;
  photo?: string;
};

function makeSafeUsername(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

async function generateUniqueUsername(base: string) {
  let candidate = makeSafeUsername(base);

  if (!candidate || candidate.length < 3) {
    candidate = `user${Date.now().toString().slice(-6)}`;
  }

  let finalUsername = candidate;
  let exists = await User.findOne({
    atUsername: normalizeAtUsername(finalUsername),
  }).lean();

  while (exists) {
    finalUsername = `${candidate}${Math.floor(1000 + Math.random() * 9000)}`;
    exists = await User.findOne({
      atUsername: normalizeAtUsername(finalUsername),
    }).lean();
  }

  return finalUsername;
}
/* =====================================================
   TOKEN GENERATOR
===================================================== */

const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      atUsername: user.atUsername
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "30d" }
  );
};

/* =====================================================
   REGISTER
===================================================== */

// ✅ تعديل auth.service.ts (registerUser / loginUser)
// المطلوب:
// 1) registerUser يستقبل role اختياري، ولو لم يُرسل => "user"
// 2) منع أي شخص من عمل نفسه admin من التسجيل (اختياري وآمن) عبر ADMIN_REGISTER_KEY
//    - لو لا تريد الحماية، احذف جزء adminKey بالكامل
// 3) loginUser يرجّع role في user
// 4) البحث يكون بـ atUsername (الموحّد) لتفادي اختلاف الكيس/المسافات


type UserRole = "user" | "admin";

function normalizeAtUsername(username: string) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_]/g, "");
}
async function inviteNewUserToGirlsRoom(userId: string) {
  try {
    const fixedRoomId = String(process.env.GIRLS_ROOM_ID || "").trim();

    let room: any = null;

    if (fixedRoomId) {
      room = await Room.findById(fixedRoomId).select(
        "_id name creator members owners admins activeUsers type"
      );
    } else {
      room = await Room.findOne({ name: "بنات" }).select(
        "_id name creator members owners admins activeUsers type"
      );
    }

    if (!room?._id || !room?.creator) {
      console.log("❌ girls room not found or creator missing");
      return;
    }

    // ✅ تأكد أن المستخدم عضو في الغرفة
    const uid = String(userId);
    const alreadyMember =
      Array.isArray(room.members) &&
      room.members.some((m: any) => m?.toString?.() === uid);

    const isOwner =
      Array.isArray(room.owners) &&
      room.owners.some((m: any) => m?.toString?.() === uid);

    const isAdmin =
      Array.isArray(room.admins) &&
      room.admins.some((m: any) => m?.toString?.() === uid);

    const isCreator = String(room.creator) === uid;

    if (!alreadyMember && !isOwner && !isAdmin && !isCreator) {
      room.members = Array.isArray(room.members) ? room.members : [];
      room.members.push(userId as any);
      await room.save();

      console.log("✅ user added to girls room members:", {
        roomId: room._id.toString(),
        userId: uid,
      });
    }

    // ✅ إرسال دعوة شات عادية مثل الزر العادي
    await roomService.inviteToRoom(
      room._id.toString(),
      room.creator.toString(),
      userId,
      `أهلاً بك 🌷 تمت دعوتك إلى ${room.name}`
    );

    console.log("✅ girls room invite sent:", {
      roomId: room._id.toString(),
      roomName: room.name,
      targetUserId: uid,
    });
  } catch (err: any) {
    console.log("❌ inviteNewUserToGirlsRoom error:", err?.message || err);
  }
}
function normalizeRole(role: unknown): UserRole {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" ? "admin" : "user";
}

/* =====================================================
   REGISTER
===================================================== */
const MAX_USERNAME_LENGTH = 64;

function normalizeDisplayUsername(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) {
    throw new Error("Invalid username");
  }

  // نستخدم Array.from حتى نحسب الإيموجي والزخارف بشكل أفضل من .length
  const usernameLength = Array.from(raw).length;

  if (usernameLength > MAX_USERNAME_LENGTH) {
    throw new Error(`Username is too long. Max length is ${MAX_USERNAME_LENGTH}`);
  }

  return raw;
}
// export const registerUser = async (
//   username: string,
//   password: string,
//   role?: unknown,
//   adminKey?: unknown
// ) => {
//   const rawUsername = normalizeDisplayUsername(username);

//   if (!String(password || "").trim() || String(password).length < 6) {
//     throw new Error("Invalid password");
//   }

//   let atUsername = normalizeAtUsername(rawUsername);

//   // لو الاسم كله إيموجي مثل ❤️، atUsername سيكون فارغًا
//   // لذلك نولّد معرف آمن تلقائيًا
//   if (!atUsername || atUsername.length < 3) {
//     atUsername = await generateUniqueUsername(rawUsername);
//   } else {
//     const existingAtUsername = await User.findOne({ atUsername }).lean();

//     if (existingAtUsername) {
//       atUsername = await generateUniqueUsername(rawUsername);
//     }
//   }

//   // لو تريد منع تكرار اسم العرض نفسه مثل ❤️
//   const existingUsername = await User.findOne({
//     username: rawUsername,
//   }).lean();

//   if (existingUsername) {
//     throw new Error("Username already exists");
//   }

//   let finalRole: UserRole = normalizeRole(role);

//   if (finalRole === "admin") {
//     const required = String(process.env.ADMIN_REGISTER_KEY || "").trim();

//     if (!required) {
//       finalRole = "user";
//     } else {
//       const provided = String(adminKey || "").trim();

//       if (provided !== required) {
//         finalRole = "user";
//       }
//     }
//   }

//   const hashed = await hashPassword(password);

//   const user = await User.create({
//     username: rawUsername, // هنا الإيموجي يبقى كما هو
//     atUsername,            // هنا معرف آمن للبحث والمنشن
//     password: hashed,
//     role: finalRole,
//   });

//   systemBotService.attachBotToNewUser(user._id.toString()).catch(() => {});

//   seedWelcomeMessagesForNewUser(user._id.toString()).catch(() => {});

//   inviteNewUserToGirlsRoom(user._id.toString()).catch((err) => {
//     console.log(
//       "❌ inviteNewUserToGirlsRoom failed (register):",
//       err?.message || err
//     );
//   });

//   const token = generateToken(user);

//   return {
//     token,
//     user: {
//       _id: user._id,
//       username: user.username,
//       atUsername: user.atUsername,
//       avatar: user.avatar,
//       role: (user as any).role || "user",
//       isVerified: user.isVerified,
//       isOnline: false,
//       isInvisible: false,
//       lastSeen: null,
//     },
//   };
// };


export const registerUser = async (
  username: string,
  password: string,
  role?: unknown,
  adminKey?: unknown
) => {
  console.log("🟡 [registerUser] START", {
    username,
    role,
    hasAdminKey: !!String(adminKey || "").trim(),
  });

  const rawUsername = normalizeDisplayUsername(username);

  console.log("🟡 [registerUser] Normalized display username:", {
    inputUsername: username,
    rawUsername,
  });

  if (!String(password || "").trim() || String(password).length < 6) {
    console.log("❌ [registerUser] Invalid password", {
      username: rawUsername,
      passwordLength: String(password || "").length,
    });

    throw new Error("Invalid password");
  }

  let atUsername = normalizeAtUsername(rawUsername);

  console.log("🟡 [registerUser] Initial atUsername:", {
    rawUsername,
    atUsername,
  });

  // لو الاسم كله إيموجي مثل ❤️، atUsername سيكون فارغًا
  // لذلك نولّد معرف آمن تلقائيًا
  if (!atUsername || atUsername.length < 3) {
    console.log("🟠 [registerUser] atUsername invalid, generating unique username", {
      rawUsername,
      currentAtUsername: atUsername,
    });

    atUsername = await generateUniqueUsername(rawUsername);

    console.log("✅ [registerUser] Generated atUsername:", {
      rawUsername,
      atUsername,
    });
  } else {
    console.log("🔵 [registerUser] Checking existing atUsername:", {
      atUsername,
    });

    const existingAtUsername = await User.findOne({ atUsername }).lean();

    if (existingAtUsername) {
      console.log("🟠 [registerUser] atUsername already exists, generating new one", {
        atUsername,
        existingUserId: String(existingAtUsername._id),
      });

      atUsername = await generateUniqueUsername(rawUsername);

      console.log("✅ [registerUser] New generated atUsername:", {
        rawUsername,
        atUsername,
      });
    } else {
      console.log("✅ [registerUser] atUsername is available:", {
        atUsername,
      });
    }
  }

  // لو تريد منع تكرار اسم العرض نفسه مثل ❤️
  console.log("🔵 [registerUser] Checking existing display username:", {
    username: rawUsername,
  });

  const existingUsername = await User.findOne({
    username: rawUsername,
  }).lean();

  if (existingUsername) {
    console.log("❌ [registerUser] Username already exists:", {
      username: rawUsername,
      existingUserId: String(existingUsername._id),
    });

    throw new Error("Username already exists");
  }

  console.log("✅ [registerUser] Display username is available:", {
    username: rawUsername,
  });

  let finalRole: UserRole = normalizeRole(role);

  console.log("🟡 [registerUser] Role after normalize:", {
    inputRole: role,
    finalRole,
  });

  if (finalRole === "admin") {
    const required = String(process.env.ADMIN_REGISTER_KEY || "").trim();

    console.log("🔵 [registerUser] Admin role requested:", {
      hasRequiredAdminKey: !!required,
      hasProvidedAdminKey: !!String(adminKey || "").trim(),
    });

    if (!required) {
      console.log("🟠 [registerUser] ADMIN_REGISTER_KEY missing, fallback to user role");

      finalRole = "user";
    } else {
      const provided = String(adminKey || "").trim();

      if (provided !== required) {
        console.log("🟠 [registerUser] Invalid admin key, fallback to user role");

        finalRole = "user";
      } else {
        console.log("✅ [registerUser] Valid admin key, admin role accepted");
      }
    }
  }

  console.log("🔵 [registerUser] Hashing password...");

  const hashed = await hashPassword(password);

  console.log("✅ [registerUser] Password hashed");

  console.log("🔵 [registerUser] Creating user:", {
    username: rawUsername,
    atUsername,
    role: finalRole,
  });

  const user = await User.create({
    username: rawUsername, // هنا الإيموجي يبقى كما هو
    atUsername,            // هنا معرف آمن للبحث والمنشن
    password: hashed,
    role: finalRole,
  });

  console.log("✅ [registerUser] User created successfully:", {
    userId: String(user._id),
    username: user.username,
    atUsername: user.atUsername,
    role: (user as any).role || "user",
  });

  console.log("🔵 [registerUser] Attaching system bot to new user:", {
    userId: String(user._id),
  });

  systemBotService
    .attachBotToNewUser(user._id.toString())
    .then(() => {
      console.log("✅ [registerUser] Bot attached successfully:", {
        userId: String(user._id),
      });
    })
    .catch((err) => {
      console.log("❌ [registerUser] attachBotToNewUser failed:", {
        userId: String(user._id),
        error: err?.message || err,
      });
    });

  console.log("🔵 [registerUser] Seeding welcome messages:", {
    userId: String(user._id),
  });

  seedWelcomeMessagesForNewUser(user._id.toString())
    .then(() => {
      console.log("✅ [registerUser] Welcome messages seeded successfully:", {
        userId: String(user._id),
      });
    })
    .catch((err) => {
      console.log("❌ [registerUser] seedWelcomeMessagesForNewUser failed:", {
        userId: String(user._id),
        error: err?.message || err,
      });
    });

  console.log("🔵 [registerUser] Inviting new user to girls room:", {
    userId: String(user._id),
  });

  inviteNewUserToGirlsRoom(user._id.toString()).catch((err) => {
    console.log("❌ inviteNewUserToGirlsRoom failed (register):", {
      userId: String(user._id),
      error: err?.message || err,
    });
  });

  console.log("🔵 [registerUser] Generating token:", {
    userId: String(user._id),
  });

  const token = generateToken(user);

  console.log("✅ [registerUser] Token generated successfully:", {
    userId: String(user._id),
  });

  const response = {
    token,
    user: {
      _id: user._id,
      username: user.username,
      atUsername: user.atUsername,
      avatar: user.avatar,
      role: (user as any).role || "user",
      isVerified: user.isVerified,
      isOnline: false,
      isInvisible: false,
      lastSeen: null,
    },
  };

  console.log("✅ [registerUser] DONE", {
    userId: String(user._id),
    username: user.username,
    atUsername: user.atUsername,
    role: (user as any).role || "user",
  });

  return response;
};
export const createPaidAccountWithCoinz = async ({
  ownerUserId,
  username,
  password,
  cost = 30000,
}: {
  ownerUserId: string;
  username: string;
  password: string;
  cost?: number;
}) => {
  console.log("🟡 [createPaidAccountWithCoinz] START", {
    ownerUserId,
    username,
    cost,
    passwordLength: String(password || "").length,
  });

  const session = await mongoose.startSession();

  let createdUser: any = null;

  try {
    await session.withTransaction(async () => {
      const owner = await User.findById(ownerUserId).session(session);

      if (!owner) {
        console.log("❌ [createPaidAccountWithCoinz] Owner not found", {
          ownerUserId,
        });

        throw new Error("Owner user not found");
      }

      const currentCoinz = Number((owner as any).CoinzBalance || 0);

      console.log("🔵 [createPaidAccountWithCoinz] Owner balance", {
        ownerUserId,
        currentCoinz,
        cost,
      });

      if (currentCoinz < cost) {
        console.log("❌ [createPaidAccountWithCoinz] Insufficient coinz", {
          ownerUserId,
          currentCoinz,
          cost,
        });

        throw new Error("Insufficient Coinz balance");
      }

      const rawUsername = normalizeDisplayUsername(username);

      console.log("🔵 [createPaidAccountWithCoinz] Username normalized", {
        rawUsername,
        length: Array.from(rawUsername).length,
        maxLength: MAX_USERNAME_LENGTH,
      });

      if (!String(password || "").trim() || String(password).length < 6) {
        console.log("❌ [createPaidAccountWithCoinz] Invalid password", {
          username: rawUsername,
          passwordLength: String(password || "").length,
        });

        throw new Error("Invalid password");
      }

      let atUsername = normalizeAtUsername(rawUsername);

      console.log("🔵 [createPaidAccountWithCoinz] Initial atUsername", {
        rawUsername,
        atUsername,
      });

      if (!atUsername || atUsername.length < 3) {
        atUsername = await generateUniqueUsername(rawUsername);

        console.log("✅ [createPaidAccountWithCoinz] Generated atUsername", {
          rawUsername,
          atUsername,
        });
      } else {
        const existingAtUsername = await User.findOne({ atUsername })
          .session(session)
          .lean();

        if (existingAtUsername) {
          console.log("🟠 [createPaidAccountWithCoinz] atUsername exists, generating another", {
            atUsername,
            existingUserId: String(existingAtUsername._id),
          });

          atUsername = await generateUniqueUsername(rawUsername);

          console.log("✅ [createPaidAccountWithCoinz] New generated atUsername", {
            rawUsername,
            atUsername,
          });
        }
      }

      const existingUsername = await User.findOne({
        username: rawUsername,
      })
        .session(session)
        .lean();

      if (existingUsername) {
        console.log("❌ [createPaidAccountWithCoinz] Username already exists", {
          username: rawUsername,
          existingUserId: String(existingUsername._id),
        });

        throw new Error("Username already exists");
      }

      const hashed = await hashPassword(password);

      console.log("🔵 [createPaidAccountWithCoinz] Creating paid account", {
        username: rawUsername,
        atUsername,
      });

      const users = await User.create(
        [
          {
            username: rawUsername,
            atUsername,
            password: hashed,
            role: "user",
          },
        ],
        { session }
      );

      createdUser = users[0];

      console.log("✅ [createPaidAccountWithCoinz] Account created", {
        createdUserId: String(createdUser._id),
        username: createdUser.username,
        atUsername: createdUser.atUsername,
      });

      // ✅ الخصم بعد نجاح إنشاء الحساب فقط
      // ✅ اسم الحقل الصحيح في User model عندك هو CoinzBalance
      (owner as any).CoinzBalance = currentCoinz - cost;

      await owner.save({ session });

      console.log("✅ [createPaidAccountWithCoinz] Coinz debited after account creation", {
        ownerUserId,
        oldBalance: currentCoinz,
        newBalance: currentCoinz - cost,
        debited: cost,
      });
    });

    // الخدمات الجانبية بعد نجاح العملية كلها
    if (createdUser?._id) {
      systemBotService
        .attachBotToNewUser(createdUser._id.toString())
        .catch((err) => {
          console.log("❌ [createPaidAccountWithCoinz] attachBot failed", {
            userId: String(createdUser._id),
            error: err?.message || err,
          });
        });

      seedWelcomeMessagesForNewUser(createdUser._id.toString()).catch((err) => {
        console.log("❌ [createPaidAccountWithCoinz] welcome messages failed", {
          userId: String(createdUser._id),
          error: err?.message || err,
        });
      });

      inviteNewUserToGirlsRoom(createdUser._id.toString()).catch((err) => {
        console.log("❌ [createPaidAccountWithCoinz] invite failed", {
          userId: String(createdUser._id),
          error: err?.message || err,
        });
      });
    }

    console.log("✅ [createPaidAccountWithCoinz] DONE", {
      createdUserId: String(createdUser?._id || ""),
      username: createdUser?.username,
      atUsername: createdUser?.atUsername,
    });

    return {
      success: true,
      cost,
      credentials: {
        username: createdUser.username,
        password,
      },
      user: {
        _id: createdUser._id,
        username: createdUser.username,
        atUsername: createdUser.atUsername,
        avatar: createdUser.avatar,
        role: (createdUser as any).role || "user",
        isVerified: createdUser.isVerified,
        isOnline: false,
        isInvisible: false,
        lastSeen: null,
      },
    };
  } catch (err: any) {
    console.log("❌ [createPaidAccountWithCoinz] ERROR", {
      ownerUserId,
      username,
      message: err?.message || err,
    });

    throw err;
  } finally {
    session.endSession();
  }
};
/* =====================================================
   LOGIN
===================================================== */
export const loginUser = async (username: string, password: string) => {
const rawUsername = String(username || "").trim();
const cleanPassword = String(password || "").trim();
const atUsername = normalizeAtUsername(rawUsername);

const user = await User.findOne({
  $or: [
    ...(atUsername ? [{ atUsername }] : []),
    { username: rawUsername },
  ],
});


  if (!user) {
    throw new Error("Invalid credentials");
  }



  if (!user.password) {
    throw new Error("This account uses Google sign-in");
  }

  const isMatch = await comparePassword(cleanPassword, user.password);


  if (!isMatch) {

    throw new Error("Invalid credentials");
  }


  const token = generateToken(user);

  return {
    token,
    user: {
      _id: user._id,
      username: user.username,
      atUsername: user.atUsername,
      avatar: user.avatar,
      role: (user as any).role || "user",
      isVerified: user.isVerified,
      bio: user.bio,
      country: user.country,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      totalLikesReceived: user.totalLikesReceived,
      profileViews: user.profileViews,
      isOnline: user.isOnline,
      isInvisible: user.isInvisible,
      lastSeen: user.lastSeen,
    }
  };
};
// export const loginUser = async (
//   username: string,
//   password: string
// ) => {
//   const rawUsername = String(username || "").trim();
//   const atUsername = normalizeAtUsername(rawUsername);

//   // ✅ الأفضل الدخول عبر atUsername (لأنه ثابت وفريد)
//   // لو تريد الإبقاء على username حرفيًا: غيّر الاستعلام لـ { username: rawUsername }
//   const user = await User.findOne({ atUsername });

//   if (!user) {
//     throw new Error("Invalid credentials");
//   }

//   const isMatch = await comparePassword(password, user.password);
//   if (!isMatch) {
//     throw new Error("Invalid credentials");
//   }

//   const token = generateToken(user);

//   return {
//     token,
//     user: {
//       _id: user._id,
//       username: user.username,
//       atUsername: user.atUsername,
//       avatar: user.avatar,
//       role: (user as any).role || "user", // ✅ أضفنا role
//       isVerified: user.isVerified,
//       bio: user.bio,
//       country: user.country,
//       followersCount: user.followersCount,
//       followingCount: user.followingCount,
//       totalLikesReceived: user.totalLikesReceived,
//       profileViews: user.profileViews,
//       isOnline: user.isOnline,
//       isInvisible: user.isInvisible,
//       lastSeen: user.lastSeen
//     }
//   };
// };
export const authWithGoogle = async ({
  idToken,
  username,
  email,
  photo,
}: GoogleAuthInput) => {
  if (!idToken || !String(idToken).trim()) {
    throw new Error("Google token is required");
  }

  const admin = getFirebaseAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);

  const firebaseUid = decoded.uid;
  const verifiedEmail = String(decoded.email || email || "").trim().toLowerCase();
  const verifiedName = String(
    username || decoded.name || verifiedEmail.split("@")[0] || "user"
  ).trim();
  const verifiedPhoto = String(photo || decoded.picture || "").trim();

  if (!verifiedEmail) {
    throw new Error("Google account email is required");
  }

  let user = await User.findOne({
    $or: [{ googleUid: firebaseUid }, { email: verifiedEmail }],
  });

  if (!user) {
    const uniqueUsername = await generateUniqueUsername(verifiedName);

    user = await User.create({
      username: uniqueUsername,
      atUsername: normalizeAtUsername(uniqueUsername),
      password: null,
      email: verifiedEmail,
      googleUid: firebaseUid,
      provider: "google",
      avatar: verifiedPhoto || "",
      isVerified: true,
      role: "user",
      isOnline: false,
      isInvisible: false,
      lastSeen: null,
    });
    // ✅ ربط البوت بالمستخدم الجديد
    systemBotService.attachBotToNewUser(user._id.toString()).catch((err) => {
    });
    seedWelcomeMessagesForNewUser(user._id.toString()).catch((err) => {
    });
  } else {
    let changed = false;

    if (!user.googleUid) {
      user.googleUid = firebaseUid;
      changed = true;
    }

    if (!user.email && verifiedEmail) {
      user.email = verifiedEmail;
      changed = true;
    }

    if ((!user.avatar || user.avatar.trim() === "") && verifiedPhoto) {
      user.avatar = verifiedPhoto;
      changed = true;
    }

    if ((user as any).provider !== "google") {
      (user as any).provider = "google";
      changed = true;
    }

    if (!user.isVerified) {
      user.isVerified = true;
      changed = true;
    }

    if (changed) {
      await user.save();
    }
  }

  const token = generateToken(user);

  return {
    token,
    user: {
      _id: user._id,
      username: user.username,
      atUsername: user.atUsername,
      email: user.email,
      avatar: user.avatar,
      role: (user as any).role || "user",
      isVerified: user.isVerified,
      bio: user.bio,
      country: user.country,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      totalLikesReceived: user.totalLikesReceived,
      profileViews: user.profileViews,
      isOnline: user.isOnline,
      isInvisible: user.isInvisible,
      lastSeen: user.lastSeen,
    },
  };
};
/* =====================================================
   LOGOUT
===================================================== */

export const logoutUser = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  /* ===== Presence Update ===== */

  user.isOnline = false;
  user.lastSeen = new Date();

  await user.save();

  /* ===== Leave All Active Rooms ===== */

  const leaveRoomsResult = await roomService.leaveAllActiveRoomsForUser(userId);

  return {
    message: "Logged out successfully",
    leftRooms: leaveRoomsResult.leftRooms,
    roomIds: leaveRoomsResult.roomIds,
  };
};

/* =====================================================
   TOGGLE INVISIBLE
===================================================== */

export const toggleInvisibleStatus = async (
  userId: string,
  invisible: boolean
) => {

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  /* ==========================================
     1) Update Invisible Status
  ========================================== */

  user.isInvisible = invisible;

  // إذا أصبح مخفيًا وكان أونلاين → نثبت lastSeen
  if (invisible && user.isOnline) {
    user.lastSeen = new Date();
  }

  await user.save();

  /* ==========================================
     2) Determine Real Visible Online State
  ========================================== */

  const visibleOnline = !user.isInvisible && user.isOnline;

  /* ==========================================
     3) Broadcast Unified Presence Event
  ========================================== */

  const io = getIO();

  const relations = await Friend.find({
    $or: [
      { requester: userId, status: "accepted" },
      { recipient: userId, status: "accepted" }
    ]
  }).select("requester recipient");

  const friendsIds = relations.map((relation: any) =>
    relation.requester.toString() === userId
      ? relation.recipient.toString()
      : relation.requester.toString()
  );

  const payload = {
    userId,
    isOnline: visibleOnline,
    lastSeen: visibleOnline ? null : user.lastSeen
  };

  friendsIds.forEach(friendId => {
    io.to(friendId).emit("presence:update", payload);
  });

  /* ========================================== */

  return {
    isInvisible: user.isInvisible
  };
};

function getOtpExpiresMs() {
  const minutes = Number(process.env.OTP_EXPIRES_MINUTES || 15);
  return minutes * 60 * 1000;
}

function getOtpCooldownMs() {
  const seconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30);
  return seconds * 1000;
}

function getOtpMaxAttempts() {
  return Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5);
}
export const forgotPasswordService = async (email: string) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    const err: any = new Error("Email is required");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({
    email: normalizedEmail,
    provider: "local",
  });

  // لا نكشف هل البريد موجود أم لا
  if (!user) {
    return {
      success: true,
      message: "If the email exists, a verification code has been sent.",
    };
  }

  const now = Date.now();
  const cooldownMs = getOtpCooldownMs();

  if (
    user.resetPasswordOtpRequestedAt &&
    now - new Date(user.resetPasswordOtpRequestedAt).getTime() < cooldownMs
  ) {
    const remainingSeconds = Math.ceil(
      (cooldownMs - (now - new Date(user.resetPasswordOtpRequestedAt).getTime())) / 1000
    );

    const err: any = new Error(
      `Please wait ${remainingSeconds} seconds before requesting another code.`
    );
    err.statusCode = 429;
    throw err;
  }

  const otp = generateOtp(6);
  const hashedOtp = await hashOtp(otp);

  user.resetPasswordOtpHash = hashedOtp;
  user.resetPasswordOtpExpiresAt = new Date(now + getOtpExpiresMs());
  user.resetPasswordOtpRequestedAt = new Date(now);
  user.resetPasswordOtpVerifyAttempts = 0;
  user.resetPasswordOtpLastAttemptAt = null;

  await user.save();

  await sendResetOtpEmail(user.email as string, otp);

  return {
    success: true,
    message: "If the email exists, a verification code has been sent.",
  };
};

export const verifyResetOtpService = async (email: string, otp: string) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();

  if (!normalizedEmail || !normalizedOtp) {
    const err: any = new Error("Email and OTP are required");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({
    email: normalizedEmail,
    provider: "local",
  });

  if (
    !user ||
    !user.resetPasswordOtpHash ||
    !user.resetPasswordOtpExpiresAt
  ) {
    const err: any = new Error("Invalid or expired code");
    err.statusCode = 400;
    throw err;
  }

  if (new Date(user.resetPasswordOtpExpiresAt).getTime() < Date.now()) {
    const err: any = new Error("Invalid or expired code");
    err.statusCode = 400;
    throw err;
  }

  if ((user.resetPasswordOtpVerifyAttempts || 0) >= getOtpMaxAttempts()) {
    const err: any = new Error("Too many invalid attempts. Please request a new code.");
    err.statusCode = 429;
    throw err;
  }

  const isMatch = await compareOtp(normalizedOtp, user.resetPasswordOtpHash);

  user.resetPasswordOtpLastAttemptAt = new Date();

  if (!isMatch) {
    user.resetPasswordOtpVerifyAttempts =
      (user.resetPasswordOtpVerifyAttempts || 0) + 1;

    await user.save();

    const err: any = new Error("Invalid or expired code");
    err.statusCode = 400;
    throw err;
  }

  await user.save();

  return {
    success: true,
    message: "OTP verified successfully",
  };
};

export const resetPasswordService = async (
  email: string,
  otp: string,
  newPassword: string
) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();
  const cleanPassword = String(newPassword || "").trim();

  if (!normalizedEmail || !normalizedOtp || !cleanPassword) {
    const err: any = new Error("Email, OTP and new password are required");
    err.statusCode = 400;
    throw err;
  }

  if (cleanPassword.length < 6) {
    const err: any = new Error("Password must be at least 6 characters");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findOne({
    email: normalizedEmail,
    provider: "local",
  });

  if (
    !user ||
    !user.resetPasswordOtpHash ||
    !user.resetPasswordOtpExpiresAt
  ) {
    const err: any = new Error("Invalid or expired code");
    err.statusCode = 400;
    throw err;
  }

  if (new Date(user.resetPasswordOtpExpiresAt).getTime() < Date.now()) {
    const err: any = new Error("Invalid or expired code");
    err.statusCode = 400;
    throw err;
  }

  if ((user.resetPasswordOtpVerifyAttempts || 0) >= getOtpMaxAttempts()) {
    const err: any = new Error("Too many invalid attempts. Please request a new code.");
    err.statusCode = 429;
    throw err;
  }

  const isMatch = await compareOtp(normalizedOtp, user.resetPasswordOtpHash);

  if (!isMatch) {
    user.resetPasswordOtpVerifyAttempts =
      (user.resetPasswordOtpVerifyAttempts || 0) + 1;
    user.resetPasswordOtpLastAttemptAt = new Date();

    await user.save();

    const err: any = new Error("Invalid or expired code");
    err.statusCode = 400;
    throw err;
  }

  // هنا نستخدم hashPassword الموجودة أصلًا في مشروعك
  const hashedNewPassword = await hashPassword(cleanPassword);

  user.password = hashedNewPassword;
  user.provider = "local";

  // تنظيف بيانات OTP بعد النجاح
  user.resetPasswordOtpHash = null;
  user.resetPasswordOtpExpiresAt = null;
  user.resetPasswordOtpRequestedAt = null;
  user.resetPasswordOtpVerifyAttempts = 0;
  user.resetPasswordOtpLastAttemptAt = null;

  await user.save();

  return {
    success: true,
    message: "Password reset successfully",
  };
};