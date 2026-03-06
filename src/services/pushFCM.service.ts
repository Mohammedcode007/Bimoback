// import User from "../models/User";
// import { getFirebaseAdmin } from "../config/firebaseAdmin";

// type PushPayload = {
//   title: string;
//   body: string;
//   data?: Record<string, string>;
// };

// export async function sendFCMToUser(userId: string, payload: PushPayload) {
//   const user = await User.findById(userId).select("fcmTokens");
//   const tokens: string[] = user?.fcmTokens || [];
//   if (!tokens.length) return { ok: false, reason: "NO_TOKENS" };

//   const admin = getFirebaseAdmin();

//   const res = await admin.messaging().sendEachForMulticast({
//     tokens,
//     notification: {
//       title: payload.title,
//       body: payload.body,
//     },
//     data: payload.data || {},
//     android: { priority: "high" },
//   });

//   // تنظيف التوكنات غير الصالحة
//   const invalidTokens: string[] = [];
//   res.responses.forEach((r, idx) => {
//     if (!r.success) {
//       const code = (r.error as any)?.code || "";
//       if (
//         code.includes("registration-token-not-registered") ||
//         code.includes("invalid-argument")
//       ) {
//         invalidTokens.push(tokens[idx]);
//       }
//     }
//   });

//   if (invalidTokens.length) {
//     await User.updateOne(
//       { _id: userId },
//       { $pull: { fcmTokens: { $in: invalidTokens } } }
//     );
//   }

//   return {
//     ok: true,
//     successCount: res.successCount,
//     failureCount: res.failureCount,
//     removedInvalid: invalidTokens.length,
//   };
// }

import User from "../models/User";
import { getFirebaseAdmin } from "../config/firebaseAdmin";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendFCMToUser(userId: string, payload: PushPayload) {

  const user = await User.findById(userId).select("fcmTokens");

  const tokens: string[] = user?.fcmTokens || [];

  if (!tokens.length)
    return { ok: false, reason: "NO_TOKENS" };

  const admin = getFirebaseAdmin();

  const res = await admin.messaging().sendEachForMulticast({
    tokens,

    notification: {
      title: payload.title,
      body: payload.body,
    },

    data: {
      ...payload.data, // 🔥 هنا يتم تمرير chatId
    },

    android: {
      priority: "high",
    },
  });

  /* =====================================================
     REMOVE INVALID TOKENS
  ===================================================== */

  const invalidTokens: string[] = [];

  res.responses.forEach((r, idx) => {

    if (!r.success) {

      const code = (r.error as any)?.code || "";

      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument")
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }

  });

  if (invalidTokens.length) {

    await User.updateOne(
      { _id: userId },
      { $pull: { fcmTokens: { $in: invalidTokens } } }
    );

  }

  return {
    ok: true,
    successCount: res.successCount,
    failureCount: res.failureCount,
    removedInvalid: invalidTokens.length,
  };
}