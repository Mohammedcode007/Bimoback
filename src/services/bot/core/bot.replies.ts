import { BotLang, BotReplyPayload } from "./bot.types";

/* =====================================================
   GENERIC HELPERS
===================================================== */

export function pickText(lang: BotLang, ar: string, en: string) {
  return lang === "en" ? en : ar;
}

/* =====================================================
   LANGUAGE / WELCOME
===================================================== */

export function buildLanguagePickerMessage(username?: string) {
  return `أهلاً ${username || "بك"} 👋
أنا المساعد الرسمي لتطبيق Bimo.

اختر اللغة / Choose language:

- عربي
- English`;
}

export function getLanguageOnlyMessage(lang: BotLang) {
  return pickText(
    lang,
    `اختر اللغة:

- عربي
- English`,
    `Choose language:

- Arabic
- English`
  );
}

export function getLocalizedWelcome(lang: BotLang, username?: string) {
  return pickText(
    lang,
    `أهلاً ${username || "بك"} 👋
أنا المساعد الرسمي لتطبيق Bimo.

أقدر أساعدك في:
- الغرف
- الدعم
- الحساب
- تغيير اللغة
- الغرف المحمية

الأوامر:
- مساعدة
- تغيير اللغة
- bot@username@password@room
- botleave@username@room
- createuser@username@password`,
    `Welcome ${username || ""} 👋
I am the official Bimo assistant.

I can help you with:
- rooms
- support
- account
- change language
- protected rooms

Commands:
- help
- change language
- bot@username@password@room
- botleave@username@room
- createuser@username@password`
  );
}

/* =====================================================
   STANDARD REPLIES
===================================================== */



export function getHelpReply(lang: BotLang): BotReplyPayload {
  return {
    handled: true,
    intent: "help",
    text: pickText(
      lang,
      `🤖 أوامر Bimo Bot

1) أوامر البوت الرسمي في الخاص
• دخول البوت إلى غرفة:
bot@username@password@room
مثال:
bot@mohammed@123456@General

• خروج البوت من غرفة:
botleave@username@room
مثال:
botleave@mohammed@General

2) أوامر البوت الصامت / Room Agent
• دخول:
username@password@room
مثال:
mohammed@123456@General

• خروج:
exit@username@room
مثال:
exit@mohammed@General

3) إنشاء مستخدم جديد
• إنشاء حساب:
createuser@username@password
مثال:
createuser@mohammedbot@123456

4) أوامر بوت الغرفة المتفاعل
• الترحيب:
!welcome on
!welcome off

• قفل الغرفة:
!lock on
!lock off

• مانع السبام:
!antispam on
!antispam off

• الوضع البطيء:
!slow 10

• طرد عضو:
!kick @username

• حظر عضو:
!ban @username reason

• كتم عضو:
!mute @username 10 reason

• إلغاء الكتم:
!unmute @username

• تغيير رتبة عضو:
!role @username admin
!role @username owner
!role @username member

5) تغيير اللغة
• عربي
• English
• lang
• language
• تغيير اللغة

ملاحظات مهمة:
• username هو اسم المستخدم وليس الاسم الظاهر.
• room هو اسم الغرفة كما هو.
• أوامر الدخول تحتاج كلمة مرور.
• أوامر الخروج لا تحتاج كلمة مرور.`,
      `🤖 Bimo Bot Commands

1) Official bot commands in private chat
• Join a room:
bot@username@password@room
Example:
bot@mohammed@123456@General

• Leave a room:
botleave@username@room
Example:
botleave@mohammed@General

2) Silent bot / Room Agent commands
• Join:
username@password@room
Example:
mohammed@123456@General

• Leave:
exit@username@room
Example:
exit@mohammed@General

3) Create a new user
• Create account:
createuser@username@password
Example:
createuser@mohammedbot@123456

4) Interactive room bot commands
• Welcome messages:
!welcome on
!welcome off

• Room lock:
!lock on
!lock off

• Anti-spam:
!antispam on
!antispam off

• Slow mode:
!slow 10

• Kick a user:
!kick @username

• Ban a user:
!ban @username reason

• Mute a user:
!mute @username 10 reason

• Unmute a user:
!unmute @username

• Change user role:
!role @username admin
!role @username owner
!role @username member

5) Change language
• عربي
• English
• lang
• language
• change language

Important notes:
• username means the account username, not the display name.
• room means the exact room name.
• Join commands require a password.
• Leave commands do not require a password.`
    ),
  };
}

export function getRoomsReply(lang: BotLang): BotReplyPayload {
  return {
    handled: true,
    intent: "rooms",
    text: pickText(
      lang,
      `يمكنك استكشاف الغرف من قسم الغرف.
ولدخول غرفة محمية استخدم:
bot@username@password@room`,
      `You can explore rooms from the Rooms section.
To join a protected room, use:
bot@username@password@room`
    ),
  };
}

export function getSupportReply(lang: BotLang): BotReplyPayload {
  return {
    handled: true,
    intent: "contact_support",
    text: pickText(
      lang,
      `أرسل طلب الدعم هنا وسأوجهك حسب نوع الطلب.`,
      `Send your support request here and I will guide you based on the request type.`
    ),
  };
}

export function getAccountReply(lang: BotLang): BotReplyPayload {
  return {
    handled: true,
    intent: "account",
    text: pickText(
      lang,
      `أستطيع لاحقًا المساعدة في إعدادات الحساب والخصوصية والبروفايل.`,
      `I can help later with account settings, privacy, and profile support.`
    ),
  };
}

export function getProtectedRoomHelpReply(lang: BotLang): BotReplyPayload {
  return {
    handled: true,
    intent: "password_protected_room",
    text: pickText(
      lang,
      `استخدم الصيغة التالية لتسجيل الدخول والدخول إلى الغرفة:

bot@username@password@room

مثال:
bot@mohamed@123456@VIP Room`,
      `Use this exact format to log in and join a room:

bot@username@password@room

Example:
bot@mohamed@123456@VIP Room`
    ),
  };
}

export function getUnknownReply(lang: BotLang) {
  return pickText(
    lang,
    `لم أفهم طلبك بالكامل.
اكتب "مساعدة" لرؤية الأوامر المتاحة.`,
    `I did not fully understand your request.
Type "help" to see available commands.`
  );
}

export function getTextOnlyReply(lang: BotLang) {
  return pickText(
    lang,
    `حالياً أتعامل مع الرسائل النصية فقط. اكتب "مساعدة".`,
    `For now, I only support text messages. Type "help".`
  );
}

export function getChangeLanguageReply(lang: BotLang): BotReplyPayload {
  return {
    handled: true,
    intent: "change_language",
    text: getLanguageOnlyMessage(lang),
  };
}

export function getLanguageChangedReply(lang: BotLang): BotReplyPayload {
  return {
    handled: true,
    intent: "change_language",
    text: pickText(
      lang,
      `تم تغيير اللغة إلى العربية ✅`,
      `Language changed to English ✅`
    ),
    meta: {
      language: lang,
    },
  };
}

/* =====================================================
   CREATE USER REPLIES
===================================================== */

export function getCreateUserUsageReply(lang: BotLang) {
  return pickText(
    lang,
    `صيغة إنشاء المستخدم:
createuser@username@password

ملاحظات:
- اسم المستخدم بالإنجليزية فقط
- يبدأ بحرف
- يمكن أن يحتوي على أرقام و underscore
- كلمة المرور 6 أحرف على الأقل`,
    `Create user format:
createuser@username@password

Rules:
- username must be English only
- must start with a letter
- may contain letters, numbers, and underscore
- password must be at least 6 characters`
  );
}

export function getCreateUserSuccessReply(lang: BotLang, username: string) {
  return pickText(
    lang,
    `تم إنشاء المستخدم بنجاح: ${username} ✅`,
    `User created successfully: ${username} ✅`
  );
}

export function getCreateUserExistsReply(lang: BotLang, username: string) {
  return pickText(
    lang,
    `اسم المستخدم هذا موجود بالفعل: ${username}`,
    `This username already exists: ${username}`
  );
}

export function getCreateUserInvalidUsernameReply(lang: BotLang) {
  return pickText(
    lang,
    `اسم المستخدم يجب أن يكون بالإنجليزية فقط، ويبدأ بحرف، ويحتوي فقط على حروف أو أرقام أو underscore.`,
    `Username must be English only, start with a letter, and contain only letters, numbers, or underscore.`
  );
}

export function getCreateUserInvalidPasswordReply(lang: BotLang) {
  return pickText(
    lang,
    `كلمة المرور يجب ألا تقل عن 6 أحرف.`,
    `Password must be at least 6 characters.`
  );
}

export function getCreateUserFailedReply(lang: BotLang, reason?: string) {
  return pickText(
    lang,
    reason ? `فشل إنشاء المستخدم: ${reason}` : `فشل إنشاء المستخدم.`,
    reason ? `Failed to create user: ${reason}` : `Failed to create user.`
  );
}

/* =====================================================
   BOT JOIN / LEAVE ROOM REPLIES
===================================================== */

export function getBotJoinUsageReply(lang: BotLang) {
  return pickText(
    lang,
    `صيغة الدخول عبر البوت:
bot@username@password@room`,
    `Bot join format:
bot@username@password@room`
  );
}

export function getBotLeaveUsageReply(lang: BotLang) {
  return pickText(
    lang,
    `صيغة الخروج عبر البوت:
botleave@username@room`,
    `Bot leave format:
botleave@username@room`
  );
}

export function getJoinRoomSuccessReply(lang: BotLang, roomName: string) {
  return pickText(
    lang,
    `تم تسجيل الدخول والدخول إلى الغرفة: ${roomName} ✅`,
    `Login successful and joined room: ${roomName} ✅`
  );
}

export function getJoinRoomLoginFailedReply(lang: BotLang) {
  return pickText(
    lang,
    `فشل تسجيل الدخول. اسم المستخدم أو كلمة المرور غير صحيحين.`,
    `Login failed. Invalid username or password.`
  );
}

export function getJoinRoomUserNotFoundReply(lang: BotLang, username: string) {
  return pickText(
    lang,
    `لم يتم العثور على المستخدم: ${username}`,
    `User not found: ${username}`
  );
}

export function getJoinRoomRoomNotFoundReply(lang: BotLang, roomName: string) {
  return pickText(
    lang,
    `لم أجد غرفة باسم: ${roomName}`,
    `Room not found: ${roomName}`
  );
}

export function getJoinRoomFailedReply(lang: BotLang, reason?: string) {
  return pickText(
    lang,
    reason ? `فشل الدخول إلى الغرفة: ${reason}` : `فشل الدخول إلى الغرفة.`,
    reason ? `Failed to join room: ${reason}` : `Failed to join room.`
  );
}

export function getLeaveRoomSuccessReply(lang: BotLang, roomName: string) {
  return pickText(
    lang,
    `تم الخروج من الغرفة: ${roomName} ✅`,
    `Successfully left room: ${roomName} ✅`
  );
}

export function getLeaveRoomUserNotFoundReply(lang: BotLang, username: string) {
  return pickText(
    lang,
    `لم يتم العثور على المستخدم: ${username}`,
    `User not found: ${username}`
  );
}

export function getLeaveRoomRoomNotFoundReply(lang: BotLang, roomName: string) {
  return pickText(
    lang,
    `لم أجد غرفة باسم: ${roomName}`,
    `Room not found: ${roomName}`
  );
}

export function getLeaveRoomFailedReply(lang: BotLang, reason?: string) {
  return pickText(
    lang,
    reason ? `فشل الخروج من الغرفة: ${reason}` : `فشل الخروج من الغرفة.`,
    reason ? `Failed to leave room: ${reason}` : `Failed to leave room.`
  );
}

/* =====================================================
   SILENT ROOM AGENT REPLIES
===================================================== */

export function getSilentJoinUsageReply(lang: BotLang) {
  return pickText(
    lang,
    `صيغة الدخول للحساب الصامت:
username@password@room`,
    `Silent login format:
username@password@room`
  );
}

export function getSilentExitUsageReply(lang: BotLang) {
  return pickText(
    lang,
    `صيغة الخروج للحساب الصامت:
exit@username@room`,
    `Silent exit format:
exit@username@room`
  );
}

export function getSilentAgentAlreadyLinkedReply(
  lang: BotLang,
  roomName?: string
) {
  return pickText(
    lang,
    roomName
      ? `هذا الحساب الصامت مرتبط بالفعل بغرفة أخرى: ${roomName}`
      : `هذا الحساب الصامت مرتبط بالفعل بغرفة أخرى.`,
    roomName
      ? `This silent account is already linked to another room: ${roomName}`
      : `This silent account is already linked to another room.`
  );
}

export function getRoomAlreadyHasAgentReply(lang: BotLang) {
  return pickText(
    lang,
    `هذه الغرفة لديها بالفعل حساب صامت مرتبط بها.`,
    `This room already has a linked silent account.`
  );
}

export function getSilentAgentJoinSuccessReply(lang: BotLang, roomName: string) {
  return pickText(
    lang,
    `تم ربط الحساب الصامت والدخول إلى الغرفة: ${roomName} ✅`,
    `Silent account linked and joined room: ${roomName} ✅`
  );
}

export function getSilentAgentExitSuccessReply(lang: BotLang, roomName: string) {
  return pickText(
    lang,
    `تم خروج الحساب الصامت من الغرفة: ${roomName} ✅`,
    `Silent account left room: ${roomName} ✅`
  );
}

/* =====================================================
   ROOM BOT REPLIES
===================================================== */

export function getRoomBotCommandRejectedReply(lang: BotLang, reason?: string) {
  return pickText(
    lang,
    reason ? `تم رفض أمر بوت الغرفة: ${reason}` : `تم رفض أمر بوت الغرفة.`,
    reason ? `Room bot command rejected: ${reason}` : `Room bot command rejected.`
  );
}

export function getRoomBotCommandSuccessReply(lang: BotLang, action: string) {
  return pickText(
    lang,
    `تم تنفيذ أمر بوت الغرفة بنجاح: ${action} ✅`,
    `Room bot command executed successfully: ${action} ✅`
  );
}

export function getWelcomeToggleReply(lang: BotLang, enabled: boolean) {
  return pickText(
    lang,
    enabled
      ? `تم تشغيل رسالة الترحيب ✅`
      : `تم إيقاف رسالة الترحيب ✅`,
    enabled
      ? `Welcome message enabled ✅`
      : `Welcome message disabled ✅`
  );
}

export function getRoomBotNotEnabledReply(lang: BotLang) {
  return pickText(
    lang,
    `بوت الغرفة غير مفعل لهذه الغرفة.`,
    `Room bot is not enabled for this room.`
  );
}

export function getRoomBotUnknownCommandReply(lang: BotLang) {
  return pickText(
    lang,
    `أمر بوت الغرفة غير معروف.`,
    `Unknown room bot command.`
  );
}