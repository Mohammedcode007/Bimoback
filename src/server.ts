
// import http from "http";
// import dotenv from "dotenv";
// import app from "./app";
// import { connectDB } from "./config/db";
// import { initSocket } from "./config/socket";

// dotenv.config();

// /* =========================
//    Handle Uncaught Errors
// ========================= */

// process.on("uncaughtException", (err) => {
//   console.error("❌ Uncaught Exception:", err);
//   process.exit(1);
// });

// /* =========================
//    Connect Database
// ========================= */

// connectDB();

// /* =========================
//    Create HTTP Server
// ========================= */

// const server = http.createServer(app);

// /* =========================
//    Initialize Socket.IO
// ========================= */

// initSocket(server);

// /* =========================
//    Start Server
// ========================= */

// const PORT = process.env.PORT || 5000;

// server.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

// /* =========================
//    Handle Unhandled Promise Rejections
// ========================= */

// process.on("unhandledRejection", (err: any) => {
//   console.error("❌ Unhandled Rejection:", err);

//   server.close(() => {
//     process.exit(1);
//   });
// });

import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./config/socket";
import { executeRoomMusicCommand } from "./services/bot/room-bot/roomMusic.command";
const { ytmp3, tiktok, facebook, instagram, twitter, ytmp4 } = require('sadaslk-dlcore');
import { cleanupExpiredAudioFiles, downloadAudioToLocal } from "./utils/audioCache";
dotenv.config();
cleanupExpiredAudioFiles();
/* =========================
   Handle Uncaught Errors
========================= */
process.on("uncaughtException", (err) => {
   console.error("❌ Uncaught Exception:", err);
   process.exit(1);
});

/* =========================
   Connect Database
========================= */
connectDB();

/* =========================
   Create HTTP Server
========================= */
const server = http.createServer(app);

/* =========================
   Initialize Socket.IO
========================= */
initSocket(server);

/* =========================
   Start Server
========================= */
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
   console.log(`🚀 Server running on port ${PORT}`);

//    try {
//       const result = await executeRoomMusicCommand("!تشغيل تملي معاك");
//       console.log("🎵 Music Command Result:", result?.meta?.youtubeUrl);
//     (async () => {
//   const mp3 = await ytmp3(result?.meta?.youtubeUrl);
//   console.log("🎧 ytmp3 result:", mp3);

//   if (!mp3?.url) {
//     throw new Error("No downloadable MP3 URL returned");
//   }

//   const saved = await downloadAudioToLocal({
//     sourceUrl: mp3.url,
//     filename: mp3.filename || "track.mp3",
//   });

//   console.log("✅ Local MP3 saved:", saved.publicUrl);
// })();
//    } catch (error) {
//       console.error("❌ Music Command Error:", error);
//    }
});

/* =========================
   Handle Unhandled Promise Rejections
========================= */
process.on("unhandledRejection", (err: any) => {
   console.error("❌ Unhandled Rejection:", err);

   server.close(() => {
      process.exit(1);
   });
});
