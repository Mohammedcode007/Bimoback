
import { getIO } from "../config/socket";
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import jwt from "jsonwebtoken";
import Friend from "../models/Friend";


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
    { expiresIn: "7d" }
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
    .replace(/\s+/g, "");
}

function normalizeRole(role: unknown): UserRole {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" ? "admin" : "user";
}

/* =====================================================
   REGISTER
===================================================== */

export const registerUser = async (
  username: string,
  password: string,
  role?: unknown,
  adminKey?: unknown // ✅ اختياري: مفتاح لإنشاء admin من التسجيل (حماية)
) => {
  const rawUsername = String(username || "").trim();
  if (!rawUsername || rawUsername.length < 3) {
    throw new Error("Invalid username");
  }

  if (!String(password || "").trim() || String(password).length < 6) {
    throw new Error("Invalid password");
  }

  const atUsername = normalizeAtUsername(rawUsername);

  // ✅ لو المستخدم موجود (افضل بالـ atUsername لأنه فريد)
  const existing = await User.findOne({ atUsername }).lean();
  if (existing) {
    throw new Error("Username already exists");
  }

  // ✅ role default = user
  let finalRole: UserRole = normalizeRole(role);

  // ✅ حماية قوية (موصى بها): لا تسمح بـ admin إلا بمفتاح
  if (finalRole === "admin") {
    const required = String(process.env.ADMIN_REGISTER_KEY || "").trim();
    if (!required) {
      // لو لم تُحدد مفتاح في env، امنع تسجيل admin نهائيًا
      finalRole = "user";
    } else {
      const provided = String(adminKey || "").trim();
      if (provided !== required) {
        // لو المفتاح غير صحيح، اجعلها user بدل رفض كامل (أو يمكنك رفض)
        finalRole = "user";
      }
    }
  }

  const hashed = await hashPassword(password);

  const user = await User.create({
    username: rawUsername,
    atUsername,
    password: hashed,
    role: finalRole // ✅ تخزين role
  });

  const token = generateToken(user);

  return {
    token,
    user: {
      _id: user._id,
      username: user.username,
      atUsername: user.atUsername,
      avatar: user.avatar,
      role: (user as any).role || "user", // ✅ أضفنا role
      isVerified: user.isVerified,
      isOnline: false,
      isInvisible: false,
      lastSeen: null
    }
  };
};

/* =====================================================
   LOGIN
===================================================== */

export const loginUser = async (
  username: string,
  password: string
) => {
  const rawUsername = String(username || "").trim();
  const atUsername = normalizeAtUsername(rawUsername);

  // ✅ الأفضل الدخول عبر atUsername (لأنه ثابت وفريد)
  // لو تريد الإبقاء على username حرفيًا: غيّر الاستعلام لـ { username: rawUsername }
  const user = await User.findOne({ atUsername });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await comparePassword(password, user.password);
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
      role: (user as any).role || "user", // ✅ أضفنا role
      isVerified: user.isVerified,
      bio: user.bio,
      country: user.country,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      totalLikesReceived: user.totalLikesReceived,
      profileViews: user.profileViews,
      isOnline: user.isOnline,
      isInvisible: user.isInvisible,
      lastSeen: user.lastSeen
    }
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

  return {
    message: "Logged out successfully"
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
