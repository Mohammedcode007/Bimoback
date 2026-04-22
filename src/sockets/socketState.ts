/* ================= SOCKET RUNTIME STATE ================= */

/* المستخدمين داخل الشات حالياً */
export const activeChats = new Map<string, string>();
// userId -> chatId

/* المستخدمين المتصلين حالياً */
export const onlineUsers = new Set<string>();
