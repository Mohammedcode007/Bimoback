// room.routes.ts
import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";

import {
  // Room settings
  updateRoomInfo,
  changeRoomType,
  changeRoomPremium,
  toggleAntiSpam,

  // VIP
  addVip,
  removeVip,

  // Poll
  startPoll,
  votePoll,
  endPoll,

  // Voice
  setMaxVoiceSeats,
  raiseHand,
  clearRaisedHand,

  // Level / XP
  addXP,

  // Boost
  boostRoom,

  // Membership
  joinRoom,
  leaveRoom,
  autoRejoin,

  // Moderation
  kickUser,

  // Messages
  sendMessage,
  pinMessage,
  toggleReaction,

  // Users & Stats
  getRoomUsers,
  getRoomStats,

  // Delete
  deleteRoom,

  // Create / Get / Search
  createRoom,
  getRoomsByType,
  searchRooms,
  getRoomMessages,
  getRoomDetails
} from "../controllers/room.controller";

const router = Router();

/* =====================================================
   PUBLIC ROUTES
   (مسارات عامة قبل protect)
===================================================== */

// GET /api/rooms?type=public&limit=30&page=1
router.get("/", getRoomsByType);

// GET /api/rooms/search?q=chat&type=public&limit=30
router.get("/search", searchRooms);
// ✅ GET /api/rooms/:roomId/details
/* =====================================================
   PROTECTED ROUTES
===================================================== */

router.use(protect);

// POST /api/rooms
router.post("/", createRoom);

/* =====================================================
   ROOM SETTINGS
===================================================== */

router.patch("/:roomId", updateRoomInfo);
router.patch("/:roomId/type", changeRoomType);
router.patch("/:roomId/premium", changeRoomPremium);
router.patch("/:roomId/anti-spam", toggleAntiSpam);
router.get("/:roomId/details", getRoomDetails);

/* =====================================================
   VIP
===================================================== */

router.post("/:roomId/vip", addVip);
router.delete("/:roomId/vip/:targetId", removeVip);

/* =====================================================
   POLL
===================================================== */

router.post("/:roomId/poll", startPoll);
router.patch("/:roomId/poll/vote", votePoll);
router.delete("/:roomId/poll", endPoll);

/* =====================================================
   VOICE
===================================================== */

router.patch("/:roomId/voice/seats", setMaxVoiceSeats);
router.post("/:roomId/voice/raise-hand", raiseHand);
router.delete("/:roomId/voice/raise-hand", clearRaisedHand);

/* =====================================================
   LEVEL / XP
===================================================== */

router.post("/:roomId/xp", addXP);

/* =====================================================
   BOOST
===================================================== */

router.post("/:roomId/boost", boostRoom);

/* =====================================================
   MEMBERSHIP
===================================================== */

router.post("/:roomId/join", joinRoom);
router.post("/:roomId/leave", leaveRoom);
router.get("/me/active-rooms", autoRejoin);

/* =====================================================
   MODERATION
===================================================== */

router.post("/:roomId/kick/:targetId", kickUser);
router.get("/:roomId/messages", getRoomMessages);
router.post("/:roomId/messages", sendMessage);
/* =====================================================
   MESSAGES
===================================================== */

router.patch("/:roomId/messages/:messageId/pin", pinMessage);
router.post("/:roomId/messages/:messageId/reaction", toggleReaction);

/* =====================================================
   USERS & STATS
===================================================== */

router.get("/:roomId/users", getRoomUsers);
router.get("/:roomId/stats", getRoomStats);

/* =====================================================
   DELETE ROOM
===================================================== */

router.delete("/:roomId", deleteRoom);

export default router;