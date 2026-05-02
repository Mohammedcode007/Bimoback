
// import { Request, Response } from "express";
// import {
//   registerUser,
//   loginUser,
//   logoutUser,
//   toggleInvisibleStatus,
//   authWithGoogle,
//   verifyResetOtpService,
//   resetPasswordService,
//   forgotPasswordService
// } from "../services/auth.service";

// /* =========================
//    REGISTER
// ========================= */


// export const register = async (req: Request, res: Response) => {
//   try {
//     const { username, password, role } = req.body;

//     const adminKey = req.headers["x-admin-key"]; // ✅ من Postman

//     const data = await registerUser(username, password, role, adminKey);

//     return res.status(201).json(data);
//   } catch (error: any) {
//     return res.status(400).json({ message: error.message });
//   }
// };
// /* =========================
//    LOGIN
// ========================= */
// /* =========================
//    GOOGLE AUTH
// ========================= */

// export const googleAuth = async (req: Request, res: Response) => {
//   try {
//     const { idToken, username, email, photo } = req.body;

//     const data = await authWithGoogle({
//       idToken,
//       username,
//       email,
//       photo
//     });

//     return res.status(200).json({
//       ...data,
//       presence: {
//         status: data.user.isInvisible ? "offline" : "online"
//       }
//     });
//   } catch (error: any) {
//     return res.status(401).json({ message: error.message });
//   }
// };

// export const login = async (req: Request, res: Response) => {
//   try {

//     const { username, password } = req.body;

//     const data = await loginUser(username, password);

//     return res.json({
//       ...data,
//       presence: {
//         status: data.user.isInvisible
//           ? "offline"
//           : "online"
//       }
//     });

//   } catch (error: any) {
//     return res.status(401).json({ message: error.message });
//   }
// };


// /* =========================
//    LOGOUT
// ========================= */

// export const logout = async (req: Request, res: Response) => {
//   try {

//     if (!req.user) {
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const userId = req.user.id;

//     await logoutUser(userId);

//     return res.json({
//       message: "Logged out successfully",
//       presence: {
//         status: "offline"
//       }
//     });

//   } catch (error: any) {
//     return res.status(400).json({ message: error.message });
//   }
// };


// /* =========================
//    TOGGLE INVISIBLE
// ========================= */

// export const toggleInvisible = async (req: Request, res: Response) => {
//   try {

   

//     if (!req.user) {
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const userId = req.user.id;
//     const { invisible } = req.body;

  

//     if (typeof invisible !== "boolean") {
//       return res.status(400).json({ message: "Invalid value" });
//     }

//     const data = await toggleInvisibleStatus(userId, invisible);

   

//     return res.json({
//       success: true,
//       isInvisible: data.isInvisible
//     });

//   } catch (error: any) {

   

//     return res.status(400).json({ message: error.message });
//   }
// };

// /* =========================
//    FORGOT PASSWORD
// ========================= */
// export const forgotPassword = async (req: Request, res: Response) => {
//   try {
//     const { email } = req.body;

//     const data = await forgotPasswordService(email);

//     return res.status(200).json(data);
//   } catch (error: any) {
//     const statusCode = error.statusCode || 400;
//     return res.status(statusCode).json({
//       success: false,
//       message: error.message || "Failed to send reset code",
//     });
//   }
// };

// /* =========================
//    VERIFY RESET OTP
// ========================= */
// export const verifyResetOtp = async (req: Request, res: Response) => {
//   try {
//     const { email, otp } = req.body;

//     const data = await verifyResetOtpService(email, otp);

//     return res.status(200).json(data);
//   } catch (error: any) {
//     const statusCode = error.statusCode || 400;
//     return res.status(statusCode).json({
//       success: false,
//       message: error.message || "Invalid or expired code",
//     });
//   }
// };

// /* =========================
//    RESET PASSWORD
// ========================= */
// export const resetPassword = async (req: Request, res: Response) => {
//   try {
//     const { email, otp, newPassword } = req.body;

//     const data = await resetPasswordService(email, otp, newPassword);

//     return res.status(200).json(data);
//   } catch (error: any) {
//     const statusCode = error.statusCode || 400;
//     return res.status(statusCode).json({
//       success: false,
//       message: error.message || "Failed to reset password",
//     });
//   }
// };
import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  toggleInvisibleStatus,
  authWithGoogle,
  verifyResetOtpService,
  resetPasswordService,
  forgotPasswordService,
  createPaidAccountWithCoinz,
} from "../services/auth.service";

/* =========================
   HELPERS
========================= */
function getAccountType(user: any) {
  if (user?.isBot) {
    if (user?.botType) return `${user.botType}_bot`;
    return "bot";
  }

  if (user?.role === "admin") return "admin";
  return "user";
}


function getAuthUserId(req: Request) {
  return String(
    (req as any).user?.id ||
      (req as any).user?._id ||
      (req as any).userId ||
      ""
  );
}

export const createPaidAccountController = async (
  req: Request,
  res: Response
) => {
  console.log("🟡 [createPaidAccountController] HIT", {
    body: req.body,
    authUser: (req as any).user,
    userId: (req as any).userId,
  });

  try {
    const ownerUserId = getAuthUserId(req);

    if (!ownerUserId) {
      console.log("❌ [createPaidAccountController] Unauthorized");
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { username, password } = req.body || {};

    const result = await createPaidAccountWithCoinz({
      ownerUserId,
      username,
      password,
      cost: 30000,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.log("❌ [createPaidAccountController] ERROR", {
      message: err?.message || err,
    });

    return res.status(400).json({
      success: false,
      message: err?.message || "Failed to create account",
    });
  }
};
/* =========================
   REGISTER
========================= */
// export const register = async (req: Request, res: Response) => {
//   try {
//     const { username, password, role } = req.body;
//     const adminKey = req.headers["x-admin-key"];

//     const data = await registerUser(username, password, role, adminKey);

//     return res.status(201).json({
//       ...data,
//       accountType: getAccountType(data.user),
//       presence: {
//         status: data.user?.isInvisible ? "offline" : "online",
//       },
//     });
//   } catch (error: any) {
//     return res.status(400).json({
//       success: false,
//       message: error.message || "Registration failed",
//     });
//   }
// };
export const register = async (req: Request, res: Response) => {
  try {
    console.log("🟡 [REGISTER CONTROLLER] START");

    console.log("🟡 [REGISTER CONTROLLER] BODY RAW:", req.body);

    console.log("🟡 [REGISTER CONTROLLER] HEADERS:", {
      adminKeyExists: Boolean(req.headers["x-admin-key"]),
      contentType: req.headers["content-type"],
      userAgent: req.headers["user-agent"],
    });

    const { username, password, role } = req.body;
    const adminKey = req.headers["x-admin-key"];

    console.log("🟡 [REGISTER CONTROLLER] PARSED:", {
      username,
      usernameType: typeof username,
      usernameLength: String(username || "").length,
      usernameChars: Array.from(String(username || "")),
      hasEmoji: /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(
        String(username || "")
      ),
      passwordExists: Boolean(password),
      passwordLength: String(password || "").length,
      role,
      adminKeyExists: Boolean(adminKey),
    });

    const data = await registerUser(username, password, role, adminKey);

    console.log("🟢 [REGISTER CONTROLLER] registerUser SUCCESS:", {
      tokenExists: Boolean(data?.token),
      userId: data?.user?._id,
      username: data?.user?.username,
      atUsername: data?.user?.atUsername,
      role: data?.user?.role,
      accountType: getAccountType(data.user),
      isInvisible: data?.user?.isInvisible,
    });

    const responsePayload = {
      ...data,
      accountType: getAccountType(data.user),
      presence: {
        status: data.user?.isInvisible ? "offline" : "online",
      },
    };

    console.log("🟢 [REGISTER CONTROLLER] RESPONSE:", {
      status: 201,
      userId: responsePayload?.user?._id,
      username: responsePayload?.user?.username,
      atUsername: responsePayload?.user?.atUsername,
      accountType: responsePayload?.accountType,
      presence: responsePayload?.presence,
    });

    return res.status(201).json(responsePayload);
  } catch (error: any) {
    console.log("🔴 [REGISTER CONTROLLER] ERROR:", {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      keyPattern: error?.keyPattern,
      keyValue: error?.keyValue,
      stack: error?.stack,
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};
/* =========================
   GOOGLE AUTH
========================= */
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken, username, email, photo } = req.body;

    const data = await authWithGoogle({
      idToken,
      username,
      email,
      photo,
    });

    return res.status(200).json({
      ...data,
      accountType: getAccountType(data.user),
      presence: {
        status: data.user?.isInvisible ? "offline" : "online",
      },
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || "Google authentication failed",
    });
  }
};

/* =========================
   LOGIN
========================= */
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const data = await loginUser(username, password);

    return res.status(200).json({
      ...data,
      accountType: getAccountType(data.user),
      presence: {
        status: data.user?.isInvisible ? "offline" : "online",
      },
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message || "Invalid username or password",
    });
  }
};

/* =========================
   LOGOUT
========================= */
export const logout = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user.id;

    await logoutUser(userId);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
      presence: {
        status: "offline",
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Logout failed",
    });
  }
};

/* =========================
   TOGGLE INVISIBLE
========================= */
export const toggleInvisible = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = req.user.id;
    const { invisible } = req.body;

    if (typeof invisible !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid value",
      });
    }

    const data = await toggleInvisibleStatus(userId, invisible);

    return res.status(200).json({
      success: true,
      isInvisible: data.isInvisible,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to toggle invisible status",
    });
  }
};

/* =========================
   FORGOT PASSWORD
========================= */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const data = await forgotPasswordService(email);

    return res.status(200).json(data);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to send reset code",
    });
  }
};

/* =========================
   VERIFY RESET OTP
========================= */
export const verifyResetOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const data = await verifyResetOtpService(email, otp);

    return res.status(200).json(data);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Invalid or expired code",
    });
  }
};

/* =========================
   RESET PASSWORD
========================= */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    const data = await resetPasswordService(email, otp, newPassword);

    return res.status(200).json(data);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to reset password",
    });
  }
};